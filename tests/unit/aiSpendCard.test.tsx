// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { afterEach,describe,expect,it,vi } from 'vitest';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const summary=(overrides:Record<string,unknown>={})=>({
  currency:'HKD',days:30,empty:false,
  kinds:[
    {kind:'producer_research',label:'Producer Deep Search',runs:12,requests:24,searchQueries:168,promptTokens:17460,outputTokens:44400,cost:19.33,costPerRun:1.61,searchesPerRun:14},
    {kind:'scan_single',label:'Single scan',runs:40,requests:44,searchQueries:0,promptTokens:52000,outputTokens:13000,cost:0.38,costPerRun:0.0095,searchesPerRun:0}
  ],
  month:{month:'2026-08',searchQueries:4200,freeRemaining:800,billableSearches:0,cost:0},
  ...overrides
});

let root:Root|null=null,host:HTMLDivElement|null=null;
afterEach(()=>{act(()=>root?.unmount());host?.remove();root=null;host=null;vi.unstubAllGlobals()});

async function render(body:unknown,status=200){
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}})));
  vi.resetModules();
  const {AiSpendCard}=await import('../../src/features/journey/AiSpendCard');
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
  await act(async()=>{root!.render(<AiSpendCard/>)});
  return host;
}

describe('the AI spend card',()=>{
  it('leads with the cost of one run, per kind',async()=>{
    const page=await render(summary());
    expect(page.textContent).toContain('Producer Deep Search');
    expect(page.textContent).toContain('12 runs');
    expect(page.textContent).toContain('14.0 searches/run');
    // the per-run figure is the headline, in the configured currency
    const headline=page.querySelector('.ai-spend-grid article b')!;
    expect(headline.textContent).toMatch(/1\.61/);
    expect(headline.textContent).toMatch(/HK\$|HKD/);
  });

  it('shows the free allowance while it lasts, and the overage once it is gone',async()=>{
    let page=await render(summary());
    expect(page.textContent).toContain('800 free searches left');
    expect(page.querySelector('.ai-spend-month.is-billing')).toBeNull();

    act(()=>root?.unmount());host?.remove();
    page=await render(summary({month:{month:'2026-08',searchQueries:12183,freeRemaining:0,billableSearches:7183,cost:788.71}}));
    expect(page.textContent).toContain('7,183 past the free allowance');
    expect(page.querySelector('.ai-spend-month.is-billing'),'the month should read as billing once the allowance is gone').not.toBeNull();
  });

  it('says nothing is metered rather than showing a wall of zeros',async()=>{
    const page=await render({currency:'HKD',days:30,kinds:[],empty:true,month:{month:'2026-08',searchQueries:0,freeRemaining:5000,billableSearches:0,cost:0}});
    expect(page.textContent).toContain('Nothing metered yet');
    expect(page.querySelector('.ai-spend-grid')).toBeNull();
  });

  it('stays out of the way when the meter cannot be read',async()=>{
    // Insights is about the wine, not the bill: a spend endpoint that fails
    // must not put an error banner on the page.
    const page=await render({error:'nope'},500);
    expect(page.textContent).toBe('');
  });
});
