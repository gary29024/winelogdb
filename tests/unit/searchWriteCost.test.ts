import { readFileSync,readdirSync } from 'node:fs';
import { DatabaseSync,type SQLInputValue } from 'node:sqlite';
import { afterEach,beforeEach,describe,expect,it } from 'vitest';
import app from '../../worker/entry';
import { createSession } from '../../src/lib/auth/session';
import { createD1Stub } from './support/d1Stub';

const migrations='src/lib/db/migrations/';
const optimization=readFileSync(`${migrations}0049_avoid_redundant_search_updates.sql`,'utf8');
const AUTH_SECRET='test-secret-value-long-enough-for-hmac';
let db:DatabaseSync;
beforeEach(()=>{
  db=new DatabaseSync(':memory:');
  for(const file of readdirSync(migrations).filter(file=>file.endsWith('.sql')).sort()){
    db.exec(readFileSync(migrations+file,'utf8'));
  }
  db.exec(`INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at)
    VALUES('w1','owner','Dujac','Clos Roche','2026-01-01','2026-01-01')`);
});
afterEach(()=>db.close());
const changes=()=>Number(db.prepare('SELECT total_changes() AS n').get()!.n);
const revision=()=>db.prepare("SELECT revision FROM achievement_cache_state WHERE owner_id='owner'").get()!.revision;
const search=(term:string)=>db.prepare('SELECT wine_id,owner_id FROM wine_search WHERE wine_search MATCH ?').all(term);

describe('search update trigger on real SQLite with all migrations',()=>{
  it('does not touch FTS for favorites, ratings, timestamps or equivalent search values',()=>{
    const before=changes();
    db.exec(`UPDATE wines SET favorite=1,rating=95,updated_at='2026-02-01',
      producer=producer,region='',event='' WHERE id='w1'`);
    // Only the wine row and owner revision changed; no FTS shadow table writes.
    expect(changes()-before).toBe(2);
    expect(search('Dujac')).toHaveLength(1);
  });

  it.each([
    ['producer','Lamarche'],['wine_name','Malconsorts'],['region','Burgundy'],
    ['grapes_json','["Chardonnay"]'],['tasting_notes','Blackberry'],
    ['event','Birthday'],['tags_json','["Memorable"]']
  ])('keeps search current when %s changes', (column,value)=>{
    const before=changes();
    db.prepare(`UPDATE wines SET ${column}=? WHERE id='w1'`).run(value);
    expect(changes()-before).toBeGreaterThan(2);
    const term=value.replace(/[[\]"]/g,'');
    expect(search(term)).toHaveLength(1);
    if(column==='producer')expect(search('Dujac')).toHaveLength(0);
  });

  it('updates the stored wine and owner identities',()=>{
    db.exec("UPDATE wines SET id='w2',owner_id='other' WHERE id='w1'");
    expect(search('Dujac')).toEqual([{wine_id:'w2',owner_id:'other'}]);
  });

  it('removes old terms when nullable text is cleared',()=>{
    db.exec("UPDATE wines SET region='Burgundy' WHERE id='w1'");
    expect(search('Burgundy')).toHaveLength(1);
    db.exec("UPDATE wines SET region=NULL WHERE id='w1'");
    expect(search('Burgundy')).toHaveLength(0);
  });

  it('can reapply the trigger migration and still indexes inserts and deletes',()=>{
    db.exec(optimization);
    expect(search('Dujac')).toHaveLength(1);
    db.exec("DELETE FROM wines WHERE id='w1'");
    expect(search('Dujac')).toHaveLength(0);
  });
});

async function favorite(value:boolean,id='w1',owner='owner'){
  const stub=createD1Stub((sql,args)=>{
    const statement=db.prepare(sql);
    if(/^SELECT/.test(sql))return {first:statement.get(...args as SQLInputValue[])};
    return {changes:Number(statement.run(...args as SQLInputValue[]).changes)};
  });
  const response=await app.fetch(new Request(`https://x/api/wines/${id}/favorite`,{
    method:'PUT',headers:{Authorization:`Bearer ${await createSession(owner,AUTH_SECRET)}`,'Content-Type':'application/json'},
    body:JSON.stringify({favorite:value})
  }),{DB:stub.db,AUTH_SECRET} as never);
  return {response,stub};
}

describe('favorite route database work',()=>{
  it('changes a favorite with one D1 statement and no FTS churn',async()=>{
    const before=changes(),oldRevision=Number(revision());
    const {response,stub}=await favorite(true);
    expect(response.status).toBe(200);expect(stub.calls).toHaveLength(1);
    expect(changes()-before).toBe(2);expect(revision()).toBe(oldRevision+1);
  });

  it('acknowledges a repeated value without any row writes or revision change',async()=>{
    await favorite(true);
    const before=changes(),oldRevision=revision();
    const {response}=await favorite(true);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({id:'w1',favorite:true,changed:false});
    expect(changes()).toBe(before);expect(revision()).toBe(oldRevision);
  });

  it('returns 404 for missing wines and wines owned by someone else',async()=>{
    expect((await favorite(true,'missing')).response.status).toBe(404);
    expect((await favorite(true,'w1','other')).response.status).toBe(404);
    expect(db.prepare("SELECT favorite FROM wines WHERE id='w1'").get()!.favorite).toBe(0);
  });
});
