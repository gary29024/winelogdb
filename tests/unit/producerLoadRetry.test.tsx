// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,describe,expect,it,vi } from 'vitest';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const producer={id:'p1',ownerId:'o',canonicalName:'Domaine Dujac',aliases:['Domaine Dujac'],homeCountry:'France',
  homeRegion:'Burgundy',homeLocality:'Morey-Saint-Denis',tastedCount:2,catalogCount:5,heroImageAvailable:false,researchedAt:null};

let root:Root|null=null,host:HTMLDivElement|null=null;
afterEach(()=>{act(()=>root?.unmount());host?.remove();root=null;host=null;vi.unstubAllGlobals()});

describe('a producer library that failed to load',()=>{
  it('offers a retry rather than waiting for the app to be restarted',async()=>{
    // Reported as: "the producer page failed to load producers and need to
    // close the app to show them again". Nothing ever asked again, so the
    // message was permanent for as long as the tab lived.
    let attempt=0;
    vi.stubGlobal('fetch',vi.fn(async()=>{
      attempt++;
      return attempt===1
        ?new Response(JSON.stringify({error:'Could not load producers'}),{status:500,headers:{'content-type':'application/json'}})
        :new Response(JSON.stringify({items:[producer]}),{status:200,headers:{'content-type':'application/json'}});
    }));
    vi.resetModules();
    const {ProducersPage}=await import('../../src/features/producers/ProducersPage');
    host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
    await act(async()=>{root!.render(<MemoryRouter><ProducersPage/></MemoryRouter>)});

    const failure=host.querySelector('.producer-load-error');
    expect(failure,'the failure should be shown with a way out').not.toBeNull();
    const retry=failure!.querySelector('button')!;
    expect(retry.textContent).toBe('Try again');

    await act(async()=>{retry.click()});
    expect(host.querySelector('.producer-load-error')).toBeNull();
    expect(host.textContent).toContain('Domaine Dujac');
  });
});
