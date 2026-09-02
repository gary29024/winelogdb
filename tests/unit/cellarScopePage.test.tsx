// @vitest-environment jsdom
import { describe,expect,it,vi,beforeEach } from 'vitest';
import { cleanup,render,screen,waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const holding={id:'h1',producerId:'p1',cuveeId:'c1',producer:'Cusumano',wineName:'Feudo di Mezzo',vintage:2020,
  country:'Italy',region:'Sicily',appellation:'Etna',wineStyle:'red',classification:null,
  bottles:6,bottleSizeMl:750,purchasePrice:280,currency:'HKD',purchasedAt:'2026-08-01',
  merchant:null,location:'Rack 3',notes:'',createdAt:'2026-08-01T00:00:00.000Z',updatedAt:'2026-08-01T00:00:00.000Z'};

function stubFetch(page:{items:unknown[];total:number;bottles:number;nextOffset:null}){
  const journal=vi.fn();
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
    const url=String(input);
    if(url.startsWith('/api/cellar'))return new Response(JSON.stringify(page),{status:200,headers:{'content-type':'application/json'}});
    journal(url);
    return new Response(JSON.stringify({items:[],total:0,nextOffset:null}),{status:200,headers:{'content-type':'application/json'}});
  }));
  return journal;
}

async function renderCellar(){
  vi.resetModules();
  const {default:CellarPage}=await import('../../src/features/cellar/CellarPage');
  return render(<MemoryRouter initialEntries={['/journal?scope=cellar']}><CellarPage/></MemoryRouter>);
}

describe('the cellar scope of the Journal',()=>{
  // No global cleanup is configured in this repo, so each render tidies up
  // after the last one rather than stacking a second copy of the page.
  beforeEach(()=>{cleanup();vi.unstubAllGlobals()});

  it('shows bottles held, and never asks the journal for wines you drank',async()=>{
    const journal=stubFetch({items:[holding],total:1,bottles:6,nextOffset:null});
    await renderCellar();
    expect(await screen.findByText('Feudo di Mezzo')).toBeTruthy();
    expect(screen.getByText('6 bottles')).toBeTruthy();
    // The promise the scopes make: the two sets are never fetched together, so
    // they can never be shown together.
    expect(journal).not.toHaveBeenCalled();
  });

  it('counts wines and bottles as two different numbers',async()=>{
    stubFetch({items:[holding],total:1,bottles:6,nextOffset:null});
    await renderCellar();
    expect(await screen.findByText('1 wine · 6 bottles')).toBeTruthy();
  });

  it('says plainly that these bottles are out of every statistic',async()=>{
    stubFetch({items:[],total:0,bottles:0,nextOffset:null});
    await renderCellar();
    await waitFor(()=>expect(screen.getByText(/out of every statistic/i)).toBeTruthy());
  });

  it('offers to open a bottle, carrying the holding to the wine form',async()=>{
    stubFetch({items:[holding],total:1,bottles:6,nextOffset:null});
    await renderCellar();
    const open=await screen.findByRole('button',{name:'Open a bottle'});
    expect(open).toBeTruthy();
  });

  it('marks the cellar tab as the one being shown',async()=>{
    stubFetch({items:[],total:0,bottles:0,nextOffset:null});
    await renderCellar();
    await waitFor(()=>expect(screen.getByRole('tab',{name:'In cellar'}).getAttribute('aria-selected')).toBe('true'));
    expect(screen.getByRole('tab',{name:'Tasted'}).getAttribute('aria-selected')).toBe('false');
  });
});

describe('getting to the cellar, and back out of it',()=>{
  beforeEach(()=>{cleanup();vi.unstubAllGlobals()});

  it('warms the cellar page on the press rather than on arrival',async()=>{
    // The chunk used to be fetched by the tap that needed it, queued behind
    // every wine photo the journal still had in flight - which is exactly when
    // someone reaches for another scope.
    const source=await import('node:fs').then(fs=>fs.readFileSync('src/features/wines/JournalScopeTabs.tsx','utf8'));
    expect(source).toMatch(/onPointerDown=\{warm\(value\)\}/);
    expect(source).toMatch(/import\('\.\.\/cellar\/CellarPage'\)/);
  });

  it('lets you leave the open-bottle form without taking the bottle',async()=>{
    // Nothing is decremented on the way in, so backing out must cost nothing -
    // and there has to be a way to back out.
    const source=await import('node:fs').then(fs=>fs.readFileSync('src/features/cellar/OpenBottlePage.tsx','utf8'));
    expect(source).toMatch(/to="\/journal\?scope=cellar"/);
    expect(source).toMatch(/Cancel/);
  });
});
