// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,describe,expect,it,vi } from 'vitest';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

/** A wine that arrived from a scan, carrying what the label was read as. */
const initial={
  producer:'Ampeleia',wineName:'Cabernet Franc',vintage:2020,country:'Italy',region:'Tuscany',
  appellation:'Todcana',recognizedRegion:'Tuscany',recognizedAppellation:'Todcana',
  grapes:['Cabernet Franc'],grapeBlend:[],tags:[],tastingNotes:'',wineStyle:'red' as const
};

let root:Root|null=null,host:HTMLDivElement|null=null;
afterEach(()=>{act(()=>root?.unmount());host?.remove();root=null;host=null;vi.unstubAllGlobals()});

async function saveWith(edit:(form:HTMLElement)=>void){
  const saved:Record<string,unknown>[]=[];
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({}),{status:200,headers:{'content-type':'application/json'}})));
  vi.resetModules();
  const {WineForm}=await import('../../src/features/wines/WineForm');
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
  await act(async()=>{root!.render(<MemoryRouter>
    <WineForm id="w1" initial={initial as never} onSave={async input=>{saved.push(input as never);return {id:'w1'}}}/>
  </MemoryRouter>)});
  edit(host);
  await act(async()=>{host!.querySelector('form')!.requestSubmit()});
  return saved[0];
}

const field=(host:HTMLElement,name:string)=>host.querySelector(`[name="${name}"]`) as HTMLInputElement;
const setValue=(input:HTMLInputElement,value:string)=>{
  const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value')!.set!;
  setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));
};

describe('the reading a wine arrived with',()=>{
  it('survives a save that leaves the appellation alone',async()=>{
    // It is what the label said; editing the tasting notes must not lose it.
    const saved=await saveWith(()=>undefined);
    expect(saved).toMatchObject({recognizedAppellation:'Todcana',recognizedRegion:'Tuscany'});
  });

  it('goes when the appellation it describes is cleared',async()=>{
    // Reported as: whatever you type is shown back as recorded, and removing it
    // leaves it there. Clearing the field is how you take it back.
    const saved=await saveWith(host=>setValue(field(host,'appellation'),''));
    expect(saved).toMatchObject({appellation:null,recognizedAppellation:null});
    // The region reading is untouched: only the cleared field loses its own.
    expect(saved).toMatchObject({recognizedRegion:'Tuscany'});
  });

  it('stays when the appellation is corrected rather than emptied',async()=>{
    // A correction still leaves something for the reading to annotate, and the
    // difference between the two is the point of showing it.
    const saved=await saveWith(host=>setValue(field(host,'appellation'),'Toscana'));
    expect(saved).toMatchObject({appellation:'Toscana',recognizedAppellation:'Todcana'});
  });
});
