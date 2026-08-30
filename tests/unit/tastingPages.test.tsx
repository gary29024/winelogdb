// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { afterEach,describe,expect,it,vi } from 'vitest';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const tasting={id:'t1',name:'Burgundy portfolio',tastingDate:'2026-08-28',venue:'Clubhouse',
  startedAt:'2026-08-28T10:00:00.000Z',endedAt:null,lastWineAt:null,
  createdAt:'2026-08-28T10:00:00.000Z',updatedAt:'2026-08-28T10:00:00.000Z'};

const wine=(over:Record<string,unknown>={})=>({
  wineId:'w1',producer:'Domaine Dujac',wineName:'Morey-Saint-Denis',vintage:2019,wineStyle:'red',
  appellation:'Morey-Saint-Denis',region:'Burgundy',country:'France',
  rating:93,consumedAt:'2026-08-28',notes:'',imageId:null,...over
});

let root:Root|null=null,host:HTMLDivElement|null=null;
afterEach(()=>{act(()=>root?.unmount());host?.remove();root=null;host=null;vi.unstubAllGlobals()});

const json=(body:unknown)=>new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});

function stubApi(routes:Record<string,unknown>){
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
    const path=String(url);
    for(const [match,body] of Object.entries(routes))if(path.includes(match))return json(body);
    return json({});
  }));
}

async function renderDetail(detail:unknown){
  stubApi({'/api/tastings/active':{tasting:null},'/api/tastings/t1':detail});
  vi.resetModules();
  const {TastingDetailPage}=await import('../../src/features/tastings/TastingDetailPage');
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
  await act(async()=>{root!.render(
    <MemoryRouter initialEntries={['/tastings/t1']}><Routes><Route path="/tastings/:id" element={<TastingDetailPage/>}/></Routes></MemoryRouter>)});
  return host;
}

async function renderList(items:unknown[]){
  stubApi({'/api/tastings/active':{tasting:null},'/api/tastings':{items}});
  vi.resetModules();
  const {TastingsPage}=await import('../../src/features/tastings/TastingsPage');
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
  await act(async()=>{root!.render(<MemoryRouter><TastingsPage/></MemoryRouter>)});
  return host;
}
const summary=(over:Record<string,unknown>={})=>({...tasting,startedAt:null,endedAt:null,wineCount:3,averageRating:92.5,...over});
const headings=()=>[...host!.querySelectorAll('.tasting-month-heading')].map(node=>node.textContent);
const namesIn=(index:number)=>[...host!.querySelectorAll('.tasting-month')[index].querySelectorAll('.tasting-row-name')]
  .map(node=>node.textContent?.replace('In progress',''));

async function renderShell(active:unknown){
  stubApi({'/api/tastings/active':{tasting:active}});
  vi.resetModules();
  const {Layout}=await import('../../src/components/Layout');
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
  await act(async()=>{root!.render(
    <MemoryRouter initialEntries={['/']}><Routes><Route element={<Layout/>}><Route index element={<p>Passport</p>}/></Route></Routes></MemoryRouter>)});
  return host;
}

describe('one tasting page',()=>{
  it('lists the lineup in pour order, numbered',async()=>{
    // The order the server sends is the order they were poured, so the page
    // must not re-sort it into anything cleverer.
    await renderDetail({tasting:{...tasting,endedAt:'2026-08-28T23:00:00.000Z'},documents:[],
      wines:[wine({wineId:'w1',wineName:'Chambolle'}),wine({wineId:'w2',wineName:'Morey'}),wine({wineId:'w3',wineName:'Clos de la Roche'})]});
    const rows=[...host!.querySelectorAll('.tasting-lineup li')];
    expect(rows.map(row=>row.querySelector('.tasting-pour-number')?.textContent)).toEqual(['1','2','3']);
    expect(rows.map(row=>row.querySelector('strong')?.textContent)).toEqual(['Chambolle','Morey','Clos de la Roche']);
  });

  it('shows the same wine twice when it was poured twice',async()=>{
    // Two pours, not one duplicate: collapsing them would lose a glass.
    await renderDetail({tasting,documents:[],wines:[wine(),wine()]});
    expect(host!.querySelectorAll('.tasting-lineup li')).toHaveLength(2);
  });

  it('offers to end an open tasting and to reopen a closed one',async()=>{
    await renderDetail({tasting,documents:[],wines:[wine()]});
    expect(host!.textContent).toContain('End tasting');
    expect(host!.textContent).toContain('In progress');
  });

  it('offers to log a wine from the page you are sitting on',async()=>{
    // Reported: there was no way to save a wine from here at all. During a
    // tasting this is the thing you do repeatedly, so needing the nav's Scan
    // Wine - two taps from the evening already on screen - was the wrong shape.
    await renderDetail({tasting,documents:[],wines:[]});
    const log=[...host!.querySelectorAll('a')].find(node=>node.textContent==='Log a wine');
    expect(log).toBeTruthy();
    expect(log?.getAttribute('href')).toBe('/upload');
  });

  it('drops that offer once the evening is over',async()=>{
    // A closed tasting no longer captures new saves, so the button would be a
    // lie: the wine would be logged outside it.
    await renderDetail({tasting:{...tasting,endedAt:'2026-08-28T23:00:00.000Z'},documents:[],wines:[]});
    expect([...host!.querySelectorAll('a')].some(node=>node.textContent==='Log a wine')).toBe(false);
  });

  it('offers the wine list once, on the card that holds it',async()=>{
    // The scan entry used to sit in the action row as well as on the Wine list
    // card, so two buttons on one screen looked like the same thing twice.
    await renderDetail({tasting,documents:[],wines:[]});
    const scans=[...host!.querySelectorAll('a')].filter(node=>node.getAttribute('href')==='/tastings/t1/sheet');
    expect(scans).toHaveLength(1);
    expect(scans[0].closest('.tasting-documents')).toBeTruthy();
  });

  it('says what an empty evening is waiting for',async()=>{
    await renderDetail({tasting,documents:[],wines:[]});
    expect(host!.querySelector('.tasting-empty')?.textContent).toContain('Every wine you log while this is open joins it');
  });

  it('takes a wine list on a tasting that is already closed',async()=>{
    // The sheet is handed out at the end, so this control cannot be gated on
    // the evening still being open.
    await renderDetail({tasting:{...tasting,endedAt:'2026-08-28T23:00:00.000Z'},documents:[],wines:[]});
    expect(host!.querySelector('.tasting-documents')?.textContent).toContain('Scan & read prices');
  });
});

describe('finding the tastings you have logged',()=>{
  it('is reachable from the shell, not only from a tasting already open',async()=>{
    // The list page shipped with no way in: the only links to it were the back
    // pills on a tasting's own page, which you could reach only while one was
    // open. So a finished evening was unreachable the next morning.
    await renderShell(null);
    const nav=host!.querySelector('.desktop-nav')!;
    const link=[...nav.querySelectorAll('a')].find(node=>node.textContent==='Tastings');
    expect(link?.getAttribute('href')).toBe('/tastings');
  });

  it('sits in the journal beside the All wines / Favorites switch',async()=>{
    // Deliberately a sibling of the tablist rather than a child of it: a
    // role="tablist" may only contain tabs, and this is a link to another page.
    stubApi({'/api/tastings/active':{tasting:null},'/api/wines':{items:[],nextOffset:null,total:0},
      '/api/journal':{items:[],nextOffset:null,total:0}});
    vi.resetModules();
    const {LibraryPage}=await import('../../src/features/wines/LibraryPage');
    host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
    await act(async()=>{root!.render(<MemoryRouter initialEntries={['/journal']}><LibraryPage/></MemoryRouter>)});

    const link=host.querySelector('.journal-tastings-link') as HTMLAnchorElement;
    expect(link?.getAttribute('href')).toBe('/tastings');
    const row=host.querySelector('.journal-scope-row')!;
    expect(link.parentElement).toBe(row);
    expect(link.closest('[role="tablist"]')).toBeNull();
    expect(row.querySelector('.journal-scope-tabs')).toBeTruthy();
  });

  it('keeps the mobile tab bar at five, which is what fits',async()=>{
    // A sixth tab does not fit at 390px, so the phone route in is the journal's
    // own link rather than another tab.
    await renderShell(null);
    expect(host!.querySelector('.mobile-nav')!.textContent).toBe('PassportJournalScan WineProducersInsights');
  });
});

describe('the tastings list, grouped by month',()=>{
  it('splits the evenings into months, newest first',async()=>{
    await renderList([
      summary({id:'a',name:'August late',tastingDate:'2026-08-29'}),
      summary({id:'b',name:'August early',tastingDate:'2026-08-02'}),
      summary({id:'c',name:'July one',tastingDate:'2026-07-14'})
    ]);
    expect(headings()).toEqual(['Aug 2026','Jul 2026']);
    expect(namesIn(0)).toEqual(['August late','August early']);
    expect(namesIn(1)).toEqual(['July one']);
  });

  it('files an undated tasting by when it was created',async()=>{
    await renderList([summary({id:'a',name:'Undated',tastingDate:null,createdAt:'2026-06-11T10:00:00.000Z'})]);
    expect(headings()).toEqual(['Jun 2026']);
  });

  it('leads its own month with the open one, not the whole page',async()=>{
    // The server pins the open tasting to the very top, which would put a
    // reopened July evening under an August heading. Grouped, it belongs to the
    // month it actually happened in - the live strip is what makes it findable.
    await renderList([
      summary({id:'open',name:'Reopened July',tastingDate:'2026-07-20',startedAt:'2026-07-20T10:00:00.000Z'}),
      summary({id:'a',name:'August one',tastingDate:'2026-08-15'}),
      summary({id:'b',name:'July other',tastingDate:'2026-07-28'})
    ]);
    expect(headings()).toEqual(['Aug 2026','Jul 2026']);
    expect(namesIn(0)).toEqual(['August one']);
    expect(namesIn(1)).toEqual(['July other','Reopened July']);
    expect(host!.querySelector('.tasting-row.is-open')?.textContent).toContain('Reopened July');
  });

  it('never repeats a month heading, however the rows arrive',async()=>{
    // The reduce only starts a new group when the key changes, so an unsorted
    // list would produce Aug, Jul, Aug rather than two groups.
    await renderList([
      summary({id:'a',name:'One',tastingDate:'2026-08-02'}),
      summary({id:'b',name:'Two',tastingDate:'2026-07-14'}),
      summary({id:'c',name:'Three',tastingDate:'2026-08-29'})
    ]);
    expect(headings()).toEqual(['Aug 2026','Jul 2026']);
  });

  it('still says so when there is nothing to group',async()=>{
    await renderList([]);
    expect(host!.querySelector('.empty')?.textContent).toContain('No tastings yet');
  });
});

describe('the scan sheet',()=>{
  const openSheet=async()=>{
    const trigger=host!.querySelector('.mobile-nav .scan-nav')!;
    await act(async()=>{trigger.dispatchEvent(new MouseEvent('click',{bubbles:true}))});
    return host!.querySelector('.scan-sheet-grid')!;
  };

  it('offers four ways in, two per row',async()=>{
    await renderShell(null);
    const grid=await openSheet();
    expect([...grid.querySelectorAll('.scan-sheet-action strong')].map(node=>node.textContent))
      .toEqual(['Single Wine','Group Photo','Batch Scan','Start Tasting']);
  });

  it('turns the fourth into a way back into the evening already running',async()=>{
    await renderShell(tasting);
    const grid=await openSheet();
    const actions=[...grid.querySelectorAll('.scan-sheet-action')];
    expect(actions[3].querySelector('strong')?.textContent).toBe('Tasting in progress');
    expect(actions[3].textContent).toContain('Burgundy portfolio');
    expect(actions[3].className).toContain('is-live');
  });

  it('shows the live strip in flow above the page, not over the nav',async()=>{
    // A second fixed element in the band above the tab bar would collide with
    // the wine form's save bar on exactly the screen you are on all evening.
    await renderShell(tasting);
    const strip=host!.querySelector('.live-tasting-strip');
    expect(strip?.textContent).toContain('Burgundy portfolio');
    expect(strip?.closest('main')).toBeTruthy();
  });

  it('leaves the strip out when nothing is open',async()=>{
    await renderShell(null);
    expect(host!.querySelector('.live-tasting-strip')).toBeNull();
  });
});
