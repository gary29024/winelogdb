// @vitest-environment jsdom
import { beforeEach,describe,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const holding={id:'h1',producerId:'p1',cuveeId:'c1',producer:'Salon',wineName:'Le Mesnil',vintage:2013,
  country:'France',region:'Champagne',appellation:null,wineStyle:'sparkling',classification:null,
  bottles:1,bottleSizeMl:750,purchasePrice:4200,currency:'HKD',purchasedAt:'2026-01-04',
  merchant:null,location:'Rack 1',notes:'',createdAt:'2026-01-04T00:00:00.000Z',updatedAt:'2026-01-04T00:00:00.000Z'};

function stub(){
  const calls:Array<{url:string;method:string;body:unknown}>=[];
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const url=String(input);
    calls.push({url,method:init?.method??'GET',body:init?.body?JSON.parse(String(init.body)):null});
    if(url.startsWith('/api/maturity/vintage'))return new Response(JSON.stringify({window:null}),{status:200,headers:{'content-type':'application/json'}});
    if(url.startsWith('/api/cellar/h1'))return new Response(JSON.stringify({holding}),{status:200,headers:{'content-type':'application/json'}});
    return new Response('{}',{status:200,headers:{'content-type':'application/json'}});
  }));
  return calls;
}

async function openSheet(props:Record<string,unknown>={}){
  vi.resetModules();
  const {AddToCellarSheet}=await import('../../src/features/cellar/AddToCellarSheet');
  return render(<MemoryRouter><AddToCellarSheet onClose={()=>{}} onAdded={()=>{}} {...props}/></MemoryRouter>);
}

describe('the drinking window while a bottle is being added',()=>{
  beforeEach(()=>{cleanup();vi.unstubAllGlobals()});

  it('answers from the boxes, before anything is saved',async()=>{
    // It used to render only while editing, and only from the saved row - so
    // adding a bottle showed no window at all, even where the year had already
    // been looked up and reading it would have cost nothing.
    stub();
    const {container}=await openSheet();
    fireEvent.change(screen.getByLabelText(/Appellation/),{target:{value:'Barolo'}});
    fireEvent.change(screen.getByLabelText(/Vintage/),{target:{value:'2014'}});
    fireEvent.change(screen.getByLabelText(/Style/),{target:{value:'red'}});
    await waitFor(()=>expect(container.querySelector('.maturity-line')).not.toBeNull());
    expect(screen.getByText(/Typical for Barolo/)).toBeTruthy();
    expect(screen.getByText('Drink 2022–2039')).toBeTruthy();
  });

  it('says nothing at all until there is a year to say it about',async()=>{
    // A wine with no vintage is not a young wine, it is a wine with no clock.
    stub();
    const {container}=await openSheet();
    fireEvent.change(screen.getByLabelText(/Appellation/),{target:{value:'Barolo'}});
    await waitFor(()=>expect((screen.getByLabelText(/Country/) as HTMLInputElement).value).toBe('Italy'));
    expect(container.querySelector('.vintage-check')).toBeNull();
  });

  it('follows the appellation when a bottle is changed into another wine',async()=>{
    // Editing a Salon into a Charmes-Chambertin used to leave the Champagne
    // window above the form until the sheet was saved and reopened.
    stub();
    const {container}=await openSheet({holding});
    await waitFor(()=>expect(container.querySelector('.maturity-line')).not.toBeNull());
    fireEvent.change(screen.getByLabelText(/Appellation/),{target:{value:'Charmes-Chambertin'}});
    await waitFor(()=>expect(screen.getByText(/Typical for Charmes-Chambertin/)).toBeTruthy());
  });
});

describe('correcting a bottle already put away',()=>{
  beforeEach(()=>{cleanup();vi.unstubAllGlobals()});

  it('opens on the bottle rather than on a blank form',async()=>{
    stub();
    await openSheet({holding});
    expect((screen.getByLabelText(/Producer/) as HTMLInputElement).value).toBe('Salon');
    expect((screen.getByLabelText(/Bottles/) as HTMLInputElement).value).toBe('1');
    expect((screen.getByLabelText(/Currency/) as HTMLInputElement).value).toBe('HKD');
  });

  it('saves the correction onto that line, rather than opening a second one',async()=>{
    const calls=stub();
    await openSheet({holding});
    fireEvent.change(screen.getByLabelText(/Where it is/),{target:{value:'Rack 4'}});
    fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
    await waitFor(()=>expect(calls.some(call=>call.method==='PUT'&&call.url==='/api/cellar/h1')).toBe(true));
    const [put]=calls.filter(call=>call.method==='PUT');
    expect((put.body as {location:string}).location).toBe('Rack 4');
    expect(calls.some(call=>call.method==='POST'&&call.url==='/api/cellar')).toBe(false);
  });

  it('is where a cellar bottle can be asked about its vintage',async()=>{
    // The only screen that exists for a wine you have not drunk, and the one you
    // are on when deciding whether to open it.
    stub();
    await openSheet({holding});
    expect(await screen.findByRole('button',{name:/Look up 2013/})).toBeTruthy();
  });

  it('adds rather than edits when it opened on nothing',async()=>{
    const calls=stub();
    await openSheet();
    fireEvent.change(screen.getByLabelText(/Producer/),{target:{value:'Salon'}});
    fireEvent.change(screen.getByLabelText(/Wine name/),{target:{value:'Le Mesnil'}});
    fireEvent.click(screen.getByRole('button',{name:/Add 1 bottle/}));
    await waitFor(()=>expect(calls.some(call=>call.method==='POST'&&call.url==='/api/cellar')).toBe(true));
  });
});

describe('the currency box',()=>{
  beforeEach(()=>{cleanup();vi.unstubAllGlobals()});

  it('is upper case however it was typed',async()=>{
    // A currency is a three-letter code, and hkd and HKD would otherwise be two
    // of them in the Insights price card.
    stub();
    await openSheet();
    const field=screen.getByLabelText(/Currency/) as HTMLInputElement;
    fireEvent.change(field,{target:{value:'hkd'}});
    expect(field.value).toBe('HKD');
  });
});

describe('changing which wine a line is',()=>{
  beforeEach(()=>{cleanup();vi.unstubAllGlobals()});

  it('moves the region with the appellation, instead of leaving the old one',async()=>{
    // Reported: a Salon edited into a Charmes-Chambertin kept Champagne in the
    // region box - and the box is what gets sent, so the bottle was saved as a
    // Burgundy grand cru in Champagne.
    const calls=stub();
    await openSheet({holding});
    expect((screen.getByLabelText(/Region/) as HTMLInputElement).value).toBe('Champagne');
    fireEvent.change(screen.getByLabelText(/Appellation/),{target:{value:'Charmes-Chambertin'}});
    await waitFor(()=>expect((screen.getByLabelText(/Region/) as HTMLInputElement).value).toBe('Burgundy'));
    expect((screen.getByLabelText(/Country/) as HTMLInputElement).value).toBe('France');

    fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
    await waitFor(()=>expect(calls.some(call=>call.method==='PUT')).toBe(true));
    const [put]=calls.filter(call=>call.method==='PUT');
    expect((put.body as {region:string}).region).toBe('Burgundy');
  });

  it('leaves a country typed by hand alone, which is why the boxes exist',async()=>{
    stub();
    await openSheet();
    fireEvent.change(screen.getByLabelText(/Appellation/),{target:{value:'Cloudbreak Ridge'}});
    fireEvent.change(screen.getByLabelText(/Country/),{target:{value:'New Zealand'}});
    await waitFor(()=>expect((screen.getByLabelText(/Country/) as HTMLInputElement).value).toBe('New Zealand'));
  });
});
