// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { VINTAGE_WINDOW_SURFACES } from '../../src/features/maturity/surfaces';

describe('where the drinking window is offered',()=>{
  it('is off on the wine page reached from the Journal',()=>{
    // The question is "should I open this?", and a bottle in the Journal has
    // been drunk. The box was taking room, and a cache read on every wine
    // opened, to answer something settled by drinking it.
    expect(VINTAGE_WINDOW_SURFACES.wineDetail).toBe(false);
  });

  it('stays on where the bottle is still unopened',()=>{
    expect(VINTAGE_WINDOW_SURFACES.cellarSheet).toBe(true);
  });

  it('is a switch, not a deletion',()=>{
    // Turning it back on has to be this one boolean and nothing else, so both
    // surfaces read the flag rather than one of them having been cut out.
    const detail=readFileSync('src/features/wines/DetailPage.tsx','utf8');
    const sheet=readFileSync('src/features/cellar/AddToCellarSheet.tsx','utf8');
    expect(detail).toMatch(/VINTAGE_WINDOW_SURFACES\.wineDetail&&<VintageCheck/);
    expect(sheet).toMatch(/VINTAGE_WINDOW_SURFACES\.cellarSheet&&<VintageCheck/);
    // and everything behind it is still here, running for the cellar
    expect(readFileSync('src/features/maturity/VintageCheck.tsx','utf8')).toMatch(/lookUpVintageWindow/);
    expect(readFileSync('src/features/cellar/CellarScope.tsx','utf8')).toMatch(/<DrinkingWindow wine=\{holding\} compact/);
  });
});

describe('the wine page with the window switched off',()=>{
  it('draws no vintage box and asks nothing about the year',async()=>{
    const {act}=await import('react');
    const {createRoot}=await import('react-dom/client');
    const {MemoryRouter,Routes,Route}=await import('react-router-dom');
    const {vi}=await import('vitest');
    (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
    const wine={id:'w1',producer:'Salon',wineName:'Le Mesnil',vintage:2013,country:'France',
      region:'Champagne',appellation:null,classification:null,wineStyle:'sparkling',grapes:[],grapeBlend:[],
      tags:[],images:[],imageIds:[],favorite:false,rating:null,tastingNotes:'',createdAt:'2026-01-01T00:00:00.000Z'};
    const asked:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
      const url=String(input);asked.push(url);
      if(url.startsWith('/api/wines/w1'))return new Response(JSON.stringify(wine),{status:200,headers:{'content-type':'application/json'}});
      return new Response(JSON.stringify({holdings:[],window:null}),{status:200,headers:{'content-type':'application/json'}});
    }));
    vi.resetModules();
    const {DetailPage}=await import('../../src/features/wines/DetailPage');
    const host=document.createElement('div');document.body.appendChild(host);
    const root=createRoot(host);
    await act(async()=>{root.render(<MemoryRouter initialEntries={['/wines/w1']}>
      <Routes><Route path="/wines/:id" element={<DetailPage/>}/></Routes></MemoryRouter>)});
    await act(async()=>{await Promise.resolve()});
    expect(host.querySelector('.vintage-check')).toBeNull();
    expect(host.querySelector('.maturity-line')).toBeNull();
    expect(asked.some(url=>url.startsWith('/api/maturity/vintage'))).toBe(false);
    act(()=>root.unmount());host.remove();vi.unstubAllGlobals();
  });
});
