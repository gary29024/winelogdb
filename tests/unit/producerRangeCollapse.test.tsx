// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';

const authState=vi.hoisted(()=>({role:null as 'owner'|'member'|null}));
vi.mock('../../src/lib/auth/client',async importOriginal=>({...await importOriginal<object>(),apiFetch:(...args:Parameters<typeof fetch>)=>fetch(...args),getAccount:()=>authState.role?{id:authState.role,email:`${authState.role}@example.com`,display_name:authState.role,role:authState.role,status:'active'}:null}));

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
  catalogCuvees:[],cuveeCatalogLinks:[],tastedWines:[],linkedProducers:[],supplementaryContacts:[],catalogDecisions:[],
  researchHistoryCount:0,sources:[],researchModel:null,researchedAt:null
};

let root:Root|null=null,host:HTMLDivElement|null=null;

let posted:Array<{url:string;body:unknown}>=[];

async function render(over:Record<string,unknown>={},options:{role?:'owner'|'member';researchRun?:Record<string,unknown>}={}){
  posted=[];
  authState.role=options.role??null;
  vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
    const target=String(url);
    if(init?.method==='POST'){posted.push({url:target,body:JSON.parse(String(init.body??'{}'))});return new Response(JSON.stringify({id:'d1',deleted:true}),{status:200,headers:{'content-type':'application/json'}})}
    if(target.includes('/name-suggestions'))return new Response(JSON.stringify({items:[]}),{status:200,headers:{'content-type':'application/json'}});
    if(target.includes('/research-status'))return options.researchRun?new Response(JSON.stringify(options.researchRun),{status:200,headers:{'content-type':'application/json'}}):new Response(null,{status:404});
    if(target.endsWith('/api/producers'))return new Response(JSON.stringify({items:[]}),{status:200,headers:{'content-type':'application/json'}});
    return new Response(JSON.stringify({...detail,...over}),{status:200,headers:{'content-type':'application/json'}});
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

const byLabel=(text:string)=>[...(host?.querySelectorAll('button')??[])].find(node=>node.textContent?.trim()===text);
const fixButtons=()=>[...(host?.querySelectorAll('.catalog-fix')??[])] as HTMLButtonElement[];
const axisTabs=()=>[...(host?.querySelectorAll('.range-axis-tabs button')??[])] as HTMLButtonElement[];
const rangeFilters=()=>[...(host?.querySelectorAll('.range-filters button')??[])] as HTMLButtonElement[];

beforeEach(()=>{window.localStorage.clear();vi.spyOn(window,'confirm').mockReturnValue(true)});
afterEach(()=>{
  if(root)act(()=>root!.unmount());
  host?.remove();root=null;host=null;authState.role=null;vi.unstubAllGlobals();vi.restoreAllMocks();window.localStorage.clear();
});

describe('Producer wine range',()=>{
  it('opens a shared tasting using the shared wine route',async()=>{
    await render({tastedWines:[{id:'shared-wine',wineName:'Clos de la Roche',vintage:2020,wineStyle:'red',shared:true}]});
    expect(host?.querySelector('.tasted-row-link')?.getAttribute('href')).toBe('/shared/shared-wine');
  });

  it('confirms and sends only range refresh for an already researched producer',async()=>{
    await render({researchedAt:'2020-01-01T00:00:00.000Z',profileResearchedAt:'2020-01-01T00:00:00.000Z'});
    await click(byLabel('Refresh wine range')!);
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('wine range only'));
    expect(window.confirm).not.toHaveBeenCalledWith(expect.stringContaining('home location'));
    expect(posted[0]).toMatchObject({body:{rangeOnly:true,refreshProfile:false}});
  });
  it.each([['Research producer',false],['Refresh profile & range',true]] as const)('sends the explicit profile choice from %s',async(label,refreshProfile)=>{
    await render();
    await click(byLabel(label)!);
    expect(posted[0]).toMatchObject({url:'/api/producers/p1/research',body:{refreshProfile,confirmation:'RUN_PRODUCER_RESEARCH'}});
  });

  it('shows members one producer research action and omits the completed-run card',async()=>{
    await render({researchedAt:'2026-09-18T10:00:00.000Z',profileResearchedAt:'2026-09-18T10:00:00.000Z'},
      {role:'member',researchRun:{requestId:'member-run',producerId:'p1',status:'complete',stage:'complete',attempt:1,message:'done',startedAt:'2026-09-18T09:57:00.000Z',updatedAt:'2026-09-18T10:00:00.000Z',completedAt:'2026-09-18T10:00:00.000Z',durationMs:163700}});
    expect(byLabel('Refresh profile')).toBeTruthy();
    expect(byLabel('Research producer')).toBeUndefined();
    expect(host!.querySelector('.producer-research-status.complete')).toBeNull();
    expect(host!.textContent).not.toContain('Research complete');
  });

  it('keeps inherited friend research visible while offering the member their own research action',async()=>{
    await render({profile:'Profile researched by a friend.',researchedAt:'2026-09-01T00:00:00.000Z',profileResearchedAt:null,researchContributorId:'alice'},{role:'member'});
    expect(host!.textContent).toContain('Profile researched by a friend.');
    expect(byLabel('Research producer')).toBeTruthy();
    expect(byLabel('Refresh profile')).toBeUndefined();
    await click(byLabel('Research producer')!);
    expect(posted[0]).toMatchObject({url:'/api/producers/p1/research',body:{refreshProfile:true,confirmation:'RUN_PRODUCER_RESEARCH'}});
  });

  it('hides the producer-wide research footnote from members',async()=>{
    await render({winemakingPractices:'Traditional élevage.'},{role:'member'});
    expect(host!.textContent).toContain('Traditional élevage.');
    expect(host!.textContent).not.toContain('Producer-wide context only. Exact cuvée/vintage techniques are researched separately on the wine page.');
  });

  it('opens on the cru mix, because that is what a Burgundy range is about',async()=>{
    // It grouped by style only, which is the least interesting of the three
    // axes here: two grand crus and a village wine is the fact about Dujac,
    // and "Red 2, White 1" is not.
    await render();
    expect(groups()).toHaveLength(2);
    expect(axisTabs().find(button=>button.classList.contains('active'))?.textContent).toBe('Classification');
    expect(toggles().map(button=>button.querySelector('.catalog-group-name')?.textContent)).toEqual(['Grand Cru','Village / appellation']);
    expect(toggles().map(button=>button.querySelector('.catalog-group-count')?.textContent)).toEqual(['2','1']);
    expect(toggles().every(button=>button.getAttribute('aria-expanded')==='true')).toBe(true);
    expect(panels().every(panel=>!panel.hidden)).toBe(true);
    expect(host?.querySelector('.producer-range-head strong')?.textContent).toContain('3 wines · 2 tiers');
  });

  it('falls back to style where nothing is classified, rather than one group called Other',async()=>{
    // A Napa producer has no cru tier and one appellation, so opening on either
    // would put every wine in a single group and say nothing at all.
    await render({catalog:[
      {name:'Cabernet Sauvignon',category:'red',appellation:'Napa Valley',classification:null,style:null,notes:null},
      {name:'Sauvignon Blanc',category:'white',appellation:'Napa Valley',classification:null,style:null,notes:null}
    ]});
    expect(axisTabs().find(button=>button.classList.contains('active'))?.textContent).toBe('Style');
    expect(toggles().map(button=>button.querySelector('.catalog-group-name')?.textContent)).toEqual(['Red','White']);
  });

  it('regroups the same wines when another axis is chosen',async()=>{
    await render();
    await click(axisTabs().find(button=>button.textContent==='Village')!);
    // A grand cru is its own appellation and is left standing as one: the
    // reference data does not say which commune it sits in.
    expect(toggles().map(button=>button.querySelector('.catalog-group-name')?.textContent))
      .toEqual(['Charmes-Chambertin','Clos de la Roche','Morey-Saint-Denis']);
    expect(host?.querySelector('.producer-range-head strong')?.textContent).toContain('3 villages');
    await click(axisTabs().find(button=>button.textContent==='Style')!);
    expect(toggles().map(button=>button.querySelector('.catalog-group-name')?.textContent)).toEqual(['Red','White']);
  });

  it('remembers the axis you chose, over the one it would have picked',async()=>{
    await render();
    await click(axisTabs().find(button=>button.textContent==='Style')!);
    if(root)act(()=>root!.unmount());
    host?.remove();
    await render();
    expect(axisTabs().find(button=>button.classList.contains('active'))?.textContent).toBe('Style');
  });

  it('narrows the list to one group without redrawing the shape of the range',async()=>{
    // The bar answers "what is this estate", which is not a question about the
    // filter. Showing 100% Grand Cru because Grand Cru is selected would be a
    // different and much less useful claim.
    await render();
    const before=[...host!.querySelectorAll('.composition-segment')].map(node=>(node as HTMLElement).style.width);
    await click(rangeFilters().find(button=>button.textContent?.startsWith('Grand Cru'))!);
    expect(groups()).toHaveLength(1);
    expect(toggles()[0].querySelector('.catalog-group-name')?.textContent).toBe('Grand Cru');
    expect([...host!.querySelectorAll('.composition-segment')].map(node=>(node as HTMLElement).style.width)).toEqual(before);
    await click(rangeFilters().find(button=>button.textContent?.startsWith('All'))!);
    expect(groups()).toHaveLength(2);
  });

  it('drops a filter that means nothing on the axis being switched to',async()=>{
    await render();
    await click(rangeFilters().find(button=>button.textContent?.startsWith('Grand Cru'))!);
    expect(groups()).toHaveLength(1);
    await click(axisTabs().find(button=>button.textContent==='Style')!);
    expect(groups()).toHaveLength(2);
  });

  it('shows the size of the estate before any of it is read',async()=>{
    await render();
    expect(host?.querySelector('.producer-header-stats')?.textContent).toBe('3 wines · 3 appellations');
  });

  it('never promises a member a range the page will not show them',async()=>{
    // The catalogue reaches every viewer's browser whatever their role, but the
    // range is owner-only. Counting it unconditionally put "3 wines · 3
    // appellations" above a page that then showed a member no range at all.
    await render({},{role:'member'});
    expect(host?.querySelector('.producer-range'),'members get profile and contacts only').toBeNull();
    expect(host?.querySelector('.producer-header-stats')?.textContent??'').not.toContain('wines');
    expect(host?.querySelector('.producer-header-stats')?.textContent??'').not.toContain('appellation');
  });

  it('still counts a member’s own tastings, which are theirs and are on the page',async()=>{
    await render({tastedWines:[
      {id:'w1',wineName:'Clos de la Roche',vintage:2019,wineStyle:'red',grapes:[],appellation:null,region:'Burgundy',
       rating:null,tastingDate:'2026-01-01',imageId:null,cuveeId:'c1',catalogCuveeId:null,releaseParentCuveeId:null,
       releaseParentName:null,releaseDesignation:null,releaseSequence:null},
      {id:'w2',wineName:'Clos de la Roche',vintage:2018,wineStyle:'red',grapes:[],appellation:null,region:'Burgundy',
       rating:null,tastingDate:'2026-02-01',imageId:null,cuveeId:'c1',catalogCuveeId:null,releaseParentCuveeId:null,
       releaseParentName:null,releaseDesignation:null,releaseSequence:null}
    ]},{role:'member'});
    // Two bottles of one cuvée is one wine tasted, not two.
    expect(host?.querySelector('.producer-header-stats')?.textContent).toBe('1 tasted');
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

  it('records a duplicate as merged into the wine that is kept',async()=>{
    await render();
    // Rows sort by classification then name, so Charmes-Chambertin is first.
    await click(fixButtons()[0]);
    const select=host!.querySelector('.catalog-fix-merge select') as unknown as HTMLSelectElement;
    // Every other wine in the range is offered as the survivor, across styles.
    // Named by style, not by the pivot that happens to be showing: which wine
    // survives a merge is a question about the wines.
    expect([...select.options].slice(1).map(option=>option.textContent)).toEqual([
      'Clos de la Roche · Red','Morey-Saint-Denis Blanc · Morey-Saint-Denis · White'
    ]);
    const merge=host!.querySelector('.catalog-fix-merge button') as HTMLButtonElement;
    expect(merge.disabled).toBe(true);
    select.value=select.options[1].value;
    await act(async()=>{select.dispatchEvent(new Event('change',{bubbles:true}))});
    await click(host!.querySelector('.catalog-fix-merge button') as HTMLButtonElement);
    const request=posted.find(item=>item.url.includes('/catalog-decisions'));
    expect(request?.body).toMatchObject({
      confirmation:'CORRECT_PRODUCER_CATALOG',decision:'merge',
      sourceName:'Charmes-Chambertin',targetName:'Clos de la Roche'
    });
  });

  it('hides a wine from the range without choosing a merge target',async()=>{
    await render();
    await click(fixButtons()[1]);
    await click(host!.querySelector('.catalog-fix-panel > button.secondary-danger') as HTMLButtonElement);
    const request=posted.find(item=>item.url.includes('/catalog-decisions'));
    expect(request?.body).toMatchObject({decision:'hide',sourceName:'Clos de la Roche',targetKey:null});
  });

  it('lists applied corrections with an undo control',async()=>{
    await render({catalogDecisions:[
      {id:'d1',decision:'merge',sourceKey:'s1',sourceName:'Clos de la Roche Grand Cru',targetKey:'t1',targetName:'Clos de la Roche',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'}
    ]});
    const correction=host!.querySelector('.catalog-correction');
    expect(correction?.querySelector('strong')?.textContent).toBe('Clos de la Roche Grand Cru');
    expect(correction?.querySelector('span')?.textContent).toBe('Merged into Clos de la Roche');
    await click(correction!.querySelector('button') as HTMLButtonElement);
    expect(posted.some(item=>/\/catalog-decisions\/d1\/undo$/.test(item.url))).toBe(true);
  });

  it('lists the cuvees you have tasted alphabetically, not by when you drank them',async()=>{
    // Reported as: the tasted list came out in last-drunk order, which is the
    // Journal's question. On this page a cuvee is looked for by name, and one
    // that moves every time another bottle is opened cannot be found twice.
    const tasted=(wineName:string,tastingDate:string,vintage:number)=>({
      id:`w-${wineName}`,wineName,vintage,wineStyle:'red',grapes:['Nebbiolo'],
      appellation:null,region:'Piedmont',rating:null,tastingDate,imageId:null,
      cuveeId:`c-${wineName}`,catalogCuveeId:null,releaseParentCuveeId:null,
      releaseParentName:null,releaseDesignation:null,releaseSequence:null
    });
    await render({tastedWines:[
      tasted('Colli Tortonesi Timorasso Derthona','2026-08-27',2024),
      tasted('Barbaresco Valeirano','2026-08-27',2014),
      tasted('Barolo Campè','2026-08-18',2009),
      tasted('Barbera d’Asti Superiore Cà di Pian','2026-06-17',2023),
      tasted('Piemonte Chardonnay Lidia','2026-03-25',2020)
    ]});
    expect([...host!.querySelectorAll('.tasted-cuvee-title strong')].map(node=>node.textContent)).toEqual([
      'Barbaresco Valeirano',
      'Barbera d’Asti Superiore Cà di Pian',
      'Barolo Campè',
      'Colli Tortonesi Timorasso Derthona',
      'Piemonte Chardonnay Lidia'
    ]);
  });

  it('offers to delete a producer nothing is logged under, and not one that is',async()=>{
    // Reported as: correcting a bottle's producer leaves the one it used to be
    // behind, empty, with no way to remove it.
    await render();
    expect(byLabel('Delete this producer'),'nothing logged under it').toBeTruthy();
    await render({tastedWines:[{id:'w1',wineName:'Clos de la Roche',vintage:2019,wineStyle:'red',grapes:[],
      appellation:null,region:'Burgundy',rating:null,tastingDate:'2026-01-01',imageId:null,
      cuveeId:'c1',catalogCuveeId:null,releaseParentCuveeId:null,releaseParentName:null,
      releaseDesignation:null,releaseSequence:null}]});
    expect(byLabel('Delete this producer'),'merging is what moves the wines').toBeUndefined();
  });

  it('offers to throw away a photograph, and only when there is one',async()=>{
    // Reported as: research often comes back with a meaningless picture - a
    // stock close-up of grapes rather than the estate.
    await render();
    expect(byLabel('Remove this photo'),'no picture, nothing to remove').toBeUndefined();
    await render({heroImageAvailable:true});
    expect(byLabel('Remove this photo')).toBeTruthy();
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
