import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe,expect,it } from 'vitest';

const root=process.cwd();
const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const path=join(dir,entry.name);
  return entry.isDirectory()?walk(path):[path];
});

/**
 * Every file that computes something the app reports as a fact about what has
 * been drunk: the Passport and Insights payload, achievement progress, the
 * producer library, the journal list and the AI ledger.
 */
const STATISTICS=[
  'worker/journeyHandler.ts',
  'worker/achievementHandler.ts',
  'worker/layered.ts',
  'src/lib/journal/list.ts',
  'src/lib/producers/entities.ts',
  'src/lib/usage/aiUsage.ts'
];

const source=(path:string)=>readFileSync(join(root,path),'utf8');

describe('a cellar holding is not a wine you drank',()=>{
  // The rule the whole feature rests on. Holdings live in their own table so no
  // aggregate can see them by accident - this is what stops a later change
  // quietly folding them in, which would be a wrong number nobody notices.
  it('is invisible to every path that counts what has been drunk',()=>{
    const leaking=STATISTICS.filter(path=>/cellar_holdings/.test(source(path)));
    expect(leaking).toEqual([]);
  });

  it('is read only through the cellar library and the routes that serve it',()=>{
    const readers=walk(join(root,'src')).concat(walk(join(root,'worker')))
      .filter(path=>/\.tsx?$/.test(path)&&/cellar_holdings/.test(readFileSync(path,'utf8')))
      .map(path=>path.slice(root.length+1));
    expect(readers.sort()).toEqual(['src/lib/cellar/holdings.ts','src/lib/cellar/list.ts']);
  });

  it('never bumps the revision the statistics caches are keyed on',()=>{
    // A cellar write changes no statistic, so it must not invalidate the caches
    // that serve them. The migration deliberately carries no revision trigger.
    // Comments first: the migration says in words why it has no trigger, and
    // that sentence must not read as the trigger it is ruling out.
    const migration=source('src/lib/db/migrations/0045_cellar_holdings.sql').replace(/^\s*--.*$/gm,'');
    expect(migration).not.toMatch(/achievement_cache_state/i);
    expect(migration).not.toMatch(/CREATE TRIGGER/i);
  });

  it('creates no producer or cuvee entity, because a producer you have never opened is a statistic',()=>{
    const holdings=source('src/lib/cellar/holdings.ts');
    expect(holdings).toMatch(/resolveExistingProducer/);
    expect(holdings).toMatch(/resolveExistingCuvee/);
    expect(holdings).not.toMatch(/ensureProducerEntity|ensureCuveeEntity|linkWineProducer|linkWineCuvee/);
  });
});
