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
  await act(async()=>edit(host!));
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
    // The detail presents region/appellation as one recorded pair, so a place
    // correction replaces that pair together rather than leaving half stale.
    expect(saved).toMatchObject({recognizedRegion:null});
  });

  it('is replaced when the appellation is corrected rather than emptied',async()=>{
    const saved=await saveWith(host=>setValue(field(host,'appellation'),'Toscana'));
    expect(saved).toMatchObject({appellation:'Toscana',recognizedAppellation:null,recognizedRegion:null});
  });

  it('retires a legacy reading whose normalized field is already blank',async()=>{
    // Older rows can contain recognized_appellation even though appellation is
    // null. The form already looks blank, so comparing only the visible before
    // and after values made this impossible to remove.
    const saved:Record<string,unknown>[]=[];
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({}),{status:200,headers:{'content-type':'application/json'}})));
    vi.resetModules();
    const {WineForm}=await import('../../src/features/wines/WineForm');
    host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
    await act(async()=>{root!.render(<MemoryRouter><WineForm id="w1" initial={{...initial,appellation:null} as never} onSave={async input=>{saved.push(input as never);return {id:'w1'}}}/></MemoryRouter>)});
    await act(async()=>{host!.querySelector('form')!.requestSubmit()});
    expect(saved[0]).toMatchObject({appellation:null,recognizedAppellation:null,recognizedRegion:null});
  });
});
