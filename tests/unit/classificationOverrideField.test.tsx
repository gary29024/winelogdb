// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,describe,expect,it,vi } from 'vitest';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

let root:Root|null=null,host:HTMLDivElement|null=null,saved:Record<string,unknown>|null=null;

async function openForm(initial:Record<string,unknown>){
  saved=null;
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({producers:[],cuvees:[]}),{status:200,headers:{'content-type':'application/json'}})));
  vi.resetModules();
  const {WineForm}=await import('../../src/features/wines/WineForm');
  host=document.createElement('div');
  document.body.appendChild(host);
  root=createRoot(host);
  await act(async()=>{root!.render(<MemoryRouter>
    <WineForm initial={initial as never} onSave={async input=>{saved=input as unknown as Record<string,unknown>;return {id:'w1'}}}/>
  </MemoryRouter>)});
  return host;
}

type SelectLike={value:string;options:ArrayLike<{value:string}>;dispatchEvent(event:Event):boolean};

const node=()=>host!.querySelector('select[name="classificationOverride"]')!;
const select=()=>node() as unknown as SelectLike;
const helper=()=>node().parentElement?.querySelector('small')?.textContent??'';
const base={producer:'Domaine Dujac',wineName:'Les Suchots',country:'France',region:'Burgundy',appellation:'Vosne-Romanée'};

afterEach(()=>{
  act(()=>root?.unmount());
  host?.remove();
  root=null;host=null;saved=null;
  vi.unstubAllGlobals();
});

describe('Setting the cru tier by hand',()=>{
  it('offers a tier for every reading, plus auto and none',async()=>{
    await openForm(base);
    expect(Array.from(select().options,option=>option.value))
      .toEqual(['','grand_cru','premier_cru','village','none']);
  });

  it('starts on auto for a wine nobody has overridden',async()=>{
    await openForm({...base,classification:'village',classificationOverride:null});
    // The derived tier does not preselect the field: the select records intent,
    // not the current answer, or every wine would look hand-set.
    expect(select().value).toBe('');
    expect(helper()).toContain('Read from the appellation');
  });

  it('preselects a tier that was set by hand',async()=>{
    await openForm({...base,classification:'premier_cru',classificationOverride:'premier_cru'});
    expect(select().value).toBe('premier_cru');
    expect(helper()).toContain('will not change it');
  });

  it('submits the chosen tier',async()=>{
    await openForm(base);
    await act(async()=>{
      const node=select();
      node.value='premier_cru';
      node.dispatchEvent(new Event('change',{bubbles:true}));
    });
    expect(select().value).toBe('premier_cru');
    await act(async()=>{host!.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))});
    expect(saved).toMatchObject({classificationOverride:'premier_cru'});
  });

  it('submits null rather than an empty string when set back to auto',async()=>{
    // The column takes null to mean "derive"; an empty string would read as a
    // tier the enum does not have.
    await openForm({...base,classificationOverride:'village'});
    await act(async()=>{
      const node=select();
      node.value='';
      node.dispatchEvent(new Event('change',{bubbles:true}));
    });
    await act(async()=>{host!.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))});
    expect(saved).toMatchObject({classificationOverride:null});
  });
});
