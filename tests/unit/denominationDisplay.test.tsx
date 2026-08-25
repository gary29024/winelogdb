// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { afterEach,describe,expect,it,vi } from 'vitest';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const wine=(over:Record<string,unknown>={})=>({
  id:'w1',ownerId:'o',producer:'Fontodi',wineName:'Filetta di Lamole',vintage:2019,
  country:'Italy',region:'Tuscany',appellation:'Chianti Classico',classification:null,
  recognizedRegion:'Tuscany',recognizedAppellation:'Chianti Classico',
  grapes:['Sangiovese'],grapeBlend:[],wineStyle:'red',alcoholPercentage:14,
  tastingNotes:'',rating:null,tastingDate:null,event:null,venue:null,tastingName:null,
  locationName:null,latitude:null,longitude:null,producerId:null,favorite:false,deepSearch:null,
  price:null,currency:null,tags:[],imageIds:[],imageObjectKeys:[],recognitionStatus:'complete',
  recognitionConfidence:null,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',
  tastingStructure:null,groupSourcePhotos:[],...over
});

let root:Root|null=null,host:HTMLDivElement|null=null;

async function render(detail:Record<string,unknown>){
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(
    JSON.stringify(String(url).includes('/research')?{runs:[]}:detail),
    {status:200,headers:{'content-type':'application/json'}})));
  vi.resetModules();
  const {DetailPage}=await import('../../src/features/wines/DetailPage');
  host=document.createElement('div');
  document.body.appendChild(host);
  root=createRoot(host);
  await act(async()=>{root!.render(<MemoryRouter initialEntries={['/wines/w1']}>
    <Routes><Route path="/wines/:id" element={<DetailPage/>}/></Routes>
  </MemoryRouter>)});
  return host;
}

const rows=()=>Object.fromEntries([...host!.querySelectorAll('.wine-detail dl > div')]
  .map(row=>[row.querySelector('dt')?.textContent??'',row.querySelector('dd')?.textContent??'']));

afterEach(()=>{
  act(()=>root?.unmount());
  host?.remove();
  root=null;host=null;
  vi.unstubAllGlobals();
});

describe('The denomination on the wine detail',()=>{
  it('sits inside the appellation pill rather than beside it',async()=>{
    // It is not a second origin, so it does not get a pill of its own.
    const page=await render(wine());
    const pill=page.querySelector('.detail-pills span')!;
    expect(pill.textContent).toBe('Chianti ClassicoDOCG');
    expect(pill.querySelector('.detail-denomination')?.textContent).toBe('DOCG');
  });

  it('spells the term out in the details, so the label term is never typed',async()=>{
    await render(wine());
    expect(rows()['Appellation']).toBe('Chianti Classico DOCG');
  });

  it('rides the region for a wine that names no appellation',async()=>{
    // Rioja is exactly the name the DOCa covers; there is no narrower place to
    // hang the term on, and dropping it would answer the question with silence.
    await render(wine({country:'Spain',region:'Rioja',appellation:null,
      recognizedRegion:'Rioja',recognizedAppellation:null}));
    expect(rows()['Region']).toBe('Rioja DOCa, Spain');
    expect(host!.querySelector('.detail-denomination')?.textContent).toBe('DOCa');
  });

  it('shows nothing where the tree knows no denomination',async()=>{
    await render(wine({country:'Germany',region:'Mosel',appellation:'Wehlener Sonnenuhr',
      recognizedRegion:'Mosel',recognizedAppellation:'Wehlener Sonnenuhr'}));
    expect(host!.querySelector('.detail-denomination')).toBeNull();
    expect(rows()['Appellation']).toBe('Wehlener Sonnenuhr');
  });
});

describe('What the label was read as, on the wine detail',()=>{
  it('is shown only where normalisation moved something',async()=>{
    await render(wine());
    expect(rows()['As recorded']).toBeUndefined();
  });

  it('shows the pair as it arrived when the columns were re-slotted',async()=>{
    // Region and appellation move between each other, so showing one alone
    // would read as a mistake rather than a shift.
    await render(wine({country:'United States',region:'Napa Valley',appellation:'Oakville',
      recognizedRegion:'California',recognizedAppellation:'Oakville, Napa Valley'}));
    expect(rows()['As recorded']).toBe('California / Oakville, Napa Valley');
  });
});
