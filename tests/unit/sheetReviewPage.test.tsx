// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { afterEach,describe,expect,it,vi } from 'vitest';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const tasting={id:'t1',name:'Burgundy portfolio',tastingDate:'2026-08-28',venue:'Clubhouse',
  startedAt:null,endedAt:'2026-08-28T23:00:00.000Z',lastWineAt:null,
  createdAt:'2026-08-28T10:00:00.000Z',updatedAt:'2026-08-28T10:00:00.000Z'};

const wine=(overrides:Record<string,unknown>={})=>({
  producer:'Domaine Dujac',wineName:'Morey-Saint-Denis',vintage:2019,country:'France',
  region:'Burgundy',appellation:'Morey-Saint-Denis',style:'red',grapes:[],
  priceOptions:[{amount:1280,label:null}],section:'FLIGHT 1',lineNumber:1,confidence:.9,...overrides
});

let root:Root|null=null,host:HTMLDivElement|null=null;
afterEach(()=>{act(()=>root?.unmount());host?.remove();root=null;host=null;vi.unstubAllGlobals()});

const json=(body:unknown)=>new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});

async function mount(parseBodies:unknown[]){
  let parseIndex=0;
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
    const path=String(url);
    if(path.includes('/sheet/parse'))return json(parseBodies[Math.min(parseIndex++,parseBodies.length-1)]);
    if(path.includes('/api/tastings/t1'))return json({tasting,wines:[],documents:[{id:'d1',contentType:'image/jpeg',byteSize:1,createdAt:'x'}]});
    return json({});
  }));
  // Preparing a photo needs a canvas; the page's own logic is what is under test.
  vi.doMock('../../src/features/uploads/prepareImage',()=>({
    prepareRecognitionImageWithinBytes:vi.fn(async(file:File)=>({file,width:1200,height:1600}))
  }));
  vi.resetModules();
  const {TastingSheetPage}=await import('../../src/features/tastings/TastingSheetPage');
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
  await act(async()=>{root!.render(
    <MemoryRouter initialEntries={['/tastings/t1/sheet']}>
      <Routes><Route path="/tastings/:id/sheet" element={<TastingSheetPage/>}/></Routes>
    </MemoryRouter>)});
  return host;
}

const pick=async(files:File[])=>{
  const input=host!.querySelector('input[type=file]') as HTMLInputElement;
  Object.defineProperty(input,'files',{configurable:true,value:files});
  await act(async()=>{input.dispatchEvent(new Event('change',{bubbles:true}))});
};
const page=(name:string)=>new File([new Uint8Array([1,2,3])],name,{type:'image/jpeg'});
const button=(text:string)=>[...host!.querySelectorAll('button')].find(node=>node.textContent?.includes(text));

const parsed=(matches:unknown[],overrides:Record<string,unknown>={})=>
  ({currency:'HKD',unresolvedCount:0,truncated:false,resumeAfterLine:null,matches,requestId:'r',recognitionDurationMs:1,...overrides});

describe('the wine list review',()=>{
  it('ticks a logged wine that has no price, and leaves a priced one alone',async()=>{
    // Overwriting a number you typed yourself with one read off paper is the
    // wrong default, so that row arrives unticked and says why.
    await mount([parsed([
      {status:'matched',wine:wine(),wineId:'w1',hasPrice:false,currentPrice:null,currentCurrency:null},
      {status:'matched',wine:wine({wineName:'Clos de la Roche',lineNumber:2}),wineId:'w2',hasPrice:true,currentPrice:980,currentCurrency:'HKD'}
    ])]);
    await pick([page('list.jpg')]);
    const boxes=[...host!.querySelectorAll('.tasting-sheet-row input[type=checkbox]')] as HTMLInputElement[];
    expect(boxes.map(box=>box.checked)).toEqual([true,false]);
    expect(boxes[1].disabled).toBe(true);
    expect(host!.textContent).toContain('already priced');
  });

  it('ticks a wine the evening does not have, for creation',async()=>{
    await mount([parsed([{status:'new',wine:wine({wineName:'Bonnes-Mares'})}])]);
    await pick([page('list.jpg')]);
    expect(button('Add 1 wine')?.disabled).toBe(false);
    expect(button('Fill 0 price')?.disabled).toBe(true);
  });

  it('reads the currency once for the sheet',async()=>{
    await mount([parsed([{status:'new',wine:wine()}])]);
    await pick([page('list.jpg')]);
    expect((host!.querySelector('.tasting-sheet-currency input') as HTMLInputElement).value).toBe('HKD');
  });

  it('groups a long list by the flights it was printed under',async()=>{
    // Two hundred undifferentiated rows is not a review anybody reads.
    const matches=[
      ...Array.from({length:40},(_,index)=>({status:'new',wine:wine({wineName:`White ${index}`,section:'FLIGHT 1 — WHITES',lineNumber:index+1})})),
      ...Array.from({length:60},(_,index)=>({status:'new',wine:wine({wineName:`Red ${index}`,section:'FLIGHT 2 — REDS',lineNumber:index+41})}))
    ];
    await mount([parsed(matches)]);
    await pick([page('list.jpg')]);
    const sections=[...host!.querySelectorAll('.tasting-sheet-section')];
    expect(sections).toHaveLength(2);
    expect(host!.querySelectorAll('.tasting-sheet-row')).toHaveLength(100);
    expect(button('Add 100 wines')).toBeTruthy();
  });

  it('collapses a flight so a hundred rows can be got past',async()=>{
    const matches=Array.from({length:30},(_,index)=>({status:'new',wine:wine({wineName:`Red ${index}`,lineNumber:index+1})}));
    await mount([parsed(matches)]);
    await pick([page('list.jpg')]);
    await act(async()=>{host!.querySelector('.tasting-sheet-toggle')?.dispatchEvent(new MouseEvent('click',{bubbles:true}))});
    expect(host!.querySelectorAll('.tasting-sheet-row')).toHaveLength(0);
    // Collapsed, not deselected: the count is still there to act on.
    expect(button('Add 30 wines')?.disabled).toBe(false);
  });

  it('reads each page of a multi-page list and merges them',async()=>{
    await mount([
      parsed([{status:'new',wine:wine({wineName:'Page one wine'})}]),
      parsed([{status:'new',wine:wine({wineName:'Page two wine',lineNumber:1})}])
    ]);
    await pick([page('one.jpg'),page('two.jpg')]);
    expect(host!.querySelectorAll('.tasting-sheet-row')).toHaveLength(2);
    expect(host!.textContent).toContain('read from 2 pages');
  });

  it('counts a wine reprinted at a page break once',async()=>{
    await mount([parsed([{status:'new',wine:wine({wineName:'Repeated'})}])]);
    await pick([page('one.jpg'),page('two.jpg')]);
    expect(host!.querySelectorAll('.tasting-sheet-row')).toHaveLength(1);
  });

  it('continues a page that was cut short instead of accepting it',async()=>{
    await mount([
      parsed([{status:'new',wine:wine({wineName:'First',lineNumber:40})}],{truncated:true,resumeAfterLine:40}),
      parsed([{status:'new',wine:wine({wineName:'Second',lineNumber:41})}])
    ]);
    await pick([page('long.jpg')]);
    expect(host!.querySelectorAll('.tasting-sheet-row')).toHaveLength(2);
  });

  it('says so when even the continuations could not finish a page',async()=>{
    await mount([parsed([{status:'new',wine:wine()}],{truncated:true,resumeAfterLine:40})]);
    await pick([page('long.jpg')]);
    expect(host!.textContent).toContain('Photograph that page in two halves');
  });

  it('offers to re-read the list already stored, without the paper',async()=>{
    await mount([parsed([{status:'new',wine:wine()}])]);
    expect(button('Re-read the 1 stored page')).toBeTruthy();
  });
});
