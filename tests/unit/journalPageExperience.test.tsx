// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { afterEach,describe,expect,it,vi } from 'vitest';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const journalWine=(imageIds:string[]=[])=>({
  id:'w1',producer:'Schödl',wineName:'Steinberg Grüner Veltliner',vintage:2023,
  country:'Austria',region:'Weinviertel',appellation:null,grapes:['Grüner Veltliner'],
  wineStyle:'white',tastingName:null,venue:null,favorite:false,rating:null,
  tastingDate:'2026-05-01',imageIds,createdAt:'2026-05-01T00:00:00.000Z'
});

let root:Root|null=null,host:HTMLDivElement|null=null;
const flush=()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,0))});

afterEach(()=>{
  act(()=>root?.unmount());host?.remove();root=null;host=null;
  vi.restoreAllMocks();vi.unstubAllGlobals();window.sessionStorage.clear();window.localStorage.clear();
});

async function render(url:string,fetcher:ReturnType<typeof vi.fn>){
  vi.stubGlobal('fetch',fetcher);vi.stubGlobal('scrollTo',vi.fn());vi.resetModules();
  const {LibraryPage}=await import('../../src/features/wines/LibraryPage');
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
  await act(async()=>{root!.render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/journal" element={<LibraryPage/>}/></Routes></MemoryRouter>)});
  await flush();return host;
}

describe('Journal result navigation',()=>{
  it('shows the filtered record count and supports direct page entry',async()=>{
    const fetcher=vi.fn(async(url:string)=>{
      const offset=Number(new URL(String(url),'https://x').searchParams.get('offset')||0);
      return new Response(JSON.stringify({items:[journalWine()],nextOffset:offset+36<73?offset+36:null,total:73}),{status:200,headers:{'content-type':'application/json'}});
    });
    const page=await render('/journal?query=Austria',fetcher);
    expect(page.querySelector('.journal-viewbar')?.textContent).toContain('73 matching wines · Page 1 of 3');
    const input=page.querySelector('[aria-label="Journal page number"]') as HTMLInputElement;
    await act(async()=>{const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value')!.set!;setter.call(input,'3');input.dispatchEvent(new Event('input',{bubbles:true}))});
    await act(async()=>{page.querySelector('.journal-page-picker')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))});
    await flush();
    expect(fetcher.mock.calls.some(([url])=>new URL(String(url),'https://x').searchParams.get('offset')==='72')).toBe(true);
    expect(page.querySelector('.journal-viewbar')?.textContent).toContain('Page 3 of 3');
  });

  it('shows a zero result count after a filter finds nothing',async()=>{
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({items:[],nextOffset:null,total:0}),{status:200,headers:{'content-type':'application/json'}}));
    const page=await render('/journal?country=Austria',fetcher);
    expect(page.querySelector('.journal-viewbar')?.textContent).toContain('0 matching wines · Page 1 of 1');
  });

  it('does not request an already-loaded photo again when selection mode remounts the card',async()=>{
    const NativeURL=URL;
    class ImageURL extends NativeURL{
      static createObjectURL(){return 'blob:wine-photo'}
      static revokeObjectURL(){}
    }
    vi.stubGlobal('URL',ImageURL);
    const fetcher=vi.fn(async(url:string)=>String(url).startsWith('/api/images/')
      ?new Response(new Blob(['photo'],{type:'image/jpeg'}),{status:200})
      :new Response(JSON.stringify({items:[journalWine(['image-select-cache'])],nextOffset:null,total:1}),{status:200,headers:{'content-type':'application/json'}}));
    const page=await render('/journal',fetcher);await flush();
    expect(page.querySelector('img.journal-wine-thumb')).not.toBeNull();
    const imageCalls=()=>fetcher.mock.calls.filter(([url])=>String(url).startsWith('/api/images/')).length;
    expect(imageCalls()).toBe(1);
    const select=[...page.querySelectorAll('button')].find(button=>button.textContent==='Select')!;
    await act(async()=>{select.dispatchEvent(new MouseEvent('click',{bubbles:true}))});await flush();
    expect(page.querySelector('img.journal-wine-thumb')).not.toBeNull();
    expect(imageCalls()).toBe(1);
  });
});
