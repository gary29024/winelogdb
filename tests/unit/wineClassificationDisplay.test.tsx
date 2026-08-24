// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { afterEach,describe,expect,it,vi } from 'vitest';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const wine=(over:Record<string,unknown>={})=>({
  id:'w1',ownerId:'o',producer:'Domaine Dujac',wineName:'Charmes-Chambertin',vintage:2018,
  country:'France',region:'Burgundy',appellation:'Charmes-Chambertin',classification:'grand_cru',
  grapes:['Pinot Noir'],grapeBlend:[],wineStyle:'red',alcoholPercentage:13,
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

const pill=()=>host?.querySelector('.detail-classification');

afterEach(()=>{
  act(()=>root?.unmount());
  host?.remove();
  root=null;host=null;
  vi.unstubAllGlobals();
});

describe('Cru tier on the wine detail',()=>{
  it('shows the tier beside the appellation',async()=>{
    // Normalising the place moves the tier off the appellation, so without this
    // a village wine and a premier cru from the same commune read identically.
    await render(wine());
    expect(pill()?.textContent).toBe('Grand Cru');
    expect(pill()?.className).toContain('detail-classification-grand_cru');
  });

  it('names each tier in the way a label would',async()=>{
    await render(wine({classification:'premier_cru',appellation:'Vosne-Romanée'}));
    expect(pill()?.textContent).toBe('Premier Cru');
    act(()=>root?.unmount());host?.remove();
    await render(wine({classification:'village',appellation:'Vosne-Romanée'}));
    expect(pill()?.textContent).toBe('Village');
  });

  it('shows nothing where the wine has no such tier',async()=>{
    // Most of the New World has no cru system; an empty pill would be noise.
    await render(wine({classification:null,appellation:'Oakville',region:'Napa Valley'}));
    expect(pill()).toBeNull();
  });

  it('keeps the appellation as its own pill',async()=>{
    const page=await render(wine());
    const pills=[...page.querySelectorAll('.detail-pills span')].map(node=>node.textContent);
    expect(pills).toContain('Charmes-Chambertin');
    expect(pills).toContain('Grand Cru');
  });
});
