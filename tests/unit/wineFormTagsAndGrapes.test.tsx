// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,describe,expect,it,vi } from 'vitest';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

/** A wine as a scan left it, tags and all. */
const initial={
  producer:'Krug',wineName:'Grande Cuvée',vintage:2012,country:'France',region:'Champagne',
  appellation:'Champagne',recognizedRegion:null,recognizedAppellation:null,
  grapes:['Chardonnay'],grapeBlend:[{grape:'Chardonnay',percentage:null}],
  tags:['France','Champagne','Chardonnay','sparkling','birthday'],
  tastingNotes:'',wineStyle:'sparkling' as const
};

let root:Root|null=null,host:HTMLDivElement|null=null;
afterEach(()=>{act(()=>root?.unmount());host?.remove();root=null;host=null;vi.unstubAllGlobals()});

async function render_(){
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({}),{status:200,headers:{'content-type':'application/json'}})));
  vi.resetModules();
  const saved:Record<string,unknown>[]=[];
  const {WineForm}=await import('../../src/features/wines/WineForm');
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
  await act(async()=>{root!.render(<MemoryRouter>
    <WineForm id="w1" initial={initial as never} onSave={async input=>{saved.push(input as never);return {id:'w1'}}}/>
  </MemoryRouter>)});
  return {saved,host:host!};
}

const field=(host:HTMLElement,name:string)=>host.querySelector(`[name="${name}"]`) as HTMLInputElement;
const setValue=(input:HTMLInputElement,value:string)=>{
  const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value')!.set!;
  setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));
};
const submit=async(host:HTMLElement)=>{await act(async()=>{host.querySelector('form')!.requestSubmit()})};

describe('tags when a scanned wine is corrected',()=>{
  it('replaces the tag the correction made wrong',async()=>{
    // Reported as: hashtags are not corrected when you fix the details.
    const {saved,host}=await render_();
    await act(async()=>{
      setValue(field(host,'region'),'Burgundy');
      setValue(field(host,'appellation'),'Chablis');
    });
    await submit(host);
    const tags=saved[0].tags as string[];
    expect(tags).not.toContain('Champagne');
    expect(tags).toContain('Burgundy');
    expect(tags).toContain('Chablis');
    // and the one nothing derived is untouched
    expect(tags).toContain('birthday');
  });

  it('leaves the tags alone when nothing about the wine changed',async()=>{
    const {saved,host}=await render_();
    await submit(host);
    expect(saved[0].tags).toEqual(initial.tags);
  });

  it('follows a grape correction too',async()=>{
    const {saved,host}=await render_();
    await act(async()=>setValue(field(host,'grapeBlend'),'Pinot Meunier'));
    await submit(host);
    const tags=saved[0].tags as string[];
    expect(tags).not.toContain('Chardonnay');
    expect(tags).toContain('Pinot Meunier');
  });
});

describe('finishing a grape in the form',()=>{
  it('offers nothing until a grape is half-typed',async()=>{
    const {host}=await render_();
    expect(host.querySelectorAll('.grape-hint')).toHaveLength(0);
  });

  it('suggests the name the grape will be filed under, and completes it',async()=>{
    // Typing is slow and mistypes are easy; the list is a local table, so this
    // costs no request and the form is no taller until it can help.
    const {host}=await render_();
    await act(async()=>setValue(field(host,'grapeBlend'),'Chardonnay 60%, spatb'));
    const hints=[...host.querySelectorAll('.grape-hint')].map(node=>node.textContent);
    expect(hints).toEqual(['Pinot Noir']);
    await act(async()=>{(host.querySelector('.grape-hint') as HTMLButtonElement).click()});
    expect(field(host,'grapeBlend').value).toBe('Chardonnay 60%, Pinot Noir');
  });

  it('keeps a percentage already typed against the grape',async()=>{
    const {host}=await render_();
    await act(async()=>setValue(field(host,'grapeBlend'),'garnach 40%'));
    await act(async()=>{(host.querySelector('.grape-hint') as HTMLButtonElement).click()});
    expect(field(host,'grapeBlend').value).toBe('Grenache 40%');
  });
});
