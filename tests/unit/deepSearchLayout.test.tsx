// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const deepSearch={
  summary:'A structured, age-worthy Pomerol from a cool, late vintage.',
  vintageQuality:'2014 was a cool, late growing season rescued by a dry September.',
  producerDetails:'Family owned since the 19th century, on the Pomerol plateau.',
  producerWinemakingPractices:'Hand harvested and double sorted across all estate parcels.',
  winemakingTechniques:'Aged in French oak barriques for 18 to 22 months with 50% new oak.',
  terroir:'Sits at the summit of the Pomerol plateau on deep gravel over crasse de fer.',
  drinkingWindow:'Drinking well from 2020 through 2045.',
  sources:[
    {title:'wine.com',url:'https://wine.com/product/la-fleur-petrus-2014'},
    {title:'wine.com',url:'https://wine.com/search?q=la-fleur-petrus'},
    {title:'moueix.com',url:'https://moueix.com/en/la-fleur-petrus'},
    {title:'Neal Martin review',url:'https://wine-searcher.com/critics/neal-martin/la-fleur-petrus-2014'}
  ],
  model:'gemini-3.7-flash (batch)',
  researchedAt:'2026-08-24T00:00:00.000Z',
  quality:{
    status:'mixed' as const,score:80,sourceTier:'grounded' as const,
    warnings:['vintage-specific-detail-in-producer-scope'],fields:{}
  },
  provenance:{
    version:1 as const,
    fields:{
      summary:{claimCount:1,supportedCount:1,partialCount:0,unsupportedCount:0,uncertaintyCount:0,conflictingCount:0,directSupportRatio:1,
        claims:[{claim:'A structured, age-worthy Pomerol from a cool, late vintage.',supportStatus:'supported' as const,sourceTier:'grounded' as const,sources:[{title:'wine.com',url:'https://wine.com/product/la-fleur-petrus-2014'}]}]},
      terroir:{claimCount:1,supportedCount:1,partialCount:0,unsupportedCount:0,uncertaintyCount:0,conflictingCount:0,directSupportRatio:1,
        claims:[{claim:'Sits at the summit of the Pomerol plateau on deep gravel over crasse de fer.',supportStatus:'supported' as const,sourceTier:'grounded' as const,sources:[{title:'moueix.com',url:'https://moueix.com/en/la-fleur-petrus'}]}]}
    }
  }
};

const wine=(over:Record<string,unknown>={})=>({
  id:'w1',ownerId:'o',producer:'Château La Fleur-Pétrus',wineName:'Château La Fleur-Pétrus',vintage:2014,
  country:'France',region:'Bordeaux',appellation:'Pomerol',classification:null,
  grapes:['Merlot','Cabernet Franc'],grapeBlend:[],wineStyle:'red',alcoholPercentage:14.5,
  tastingNotes:'',rating:null,tastingDate:null,event:null,venue:null,tastingName:null,
  locationName:null,latitude:null,longitude:null,producerId:null,favorite:false,deepSearch,
  price:null,currency:null,tags:[],imageIds:[],imageObjectKeys:[],recognitionStatus:'complete',
  recognitionConfidence:null,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',
  tastingStructure:null,groupSourcePhotos:[],...over
});

const sharedDeepSearch={
  summary:deepSearch.summary,vintageQuality:deepSearch.vintageQuality,producerDetails:deepSearch.producerDetails,
  producerWinemakingPractices:deepSearch.producerWinemakingPractices,winemakingTechniques:deepSearch.winemakingTechniques,
  terroir:deepSearch.terroir,drinkingWindow:deepSearch.drinkingWindow,sources:deepSearch.sources,researchedAt:deepSearch.researchedAt
};
const sharedWine=()=>({
  id:'w1',ownerName:'Alice',producer:'Château La Fleur-Pétrus',producerId:null,wineName:'Château La Fleur-Pétrus',vintage:2014,
  country:'France',region:'Bordeaux',appellation:'Pomerol',recognizedRegion:null,recognizedAppellation:null,
  wineStyle:'red',grapes:['Merlot','Cabernet Franc'],grapeBlend:[],classification:null,alcoholPercentage:14.5,
  deepSearch:sharedDeepSearch,sparklingDetails:null,favorite:false,updatedAt:'2026-01-01T00:00:00.000Z',photos:[],
  tastingNotes:'',rating:null,tastingDate:null,tastingName:null,venue:null,locationName:null,price:null,currency:null,structure:null
});

let root:Root|null=null,host:HTMLDivElement|null=null;

async function render(over:Record<string,unknown>={},run:Record<string,unknown>|null=null){
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(
    JSON.stringify(String(url).includes('/deep-search-status')?run:String(url).includes('/research')?{runs:[]}:wine(over)),
    {status:200,headers:{'content-type':'application/json'}})));
  vi.resetModules();
  const {DetailPage}=await import('../../src/features/wines/DetailPage');
  host=document.createElement('div');
  document.body.appendChild(host);
  root=createRoot(host);
  await act(async()=>{root!.render(<MemoryRouter initialEntries={['/wines/w1']}>
    <Routes><Route path="/wines/:id" element={<DetailPage/>}/></Routes>
  </MemoryRouter>)});
  return host;
}

async function renderShared(over:Record<string,unknown>={}){
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>String(url).includes('/deep-search-status')
    ?new Response(JSON.stringify({error:'Research run not found'}),{status:404,headers:{'content-type':'application/json'}})
    :new Response(JSON.stringify({...sharedWine(),...over}),{status:200,headers:{'content-type':'application/json'}})));
  vi.resetModules();
  const {SharedWinesPage}=await import('../../src/features/wines/SharedWinesPage');
  host=document.createElement('div');
  document.body.appendChild(host);
  root=createRoot(host);
  await act(async()=>{root!.render(<MemoryRouter initialEntries={['/shared/wines/w1']}>
    <Routes><Route path="/shared/wines/:id" element={<SharedWinesPage/>}/></Routes>
  </MemoryRouter>)});
  return host;
}

const sectionToggles=()=>[...(host?.querySelectorAll('.deep-section-toggle')??[])] as HTMLButtonElement[];
const sectionBodies=()=>[...(host?.querySelectorAll('.deep-section-body')??[])] as HTMLElement[];
const click=async(button:HTMLButtonElement)=>{await act(async()=>{button.click()})};

beforeEach(()=>{window.localStorage.clear()});
afterEach(()=>{
  act(()=>root?.unmount());
  host?.remove();
  root=null;host=null;
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('Deep Search research sections',()=>{
  it('distinguishes an expired uncertain outcome from a definite failure on reopening',async()=>{
    await render({deepSearch:null},{requestId:'uncertain-request',wineId:'w1',status:'failed',stage:'failed',outcome:'uncertain',retryBlocked:false});
    expect(host!.querySelector('.deep-search-panel')!.textContent).toContain('WineLog could not confirm the research outcome.');
  });
  it('restores a definite failure after reopening with a safe message and Support ID',async()=>{
    await render({deepSearch:null},{requestId:'failed-request',wineId:'w1',status:'failed',stage:'failed',message:'Gemini internal diagnostic',retryBlocked:false});
    const panel=host!.querySelector('.deep-search-panel')!;
    expect(panel.textContent).toContain('Retry Deep Search');expect(panel.textContent).toContain('Support ID failed-request');expect(panel.textContent).not.toContain('Gemini internal diagnostic');
  });
  it('restores a friend follower after reopening without starting a new request',async()=>{
    await render({deepSearch:null},{requestId:'follow-request',wineId:'w1',status:'running',stage:'queued',waitingForFriend:true,creditOperationId:'follow-operation'});
    expect(host!.querySelector('.deep-search-panel')!.textContent).toContain('A friend is researching this wine.');
    expect(vi.mocked(fetch).mock.calls.some(([,init])=>init?.method==='POST')).toBe(false);
  });
  it.each([true,undefined])('keeps a held request visible on reopening and checks status without starting AI (flag %s)',async retryBlocked=>{
    const run={requestId:'held-request',wineId:'w1',status:'failed',stage:'failed',message:'Provider completion needs reconciliation',retryBlocked};
    await render({deepSearch:null},run);
    const panel=host!.querySelector('.deep-search-panel')!;
    expect(panel.textContent).toContain('Deep Search needs review.');
    expect(panel.textContent).toContain('Support ID held-request');
    expect(panel.textContent).not.toContain('Retry Deep Search');
    expect(panel.querySelector('.deep-error')?.textContent).not.toContain('Close');
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({...run,retryBlocked:false}));
    await click(panel.querySelector<HTMLButtonElement>('.deep-error button')!);
    expect(vi.mocked(fetch).mock.calls.some(([,init])=>init?.method==='POST')).toBe(false);
    expect(panel.textContent).toContain('Retry Deep Search');
    expect(panel.textContent).not.toContain('Deep Search needs review.');
  });

  it('reuses vintage-only research and queues missing sections without forcing a refresh',async()=>{
    await render({deepSearch:{...deepSearch,summary:'',producerDetails:'',producerWinemakingPractices:'',
      winemakingTechniques:'',terroir:'',drinkingWindow:''}});
    const panel=host!.querySelector('.deep-search-panel')!;
    expect(sectionToggles()).toHaveLength(1);
    expect(panel.textContent).toContain('Partial research is available');
    expect(panel.querySelector('.provenance-chip')).toBeNull();
    expect(panel.textContent).not.toContain('Refresh vintage research');
    const button=panel.querySelector<HTMLButtonElement>('button.primary')!;
    expect(button.textContent).toBe('Deep Search');
    await click(button);
    expect(panel.querySelector('.deep-confirm')?.textContent).toContain('researches only what is missing');
    const queue=panel.querySelector<HTMLButtonElement>('.deep-confirm button.primary')!;
    expect(queue.textContent).toBe('Queue Deep Search');
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({accepted:true,cached:true}),{status:200}));
    await click(queue);
    const request=vi.mocked(fetch).mock.calls.find(([url,init])=>String(url).endsWith('/deep-search')&&init?.method==='POST');
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({refresh:'none'});
  });

  it('keeps the vintage refresh action for complete research, including legacy results',async()=>{
    await render();
    const panel=host!.querySelector('.deep-search-panel')!;
    expect(panel.textContent).not.toContain('Partial research is available');
    expect(panel.querySelector('.provenance-chip')?.textContent).toBe('Researched');
    const button=panel.querySelector<HTMLButtonElement>('button.primary')!;
    expect(button.textContent).toBe('Refresh vintage research');
    await click(button);
    const queue=panel.querySelector<HTMLButtonElement>('.deep-confirm button.primary')!;
    expect(queue.textContent).toBe('Queue vintage refresh');
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({accepted:true,cached:true}),{status:200}));
    await click(queue);
    const request=vi.mocked(fetch).mock.calls.find(([url,init])=>String(url).endsWith('/deep-search')&&init?.method==='POST');
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({refresh:'vintage'});
  });

  it('does not require regional vintage research for a non-vintage wine',async()=>{
    await render({vintage:null,deepSearch:{...deepSearch,vintageQuality:''}});
    expect(host!.querySelector('.deep-search-panel button.primary')?.textContent).toBe('Refresh vintage research');
    expect(host!.textContent).not.toContain('Partial research is available');
  });

  it.each(['summary','producerDetails','producerWinemakingPractices','terroir','winemakingTechniques','drinkingWindow','vintageQuality'])(
    'offers Deep Search when %s is still missing',async field=>{
      await render({deepSearch:{...deepSearch,[field]:'   '}});
      expect(host!.querySelector('.deep-search-panel button.primary')?.textContent).toBe('Deep Search');
    });

  it('lists every populated scope collapsed by default',async()=>{
    await render();
    expect(sectionToggles()).toHaveLength(6);
    expect(sectionToggles().every(button=>button.getAttribute('aria-expanded')==='false')).toBe(true);
    expect(sectionBodies().every(body=>body.hidden)).toBe(true);
    expect(host?.querySelector('.deep-sections-head span')?.textContent).toBe('6 research sections');
  });

  it('always shows the summary, unlike the other sections',async()=>{
    await render();
    expect(host?.querySelector('.deep-summary')?.textContent).toContain('A structured, age-worthy Pomerol');
  });

  it('opens one section without disturbing the others',async()=>{
    await render();
    await click(sectionToggles()[0]);
    expect(sectionToggles()[0].getAttribute('aria-expanded')).toBe('true');
    expect(sectionBodies()[0].hidden).toBe(false);
    expect(sectionBodies()[1].hidden).toBe(true);
  });

  it('expands and collapses every section at once',async()=>{
    await render();
    const toggleAll=host!.querySelector('.deep-toggle-all') as HTMLButtonElement;
    expect(toggleAll.textContent).toBe('Expand all');
    await click(toggleAll);
    expect(sectionBodies().every(body=>!body.hidden)).toBe(true);
    expect((host!.querySelector('.deep-toggle-all') as HTMLButtonElement).textContent).toBe('Collapse all');
    await click(host!.querySelector('.deep-toggle-all') as HTMLButtonElement);
    expect(sectionBodies().every(body=>body.hidden)).toBe(true);
  });

  it('remembers which sections were opened across visits',async()=>{
    await render();
    await click(sectionToggles()[2]);
    act(()=>root?.unmount());host?.remove();
    await render();
    expect(sectionToggles()[0].getAttribute('aria-expanded')).toBe('false');
    expect(sectionToggles()[2].getAttribute('aria-expanded')).toBe('true');
  });

  it('shows a compact evidence count on a closed section',async()=>{
    // The summary count is visible before expanding, so a reader can tell a
    // section is worth opening without opening it first.
    await render();
    const summarySection=sectionToggles().find(button=>button.querySelector('.deep-section-name')?.textContent==='Vintage quality');
    expect(summarySection?.querySelector('.deep-section-meta')).toBeNull();
    const terroirSection=[...(host?.querySelectorAll('.deep-research-section')??[])].find(section=>section.querySelector('.deep-section-name')?.textContent==='Terroir');
    expect(terroirSection?.querySelector('.deep-section-meta')?.textContent).toBe('1 direct');
  });
});

describe('Deep Search quality',()=>{
  it('shows a compact pill in the header for every result',async()=>{
    await render();
    const pill=host?.querySelector('.deep-quality-pill');
    expect(pill?.textContent).toBe('Mixed confidence · 80/100');
    expect(pill?.className).toContain('mixed');
  });

  it('only shows the detailed warning box when there is a warning to explain',async()=>{
    await render();
    expect(host?.querySelector('.deep-quality')).not.toBeNull();
    act(()=>root?.unmount());host?.remove();
    await render({deepSearch:{...deepSearch,quality:{...deepSearch.quality,status:'verified',warnings:[]}}});
    expect(host?.querySelector('.deep-quality-pill')?.textContent).toBe('Verified · 80/100');
    expect(host?.querySelector('.deep-quality')).toBeNull();
  });
});

describe('Deep Search sources',()=>{
  it('groups repeated hosts instead of listing the same domain over and over',async()=>{
    await render();
    const groups=[...(host?.querySelectorAll('.deep-source-group')??[])];
    expect(groups).toHaveLength(3);
    const wineComGroup=groups.find(group=>group.querySelector('strong')?.textContent==='wine.com');
    expect(wineComGroup?.querySelectorAll('a')).toHaveLength(2);
  });

  it('labels a link by its page rather than repeating the bare hostname',async()=>{
    await render();
    const wineComGroup=[...(host?.querySelectorAll('.deep-source-group')??[])].find(group=>group.querySelector('strong')?.textContent==='wine.com');
    const labels=[...(wineComGroup?.querySelectorAll('a')??[])].map(a=>a.textContent);
    // Both links are on the same host and share the fallback "wine.com" title,
    // so the distinguishing label has to come from the page path instead.
    expect(labels).toContain('la fleur petrus 2014');
    expect(labels).toContain('search');
  });

  it('keeps a real page title when Gemini provided one',async()=>{
    await render();
    const critic=[...(host?.querySelectorAll('.deep-source-group a')??[])].find(a=>a.getAttribute('href')?.includes('wine-searcher'));
    expect(critic?.textContent).toBe('Neal Martin review');
  });

  it('is collapsed by default and summarises the count',async()=>{
    await render();
    const details=host?.querySelector('.deep-sources') as HTMLDetailsElement|null;
    expect(details?.open).toBe(false);
    expect(details?.querySelector('summary')?.textContent).toBe('4 sources · 3 websites');
  });

  it('shows nothing when there are no sources at all',async()=>{
    await render({deepSearch:{...deepSearch,sources:[]}});
    expect(host?.querySelector('.deep-sources')).toBeNull();
  });
});


describe('Shared Deep Search research sections',()=>{
  it('uses the same collapsed section controls as the owner page',async()=>{
    await renderShared();
    expect(sectionToggles()).toHaveLength(6);
    expect(sectionToggles().every(button=>button.getAttribute('aria-expanded')==='false')).toBe(true);
    expect(sectionBodies().every(body=>body.hidden)).toBe(true);
    expect(host?.querySelector('.deep-summary')?.textContent).toContain('A structured, age-worthy Pomerol');
    const toggleAll=host!.querySelector('.deep-toggle-all') as HTMLButtonElement;
    expect(toggleAll.textContent).toBe('Expand all');
    await click(toggleAll);
    expect(sectionBodies().every(body=>!body.hidden)).toBe(true);
    expect((host!.querySelector('.deep-toggle-all') as HTMLButtonElement).textContent).toBe('Collapse all');
  });

  it('remembers the same open sections across shared-wine visits',async()=>{
    await renderShared();
    await click(sectionToggles()[1]);
    act(()=>root?.unmount());host?.remove();
    root=null;host=null;
    await renderShared();
    expect(sectionToggles()[1].getAttribute('aria-expanded')).toBe('true');
    expect(sectionBodies()[1].hidden).toBe(false);
    expect(sectionBodies()[0].hidden).toBe(true);
  });
});

describe('Deep Search a recipient runs on a shared wine',()=>{
  const buttons=()=>[...(host?.querySelectorAll('.deep-search-panel button')??[])].map(button=>button.textContent);
  it('offers Deep Search for partial research and says the research is partial',async()=>{
    await renderShared({deepSearch:{...sharedDeepSearch,complete:false}});
    expect(host?.querySelector('.deep-search-panel')?.textContent).toContain('Partial research is available');
    expect(buttons()).toContain('Deep Search');
  });
  it('offers the vintage refresh once research is complete, as the owner page does',async()=>{
    await renderShared({deepSearch:{...sharedDeepSearch,complete:true}});
    expect(buttons()).toContain('Refresh vintage research');
  });
  it('offers Deep Search before anyone has researched the wine',async()=>{
    await renderShared({deepSearch:null});
    expect(host?.querySelector('.deep-search-panel')?.textContent).toContain('Enrich this wine with grounded research');
    expect(buttons()).toContain('Deep Search');
  });
  it('says the reader pays and the friend sees the result before queueing',async()=>{
    await renderShared({deepSearch:null});
    const start=[...host!.querySelectorAll<HTMLButtonElement>('.deep-search-panel button')].find(button=>button.textContent==='Deep Search')!;
    await click(start);
    expect(host?.querySelector('.deep-confirm')?.textContent).toContain('uses your own credits');
    expect(host?.querySelector('.deep-confirm')?.textContent).toContain('your friend can see the result');
  });
});
