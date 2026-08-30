// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter,useLocation } from 'react-router-dom';
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
let lastPath='';
async function mount(props:Record<string,unknown>={},active:unknown=tasting,hold?:{release:()=>void}){
  lastPath='';
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
    if(String(url).includes('/api/tastings/active')){
      if(hold)await new Promise<void>(resolve=>{hold.release=resolve});
      return json({tasting:active});
    }
    if(String(url).includes('/api/producers/resolve'))return json({matched:false,inputName:''});
    if(String(url)==='/api/wines')return json({id:'saved-wine'});
    return json({});
  }));
  vi.resetModules();
  const {WineForm}=await import('../../src/features/wines/WineForm');
  function Spy(){lastPath=useLocation().pathname;return null}
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
  await act(async()=>{root!.render(<MemoryRouter><Spy/><WineForm {...props}/></MemoryRouter>)});
  return host;
}

/** Fills the two required fields and submits. */
async function saveWine(){
  const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value')!.set!;
  await act(async()=>{
    for(const [name,value] of [['producer','Domaine Dujac'],['wineName','Morey-Saint-Denis']]){
      const el=host!.querySelector(`[name="${name}"]`) as HTMLInputElement;
      setter.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));
    }
  });
  await act(async()=>{host!.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))});
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

  it('will not save a wine before it knows whether an evening is open',async()=>{
    // Reported as "how do I ensure a wine is logged if I leave the tasting page
    // midway". The tasting is server state, so leaving the page is safe - but
    // saving in the moments *before* /api/tastings/active answers posted a null
    // tastingName, and the bottle was created outside the evening with nothing
    // said. The probe is one indexed query, cached for the rest of the session,
    // so this holds the button for a flicker on the first save and never again.
    const hold={release:()=>{}};
    await mount({},tasting,hold);
    const submit=[...host!.querySelectorAll('button')].find(node=>node.type==='submit')!;
    expect(submit.disabled).toBe(true);
    expect(submit.textContent).toBe('Checking tasting…');
    await act(async()=>{hold.release()});
    expect(submit.disabled).toBe(false);
    expect(field('tastingName').value).toBe('Burgundy portfolio');
  });

  it('does not hold up editing an existing wine, which joins nothing',async()=>{
    const hold={release:()=>{}};
    await mount({id:'w1',initial:{producer:'Ridge',wineName:'Monte Bello'}},tasting,hold);
    const submit=[...host!.querySelectorAll('button')].find(node=>node.type==='submit')!;
    expect(submit.disabled).toBe(false);
    await act(async()=>{hold.release()});
  });

  it('leaves an existing wine alone when it is edited',async()=>{
    // A bottle from March must not be captured by tonight.
    await mount({id:'w1',initial:{producer:'Ridge',wineName:'Monte Bello',tastingName:'March dinner',venue:'Home',tastingDate:'2026-03-14'}});
    expect(field('tastingName').value).toBe('March dinner');
    expect(field('venue').value).toBe('Home');
    expect(field('tastingDate').value).toBe('2026-03-14');
    expect(host!.textContent).not.toContain('Prefilled from your open tasting');
  });

  it('goes back to the evening after a save, ready for the next bottle',async()=>{
    // Fourteen bottles a night, and landing on the wine each time meant backing
    // out of it fourteen times. The lineup is both the receipt for what was
    // just saved and where the next one is logged from.
    await mount();
    await saveWine();
    expect(lastPath).toBe('/tastings/t1');
  });

  it('goes to the wine when the bottle was logged outside the evening',async()=>{
    // Changing the event is how you say "this one is not part of tonight", so
    // returning to the tasting would be answering a question nobody asked.
    await mount();
    await type(field('tastingName'),'Somewhere else');
    await saveWine();
    expect(lastPath).toBe('/wines/saved-wine');
  });

  it('goes to the wine when no evening is open at all',async()=>{
    await mount({},null);
    await saveWine();
    expect(lastPath).toBe('/wines/saved-wine');
  });

  it('leaves the group and batch review flows alone',async()=>{
    // They pass onSaved and keep their own list, which already returns you to
    // the review rather than anywhere else.
    const saved:string[]=[];
    await mount({onSaved:(wineId:string)=>{saved.push(wineId)}});
    await saveWine();
    expect(saved).toEqual(['saved-wine']);
    expect(lastPath).toBe('/');
  });

  it('fills in nothing when no tasting is open',async()=>{
    await mount({},null);
    expect(field('tastingName').value).toBe('');
    expect(field('tastingDate').value).toBe('');
    expect(host!.textContent).not.toContain('Prefilled from your open tasting');
  });
});
