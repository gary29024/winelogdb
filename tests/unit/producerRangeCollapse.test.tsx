// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const detail={
  id:'p1',ownerId:'o',canonicalName:'Domaine Dujac',aliases:['Domaine Dujac'],
  homeCountry:'France',homeRegion:'Burgundy',homeLocality:'Morey-Saint-Denis',
  officialWebsiteUrl:null,instagramUrl:null,contactEmail:null,contactPhone:null,contactSources:[],
  profile:'A Morey-Saint-Denis domaine.',winemakingPractices:'',heroImageAvailable:false,
  catalog:[
    {name:'Clos de la Roche',category:'red',appellation:'Clos de la Roche',classification:'Grand Cru',style:null,notes:null},
    {name:'Charmes-Chambertin',category:'red',appellation:'Charmes-Chambertin',classification:'Grand Cru',style:null,notes:null},
    {name:'Morey-Saint-Denis Blanc',category:'white',appellation:'Morey-Saint-Denis',classification:null,style:null,notes:null}
  ],
  catalogCuvees:[],cuveeCatalogLinks:[],tastedWines:[],linkedProducers:[],supplementaryContacts:[],
  researchHistoryCount:0,sources:[],researchModel:null,researchedAt:null
};

let root:Root|null=null,host:HTMLDivElement|null=null;

async function render(){
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
    const target=String(url);
    if(target.includes('/research-status'))return new Response(null,{status:404});
    if(target.endsWith('/api/producers'))return new Response(JSON.stringify({items:[]}),{status:200,headers:{'content-type':'application/json'}});
    return new Response(JSON.stringify(detail),{status:200,headers:{'content-type':'application/json'}});
  }));
  vi.resetModules();
  const {ProducerDetailPage}=await import('../../src/features/producers/ProducerDetailPage');
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
  await act(async()=>{root!.render(<MemoryRouter initialEntries={['/producers/p1']}>
    <Routes><Route path="/producers/:id" element={<ProducerDetailPage/>}/></Routes>
  </MemoryRouter>)});
  return host;
}

const groups=()=>[...(host?.querySelectorAll('.producer-catalog-group')??[])];
const toggles=()=>[...(host?.querySelectorAll('.catalog-group-toggle')??[])] as HTMLButtonElement[];
const panels=()=>[...(host?.querySelectorAll('.producer-catalog')??[])] as HTMLElement[];
const click=async(button:HTMLButtonElement)=>{await act(async()=>{button.click()})};

beforeEach(()=>{window.localStorage.clear()});
afterEach(()=>{
  if(root)act(()=>root!.unmount());
  host?.remove();root=null;host=null;vi.unstubAllGlobals();window.localStorage.clear();
});

describe('Producer wine range',()=>{
  it('groups the range by style and starts expanded',async()=>{
    await render();
    expect(groups()).toHaveLength(2);
    expect(toggles().map(button=>button.querySelector('.catalog-group-name')?.textContent)).toEqual(['Red','White']);
    expect(toggles().map(button=>button.querySelector('.catalog-group-count')?.textContent)).toEqual(['2','1']);
    expect(toggles().every(button=>button.getAttribute('aria-expanded')==='true')).toBe(true);
    expect(panels().every(panel=>!panel.hidden)).toBe(true);
    expect(host?.querySelector('.producer-range-head strong')?.textContent).toContain('3 wines · 2 styles');
  });

  it('collapses and re-expands a single style without touching the others',async()=>{
    await render();
    await click(toggles()[0]);
    expect(toggles()[0].getAttribute('aria-expanded')).toBe('false');
    expect(panels()[0].hidden).toBe(true);
    expect(panels()[1].hidden).toBe(false);
    await click(toggles()[0]);
    expect(panels()[0].hidden).toBe(false);
  });

  it('collapses every style at once and offers to expand them again',async()=>{
    await render();
    const toggleAll=host!.querySelector('.range-toggle-all') as HTMLButtonElement;
    expect(toggleAll.textContent).toBe('Collapse all');
    await click(toggleAll);
    expect(panels().every(panel=>panel.hidden)).toBe(true);
    expect((host!.querySelector('.range-toggle-all') as HTMLButtonElement).textContent).toBe('Expand all');
    await click(host!.querySelector('.range-toggle-all') as HTMLButtonElement);
    expect(panels().every(panel=>!panel.hidden)).toBe(true);
  });

  it('remembers collapsed styles across visits',async()=>{
    await render();
    await click(toggles()[1]);
    if(root)act(()=>root!.unmount());
    host?.remove();
    await render();
    expect(toggles()[0].getAttribute('aria-expanded')).toBe('true');
    expect(toggles()[1].getAttribute('aria-expanded')).toBe('false');
  });

  it('survives local storage that refuses the range preference',async()=>{
    const blocked=(key:string)=>{if(key==='winelog.producerRange.collapsed')throw new Error('blocked')};
    vi.spyOn(Storage.prototype,'getItem').mockImplementation(function(this:Storage,key:string){blocked(key);return null});
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(this:Storage,key:string){blocked(key)});
    await render();
    expect(groups()).toHaveLength(2);
    await click(toggles()[0]);
    expect(panels()[0].hidden).toBe(true);
    vi.restoreAllMocks();
  });
});
