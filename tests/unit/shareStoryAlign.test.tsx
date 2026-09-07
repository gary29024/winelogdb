// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { afterEach,describe,expect,it,vi } from 'vitest';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const wines=(count:number)=>Array.from({length:count},(_,index)=>({
  id:`w${index}`,producer:`Domaine ${index}`,wineName:`Cuvée ${index}`,vintage:2019,favorite:false,imageId:`img-${index}`
}));

// jsdom has no canvas, and this file is about the sheet around the card rather
// than the card: a null context makes the draw fail quietly instead of filling
// the run with not-implemented traces.
vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);

let root:Root|null=null,host:HTMLDivElement|null=null;
afterEach(()=>{act(()=>root?.unmount());host?.remove();root=null;host=null;vi.unstubAllGlobals();vi.resetModules()});

/** Answers the frame lookup and the photo fetches; records every call. */
function stubFetch(frames:Record<string,unknown>={}){
  const calls:Array<{url:string;method:string}>=[];
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo,init?:RequestInit)=>{
    const url=String(input),method=init?.method??'GET';
    calls.push({url,method});
    if(url.startsWith('/api/bottle-frames'))return new Response(JSON.stringify({frames}),{status:200,headers:{'content-type':'application/json'}});
    return new Response(new Blob(['x']),{status:200});
  }));
  return calls;
}

async function open(count:number,frames:Record<string,unknown>={}){
  const calls=stubFetch(frames);
  const {ShareStorySheet}=await import('../../src/features/share/ShareStorySheet');
  host=document.createElement('div');document.body.appendChild(host);
  root=createRoot(host);
  await act(async()=>{root!.render(<ShareStorySheet card={{title:'An evening',subtitle:'Today',wines:wines(count)}} onClose={()=>undefined}/>)});
  return calls;
}

describe('lining the bottles up on a card',()=>{
  it('never spends anything just by opening the sheet',async()=>{
    const calls=await open(3);
    // The lookup is free; measuring is the vision call, and it is a POST.
    expect(calls.some(call=>call.url.startsWith('/api/bottle-frames?'))).toBe(true);
    expect(calls.filter(call=>call.method==='POST'),'opening a sheet must never bill').toEqual([]);
  });

  it('offers to measure exactly the photographs nothing is known about',async()=>{
    await open(3,{'img-1':{bottle:{xMin:0,yMin:0,xMax:500,yMax:900},label:null}});
    expect(host!.textContent).toContain('Measure 2 photographs');
    expect(host!.textContent,'and says what is already done').toContain('1 of 3 photographs have been measured');
  });

  it('asks for nothing more once every bottle on the card is measured',async()=>{
    const measured=Object.fromEntries(wines(2).map(wine=>[wine.imageId,{bottle:{xMin:0,yMin:0,xMax:500,yMax:900},label:null}]));
    await open(2,measured);
    expect(host!.textContent).toContain('Every bottle on this card has been measured');
    expect(host!.textContent).not.toContain('Measure');
  });

  it('can be turned off, for a card the measurement framed badly',async()=>{
    await open(2);
    const toggle=[...host!.querySelectorAll('input[type=checkbox]')]
      .find(input=>input.closest('label')?.textContent?.includes('Line the bottles up')) as HTMLInputElement;
    expect(toggle.checked,'on by default - it is what the card is for').toBe(true);
    await act(async()=>{toggle.click()});
    expect(toggle.checked).toBe(false);
    // With it off there is nothing to measure for, so the offer goes quiet too.
    expect((host!.querySelector('.story-share-align button') as HTMLButtonElement).disabled).toBe(true);
  });
});
