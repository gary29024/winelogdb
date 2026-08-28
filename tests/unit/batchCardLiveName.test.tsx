// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,describe,expect,it,vi } from 'vitest';
import { createD1Stub } from './support/d1Stub';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const recognition={producer:'Haselberger',wineName:'Landlbirn',vintage:2021,confidence:1,
  country:'Austria',region:null,appellation:null,grapes:[],wineStyle:'red'};

const item=(overrides:Record<string,unknown>={})=>({
  id:'i1',position:0,status:'confirmed',recognition,error:null,confirmedWineId:'w1',
  saved:{producer:'Weingut Haselberger',wineName:'Landlbirne',vintage:2020},imageIds:[],...overrides
});
const session=(items:unknown[])=>({id:'s1',status:'complete',totalItems:items.length,expectedItems:items.length,
  confirmedItems:items.length,createdAt:'x',updatedAt:'x',expiresAt:'x',items});

let root:Root|null=null,host:HTMLDivElement|null=null;
afterEach(()=>{act(()=>root?.unmount());host?.remove();root=null;host=null;vi.unstubAllGlobals()});

async function render(items:unknown[]){
  // The page finds the asked session in the list first, then fetches it.
  const summary={id:'s1',status:'complete',totalItems:items.length,expectedItems:items.length,
    confirmedItems:items.length,createdAt:'x',updatedAt:'x',expiresAt:'x'};
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(
    JSON.stringify(String(url).endsWith('/sessions/s1')?session(items):{items:[summary]}),
    {status:200,headers:{'content-type':'application/json'}})));
  vi.resetModules();
  const {BatchScanPage}=await import('../../src/features/uploads/BatchScanPage');
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
  await act(async()=>{root!.render(<MemoryRouter initialEntries={['/batch-scan?session=s1']}><BatchScanPage/></MemoryRouter>)});
  return host;
}
const card=()=>host!.querySelector('.batch-result-card')!;

describe('a confirmed card in a batch scan',()=>{
  it('shows the wine as it stands, not as it was read',async()=>{
    // Reported as: renaming a producer and wine shows on the detail page but
    // the batch card keeps the old names. The card was rendering the scan
    // snapshot, which stops being true the moment the wine is edited.
    await render([item()]);
    expect(card().textContent).toContain('Landlbirne');
    expect(card().textContent).toContain('Weingut Haselberger');
    expect(card().textContent).not.toContain('Landlbirn·');
  });

  it('shows the saved vintage, and keeps the confidence of the reading',async()=>{
    await render([item()]);
    // The confidence belongs to the scan and stays; the vintage follows the wine.
    expect(card().textContent).toContain('2020 · 100% confidence');
  });

  it('falls back to the reading when nothing was saved yet',async()=>{
    await render([item({status:'ready',confirmedWineId:null,saved:null})]);
    expect(card().textContent).toContain('Landlbirn');
    expect(card().textContent).toContain('2021 · 100% confidence');
  });

  it('falls back to the reading when the saved wine is gone',async()=>{
    // A deleted wine leaves the join empty rather than blanking the card.
    await render([item({saved:null})]);
    expect(card().textContent).toContain('Landlbirn');
    expect(card().textContent).toContain('Haselberger');
  });
});

describe('the session the card reads from',()=>{
  it('joins the saved wine so the card has something current to show',async()=>{
    const stub=createD1Stub(sql=>/FROM batch_recognition_sessions/.test(sql)
      ?{first:{id:'s1',status:'complete',total_items:1,expected_items:1,confirmed_items:1,created_at:'x',updated_at:'x',expires_at:'x'}}
      :/batch_recognition_items i LEFT JOIN wines/.test(sql)
        ?{all:[{id:'i1',position:0,status:'confirmed',metadata_json:'{}',recognition_json:JSON.stringify(recognition),
          error:null,confirmed_wine_id:'w1',saved_producer:'Weingut Haselberger',saved_wine_name:'Landlbirne',saved_vintage:2020}]}
        :{all:[]});
    const { getBatchSession }=await import('../../worker/batchRecognition');
    const result=await getBatchSession(stub.db,'owner','s1');
    expect(result?.items[0].saved).toEqual({producer:'Weingut Haselberger',wineName:'Landlbirne',vintage:2020});
    // The reading is kept beside it rather than replaced.
    expect(result?.items[0].recognition).toMatchObject({wineName:'Landlbirn'});
  });
});
