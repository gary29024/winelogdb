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

  it('says what an empty evening is waiting for',async()=>{
    await renderDetail({tasting,documents:[],wines:[]});
    expect(host!.querySelector('.tasting-empty')?.textContent).toContain('Every wine you log while this is open joins it');
  });

  it('takes a wine list on a tasting that is already closed',async()=>{
    // The sheet is handed out at the end, so this control cannot be gated on
    // the evening still being open.
    await renderDetail({tasting:{...tasting,endedAt:'2026-08-28T23:00:00.000Z'},documents:[],wines:[]});
    expect(host!.querySelector('.tasting-documents')?.textContent).toContain('Add wine list');
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
