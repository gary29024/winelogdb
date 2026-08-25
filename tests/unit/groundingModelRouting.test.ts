import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { GROUNDING_COOLDOWN_MS,orderModelsByGrounding,rankGroundingState } from '../../src/lib/research/modelHealth';

const iso=(msAgo:number)=>new Date(Date.now()-msAgo).toISOString();
const MINUTE=60_000,HOUR=60*MINUTE;

describe('ranking a model by what it did with grounding',()=>{
  it('prefers a model observed to ground over one never seen',()=>{
    expect(rankGroundingState({model:'a',grounding_ok_at:iso(MINUTE),grounding_failed_at:null})).toBe(0);
    expect(rankGroundingState(undefined)).toBe(1);
  });

  it('routes around a model that recently answered ungrounded',()=>{
    expect(rankGroundingState({model:'a',grounding_ok_at:null,grounding_failed_at:iso(MINUTE)})).toBe(2);
  });

  it('lets a model recover by grounding again',()=>{
    // The newer observation wins, so a provider fix needs no intervention.
    expect(rankGroundingState({model:'a',grounding_ok_at:iso(MINUTE),grounding_failed_at:iso(HOUR)})).toBe(0);
    expect(rankGroundingState({model:'a',grounding_ok_at:iso(HOUR),grounding_failed_at:iso(MINUTE)})).toBe(2);
  });

  it('forgets an old failure once the cooldown has passed',()=>{
    expect(rankGroundingState({model:'a',grounding_ok_at:null,grounding_failed_at:iso(GROUNDING_COOLDOWN_MS+MINUTE)})).toBe(1);
  });
});

describe('choosing which model to research on',()=>{
  const db=(rows:Array<{model:string;grounding_ok_at:string|null;grounding_failed_at:string|null}>)=>({
    prepare:()=>({bind:()=>({all:async()=>({results:rows})})})
  }) as unknown as D1Database;

  it('keeps the configured order when nothing has been observed',async()=>{
    expect(await orderModelsByGrounding(db([]),'o',['primary','fallback'])).toEqual(['primary','fallback']);
  });

  it('puts the model that grounds first, whichever one that turns out to be',async()=>{
    // Deliberately not hardcoded: the evidence has pointed both ways, and the
    // provider can change it again without warning.
    const fallbackGrounds=db([
      {model:'primary',grounding_ok_at:null,grounding_failed_at:iso(MINUTE)},
      {model:'fallback',grounding_ok_at:iso(MINUTE),grounding_failed_at:null}
    ]);
    expect(await orderModelsByGrounding(fallbackGrounds,'o',['primary','fallback'])).toEqual(['fallback','primary']);
    const primaryGrounds=db([
      {model:'primary',grounding_ok_at:iso(MINUTE),grounding_failed_at:null},
      {model:'fallback',grounding_ok_at:null,grounding_failed_at:iso(MINUTE)}
    ]);
    expect(await orderModelsByGrounding(primaryGrounds,'o',['primary','fallback'])).toEqual(['primary','fallback']);
  });

  it('falls back to the configured order when the health table cannot be read',async()=>{
    const broken={prepare:()=>{throw new Error('no such column')}} as unknown as D1Database;
    expect(await orderModelsByGrounding(broken,'o',['primary','fallback'])).toEqual(['primary','fallback']);
  });
});

describe('the grounding instruction',()=>{
  const sources=['src/lib/research/batchWineResearch.ts','src/lib/producers/batchResearch.ts'].map(path=>readFileSync(path,'utf8'));

  it('tells every research model to search before answering',()=>{
    // Both models get the same instruction: the request cannot force grounding,
    // so asking plainly and rejecting what comes back ungrounded is the whole
    // of the enforcement.
    for(const source of sources)expect(source).toMatch(/must use the Google Search tool before answering/);
  });

  it('still declares the search tool on every research request',()=>{
    for(const source of sources)expect(source).toMatch(/google_search/);
  });

  it('records the migration that lets routing remember what happened',()=>{
    const sql=readFileSync('src/lib/db/migrations/0036_research_model_grounding.sql','utf8');
    expect(sql).toContain('grounding_ok_at');
    expect(sql).toContain('grounding_failed_at');
    expect(sql).not.toMatch(/DROP\s+TABLE/i);
  });
});
