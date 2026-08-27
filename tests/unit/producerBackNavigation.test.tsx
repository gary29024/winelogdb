// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter,Route,Routes,useLocation } from 'react-router-dom';
import { afterEach,beforeEach,describe,expect,it } from 'vitest';
import { CampaignItemList } from '../../src/features/producers/ResearchCampaignHistory';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

let root:Root|null=null,host:HTMLDivElement|null=null;

const items=[
  {producerId:'p1',producerName:'Domaine de la Mordorée',status:'failed' as const,message:'Research failed.'},
  {producerId:'p2',producerName:'Gaja',status:'complete' as const,message:null}
];

beforeEach(()=>{host=document.createElement('div');document.body.appendChild(host);root=createRoot(host)});
afterEach(()=>{act(()=>root?.unmount());host?.remove();root=null;host=null;window.sessionStorage.clear()});

/** Stands in for the producer page: it only reports what it was handed. */
function Landed(){
  const {state}=useLocation();
  return <p className="landed">{JSON.stringify((state as{from?:unknown}|null)?.from??null)}</p>;
}

describe('a producer opened from a batch run',()=>{
  it('is handed the batch run as its way back',async()=>{
    // Reported as: checking one failed producer dropped you on the producer
    // catalogue, so the list of the other failures was gone.
    await act(async()=>{root!.render(<MemoryRouter initialEntries={['/producers/research-batch']}>
      <Routes>
        <Route path="/producers/research-batch" element={<CampaignItemList items={items}/>}/>
        <Route path="/producers/:id" element={<Landed/>}/>
      </Routes>
    </MemoryRouter>)});
    const links=[...host!.querySelectorAll('a')];
    expect(links.map(link=>link.getAttribute('href'))).toEqual(['/producers/p1','/producers/p2']);
    await act(async()=>{links[0].dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0}))});
    expect(JSON.parse(host!.querySelector('.landed')!.textContent!))
      .toEqual({to:'/producers/research-batch',label:'Batch Deep Search'});
  });
});

describe('the remembered back target',()=>{
  it('keeps producers and wines apart, so one cannot overwrite the other',async()=>{
    const {rememberBackTarget,readBackTarget,BATCH_RESEARCH_BACK,JOURNAL_BACK}=await import('../../src/features/wines/backTarget');
    rememberBackTarget('p1',BATCH_RESEARCH_BACK,'producer');
    rememberBackTarget('w1',JOURNAL_BACK);
    expect(readBackTarget('p1','producer')).toEqual(BATCH_RESEARCH_BACK);
    expect(readBackTarget('w1')).toEqual(JOURNAL_BACK);
    // and a target still only shows against the id it was stored for
    expect(readBackTarget('p2','producer')).toBeNull();
  });

  it('refuses a target that would leave the app',async()=>{
    const {readBackTarget}=await import('../../src/features/wines/backTarget');
    window.sessionStorage.setItem('winelog.producerBack',JSON.stringify({wineId:'p1',to:'//evil.example',label:'Back'}));
    expect(readBackTarget('p1','producer')).toBeNull();
  });
});
