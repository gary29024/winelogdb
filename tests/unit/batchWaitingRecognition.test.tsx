// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,describe,expect,it,vi } from 'vitest';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

const minutesAgo=(minutes:number)=>new Date(Date.now()-minutes*60_000).toISOString();
const waiting=(id:string,position:number)=>({id,position,status:'submitted',recognition:null,error:null,confirmedWineId:null,saved:null,imageIds:[]});
const ready=(id:string,position:number)=>({...waiting(id,position),status:'ready',recognition:{producer:'Domaine',wineName:'Cuvée',vintage:2020,confidence:0.9,country:'France',region:null,appellation:null,grapes:[],style:'red'}});
// The batch row was last stamped when it was queued, 20 minutes ago, as it is
// throughout a healthy run. Only lastActivityAt says whether anything moved since.
const batch=(lastActivityAt:string,items:unknown[]=[waiting('i1',0),waiting('i2',1)])=>({id:'s1',status:'running',totalItems:2,expectedItems:2,confirmedItems:0,
  createdAt:minutesAgo(30),updatedAt:minutesAgo(20),lastActivityAt,expiresAt:new Date(Date.now()+86400_000).toISOString(),items});

let root:Root|null=null,host:HTMLDivElement|null=null;
afterEach(()=>{act(()=>root?.unmount());host?.remove();root=null;host=null;vi.unstubAllGlobals()});

type Routes={session:()=>unknown;quote?:()=>Response;submit?:()=>Response};
async function render(routes:Routes){
  const posts:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async(input:string,init?:RequestInit)=>{
    const url=new URL(String(input),'https://wine.example');
    if(init?.method==='POST'){
      posts.push(url.pathname);
      if(url.pathname==='/api/credits/quotes')return routes.quote?.()??Response.json({id:'q1',total:0,available:0,units:[]});
      if(url.pathname==='/api/batch-recognition/sessions/s1/submit')return routes.submit?.()??Response.json({accepted:true,sessionId:'s1'},{status:202});
    }
    if(url.pathname==='/api/batch-recognition/sessions/s1')return Response.json(routes.session());
    const summary=routes.session() as Record<string,unknown>;
    return Response.json({items:[{...summary,items:undefined}]});
  }));
  vi.resetModules();
  const {BatchScanPage}=await import('../../src/features/uploads/BatchScanPage');
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
  await act(async()=>{root!.render(<MemoryRouter initialEntries={['/batch-scan?session=s1']}><BatchScanPage/></MemoryRouter>)});
  return posts;
}
const retryButton=()=>[...host!.querySelectorAll('.batch-upload-actions button')][0] as HTMLButtonElement;
const error=()=>host!.querySelector('.scan-error')?.textContent??null;

describe('waiting for batch recognition',()=>{
  it('does not call a batch stalled while its wines are still moving',async()=>{
    // Reported as "Could not restart 22 waiting recognitions" on a batch whose
    // wines were being recognized: the page read the batch row's own stamp.
    const posts=await render({session:()=>batch(minutesAgo(1))});
    expect(posts).toEqual([]);
    expect(error()).toBeNull();
    expect(retryButton().textContent).toBe('Retry waiting recognition');
  });

  it('restarts a batch nothing has moved in for longer than a recognition request can run',async()=>{
    const posts=await render({session:()=>batch(minutesAgo(20))});
    expect(posts).toEqual(['/api/credits/quotes','/api/batch-recognition/sessions/s1/submit']);
    expect(host!.textContent).toContain('Recovery queued for 2 waiting wines.');
    expect(error()).toBeNull();
  });

  it('leaves Retry ready beside its error when the retry is refused',async()=>{
    await render({session:()=>batch(minutesAgo(1)),quote:()=>Response.json({error:'No staged scan images'},{status:400})});
    await act(async()=>{retryButton().click()});
    expect(error()).toBe('Could not restart 2 waiting recognitions: No staged scan images');
    expect(retryButton().textContent).toBe('Retry waiting recognition');
    expect(retryButton().disabled).toBe(false);
  });

  it('holds Retry for its cooldown once a retry is queued',async()=>{
    await render({session:()=>batch(minutesAgo(1))});
    await act(async()=>{retryButton().click()});
    expect(error()).toBeNull();
    expect(host!.textContent).toContain('Recovery queued for 2 waiting wines.');
    expect(retryButton().textContent).toBe('Retry queued…');
    expect(retryButton().disabled).toBe(true);
  });

  it('reports nothing when the wines finished while the retry was refused',async()=>{
    let current=batch(minutesAgo(1));
    await render({session:()=>current,quote:()=>Response.json({error:'This batch has no wines waiting for recognition'},{status:400})});
    current=batch(minutesAgo(0),[ready('i1',0),ready('i2',1)]);
    await act(async()=>{retryButton().click()});
    expect(error()).toBeNull();
    expect(host!.textContent).not.toContain('WAITING FOR RECOGNITION');
  });
});
