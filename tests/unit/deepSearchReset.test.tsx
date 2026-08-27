// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { afterEach,describe,expect,it,vi } from 'vitest';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const research={
  summary:'A ripe vintage.',vintageQuality:'',producerDetails:'',producerWinemakingPractices:'',
  winemakingTechniques:'',terroir:'',drinkingWindow:'',sources:[],
  model:'gemini-3.7-flash',researchedAt:'2026-08-01T00:00:00.000Z'
};
const wine=(deepSearch:unknown)=>({
  id:'w1',ownerId:'o',producer:'Domaine William Fevre',wineName:'Chablis Grand Cru Bougros',vintage:2019,
  country:'France',region:'Burgundy',appellation:'Bougros',classification:'grand_cru',
  grapes:['Chardonnay'],grapeBlend:[],wineStyle:'white',alcoholPercentage:12.5,
  tastingNotes:'',rating:null,tastingDate:null,event:null,venue:null,tastingName:null,
  locationName:null,latitude:null,longitude:null,producerId:'p1',favorite:false,deepSearch,
  price:null,currency:null,tags:[],imageIds:[],imageObjectKeys:[],recognitionStatus:'complete',
  recognitionConfidence:null,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',
  tastingStructure:null,groupSourcePhotos:[]
});

let root:Root|null=null,host:HTMLDivElement|null=null;
const posts:Array<{url:string;body:unknown}>=[];

async function render(deepSearch:unknown){
  posts.length=0;
  vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
    const path=String(url);
    if(init?.method==='POST'){
      posts.push({url:path,body:JSON.parse(String(init.body||'{}'))});
      return new Response(JSON.stringify({accepted:true,researchRequestId:'r-1'}),{status:202,headers:{'content-type':'application/json'}});
    }
    const body=path.includes('deep-search-status')?{error:'not found'}:path.includes('/research')?{runs:[]}:wine(deepSearch);
    return new Response(JSON.stringify(body),{status:path.includes('deep-search-status')?404:200,headers:{'content-type':'application/json'}});
  }));
  vi.resetModules();
  const {DetailPage}=await import('../../src/features/wines/DetailPage');
  host=document.createElement('div');document.body.appendChild(host);
  root=createRoot(host);
  await act(async()=>{root!.render(<MemoryRouter initialEntries={['/wines/w1']}>
    <Routes><Route path="/wines/:id" element={<DetailPage/>}/></Routes></MemoryRouter>)});
  return host;
}

const button=(text:string)=>[...host!.querySelectorAll('button')].find(item=>item.textContent?.trim()===text);
const click=async(el:HTMLElement)=>{await act(async()=>{el.click()})};

afterEach(()=>{
  act(()=>root?.unmount());host?.remove();root=null;host=null;vi.unstubAllGlobals();
});

describe('starting a wine\'s research over',()=>{
  it('clears every stored scope when asked for a fresh search',async()=>{
    // Cached research is what makes a refresh cheap, but a thin or wrong answer
    // used to be permanent - nothing in the app could clear it.
    await render(research);
    await click(button('Reset and search fresh')!);
    await click(button('Clear and research again')!);
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toContain('/api/wines/w1/deep-search');
    expect(posts[0].body).toMatchObject({refresh:'all'});
  });

  it('says what a reset costs before running it',async()=>{
    await render(research);
    await click(button('Reset and search fresh')!);
    const confirm=host!.querySelector('.deep-confirm')!.textContent??'';
    expect(confirm).toContain('discards');
    expect(confirm).toContain('again');
    expect(posts).toHaveLength(0);
  });

  it('leaves the ordinary refresh alone',async()=>{
    await render(research);
    await click(button('Refresh vintage research')!);
    await click(button('Queue vintage refresh')!);
    expect(posts[0].body).toMatchObject({refresh:'vintage'});
  });

  it('offers no reset on a wine with nothing stored',async()=>{
    await render(null);
    expect(button('Reset and search fresh')).toBeUndefined();
    await click(button('Deep Search')!);
    await click(button('Queue Deep Search')!);
    expect(posts[0].body).toMatchObject({refresh:'none'});
  });
});
