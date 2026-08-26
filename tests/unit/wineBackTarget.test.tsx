// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { afterEach,describe,expect,it,vi } from 'vitest';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
import { backTargetFromState,JOURNAL_BACK,linkFrom,readBackTarget,rememberBackTarget } from '../../src/features/wines/backTarget';

afterEach(()=>{window.sessionStorage.clear()});

describe('where a wine goes back to',()=>{
  it('takes the target the linking page handed over',()=>{
    const producer={to:'/producers/p1',label:'Pierre Vincent'};
    expect(backTargetFromState(linkFrom(producer))).toEqual(producer);
  });

  it('carries it through a reload of the same wine',()=>{
    // location.state survives browser back and forward on its own, but not a
    // reload or a trip out to the edit page - which is where the stored copy
    // earns its place.
    rememberBackTarget('w1',{to:'/batch-scan?session=b7',label:'Batch scan'});
    expect(readBackTarget('w1')).toEqual({to:'/batch-scan?session=b7',label:'Batch scan'});
  });

  it('never shows one wine\'s way back on another wine',()=>{
    rememberBackTarget('w1',{to:'/producers/p1',label:'Pierre Vincent'});
    expect(readBackTarget('w2')).toBeNull();
  });

  it('falls back to the journal for a wine opened from a link',()=>{
    expect(backTargetFromState(null)).toBeNull();
    expect(readBackTarget('w1')).toBeNull();
    expect(JOURNAL_BACK).toEqual({to:'/journal',label:'Journal'});
  });

  it('refuses a target that would leave the app',()=>{
    // The target is rendered straight into a link, and state is attacker-
    // reachable through a crafted history entry, so anything that is not an
    // in-app path is dropped rather than followed.
    for(const to of ['https://example.com','//example.com','javascript:alert(1)','wines/w1','']){
      expect(backTargetFromState({from:{to,label:'Elsewhere'}}),to).toBeNull();
    }
    expect(backTargetFromState({from:{to:'/producers/p1',label:''}})).toBeNull();
  });

  it('ignores whatever else is riding along in location state',()=>{
    expect(backTargetFromState({scrollTo:120})).toBeNull();
    expect(backTargetFromState('nonsense')).toBeNull();
    expect(backTargetFromState({from:'/producers/p1'})).toBeNull();
  });

  it('survives storage being unavailable',()=>{
    // Private browsing throws on both reads and writes; a back link is not
    // worth taking the page down for.
    const storage=Object.getOwnPropertyDescriptor(window,'sessionStorage')!;
    Object.defineProperty(window,'sessionStorage',{configurable:true,get(){throw new Error('denied')}});
    expect(()=>rememberBackTarget('w1',{to:'/journal',label:'Journal'})).not.toThrow();
    expect(readBackTarget('w1')).toBeNull();
    Object.defineProperty(window,'sessionStorage',storage);
  });

  it('shrugs off a corrupted entry',()=>{
    window.sessionStorage.setItem('winelog.wineBack','{not json');
    expect(readBackTarget('w1')).toBeNull();
  });
});

const wine={
  id:'w1',ownerId:'o',producer:'Pierre Vincent',wineName:'Savigny-lès-Beaune 1er Cru Aux Vergelesses',vintage:2024,
  country:'France',region:'Burgundy',appellation:'Savigny-lès-Beaune',classification:'premier_cru',
  grapes:['Chardonnay'],grapeBlend:[],wineStyle:'white',alcoholPercentage:13,
  tastingNotes:'',rating:null,tastingDate:null,event:null,venue:null,tastingName:null,
  locationName:null,latitude:null,longitude:null,producerId:'p1',favorite:false,deepSearch:null,
  price:null,currency:null,tags:[],imageIds:[],imageObjectKeys:[],recognitionStatus:'complete',
  recognitionConfidence:null,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',
  tastingStructure:null,groupSourcePhotos:[]
};

let root:Root|null=null,host:HTMLDivElement|null=null;

async function renderWine(state:unknown){
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(
    JSON.stringify(String(url).includes('/research')?{runs:[]}:wine),
    {status:200,headers:{'content-type':'application/json'}})));
  vi.resetModules();
  const {DetailPage}=await import('../../src/features/wines/DetailPage');
  host=document.createElement('div');document.body.appendChild(host);
  root=createRoot(host);
  await act(async()=>{root!.render(<MemoryRouter initialEntries={[{pathname:'/wines/w1',state}]}>
    <Routes><Route path="/wines/:id" element={<DetailPage/>}/></Routes>
  </MemoryRouter>)});
  return host.querySelector('.back-pill') as HTMLAnchorElement;
}

describe('the back link on a wine',()=>{
  afterEach(()=>{
    act(()=>root?.unmount());host?.remove();root=null;host=null;
    vi.unstubAllGlobals();window.sessionStorage.clear();
  });

  it('returns to the producer you came from',async()=>{
    const back=await renderWine(linkFrom({to:'/producers/p1',label:'Pierre Vincent'}));
    expect(back.getAttribute('href')).toBe('/producers/p1');
    expect(back.textContent).toBe('← Pierre Vincent');
  });

  it('returns to the batch you saved it from',async()=>{
    const back=await renderWine(linkFrom({to:'/batch-scan?session=b7',label:'Batch scan'}));
    expect(back.getAttribute('href')).toBe('/batch-scan?session=b7');
    expect(back.textContent).toBe('← Batch scan');
  });

  it('goes to the journal for a wine opened cold',async()=>{
    // And to the journal itself - the old link was labelled Journal but pointed
    // at "/", which is the passport.
    const back=await renderWine(null);
    expect(back.getAttribute('href')).toBe('/journal');
    expect(back.textContent).toBe('← Journal');
  });

  it('still knows the way back after a reload',async()=>{
    await renderWine(linkFrom({to:'/producers/p1',label:'Pierre Vincent'}));
    act(()=>root?.unmount());host?.remove();
    const back=await renderWine(null);   // no state, as after a refresh
    expect(back.getAttribute('href')).toBe('/producers/p1');
  });
});
