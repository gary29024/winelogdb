// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { afterEach,describe,expect,it,vi } from 'vitest';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const item=(overrides:Record<string,unknown>={})=>({
  id:'montelena-1973',label:'Chateau Montelena Chardonnay 1973',status:'tasted',
  tastedWineIds:['w-2024','w-2022','w-2021','w-2013'],tastedVintages:[2013,2021,2022,2024],
  tastedVintageLinks:[{vintage:2013,wineId:'w-2013'},{vintage:2021,wineId:'w-2021'},
    {vintage:2022,wineId:'w-2022'},{vintage:2024,wineId:'w-2024'}],
  ...overrides
});

const collection=(items:unknown[])=>[{
  definition:{id:'judgment-paris',title:'Judgment of Paris',subtitle:'',icon:'judgment-paris',category:'Tasting',references:[],editable:false,origin:'curated'},
  completed:1,possible:0,pending:0,total:items.length,percent:100,complete:false,items,
  matchMode:'producer',supportsRelaxedMatching:true
}];

let root:Root|null=null,host:HTMLDivElement|null=null;
afterEach(()=>{act(()=>root?.unmount());host?.remove();root=null;host=null;vi.unstubAllGlobals()});

async function render(items:unknown[]){
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(collection(items)),{status:200,headers:{'content-type':'application/json'}})));
  vi.resetModules();
  const {AchievementDetailPage}=await import('../../src/features/achievements/AchievementDetailPage');
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
  await act(async()=>{root!.render(<MemoryRouter initialEntries={['/achievements/judgment-paris']}>
    <Routes><Route path="/achievements/:id" element={<AchievementDetailPage/>}/></Routes>
  </MemoryRouter>)});
  return host;
}

const vintageLinks=()=>[...(host?.querySelectorAll('.achievement-check-vintages a')??[])] as HTMLAnchorElement[];
const statusLink=()=>host?.querySelector('.achievement-check-status a') as HTMLAnchorElement|null;

describe('a checklist row with several tasted vintages',()=>{
  it('links every vintage to its own tasting',async()=>{
    // Reported as: one link for five vintages, pointing somewhere different
    // between two loads. Now each vintage carries its own.
    await render([item()]);
    expect(vintageLinks().map(link=>link.textContent)).toEqual(['2013','2021','2022','2024']);
    expect(vintageLinks().map(link=>link.getAttribute('href')))
      .toEqual(['/wines/w-2013','/wines/w-2021','/wines/w-2022','/wines/w-2024']);
  });

  it('still offers the latest tasting, and says that is what it is',async()=>{
    await render([item()]);
    expect(statusLink()?.textContent).toBe('Latest tasting');
    expect(statusLink()?.getAttribute('href')).toBe('/wines/w-2024');
  });

  it('does not repeat itself when only one vintage was tasted',async()=>{
    await render([item({tastedWineIds:['w-2013'],tastedVintages:[2013],tastedVintageLinks:[{vintage:2013,wineId:'w-2013'}]})]);
    expect(vintageLinks().map(link=>link.getAttribute('href'))).toEqual(['/wines/w-2013']);
    expect(statusLink(),'the single vintage above is already the link').toBeNull();
  });

  it('keeps one link for a tasting with no vintage at all',async()=>{
    // An NV or undated bottle has nothing to list, so the row still needs its
    // own way in.
    await render([item({tastedWineIds:['w-nv'],tastedVintages:[],tastedVintageLinks:[]})]);
    expect(vintageLinks()).toHaveLength(0);
    expect(statusLink()?.textContent).toBe('View tasting');
    expect(statusLink()?.getAttribute('href')).toBe('/wines/w-nv');
  });

  it('offers nothing to open for a target that has not been tasted',async()=>{
    await render([item({status:'pending',tastedWineIds:[],tastedVintages:[],tastedVintageLinks:[]})]);
    expect(vintageLinks()).toHaveLength(0);
    expect(statusLink()).toBeNull();
  });
});
