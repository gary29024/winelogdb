// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
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

describe('back to the journal you left',()=>{
  it('carries the search, the filters and the page you were on',()=>{
    // The journal keeps nine things in the query string - query, favorite,
    // month, offset, country, rating, sort, style, tasting. A bare /journal
    // would drop all of them and land on an unfiltered page one, which is the
    // place you were trying not to go back to.
    const target={to:'/journal?query=roumier&style=red&offset=40',label:'Journal'};
    expect(backTargetFromState(linkFrom(target))).toEqual(target);
  });

  it('keeps the plain journal when nothing is filtered',()=>{
    expect(JOURNAL_BACK.to).toBe('/journal');
  });

  it('is what the journal page actually hands over',async()=>{
    // The whole chain rather than the shape: render the journal with filters
    // in the URL, click through to the wine, and read the back link.
    const journalWine={
      id:'w1',producer:'Domaine Georges Roumier',wineName:'Les Amoureuses',vintage:2019,
      country:'France',region:'Burgundy',appellation:'Chambolle-Musigny 1er Cru',
      grapes:['Pinot Noir'],wineStyle:'red',rating:97,favorite:false,imageIds:[],
      tastingName:null,venue:null,tastingDate:null,createdAt:'2026-01-01T00:00:00.000Z'
    };
    vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
      const path=String(url);
      const body=path.includes('/research')?{runs:[]}
        :/\/api\/wines\/w1(\?|$)/.test(path)?{...wine,id:'w1'}
        :{items:[journalWine],total:1};
      return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
    }));
    vi.resetModules();
    const {LibraryPage}=await import('../../src/features/wines/LibraryPage');
    const {DetailPage}=await import('../../src/features/wines/DetailPage');
    host=document.createElement('div');document.body.appendChild(host);
    root=createRoot(host);
    await act(async()=>{root!.render(
      <MemoryRouter initialEntries={['/journal?query=roumier&style=red&offset=40']}>
        <Routes>
          <Route path="/journal" element={<LibraryPage/>}/>
          <Route path="/wines/:id" element={<DetailPage/>}/>
        </Routes>
      </MemoryRouter>)});
    const card=host.querySelector('a.wine-card') as HTMLAnchorElement;
    expect(card,'the journal should have rendered a wine card').toBeTruthy();
    await act(async()=>{card.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0}))});
    const back=host.querySelector('.back-pill') as HTMLAnchorElement;
    expect(back,'the wine should have rendered').toBeTruthy();
    expect(back.getAttribute('href')).toBe('/journal?query=roumier&style=red&offset=40');
    expect(back.textContent).toBe('← Journal');
  });
});

describe('the group photo a wine came from',()=>{
  it('is dated by when the photo was taken, not when it was uploaded',async()=>{
    // A lineup photographed at dinner and uploaded the next morning belongs to
    // the dinner. The session stores both: capturedAt from EXIF, created_at
    // from the upload.
    vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(
      JSON.stringify(String(url).includes('/research')?{runs:[]}:{...wine,id:'w1',
        groupSourcePhotos:[{sessionId:'s1',createdAt:'2026-08-26T09:00:00.000Z',capturedAt:'2026-08-24T20:30:00.000Z'}]}),
      {status:200,headers:{'content-type':'application/json'}})));
    vi.resetModules();
    const {DetailPage}=await import('../../src/features/wines/DetailPage');
    host=document.createElement('div');document.body.appendChild(host);
    root=createRoot(host);
    await act(async()=>{root!.render(<MemoryRouter initialEntries={['/wines/w1']}>
      <Routes><Route path="/wines/:id" element={<DetailPage/>}/></Routes></MemoryRouter>)});
    const stamp=host.querySelector('.group-source-button > span:last-child')?.textContent;
    expect(stamp).toBe(new Date('2026-08-24T20:30:00.000Z').toLocaleDateString());
    expect(stamp).not.toBe(new Date('2026-08-26T09:00:00.000Z').toLocaleDateString());
  });

  it('falls back to the upload date when the camera recorded nothing',async()=>{
    // A screenshot, or a photo stripped of EXIF by a messaging app.
    vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(
      JSON.stringify(String(url).includes('/research')?{runs:[]}:{...wine,id:'w1',
        groupSourcePhotos:[{sessionId:'s1',createdAt:'2026-08-26T09:00:00.000Z',capturedAt:null}]}),
      {status:200,headers:{'content-type':'application/json'}})));
    vi.resetModules();
    const {DetailPage}=await import('../../src/features/wines/DetailPage');
    host=document.createElement('div');document.body.appendChild(host);
    root=createRoot(host);
    await act(async()=>{root!.render(<MemoryRouter initialEntries={['/wines/w1']}>
      <Routes><Route path="/wines/:id" element={<DetailPage/>}/></Routes></MemoryRouter>)});
    expect(host.querySelector('.group-source-button > span:last-child')?.textContent)
      .toBe(new Date('2026-08-26T09:00:00.000Z').toLocaleDateString());
  });

  afterEach(()=>{
    act(()=>root?.unmount());host?.remove();root=null;host=null;
    vi.unstubAllGlobals();window.sessionStorage.clear();
  });
});

describe('every page that links into a wine',()=>{
  it('hands over a target the wine will actually accept',()=>{
    // A rejected target falls back to the journal silently, so a call site that
    // gets it wrong looks like the feature simply not working rather than like
    // a bug. Catch it here instead.
    const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true})
      .flatMap(entry=>entry.isDirectory()?walk(join(dir,entry.name)):[join(dir,entry.name)]);
    const sources=walk(join(process.cwd(),'src')).filter(path=>path.endsWith('.tsx'))
      .map(path=>({file:path.split('/').pop()!,code:readFileSync(path,'utf8')}));

    const callSites=sources.flatMap(({file,code})=>
      [...code.matchAll(/linkFrom\(/g)].map(match=>{
        // take the balanced argument so a ternary inside it is not truncated
        let depth=0,end=match.index!+match[0].length-1;
        for(let at=end;at<code.length;at++){
          if('([{`'.includes(code[at]))depth++;
          else if(')]}'.includes(code[at])&&--depth===0){end=at;break}
        }
        return {file,arg:code.slice(match.index!+match[0].length,end)};
      }));
    // journal, producer, batch, group photo, passport, achievement
    expect(callSites.length).toBeGreaterThanOrEqual(6);

    const rejected=callSites.flatMap(site=>{
      const afterTo=site.arg.split(/\bto:/).slice(1).join(' ');
      // every string literal the `to` can evaluate to, ternary branches included
      const literals=[...afterTo.matchAll(/`([^`]*)`|'([^']*)'/g)]
        .map(match=>(match[1]??match[2]).replace(/\$\{[^}]*\}/g,'x'))
        .filter(literal=>literal.startsWith('/')||literal.includes('://')||literal.startsWith('javascript'));
      return literals
        .filter(literal=>!backTargetFromState(linkFrom({to:literal,label:'x'})))
        .map(literal=>`${site.file}: ${literal}`);
    });
    expect(rejected).toEqual([]);
  });
});
