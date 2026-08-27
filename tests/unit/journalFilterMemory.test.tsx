// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter,Route,Routes,useLocation } from 'react-router-dom';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const KEY='winelog-journal-filters';
let root:Root|null=null,host:HTMLDivElement|null=null,requested:string[]=[];

function Probe(){
  const location=useLocation();
  return <b data-testid="search">{location.search}</b>;
}

async function openJournal(at:string){
  requested=[];
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
    requested.push(String(url));
    return new Response(JSON.stringify({items:[],nextOffset:null}),{status:200,headers:{'content-type':'application/json'}});
  }));
  vi.resetModules();
  const {LibraryPage}=await import('../../src/features/wines/LibraryPage');
  host=document.createElement('div');
  document.body.appendChild(host);
  root=createRoot(host);
  await act(async()=>{root!.render(<MemoryRouter initialEntries={[at]}>
    <Probe/>
    <Routes><Route path="/journal" element={<LibraryPage/>}/></Routes>
  </MemoryRouter>)});
  return host;
}

const search=()=>host?.querySelector('[data-testid="search"]')?.textContent??'';
const journalCalls=()=>requested.filter(url=>url.startsWith('/api/journal'));

beforeEach(()=>{window.sessionStorage.clear()});
afterEach(()=>{
  act(()=>root?.unmount());
  host?.remove();
  root=null;host=null;
  vi.unstubAllGlobals();
});

describe('Journal filter memory',()=>{
  it('remembers the filters you left with',async()=>{
    await openJournal('/journal?country=France&style=red');
    expect(window.sessionStorage.getItem(KEY)).toBe('country=France&style=red');
  });

  it('restores them when you come back to a bare journal link',async()=>{
    window.sessionStorage.setItem(KEY,'country=France&style=red&offset=36');
    await openJournal('/journal');
    expect(search()).toBe('?country=France&style=red&offset=36');
  });

  it('does not fetch the unfiltered list on the way through',async()=>{
    // The restore happens before any request, so returning to the journal costs
    // one query for the list you wanted, not one for the reset list as well.
    window.sessionStorage.setItem(KEY,'country=France');
    await openJournal('/journal');
    expect(journalCalls()).toHaveLength(1);
    expect(journalCalls()[0]).toContain('country=France');
  });

  it('still holds the restored page once the search debounce has settled',async()=>{
    // The debounce writes the query param, and any write clears offset. Coming
    // back to page two has to survive that, not silently land on page one.
    window.sessionStorage.setItem(KEY,'query=Dujac&offset=36');
    await openJournal('/journal');
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,400))});
    expect(search()).toContain('offset=36');
    expect(search()).toContain('query=Dujac');
  });

  it('lets a link that carries its own filters win',async()=>{
    window.sessionStorage.setItem(KEY,'country=France');
    await openJournal('/journal?country=Italy');
    expect(search()).toBe('?country=Italy');
  });

  it('has nothing to restore once the filters are cleared',async()=>{
    window.sessionStorage.setItem(KEY,'');
    await openJournal('/journal');
    expect(search()).toBe('');
    expect(journalCalls()).toHaveLength(1);
  });
});

describe('clearing the journal filters',()=>{
  const reset=()=>[...(host?.querySelectorAll('button')??[])].find(button=>button.textContent==='Reset filters');

  it('offers nothing to reset on a plain journal',async()=>{
    await openJournal('/journal');
    expect(reset()).toBeUndefined();
  });

  it('puts the journal back to its default in one press',async()=>{
    // Filters accumulate and are restored on the way back from a wine, so
    // without this the only way to a plain journal was editing the URL.
    await openJournal('/journal?query=roumier&style=red&country=France&sort=rating&offset=40');
    expect(reset()).toBeDefined();
    await act(async()=>{reset()!.click()});
    expect(search()).toBe('');
    expect(reset()).toBeUndefined();
  });

  it('forgets the filters it had remembered',async()=>{
    // Otherwise the next visit restores exactly what was just cleared.
    await openJournal('/journal?style=red&month=2026-08');
    expect(window.sessionStorage.getItem(KEY)).toBeTruthy();
    await act(async()=>{reset()!.click()});
    expect(window.sessionStorage.getItem(KEY)??'').toBe('');
  });

  it('reloads the list once, unfiltered',async()=>{
    await openJournal('/journal?style=red');
    const before=journalCalls().length;
    await act(async()=>{reset()!.click()});
    const after=journalCalls().slice(before);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every(url=>!url.includes('style='))).toBe(true);
  });
});
