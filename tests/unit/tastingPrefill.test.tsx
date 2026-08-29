// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,describe,expect,it,vi } from 'vitest';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const tasting={id:'t1',name:'Burgundy portfolio',tastingDate:'2026-08-28',venue:'Clubhouse',
  startedAt:'2026-08-28T10:00:00.000Z',endedAt:null,lastWineAt:null,
  createdAt:'2026-08-28T10:00:00.000Z',updatedAt:'2026-08-28T10:00:00.000Z'};

let root:Root|null=null,host:HTMLDivElement|null=null;
afterEach(()=>{act(()=>root?.unmount());host?.remove();root=null;host=null;vi.unstubAllGlobals()});

const json=(body:unknown)=>new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});

/**
 * A fresh module graph per test: useActiveTasting caches the open tasting at
 * module level on purpose - one read per app load - which would otherwise leak
 * between these cases.
 */
async function mount(props:Record<string,unknown>={},active:unknown=tasting,hold?:{release:()=>void}){
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
    if(String(url).includes('/api/tastings/active')){
      if(hold)await new Promise<void>(resolve=>{hold.release=resolve});
      return json({tasting:active});
    }
    if(String(url).includes('/api/producers/resolve'))return json({matched:false,inputName:''});
    return json({});
  }));
  vi.resetModules();
  const {WineForm}=await import('../../src/features/wines/WineForm');
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
  await act(async()=>{root!.render(<MemoryRouter><WineForm {...props}/></MemoryRouter>)});
  return host;
}

const field=(name:string)=>host!.querySelector(`[name="${name}"]`) as HTMLInputElement;
const type=async(input:HTMLInputElement,value:string)=>{
  const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value')!.set!;
  await act(async()=>{setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))});
};

describe('the wine form while a tasting is open',()=>{
  it('arrives with the evening already filled in',async()=>{
    // The whole point: fourteen bottles in one evening should not mean typing
    // the same event, venue and date fourteen times.
    await mount();
    expect(field('tastingName').value).toBe('Burgundy portfolio');
    expect(field('venue').value).toBe('Clubhouse');
    expect(field('tastingDate').value).toBe('2026-08-28');
    expect(host!.textContent).toContain('Prefilled from your open tasting');
  });

  it('never overwrites what someone has already typed',async()=>{
    // The tasting arrives asynchronously, so the prefill can land after the
    // first keystrokes. It must lose that race, not win it.
    const hold={release:()=>{}};
    await mount({},tasting,hold);
    await type(field('tastingName'),'Somewhere else');
    await act(async()=>{hold.release()});
    expect(field('tastingName').value).toBe('Somewhere else');
    expect(field('venue').value).toBe('Clubhouse');
  });

  it('lets the tasting date beat the one recognition read off the photo',async()=>{
    // An old photo's EXIF timestamp winning here would look to the server like
    // a deliberate date change and silently end the evening. Someone declaring
    // "I am at this tasting" outranks a file timestamp.
    await mount({initial:{tastingDate:'2019-04-02'}});
    expect(field('tastingDate').value).toBe('2026-08-28');
  });

  it('leaves an existing wine alone when it is edited',async()=>{
    // A bottle from March must not be captured by tonight.
    await mount({id:'w1',initial:{producer:'Ridge',wineName:'Monte Bello',tastingName:'March dinner',venue:'Home',tastingDate:'2026-03-14'}});
    expect(field('tastingName').value).toBe('March dinner');
    expect(field('venue').value).toBe('Home');
    expect(field('tastingDate').value).toBe('2026-03-14');
    expect(host!.textContent).not.toContain('Prefilled from your open tasting');
  });

  it('fills in nothing when no tasting is open',async()=>{
    await mount({},null);
    expect(field('tastingName').value).toBe('');
    expect(field('tastingDate').value).toBe('');
    expect(host!.textContent).not.toContain('Prefilled from your open tasting');
  });
});
