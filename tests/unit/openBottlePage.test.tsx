// @vitest-environment jsdom
import { beforeEach,describe,expect,it,vi } from 'vitest';
import { cleanup,render,screen,waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const holding={id:'h1',producerId:'p1',cuveeId:'c1',producer:'Cusumano',wineName:'Feudo di Mezzo',vintage:2020,
  country:'Italy',region:'Sicily',appellation:'Etna',wineStyle:'red',classification:null,
  bottles:6,bottleSizeMl:750,purchasePrice:280,currency:'HKD',purchasedAt:'2026-08-01',
  merchant:null,location:'Rack 3',notes:'',createdAt:'2026-08-01T00:00:00.000Z',updatedAt:'2026-08-01T00:00:00.000Z'};

function stubFetch(){
  const calls:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
    const url=String(input);calls.push(url);
    if(url.startsWith('/api/cellar/h1'))return new Response(JSON.stringify({holding}),{status:200,headers:{'content-type':'application/json'}});
    return new Response(JSON.stringify({}),{status:200,headers:{'content-type':'application/json'}});
  }));
  return calls;
}

async function open(){
  vi.resetModules();
  const {OpenBottlePage}=await import('../../src/features/cellar/OpenBottlePage');
  return render(<MemoryRouter initialEntries={['/wines/new?holding=h1']}><OpenBottlePage/></MemoryRouter>);
}

describe('opening a bottle from the cellar',()=>{
  beforeEach(()=>{cleanup();vi.unstubAllGlobals()});

  it('carries what you paid onto the wine, so Insights prices it',async()=>{
    stubFetch();
    await open();
    // The outer <label>Price wraps both inputs, so the field is asked for by
    // role rather than by a name two elements answer to.
    const price=await screen.findByRole('spinbutton',{name:'Price'}) as HTMLInputElement;
    expect(price.value).toBe('280');
    expect((screen.getByRole('textbox',{name:'Currency'}) as HTMLInputElement).value).toBe('HKD');
  });

  it('prefills the identity the cellar already knew',async()=>{
    stubFetch();
    await open();
    await waitFor(()=>expect((screen.getByLabelText(/Producer/) as HTMLInputElement).value).toBe('Cusumano'));
    expect((screen.getByLabelText(/Vintage/) as HTMLInputElement).value).toBe('2020');
  });

  it('asks for a photo, and says plainly that skipping is fine',async()=>{
    stubFetch();
    await open();
    expect(await screen.findByText('Add a photo of the bottle?')).toBeTruthy();
    expect(screen.getByText(/Skip it and the wine saves without/)).toBeTruthy();
  });

  it('offers no label check until there is a photo to check against',async()=>{
    stubFetch();
    await open();
    await screen.findByText('Add a photo of the bottle?');
    expect(screen.queryByRole('button',{name:/Check the details/})).toBeNull();
  });

  it('reads nothing and calls nothing on its own',async()=>{
    const calls=stubFetch();
    await open();
    await screen.findByText('Add a photo of the bottle?');
    // The identity came out of the cellar, so opening a bottle costs no AI call
    // unless the check is pressed.
    expect(calls.some(url=>url.includes('/api/recognition'))).toBe(false);
  });

  it('falls back to an ordinary new wine when the bottles have gone',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}',{status:404,headers:{'content-type':'application/json'}})));
    await open();
    expect(await screen.findByText(/no longer in your cellar/)).toBeTruthy();
  });
});
