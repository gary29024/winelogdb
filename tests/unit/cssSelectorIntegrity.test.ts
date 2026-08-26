import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe,expect,it } from 'vitest';

const src=join(process.cwd(),'src');
const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const path=join(dir,entry.name);
  return entry.isDirectory()?walk(path):[path];
});
const files=walk(src);
const sheets=files.filter(path=>path.endsWith('.css')).map(path=>({name:path.split('/').pop()!,css:readFileSync(path,'utf8')}));
const markup=files.filter(path=>path.endsWith('.tsx')).map(path=>readFileSync(path,'utf8'));

const tokensOf=(raw:string)=>new Set(raw.split(/[\s`${}?:'"()+]+/).filter(token=>/^[a-z][a-z0-9-]+$/.test(token)));
/** Every className expression in the app, as the set of names it can produce. */
const expressions=markup.flatMap(file=>
  [...file.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map(match=>{
    const raw=match[1]??match[2]??'';
    return {raw,tokens:tokensOf(raw)};
  }));
/**
 * Every name that appears as literal text in some className. A name only ever
 * produced by interpolation - `claim-status ${claim.status}` - is not in here,
 * and pairs involving one are not judged: its absence from an expression says
 * nothing.
 */
const literal=new Set(expressions.flatMap(expression=>[...expression.tokens]));
const selectors=sheets.flatMap(sheet=>
  [...sheet.css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .flatMap(rule=>rule[1].split(',').map(part=>({sheet:sheet.name,selector:part.trim(),body:rule[2]}))));

/**
 * Pairs that are assembled across statements or handed between components, so
 * no single className expression names both. Each is real and rendered; the
 * check cannot see it without executing the app.
 */
const composedAtRuntime=new Set([
  '.journal-gallery .wine-image-loading.journal-wine-thumb',   // WineImage adds its own state class beside the caller's
  '.journal-gallery .wine-image-fallback.journal-wine-thumb',
  '.wine-image-loading.journal-wine-thumb',
  '.wine-image-fallback.journal-wine-thumb',
  '.research-campaign-link.is-running>span:first-child',        // the modifier is chosen in a variable above the JSX
  '.scan-nav.active .scan-plus'                                 // NavLink writes `active` itself
]);

describe('selectors that can never match',()=>{
  it('does not fuse two component classes that never sit on the same element',()=>{
    // How the price and currency inputs lost their grid: removing the rule
    // before them took the separator with it, leaving
    // `.structure-option.price-currency-inputs`. It parses, it keeps its
    // declarations, devtools shows it - and it matches nothing, so the price
    // field silently fell back to stacking. Only pairs written out in full on
    // both sides are checked; a name assembled at runtime says nothing here.
    const fused=selectors.flatMap(rule=>
      [...rule.selector.matchAll(/\.([a-z][a-z0-9-]+)\.([a-z][a-z0-9-]+)(?![\w-])/g)]
        .filter(([,first,second])=>literal.has(first)&&literal.has(second))
        .filter(([,first,second])=>!expressions.some(expression=>expression.tokens.has(first)&&expression.tokens.has(second)))
        .map(()=>`${rule.sheet} ${rule.selector}`))
      .filter(entry=>!composedAtRuntime.has(entry.split(' ').slice(1).join(' ')));
    expect([...new Set(fused)]).toEqual([]);
  });
});

describe('the price and currency pair',()=>{
  it('is laid out as one row of two columns',()=>{
    // Reported as "the currency field is too large that the price field go down
    // to next row" - which is what a grid container looks like when its
    // display never applies.
    const base=selectors.filter(rule=>rule.selector==='.price-currency-inputs');
    expect(base.length,'.price-currency-inputs should be styled by a selector of its own').toBeGreaterThan(0);
    const declared=base.map(rule=>rule.body).join(';');
    expect(declared).toContain('display:grid');
    expect(/grid-template-columns:[^;]*\s[^;]+/.test(declared),'two columns').toBe(true);
  });
});
