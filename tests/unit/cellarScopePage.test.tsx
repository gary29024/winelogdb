// @vitest-environment jsdom
import { describe,expect,it,vi,beforeEach } from 'vitest';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
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

  it('keeps the count, the readiness and the rack on one row',async()=>{
    // Three facts of a few words each had a line apiece, which on a phone is
    // three lines of mostly white space and two cards to a screen.
    stubFetch({items:[{...holding,vintageWindow:null}],total:1,bottles:6,nextOffset:null});
    const {container}=await renderCellar();
    await screen.findByText('Feudo di Mezzo');
    const state=container.querySelector('.cellar-state')!;
    expect(state.querySelector('.cellar-bottles')!.textContent).toBe('6 bottles');
    expect(state.querySelector('.maturity-dot')).not.toBeNull();
    expect(state.querySelector('.cellar-location')!.textContent).toBe('Rack 3');
  });

  it('says what the bottles cost, which is why the price was recorded',async()=>{
    stubFetch({items:[{...holding,vintageWindow:null}],total:1,bottles:6,nextOffset:null});
    const {container}=await renderCellar();
    await screen.findByText('Feudo di Mezzo');
    // Per bottle first - it is what the form asks for and what compares between
    // two lines - then the lot, which is what is actually on the rack.
    const price=container.querySelector('.cellar-state .cellar-price')!.textContent!;
    expect(price).toMatch(/280/);
    expect(price).toMatch(/× 6/);
    expect(price).toMatch(/1,680/);
  });

  it('quotes one bottle once, without a multiplier',async()=>{
    stubFetch({items:[{...holding,bottles:1,vintageWindow:null}],total:1,bottles:1,nextOffset:null});
    const {container}=await renderCellar();
    await screen.findByText('Feudo di Mezzo');
    const price=container.querySelector('.cellar-price')!.textContent!;
    expect(price).toMatch(/280/);
    expect(price).not.toMatch(/×/);
  });

  it('says nothing where no price was recorded',async()=>{
    stubFetch({items:[{...holding,purchasePrice:null,vintageWindow:null}],total:1,bottles:6,nextOffset:null});
    const {container}=await renderCellar();
    await screen.findByText('Feudo di Mezzo');
    expect(container.querySelector('.cellar-price')).toBeNull();
  });

  it('keeps removal off the row and behind the sheet',async()=>{
    // The rarest thing done to a holding and the only irreversible one. The
    // width it took on every row is the price of a bottle instead.
    stubFetch({items:[{...holding,vintageWindow:null}],total:1,bottles:6,nextOffset:null});
    await renderCellar();
    await screen.findByText('Feudo di Mezzo');
    expect(screen.queryByRole('button',{name:'Remove'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Edit'}));
    const remove=await screen.findByRole('button',{name:'Remove these bottles'});
    // and it still asks first, and still deletes the line it was opened on
    vi.stubGlobal('confirm',vi.fn(()=>true));
    fireEvent.click(remove);
    await waitFor(()=>expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
      .some(([url,init])=>String(url)==='/api/cellar/h1'&&(init as RequestInit|undefined)?.method==='DELETE')).toBe(true));
  });

  it('refreshes the rows when a vintage is looked up from inside a sheet',async()=>{
    // Reported as: the star does not appear until you leave the page and come
    // back. Cancel is the obvious way out of the sheet after pressing the
    // button - it saves nothing, so it reloaded nothing, and the rows behind
    // kept the window they had before the search.
    const window_={country:'France',region:'Champagne',appellation:null,vintage:2020,wineStyle:'red',
      shiftFrom:1,shiftTo:2,note:'n',sources:[{title:'A page',url:'https://vertexaisearch.cloud.google.com/x'}],
      model:'m',researchedAt:'2026-09-02T00:00:00.000Z'};
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input);
      if(url.startsWith('/api/maturity/vintage'))
        return new Response(JSON.stringify({window:init?.method==='POST'?window_:null}),{status:200,headers:{'content-type':'application/json'}});
      if(url.startsWith('/api/cellar'))
        return new Response(JSON.stringify({items:[{...holding,vintageWindow:null}],total:1,bottles:6,nextOffset:null}),{status:200,headers:{'content-type':'application/json'}});
      return new Response(JSON.stringify({items:[],total:0,nextOffset:null}),{status:200,headers:{'content-type':'application/json'}});
    }));
    vi.resetModules();
    const {default:CellarPage}=await import('../../src/features/cellar/CellarPage');
    render(<MemoryRouter initialEntries={['/journal?scope=cellar']}><CellarPage/></MemoryRouter>);
    await screen.findByText('Feudo di Mezzo');
    const listed=()=>(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
      .filter(([url])=>String(url).startsWith('/api/cellar')).length;
    const before=listed();
    fireEvent.click(screen.getByRole('button',{name:'Edit'}));
    fireEvent.click(await screen.findByRole('button',{name:'Look up 2020'}));
    // The answer is filed per region and year, so it is not only this bottle's:
    // every row in the cell has a window it did not have a moment ago.
    await waitFor(()=>expect(listed()).toBeGreaterThan(before));
  });

  it('reads as the journal list does on a phone',async()=>{
    // A stack of bordered cards fitted two to a screen. The rows share one
    // panel and a hairline apiece, the same treatment the journal already uses.
    const css=(await import('node:fs')).readFileSync('src/cellar.css','utf8');
    const phone=css.match(/@media \(max-width:700px\)\{[\s\S]*?\n\}/)![0];
    expect(phone).toMatch(/\.cellar-card\{[^}]*border:0/);
    expect(phone).toMatch(/\.cellar-card\{[^}]*border-bottom:1px solid var\(--sunken\)/);
    expect(phone).toMatch(/\.cellar-list\{[^}]*gap:0/);
    // and the actions stay on one row rather than stacking into three
    expect(css).not.toMatch(/\.cellar-card-actions\{[^}]*flex-direction:column/);
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
