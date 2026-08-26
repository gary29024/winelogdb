import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe,expect,it } from 'vitest';
import { journeyLadder,stampTotals } from '../../src/features/journey/model';

const src=join(process.cwd(),'src');
const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const path=join(dir,entry.name);
  return entry.isDirectory()?walk(path):[path];
});
const files=walk(src);
const css=files.filter(path=>path.endsWith('.css')).map(path=>readFileSync(path,'utf8')).join('\n');
// Flattening the media blocks first: a rule inside one is otherwise swallowed
// as the body of its @media "selector".
const flat=css.replace(/\/\*[\s\S]*?\*\//g,'').replace(/@media[^{]*\{/g,'');
const rulesFor=(selector:string)=>[...flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter(rule=>rule[1].split(',').map(part=>part.trim()).includes(selector))
  .map(rule=>rule[2]);

const summary=(over:Record<string,number>={})=>({
  totalWines:0,producers:0,appellations:0,regions:0,countries:0,vintages:0,structuredTastings:0,...over
} as Parameters<typeof journeyLadder>[0]);

describe('the stamp count on the passport',()=>{
  it('counts what the milestones page counts',()=>{
    // The passport said "4 earned across 5 tracks" while Milestones said
    // "20 earned" - the same collection, counted once per track and once per
    // stamp. Both pages read this, so they cannot disagree again.
    const ladder=journeyLadder(summary({totalWines:957,producers:566,appellations:214,regions:120,countries:20}));
    expect(stampTotals(ladder)).toEqual({
      earned:ladder.reduce((n,track)=>n+track.earned,0),
      total:ladder.reduce((n,track)=>n+track.total,0)
    });
    expect(stampTotals(ladder).earned).toBe(24);
  });

  it('has a rule of its own, so the figure is set in the display face',()=>{
    // Reported as inconsistent fonts. The class was on the element but nothing
    // styled it, so the line fell back to body text at body size while every
    // other figure in the passport - the stat grid, the ring, the recent list -
    // is Playfair. An unstyled class looks like a decision until you measure it.
    const figure=rulesFor('.passport-stamp-count strong');
    expect(figure.length,'.passport-stamp-count strong should be styled').toBeGreaterThan(0);
    expect(figure.join(' ')).toContain("font-family:'Playfair Display'");
    expect(rulesFor('.passport-stat-grid strong').join(' ')).toContain("font-family:'Playfair Display'");
  });
});

describe('two layouts that were sized by their content',()=>{
  it('stacks the group photo result instead of setting it beside the heading',()=>{
    // In a flex row the sentence became a narrow column pinned to the right of
    // "Group photo complete." on a phone. It reads as a paragraph under the
    // heading.
    const notice=rulesFor('.group-complete');
    expect(notice.length).toBeGreaterThan(0);
    expect(notice[0]).toContain('display:grid');
    expect(notice[0]).not.toContain('display:flex');
  });

  it('lets the producer search field use the width it has',()=>{
    // The phone rule switched the row to grid but kept justify-content:
    // space-between from the flex version, which sizes the single implicit
    // column to its content - so the field stopped at the width of its
    // placeholder text.
    const phone=rulesFor('.producer-search').find(body=>body.includes('display:grid'));
    expect(phone,'the phone rule for .producer-search should exist').toBeTruthy();
    expect(phone!).toContain('grid-template-columns:minmax(0,1fr)');
  });
});
