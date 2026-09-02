// @vitest-environment jsdom
import { beforeEach,describe,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const producerDetail={id:'p1',canonicalName:'Cusumano',catalogCuvees:[{id:'c1',canonicalName:'Feudo di Mezzo',appellation:'Etna',wineStyle:'red',tastedCount:2,tastedVintages:[2020]}],
  tastedWines:[],catalog:[],aliases:[],researchHistoryCount:0,linkedProducers:[],cuveeCatalogLinks:[],supplementaryContacts:[],catalogDecisions:[],
  homeCountry:'Italy',homeRegion:null,homeLocality:null,profile:'',winemakingPractices:'',sources:[],officialWebsiteUrl:null,instagramUrl:null,
  contactEmail:null,contactPhone:null,contactSources:[],heroImageAvailable:false,heroImageSourceUrl:null,researchModel:null,researchedAt:null};

function stubResolve(reply:(name:string)=>unknown){
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
    const url=String(input);
    if(url.startsWith('/api/producers/resolve')){
      const name=decodeURIComponent(new URL(url,'https://x').searchParams.get('name')??'');
      return new Response(JSON.stringify(reply(name)),{status:200,headers:{'content-type':'application/json'}});
    }
    if(url.startsWith('/api/producers/p1'))return new Response(JSON.stringify(producerDetail),{status:200,headers:{'content-type':'application/json'}});
    return new Response('{}',{status:200,headers:{'content-type':'application/json'}});
  }));
}

async function openSheet(){
  vi.resetModules();
  const {AddToCellarSheet}=await import('../../src/features/cellar/AddToCellarSheet');
  render(<MemoryRouter><AddToCellarSheet onClose={()=>{}} onAdded={()=>{}}/></MemoryRouter>);
  return screen.getByLabelText(/Producer/) as HTMLInputElement;
}

describe('matching a producer as you add bottles',()=>{
  beforeEach(()=>{cleanup();vi.unstubAllGlobals();vi.useRealTimers()});

  it('reports the producer the library already knows',async()=>{
    stubResolve(()=>({matched:true,inputName:'Cusumano',producer:{id:'p1',canonicalName:'Cusumano',matchedName:'Cusumano',matchType:'canonical',researchedAt:null,catalogCount:1,tastedCount:3}}));
    const field=await openSheet();
    fireEvent.change(field,{target:{value:'Cusumano'}});
    expect(await screen.findByText(/Existing producer · Cusumano/)).toBeTruthy();
  });

  it('takes the library spelling, so the name cannot drift at the cellar door',async()=>{
    // A holding stores the producer as text, and that text creates the producer
    // when the bottle is opened - months after anyone could connect the two.
    stubResolve(()=>({matched:true,inputName:'cusumano',producer:{id:'p1',canonicalName:'Cusumano',matchedName:'cusumano',matchType:'normalized',researchedAt:null,catalogCount:1,tastedCount:3}}));
    const field=await openSheet();
    fireEvent.change(field,{target:{value:'cusumano'}});
    await waitFor(()=>expect(field.value).toBe('Cusumano'));
    expect(screen.getByText(/Filed under the library's spelling/)).toBeTruthy();
  });

  it('offers a near miss rather than silently making a second producer',async()=>{
    stubResolve(()=>({matched:false,inputName:'Cusumano Alta Mora',suggestion:{id:'p1',canonicalName:'Cusumano',tastedCount:3}}));
    const field=await openSheet();
    fireEvent.change(field,{target:{value:'Cusumano Alta Mora'}});
    expect(await screen.findByText(/Did you mean/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Use it'}));
    await waitFor(()=>expect(field.value).toBe('Cusumano'));
  });

  it('says a new name creates nothing until a bottle is opened',async()=>{
    // The cellar's whole rule: a producer you have never drunk must not appear
    // in the library at nought tasted.
    stubResolve(()=>({matched:false,inputName:'Somewhere New'}));
    const field=await openSheet();
    fireEvent.change(field,{target:{value:'Somewhere New'}});
    expect(await screen.findByText(/nothing is created in Producers until you open one/i)).toBeTruthy();
  });

  it('offers the matched producer’s wines by name',async()=>{
    stubResolve(()=>({matched:true,inputName:'Cusumano',producer:{id:'p1',canonicalName:'Cusumano',matchedName:'Cusumano',matchType:'canonical',researchedAt:null,catalogCount:1,tastedCount:3}}));
    const field=await openSheet();
    fireEvent.change(field,{target:{value:'Cusumano'}});
    expect(await screen.findByText(/1 known wine from this producer/)).toBeTruthy();
  });
});
