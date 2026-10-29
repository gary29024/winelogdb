// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,describe,expect,it,vi } from 'vitest';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

/** A scanned wine before its first save, as Batch Scan hands it to the form. */
const scanned={
  producer:'Domaine Test',wineName:'A4 Chardonnay',vintage:2024,
  recognizedProducer:'DOMAINE TEST',recognizedWineName:'A4 2024 CHARDONNAY',recognizedVintageText:'2024',
  country:'Australia',region:null,appellation:null,grapes:[],grapeBlend:[],tags:[],tastingNotes:'',wineStyle:'white' as const,recognitionStatus:'review' as const
};

let root:Root|null=null,host:HTMLDivElement|null=null;
afterEach(()=>{act(()=>root?.unmount());host?.remove();root=null;host=null;vi.unstubAllGlobals()});

async function saveNew(edit:(form:HTMLElement)=>void){
  const saved:Record<string,unknown>[]=[];
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({}),{status:200,headers:{'content-type':'application/json'}})));
  vi.resetModules();
  const {WineForm}=await import('../../src/features/wines/WineForm');
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
  await act(async()=>{root!.render(<MemoryRouter>
    <WineForm initial={scanned as never} onSave={async input=>{saved.push(input as never);return {id:'w1'}}} submitLabel="Confirm & save wine"/>
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

describe('naming a scanned wine before its first save',()=>{
  it('files it under the corrected name, not the label reading',async()=>{
    // Reported as: a wine renamed in Batch Scan review was saved under the
    // recognized name, and only took the new one when edited and saved again.
    // The server files a wine under its recognized name, so the correction
    // has to replace that reading, as a rename of a saved wine does.
    const saved=await saveNew(host=>setValue(field(host,'wineName'),'A4 Reserve Chardonnay'));
    expect(saved).toMatchObject({wineName:'A4 Reserve Chardonnay',recognizedWineName:'A4 Reserve Chardonnay'});
  });

  it('keeps the label reading when the name is left as recognized',async()=>{
    const saved=await saveNew(()=>undefined);
    expect(saved).toMatchObject({wineName:'A4 Chardonnay',recognizedWineName:'A4 2024 CHARDONNAY'});
  });

  it('keeps the reading of everything else the correction did not touch',async()=>{
    const saved=await saveNew(host=>setValue(field(host,'wineName'),'A4 Reserve Chardonnay'));
    expect(saved).toMatchObject({recognizedProducer:'DOMAINE TEST',recognizedVintageText:'2024'});
  });
});
