// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const summary={
  currency:'HKD',days:30,empty:false,
  kinds:[{kind:'producer_research',label:'Producer Deep Search',runs:1,requests:2,searchQueries:3,promptTokens:1000,outputTokens:2000,cost:1.2,costPerRun:1.2,searchesPerRun:3,units:0,unit:'run',unitCount:1,costPerUnit:1.2}],
  month:{month:'2026-09',searchQueries:3,freeRemaining:4997,billableSearches:0,cost:.02,resetsAt:'2026-10-01T07:00:00.000Z',timeZone:'America/Los_Angeles'}
};
const history={currency:'HKD',days:30,kind:'producer_research',runs:[{
  kind:'producer_research',runId:'run-1',targetId:'p1',targetLabel:'Domaine Test',createdAt:'2026-09-11T06:00:00.000Z',
  requests:2,searchQueries:3,promptTokens:1000,outputTokens:2000,cost:1.2,
  parts:[{model:'gemini-3.8-flash',tier:'batch',createdAt:'2026-09-11T06:00:00.000Z',requests:2,searchQueries:3,promptTokens:1000,outputTokens:2000,cost:1.2}]
}]};

let root:Root|null=null,host:HTMLDivElement|null=null;
beforeEach(()=>{
  Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.setAttribute('open','')}});
  Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.removeAttribute('open')}});
});
afterEach(()=>{act(()=>root?.unmount());host?.remove();root=null;host=null;vi.unstubAllGlobals();vi.resetModules()});

async function render(){
  const fetchMock=vi.fn(async(input:RequestInfo|URL)=>{
    const url=String(input),body=url.startsWith('/api/usage/spend/runs?')?history:summary;
    return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
  });
  vi.stubGlobal('fetch',fetchMock);
  const {AiSpendCard}=await import('../../src/features/journey/AiSpendCard');
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
  await act(async()=>{root!.render(<AiSpendCard/>)});
  return {page:host,fetchMock};
}

describe('AI spend drill-down reads',()=>{
  it('loads history only on first open and reuses it within the page visit',async()=>{
    const {page,fetchMock}=await render();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/usage/spend?days=30');

    const card=[...page.querySelectorAll<HTMLElement>('.ai-spend-grid article')].find(item=>item.textContent?.includes('Producer Deep Search'))!;
    await act(async()=>{card.click()});
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/usage/spend/runs?');
    expect(String(fetchMock.mock.calls[1][0])).toContain('kind=producer_research');
    expect(page.textContent).toContain('Domaine Test');

    const close=page.querySelector<HTMLButtonElement>('[aria-label="Close AI spend details"]')!;
    await act(async()=>{close.click()});
    await act(async()=>{card.click()});
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(page.textContent).toContain('Domaine Test');
  });
});
