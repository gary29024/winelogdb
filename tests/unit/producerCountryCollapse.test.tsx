// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const producer=(id:string,name:string,country:string,region='Burgundy',locality='Beaune')=>({
  id,ownerId:'o',canonicalName:name,aliases:[name],homeCountry:country,homeRegion:region,homeLocality:locality,
  tastedCount:2,catalogCount:5,heroImageAvailable:false,researchedAt:null
});
const library=[
  producer('p1','Domaine Dujac','France','Burgundy','Morey-Saint-Denis'),
  producer('p2','Château Margaux','France','Bordeaux','Margaux'),
  producer('p3','Gaja','Italy','Piedmont','Barbaresco'),
  producer('p4','Penfolds','Australia','South Australia','Barossa')
];

let root:Root|null=null,host:HTMLDivElement|null=null;

async function render(items=library){
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({items}),
    {status:200,headers:{'content-type':'application/json'}})));
  vi.resetModules();
  const {ProducersPage}=await import('../../src/features/producers/ProducersPage');
  host=document.createElement('div');
  document.body.appendChild(host);
  root=createRoot(host);
  await act(async()=>{root!.render(<MemoryRouter><ProducersPage/></MemoryRouter>)});
  return host;
}

// Every leaf that states the size of the library, ignoring the batch-research
// panel - it counts something else (producers never researched) and says so.
const libraryCounts=()=>[...(host?.querySelectorAll('*')??[])]
  .filter(el=>el.children.length===0&&!el.closest('.research-campaign')&&/\d+\s+(?:of\s+\d+\s+)?producers?\b/.test(el.textContent??''))
  .map(el=>el.textContent);
const toggles=()=>[...(host?.querySelectorAll('.country-group-toggle')??[])] as HTMLButtonElement[];
const bodies=()=>[...(host?.querySelectorAll('.producer-country-body')??[])] as HTMLElement[];
const named=(country:string)=>toggles().find(button=>button.querySelector('.country-group-name')?.textContent===country)!;
const click=async(el:HTMLElement)=>{await act(async()=>{el.click()})};
const type=async(value:string)=>{
  const input=host!.querySelector('.producer-search-field input') as HTMLInputElement;
  const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value')!.set!;
  await act(async()=>{setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))});
};

beforeEach(()=>{window.localStorage.clear()});
afterEach(()=>{
  act(()=>root?.unmount());
  host?.remove();root=null;host=null;
  vi.unstubAllGlobals();window.localStorage.clear();
});

describe('the producer library by country',()=>{
  it('opens as an index rather than the whole library',()=>{
    // The reported problem: every producer on screen at once stops working as
    // the library grows. Countries start closed so the page opens as a list of
    // places you can scan.
    return render().then(()=>{
      expect(toggles().map(button=>button.querySelector('.country-group-name')?.textContent))
        .toEqual(['Australia','France','Italy']);
      expect(bodies().every(body=>body.hidden)).toBe(true);
      expect(toggles().every(button=>button.getAttribute('aria-expanded')==='false')).toBe(true);
    });
  });

  it('counts the producers inside a country before you open it',async()=>{
    await render();
    expect(named('France').querySelector('.catalog-group-count')?.textContent).toBe('2');
    expect(named('Italy').querySelector('.catalog-group-count')?.textContent).toBe('1');
  });

  it('opens one country without disturbing the others',async()=>{
    await render();
    await click(named('France'));
    expect(named('France').getAttribute('aria-expanded')).toBe('true');
    const [australia,france,italy]=bodies();
    expect([australia.hidden,france.hidden,italy.hidden]).toEqual([true,false,true]);
  });

  it('remembers what was open across visits',async()=>{
    await render();
    await click(named('Italy'));
    act(()=>root?.unmount());host?.remove();
    await render();
    expect(named('Italy').getAttribute('aria-expanded')).toBe('true');
    expect(named('France').getAttribute('aria-expanded')).toBe('false');
  });

  it('expands and collapses every country at once',async()=>{
    await render();
    const toggleAll=()=>host!.querySelector('.range-toggle-all') as HTMLButtonElement;
    expect(toggleAll().textContent).toBe('Expand all');
    await click(toggleAll());
    expect(bodies().every(body=>!body.hidden)).toBe(true);
    expect(toggleAll().textContent).toBe('Collapse all');
    await click(toggleAll());
    expect(bodies().every(body=>body.hidden)).toBe(true);
  });

  it('opens everything while a search is running',async()=>{
    // A search that hid its own results inside a collapsed country would be a
    // trap - you would type a producer's name and see nothing.
    await render();
    await type('gaja');
    expect(host?.querySelectorAll('.producer-row')).toHaveLength(1);
    expect(host?.querySelector('.producer-row')?.textContent).toContain('Gaja');
    expect([...(host?.querySelectorAll('.producer-country-body')??[])].every(body=>!(body as HTMLElement).hidden)).toBe(true);
  });

  it('puts the countries back as they were when the search is cleared',async()=>{
    await render();
    await click(named('France'));
    await type('gaja');
    await type('');
    expect(named('France').getAttribute('aria-expanded')).toBe('true');
    expect(named('Italy').getAttribute('aria-expanded')).toBe('false');
  });

  it('states the size of the library once',async()=>{
    // It was printed twice: a caption under the search field and again in the
    // header above the countries, in two different sizes, which read as two
    // different numbers rather than one fact.
    await render();
    expect(libraryCounts()).toEqual(['3 countries · 4 producers']);
  });

  it('says how much of the library a search matched',async()=>{
    await render();
    await type('gaja');
    expect(libraryCounts()).toEqual(['1 country · 1 of 4 producers']);
  });

  it('does not make a single country collapsible',async()=>{
    // Collapsing the only group on the page hides everything and navigates
    // nowhere, so a one-country library keeps the plain heading.
    await render([producer('p1','Domaine Dujac','France')]);
    expect(toggles()).toHaveLength(0);
    expect(host?.querySelector('.range-toggle-all')).toBeNull();
    expect(host?.querySelectorAll('.producer-row')).toHaveLength(1);
  });
});
