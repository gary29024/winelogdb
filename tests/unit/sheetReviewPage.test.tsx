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
afterEach(()=>{act(()=>root?.unmount());host?.remove();root=null;host=null;vi.unstubAllGlobals();window.localStorage.clear()});

const json=(body:unknown)=>new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});

async function mount(parseBodies:unknown[]){
  let parseIndex=0,uploadIndex=0;
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
    const path=String(url);
    if(path.includes('/sheet/parse'))return json(parseBodies[Math.min(parseIndex++,parseBodies.length-1)]);
    // Uploading returns the pages it just stored, not the whole tasting.
    if(path.includes('/documents'))return json({documents:[{id:`up${uploadIndex++}`,contentType:'image/jpeg',byteSize:1,createdAt:'x'}]});
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
/**
 * Choosing photographs saves them; reading them is a separate press, so every
 * case that wants a parse asks for one the way a person would.
 */
const byText=(pattern:RegExp)=>[...host!.querySelectorAll('button')].find(node=>pattern.test(node.textContent??''));
const read=async()=>{await act(async()=>{byText(/^Read \d+ page/)!.click()})};
const readSaved=async()=>{await act(async()=>{byText(/^Read \d+ saved page/)!.click()})};
const choose=async(files:File[])=>{await pick(files);await read()};

const pickersIn=(node:HTMLElement)=>[...node.querySelectorAll('.tasting-sheet-match')] as unknown as HTMLSelectElement[];
const parsed=(matches:unknown[],overrides:Record<string,unknown>={})=>
  ({currency:'HKD',unresolvedCount:0,truncated:false,resumeAfterLine:null,matches,lineup:[],requestId:'r',recognitionDurationMs:1,...overrides});
const logged=(overrides:Record<string,unknown>={})=>
  ({wineId:'w1',producer:'Henri Giraud',wineName:'MV20',vintage:null,hasPrice:false,price:null,currency:null,...overrides});

describe('the wine list review',()=>{
  it('ticks a logged wine that has no price, and leaves a priced one alone',async()=>{
    // Overwriting a number you typed yourself with one read off paper is the
    // wrong default, so that row arrives unticked and says why.
    await mount([parsed([
      {status:'matched',wine:wine(),wineId:'w1',hasPrice:false,currentPrice:null,currentCurrency:null},
      {status:'matched',wine:wine({wineName:'Clos de la Roche',lineNumber:2}),wineId:'w2',hasPrice:true,currentPrice:980,currentCurrency:'HKD'}
    ])]);
    await choose([page('list.jpg')]);
    const boxes=[...host!.querySelectorAll('.tasting-sheet-row input[type=checkbox]')] as HTMLInputElement[];
    expect(boxes.map(box=>box.checked)).toEqual([true,false]);
    expect(boxes[1].disabled).toBe(true);
    expect(host!.textContent).toContain('already priced');
  });

  it('ticks a wine the evening does not have, for creation',async()=>{
    await mount([parsed([{status:'new',wine:wine({wineName:'Bonnes-Mares'})}])]);
    await choose([page('list.jpg')]);
    expect(button('Add 1 wine')?.disabled).toBe(false);
    expect(button('Fill 0 price')?.disabled).toBe(true);
  });

  it('reads the currency once for the sheet',async()=>{
    await mount([parsed([{status:'new',wine:wine()}])]);
    await choose([page('list.jpg')]);
    expect((host!.querySelector('.tasting-sheet-currency input') as HTMLInputElement).value).toBe('HKD');
  });

  it('groups a long list by the flights it was printed under',async()=>{
    // Two hundred undifferentiated rows is not a review anybody reads.
    const matches=[
      ...Array.from({length:40},(_,index)=>({status:'new',wine:wine({wineName:`White ${index}`,section:'FLIGHT 1 — WHITES',lineNumber:index+1})})),
      ...Array.from({length:60},(_,index)=>({status:'new',wine:wine({wineName:`Red ${index}`,section:'FLIGHT 2 — REDS',lineNumber:index+41})}))
    ];
    await mount([parsed(matches)]);
    await choose([page('list.jpg')]);
    const sections=[...host!.querySelectorAll('.tasting-sheet-section')];
    expect(sections).toHaveLength(2);
    expect(host!.querySelectorAll('.tasting-sheet-row')).toHaveLength(100);
    expect(button('Add 100 wines')).toBeTruthy();
  });

  it('collapses a flight so a hundred rows can be got past',async()=>{
    const matches=Array.from({length:30},(_,index)=>({status:'new',wine:wine({wineName:`Red ${index}`,lineNumber:index+1})}));
    await mount([parsed(matches)]);
    await choose([page('list.jpg')]);
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
    await choose([page('one.jpg'),page('two.jpg')]);
    expect(host!.querySelectorAll('.tasting-sheet-row')).toHaveLength(2);
    expect(host!.textContent).toContain('read from 2 pages');
  });

  it('counts a wine reprinted at a page break once',async()=>{
    await mount([parsed([{status:'new',wine:wine({wineName:'Repeated'})}])]);
    await choose([page('one.jpg'),page('two.jpg')]);
    expect(host!.querySelectorAll('.tasting-sheet-row')).toHaveLength(1);
  });

  it('continues a page that was cut short instead of accepting it',async()=>{
    await mount([
      parsed([{status:'new',wine:wine({wineName:'First',lineNumber:40})}],{truncated:true,resumeAfterLine:40}),
      parsed([{status:'new',wine:wine({wineName:'Second',lineNumber:41})}])
    ]);
    await choose([page('long.jpg')]);
    expect(host!.querySelectorAll('.tasting-sheet-row')).toHaveLength(2);
  });

  it('says so when even the continuations could not finish a page',async()=>{
    await mount([parsed([{status:'new',wine:wine()}],{truncated:true,resumeAfterLine:40})]);
    await choose([page('long.jpg')]);
    expect(host!.textContent).toContain('Photograph that page in two halves');
  });

});

describe('choosing the photographs',()=>{
  it('saves the pages without reading them, and waits to be told',async()=>{
    // Reported as: the scan fired the moment the photos were chosen. One AI
    // call per page, on a sheet that can run to seven, spent before anyone had
    // looked at the screen.
    const host=await mount([parsed([{status:'new',wine:wine()}])]);
    await pick([page('one.jpg'),page('two.jpg')]);
    const calls=(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map(call=>String(call[0]));
    expect(calls.filter(url=>url.includes('/sheet/parse')),'nothing read yet').toHaveLength(0);
    expect(calls.some(url=>url.includes('/documents')),'but the paper is kept').toBe(true);
    expect(host.textContent).toContain('2 pages saved to this tasting');
    expect(button('Read 2 pages')).toBeTruthy();
  });

  it('reads them only once the button is pressed',async()=>{
    const host=await mount([parsed([{status:'new',wine:wine({wineName:'Bonnes-Mares'})}])]);
    await pick([page('one.jpg')]);
    await read();
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
      .filter(call=>String(call[0]).includes('/sheet/parse'))).toHaveLength(1);
    expect(host.textContent).toContain('Bonnes-Mares');
  });

  it('lets the pages be kept unread, which costs nothing',async()=>{
    // The other half of the same fix: a list you photographed only to have a
    // record of should not have to be read to be stored.
    const host=await mount([parsed([{status:'new',wine:wine()}])]);
    await pick([page('one.jpg')]);
    await act(async()=>{button('Just keep them')!.click()});
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
      .filter(call=>String(call[0]).includes('/sheet/parse'))).toHaveLength(0);
    expect(host.textContent).toContain('nothing was charged');
    expect(byText(/^Read \d+ page/),'nothing staged is waiting to be read').toBeUndefined();
    // and the page it kept is now offered from storage, which is the point of
    // keeping it: the prices can be read off it another day.
    expect(byText(/^Read \d+ saved page/)).toBeTruthy();
  });
});

describe('reading a list saved on an earlier visit',()=>{
  it('reads the stored pages without asking for the paper again',async()=>{
    // Reported as: "the list was just saved in the first place, but I want to
    // read the prices later on". The photograph is in a bin by then; the copy
    // in R2 is what this screen is for.
    const host=await mount([parsed([{status:'new',wine:wine({wineName:'Bonnes-Mares'})}])]);
    expect(host.textContent).toContain('Pages already saved');
    await readSaved();
    const calls=(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map(call=>String(call[0]));
    expect(calls.some(url=>url.includes('/api/tastings/documents/d1')),'fetched off the stored copy').toBe(true);
    expect(calls.filter(url=>url.includes('/sheet/parse'))).toHaveLength(1);
    expect(host.textContent).toContain('Bonnes-Mares');
  });

  it('will not spend a second call on pages it has just read',async()=>{
    // Each page is an AI call, and the button sits right there afterwards.
    const host=await mount([parsed([{status:'new',wine:wine()}])]);
    await readSaved();
    expect(byText(/^Read 0 saved page/)?.disabled,'unticked once read').toBe(true);
    expect(host.textContent).toContain('Pages already saved');
  });

  it('reads only the pages that are ticked',async()=>{
    const host=await mount([parsed([{status:'new',wine:wine()}])]);
    const boxes=[...host.querySelectorAll('.tasting-sheet-stored-page input')] as HTMLInputElement[];
    expect(boxes,'one per saved page, ticked on arrival').toHaveLength(1);
    expect(boxes[0].checked).toBe(true);
    await act(async()=>{boxes[0].click()});
    expect(byText(/^Read 0 saved page/)?.disabled).toBe(true);
  });
});

describe('a printed line the reading could not match',()=>{
  // Reported from a real order form: every line came back "Not in this tasting
  // yet" because the sheet prints "'MV20' Aÿ Grand Cru Brut" where the bottle
  // was logged as "MV20". No normalisation closes that gap, and the only offer
  // was to create a second copy of a wine already in the evening - which loses
  // the price and doubles the wine.
  const unmatched=(lineup:unknown[])=>parsed([{status:'new',wine:wine({wineName:"'MV20' Aÿ Grand Cru Brut"})}],{lineup});
  const pickers=()=>pickersIn(host!);
  const picker=()=>pickers()[0];
  const pick=async(value:string)=>{
    const select=picker()!;
    const setter=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value')!.set!;
    await act(async()=>{setter.call(select,value);select.dispatchEvent(new Event('change',{bubbles:true}))});
  };

  it('can be pointed at a wine already logged, instead of duplicating it',async()=>{
    const host=await mount([unmatched([logged()])]);
    await choose([page('list.jpg')]);
    expect(host.textContent).toContain('Not in this tasting yet');
    expect(button('Add 1 wine'),'the only offer before').toBeTruthy();

    await pick('w1');
    expect(host.textContent).toContain('Matched by you to Henri Giraud · MV20');
    expect(button('Fill 1 price'),'now a price to fill').toBeTruthy();
    expect(button('Add 0 wines'),'and no longer a wine to create').toBeTruthy();
  });

  it('writes the price to the wine it was pointed at',async()=>{
    const host=await mount([unmatched([logged()])]);
    await choose([page('list.jpg')]);
    await pick('w1');
    vi.stubGlobal('confirm',()=>true);
    await act(async()=>{button('Fill 1 price')!.click()});
    const call=(globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
      .find(entry=>String(entry[0]).includes('/sheet/prices'))!;
    expect(JSON.parse(String((call[1] as RequestInit).body))).toMatchObject({
      currency:'HKD',prices:[{wineId:'w1',price:1280}]
    });
    expect(host.textContent).toBeTruthy();
  });

  it('leaves a wine that already has a price unticked when pointed at',async()=>{
    // Same rule an automatic match follows: a number entered by hand is not
    // replaced by one read off paper.
    await mount([unmatched([logged({hasPrice:true,price:980,currency:'HKD'})])]);
    await choose([page('list.jpg')]);
    await pick('w1');
    expect(host!.textContent).toContain('already priced');
    expect(button('Fill 0 prices')?.disabled,'nothing to overwrite').toBe(true);
  });

  it('does not offer one wine to two different lines',async()=>{
    // Two printed lines both pointed at the same bottle would write one price
    // twice and lose the other.
    await mount([parsed([
      {status:'new',wine:wine({wineName:"'MV20' Aÿ Grand Cru Brut"})},
      {status:'new',wine:wine({wineName:'Ratafia Solera'})}
    ],{lineup:[logged(),logged({wineId:'w2',wineName:'Esprit Nature'})]})]);
    await choose([page('list.jpg')]);
    const selects=pickers();
    expect(selects).toHaveLength(2);
    const setter=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value')!.set!;
    await act(async()=>{setter.call(selects[0],'w1');selects[0].dispatchEvent(new Event('change',{bubbles:true}))});
    const remaining=[...pickers()[1].options].map(option=>option.value);
    expect(remaining,'the claimed wine is gone from the other line').toEqual(['','w2']);
  });

  it('offers nothing to point at when the evening has no wines yet',async()=>{
    await mount([unmatched([])]);
    await choose([page('list.jpg')]);
    expect(picker()).toBeUndefined();
    expect(button('Add 1 wine')).toBeTruthy();
  });
});

describe('a reading already paid for',()=>{
  // Reading a list is the most expensive thing the app does - one AI call per
  // page, on a sheet that can run to seven - and closing the screen used to
  // throw the whole result away. Coming back to fill the prices in later meant
  // paying to read the same paper again.
  const oneRow=()=>parsed([{status:'new',wine:wine({wineName:'Bonnes-Mares'})}]);

  it('is still there after the screen is closed and reopened',async()=>{
    await mount([oneRow()]);
    await choose([page('list.jpg')]);
    expect(host!.textContent).toContain('Bonnes-Mares');

    // reopened later: no parse call is made, and the rows come back
    const host2=await mount([oneRow()]);
    expect(host2.textContent).toContain('Bonnes-Mares');
    expect(host2.textContent).toContain('Showing the list read on');
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
      .filter(call=>String(call[0]).includes('/sheet/parse')),'nothing rescanned').toHaveLength(0);
  });

  it('keeps the choices made against it, not just the wines',async()=>{
    await mount([parsed([{status:'new',wine:wine()}],{lineup:[logged()]})]);
    await choose([page('list.jpg')]);
    await act(async()=>{
      const select=pickersIn(host!)[0];
      const setter=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value')!.set!;
      setter.call(select,'w1');select.dispatchEvent(new Event('change',{bubbles:true}));
    });
    expect(host!.textContent).toContain('Matched by you to Henri Giraud · MV20');

    const host2=await mount([oneRow()]);
    expect(host2.textContent,'the hand-made match survives too').toContain('Matched by you to Henri Giraud · MV20');
  });

  it('goes only when it is thrown away on purpose',async()=>{
    await mount([oneRow()]);
    await choose([page('list.jpg')]);
    vi.stubGlobal('confirm',()=>true);
    await act(async()=>{button('Discard')!.click()});
    expect(host!.textContent).not.toContain('Bonnes-Mares');
    expect(host!.textContent).toContain('pages are still saved');

    const host2=await mount([oneRow()]);
    expect(host2.textContent).not.toContain('Bonnes-Mares');
  });

  it('is superseded by a fresh reading rather than merged with it',async()=>{
    await mount([oneRow()]);
    await choose([page('list.jpg')]);
    const host2=await mount([parsed([{status:'new',wine:wine({wineName:'Clos de Tart'})}])]);
    expect(host2.textContent).toContain('Showing the list read on');
    await choose([page('again.jpg')]);
    expect(host2.textContent).toContain('Clos de Tart');
    expect(host2.textContent).not.toContain('Bonnes-Mares');
    expect(host2.textContent,'and it is no longer billed as restored').not.toContain('Showing the list read on');
  });
});

describe('naming the wines you can point a line at',()=>{
  it('leads with the producer, because that is what tells them apart',async()=>{
    // Reported from a Montalcino tasting: the list read "Brunello di Montalcino
    // · 2017", "Brunello di Montalcino · 2018", "Brunello di Montalcino · 2019"
    // and there was no way to see whose was whose.
    await mount([parsed([{status:'new',wine:wine({wineName:'Brunello di Montalcino'})}],{lineup:[
      logged({wineId:'a',producer:'Siro Pacenti',wineName:'Brunello di Montalcino',vintage:2019}),
      logged({wineId:'b',producer:'Il Poggione',wineName:'Brunello di Montalcino',vintage:2017})
    ]})]);
    await choose([page('list.jpg')]);
    const labels=[...pickersIn(host!)[0].options].map(option=>option.textContent?.trim());
    expect(labels).toEqual(['Add as a new wine','Il Poggione · Brunello di Montalcino · 2017','Siro Pacenti · Brunello di Montalcino · 2019']);
  });

  it('does not say a producer twice when the cuvée was logged with it',async()=>{
    await mount([parsed([{status:'new',wine:wine()}],{lineup:[
      logged({wineId:'a',producer:'Pian delle Vigne',wineName:'Pian delle Vigne Brunello di Montalcino',vintage:2019})
    ]})]);
    await choose([page('list.jpg')]);
    expect([...pickersIn(host!)[0].options][1].textContent?.trim())
      .toBe('Pian delle Vigne · Brunello di Montalcino · 2019');
  });

  it('says NV rather than nothing for a wine with no vintage',async()=>{
    await mount([parsed([{status:'new',wine:wine()}],{lineup:[logged({hasPrice:true})]})]);
    await choose([page('list.jpg')]);
    expect([...pickersIn(host!)[0].options][1].textContent?.trim())
      .toBe('Henri Giraud · MV20 · NV (already priced)');
  });
});
