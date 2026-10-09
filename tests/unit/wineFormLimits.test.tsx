// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,describe,expect,it,vi } from 'vitest';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const initial={
  producer:'Domaine Dujac',wineName:'Clos de la Roche',vintage:2019,country:'France',region:'Burgundy',
  appellation:'Clos de la Roche',grapes:['Pinot Noir'],grapeBlend:[{grape:'Pinot Noir',percentage:null}],
  tags:['France','Burgundy'],tastingNotes:'',wineStyle:'red' as const
};

let root:Root|null=null,host:HTMLDivElement|null=null;
afterEach(()=>{act(()=>root?.unmount());host?.remove();root=null;host=null;vi.unstubAllGlobals()});

async function render(overrides:Record<string,unknown>={},id:string|undefined='w1'){
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({}),{status:200,headers:{'content-type':'application/json'}})));
  vi.resetModules();
  const saved:Record<string,unknown>[]=[];
  const {WineForm}=await import('../../src/features/wines/WineForm');
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
  await act(async()=>{root!.render(<MemoryRouter>
    <WineForm id={id} initial={{...initial,...overrides} as never} onSave={async input=>{saved.push(input as never);return {id:'w1'}}}/>
  </MemoryRouter>)});
  return saved;
}

const field=(name:string)=>host!.querySelector(`[name="${name}"]`) as HTMLInputElement;
const setValue=(input:HTMLInputElement,value:string)=>{
  const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value')!.set!;
  setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));
};
const submit=async()=>{await act(async()=>{host!.querySelector('form')!.requestSubmit()})};
const disclosure=(name:string)=>field(name).closest('details') as HTMLDetailsElement;

describe('values that cannot be right are stopped at the field',()=>{
  it.each([
    ['vintage','99999'],['vintage','201'],['vintage',String(new Date().getFullYear()+1)],
    ['rating','150'],['alcoholPercentage','500'],['price','-5'],['currency','HK'],
  ])('refuses %s %s before anything is sent',async(name,value)=>{
    const saved=await render();
    await act(async()=>setValue(field(name),value));
    await submit();
    expect(field(name).validity.valid).toBe(false);
    expect(saved).toHaveLength(0);
  });

  it('still saves an ordinary bottle',async()=>{
    const saved=await render();
    await act(async()=>{setValue(field('rating'),'93.5');setValue(field('alcoholPercentage'),'13.5');setValue(field('price'),'880');setValue(field('currency'),'hkd')});
    await submit();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({vintage:2019,rating:93.5,alcoholPercentage:13.5,price:880,currency:'HKD'});
  });

  it('refuses a blend over 100% at the grapes field, then lets the fix through',async()=>{
    const saved=await render();
    await act(async()=>setValue(field('grapeBlend'),'Merlot 80%, Cabernet Franc 40%'));
    await submit();
    expect(saved).toHaveLength(0);
    expect(field('grapeBlend').validationMessage).toContain('120%');
    await act(async()=>setValue(field('grapeBlend'),'Merlot 80%, Cabernet Franc 20%'));
    await submit();
    expect(saved).toHaveLength(1);
  });

  it('allows the point of rounding a label can carry',async()=>{
    const saved=await render();
    await act(async()=>setValue(field('grapeBlend'),'Merlot 34%, Cabernet Sauvignon 34%, Cabernet Franc 33%'));
    await submit();
    expect(saved).toHaveLength(1);
  });

  it('refuses a tag the server would, and opens the tags to show it',async()=>{
    const saved=await render();
    expect(disclosure('tags').open).toBe(false);
    await act(async()=>setValue(field('tags'),`France, ${'x'.repeat(60)}`));
    await submit();
    expect(saved).toHaveLength(0);
    expect(field('tags').validationMessage).toContain('50 characters');
    expect(disclosure('tags').open).toBe(true);
  });
});

describe('the form shows less until it is needed',()=>{
  it('hides year status and edition once a year is typed',async()=>{
    await render({vintage:null,vintageKind:'non_vintage'});
    const yearStatus=()=>[...host!.querySelectorAll('label')].find(label=>label.textContent?.startsWith('Year status'));
    expect(yearStatus()).toBeTruthy();
    await act(async()=>setValue(field('vintage'),'2019'));
    expect(yearStatus()).toBeUndefined();
  });

  it('keeps an edition that is already filled in, year or not',async()=>{
    await render({releaseDesignation:'171ème Édition'});
    expect(host!.querySelector('input[placeholder^="e.g. 171"]')).toBeTruthy();
  });

  it('folds the occasion away for a bottle with nothing to put there',async()=>{
    await render({tastingName:null,venue:null,locationName:null});
    expect(disclosure('venue').open).toBe(false);
  });

  it('opens the occasion when it already holds something',async()=>{
    await render({venue:'Clubhouse'});
    expect(disclosure('venue').open).toBe(true);
    expect(disclosure('venue').querySelector('summary small')?.textContent).toBe('Clubhouse');
  });
});
