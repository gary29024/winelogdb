// @vitest-environment jsdom
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,waitFor,within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CellarScope } from '../../src/features/cellar/CellarScope';
import { getVintageWindow } from '../../src/features/maturity/api';

const holding={id:'h1',producerId:null,cuveeId:null,producer:'Example domaine',wineName:'Gevrey-Chambertin',
  country:'France',region:'Burgundy',appellation:'Gevrey-Chambertin',wineStyle:'red',classification:null,vintage:2019,
  bottles:2,bottleSizeMl:750,purchasePrice:null,currency:null,purchasedAt:null,merchant:null,location:null,notes:'',createdAt:'',updatedAt:''};
const research={country:'France',region:'Burgundy',appellation:null,wineStyle:'red',vintage:2019,
  shiftFrom:20,shiftTo:20,note:'A structured year.',sources:[],model:'model',researchedAt:'2026-09-10',
  quality:{score:93,confidence:'medium',consensus:'Structured.',strengths:[],cautions:[]}};

const dialogMethods=Object.fromEntries(['showModal','close'].map(name=>[name,Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype,name)]));

describe('cellar vintage research access',()=>{
  beforeEach(()=>{
    // jsdom has no native dialog implementation; browser QA covers focus trapping.
    Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.setAttribute('open','')}});
    Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.removeAttribute('open')}});
  });
  afterEach(()=>{
    cleanup();vi.unstubAllGlobals();
    for(const [name,descriptor] of Object.entries(dialogMethods)){
      if(descriptor)Object.defineProperty(HTMLDialogElement.prototype,name,descriptor);
      else Reflect.deleteProperty(HTMLDialogElement.prototype,name);
    }
  });

  it('opens the cached research without editing or making another lookup, then restores focus',async()=>{
    const fetch=vi.fn(async()=>Response.json({items:[{...holding,vintageWindow:research}],total:1,bottles:2,nextOffset:null}));
    vi.stubGlobal('fetch',fetch);
    render(<MemoryRouter><CellarScope/></MemoryRouter>);
    const trigger=await screen.findByRole('button',{name:/View vintage research/});
    trigger.focus();fireEvent.click(trigger);
    const dialog=screen.getByRole('dialog',{name:'Gevrey-Chambertin'});
    expect(within(dialog).getByText('93')).toBeTruthy();
    expect(within(dialog).queryByLabelText('Producer *')).toBeNull();
    expect(within(trigger).getByText('Too young')).toBeTruthy();
    expect(within(dialog).getByText('Too young')).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole('button',{name:'Close vintage research'}));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe('');
  });

  it('reloads cellar cards after research in the dialog and supports Escape dismissal',async()=>{
    const fetch=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      if(init?.method==='POST')return Response.json({window:research,cached:false});
      return Response.json({items:[{...holding,vintageWindow:null}],total:1,bottles:2,nextOffset:null});
    });
    vi.stubGlobal('fetch',fetch);
    render(<MemoryRouter><CellarScope/></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button',{name:/View vintage research/}));
    const dialog=screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button',{name:'Look up 2019'}));
    await waitFor(()=>expect(within(dialog).getByText('93')).toBeTruthy());
    await waitFor(()=>expect(fetch.mock.calls.filter(([url])=>String(url).startsWith('/api/cellar'))).toHaveLength(2));
    expect(fetch.mock.calls.filter(([url,init])=>String(url).startsWith('/api/maturity/')&&init?.method!=='POST')).toHaveLength(0);
    fireEvent(dialog,new Event('cancel',{bubbles:false,cancelable:true}));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('reading saved research',()=>{
  afterEach(()=>vi.unstubAllGlobals());
  it('returns null only for a successful cache miss',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({window:null})));
    await expect(getVintageWindow(holding)).resolves.toBeNull();
  });
  it.each([503,401])('reports HTTP %s as a read failure',async status=>{
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:'unavailable'},{status})));
    await expect(getVintageWindow(holding)).rejects.toThrow();
  });
  it('does not treat an invalid success payload as missing research',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({})));
    await expect(getVintageWindow(holding)).rejects.toThrow(/Could not read/);
  });
});
