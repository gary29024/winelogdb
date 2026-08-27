// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { afterEach,describe,expect,it,vi } from 'vitest';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const summary=(overrides:Record<string,unknown>={})=>({
  currency:'HKD',days:30,empty:false,
  kinds:[
    {kind:'producer_research',label:'Producer Deep Search',runs:12,requests:24,searchQueries:168,promptTokens:17460,outputTokens:44400,cost:19.33,costPerRun:1.61,searchesPerRun:14,units:0,unit:'run',unitCount:12,costPerUnit:1.61},
    {kind:'scan_batch',label:'Batch scan',runs:3,requests:38,searchQueries:0,promptTokens:52000,outputTokens:13000,cost:0.69,costPerRun:0.23,searchesPerRun:0,units:36,unit:'wine',unitCount:36,costPerUnit:0.019}
  ],
  month:{month:'2026-08',searchQueries:4200,freeRemaining:800,billableSearches:0,cost:0,resetsAt:'2026-09-01T07:00:00.000Z',timeZone:'America/Los_Angeles'},
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
    // Recognition is quoted per wine: a session of a dozen bottles and a
    // session of one are not the same run.
    expect(page.textContent).toContain('36 wines');
    expect(page.textContent).toContain('per wine');
    // and the run count stays visible, so the session is still findable
    expect(page.textContent).toContain('3 runs');
    expect(page.textContent).toContain('14.0 searches/run');
    // the per-run figure is the headline, in the configured currency
    const headline=page.querySelector('.ai-spend-grid article b')!;
    expect(headline.textContent).toMatch(/1\.61/);
    expect(headline.textContent).toMatch(/HK\$|HKD/);
  });

  it('shows the free allowance while it lasts, and the overage once it is gone',async()=>{
    let page=await render(summary());
    expect(page.textContent).toContain('800 free searches left');
    // The card is handed the reset as an instant and must render it in the
    // reader's own clock - midnight Pacific on 1 September is 15:00 that day in
    // Hong Kong - rather than reading the date out of the ISO string. Comparing
    // against the same conversion keeps this true wherever the suite runs; that
    // the instant itself is Pacific midnight is tested in the ledger.
    const reset=[...page.querySelectorAll('.ai-spend-month small')].at(-1)!.textContent!;
    const local=new Intl.DateTimeFormat(undefined,{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(new Date('2026-09-01T07:00:00.000Z'));
    expect(reset).toBe(`resets ${local}`);
    expect(page.querySelector('.ai-spend-month.is-billing')).toBeNull();

    act(()=>root?.unmount());host?.remove();
    page=await render(summary({month:{month:'2026-08',searchQueries:12183,freeRemaining:0,billableSearches:7183,cost:788.71,resetsAt:'2026-09-01T07:00:00.000Z',timeZone:'America/Los_Angeles'}}));
    expect(page.textContent).toContain('7,183 past the free allowance');
    expect(page.querySelector('.ai-spend-month.is-billing'),'the month should read as billing once the allowance is gone').not.toBeNull();
  });

  it('says nothing is metered rather than showing a wall of zeros',async()=>{
    const page=await render({currency:'HKD',days:30,kinds:[],empty:true,month:{month:'2026-08',searchQueries:0,freeRemaining:5000,billableSearches:0,cost:0,resetsAt:'2026-09-01T07:00:00.000Z',timeZone:'America/Los_Angeles'}});
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
