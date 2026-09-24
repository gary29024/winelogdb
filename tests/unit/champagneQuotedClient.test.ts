// @vitest-environment jsdom
import { File as NativeFile,Blob as NativeBlob } from 'node:buffer';
import { FormData as NativeFormData,Request as NativeRequest,Response as NativeResponse,Headers as NativeHeaders } from 'undici';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { bootstrapAccount,clearSession } from '../../src/lib/auth/client';
import { getChampagneExtraction,startChampagneExtraction } from '../../src/features/wines/champagneExtractionApi';
import { prepareRecognitionImageWithinBytes } from '../../src/features/uploads/prepareImage';

vi.mock('../../src/features/uploads/prepareImage',()=>({prepareRecognitionImageWithinBytes:vi.fn(async(file:File)=>({file}))}));
const run={requestId:'run-1',status:'queued',details:null,error:null,imageIds:['front','back']};
// Use one fetch implementation: Node's bundled Request can reject another
// Undici version's FormData and stringify it instead of encoding multipart.
beforeEach(()=>{vi.stubGlobal('File',NativeFile);vi.stubGlobal('Blob',NativeBlob);vi.stubGlobal('FormData',NativeFormData);vi.stubGlobal('Request',NativeRequest);vi.stubGlobal('Response',NativeResponse);vi.stubGlobal('Headers',NativeHeaders)});
afterEach(()=>{clearSession();vi.useRealTimers();vi.unstubAllGlobals();vi.clearAllMocks();localStorage.clear();sessionStorage.clear()});

it('quotes byte-identical prepared photos and retries with the same operation key',async()=>{
  const quoted:Array<RequestInit>=[],submitted:Array<RequestInit>=[];
  vi.stubGlobal('fetch',vi.fn(async(target:string,init?:RequestInit)=>{
    if(target==='/api/me')return Response.json({user:{id:'alice',role:'member'}});
    if(target.startsWith('/api/images/'))return new Response(new Uint8Array(30),{headers:{'Content-Type':'image/jpeg'}});
    if(target.startsWith('/api/credits/quotes')){quoted.push(init!);return Response.json({id:'q-1',total:0,available:0,units:[{action:'champagne_extraction',credits:0}]})}
    submitted.push(init!);if(submitted.length===1)throw new Error('Response lost');return Response.json({run});
  }));
  await bootstrapAccount();expect(await startChampagneExtraction('wine',['front','back'])).toEqual({run});
  expect(prepareRecognitionImageWithinBytes).toHaveBeenCalledTimes(2);
  expect(quoted).toHaveLength(1);expect(submitted).toHaveLength(2);
  expect(new Uint8Array(quoted[0].body as ArrayBuffer)).toEqual(new Uint8Array(submitted[0].body as ArrayBuffer));
  expect(new Uint8Array(submitted[0].body as ArrayBuffer)).toEqual(new Uint8Array(submitted[1].body as ArrayBuffer));
  const first=new Headers(submitted[0].headers),second=new Headers(submitted[1].headers);
  expect(first.get('Content-Type')).toContain('multipart/form-data; boundary=');
  expect(first.get('X-WineLog-Quote')).toBe('q-1');expect(first.get('Idempotency-Key')).toBeTruthy();
  expect(second.get('Idempotency-Key')).toBe(first.get('Idempotency-Key'));expect(first.get('X-WineLog-Account')).toBe('alice');
  const body=await new Request('https://wine.example',{method:'POST',headers:first,body:submitted[0].body}).formData();
  expect(body.get('imageIds')).toBe('["front","back"]');expect(body.getAll('images')).toHaveLength(2);
});

it('stops before submitting extraction when the owner-configured allowance is exhausted',async()=>{
  const execute=vi.fn();
  vi.stubGlobal('fetch',vi.fn(async(target:string)=>{
    if(target==='/api/me')return Response.json({user:{id:'alice'}});
    if(target.startsWith('/api/images/'))return new Response(new Uint8Array(30),{headers:{'Content-Type':'image/jpeg'}});
    if(target.startsWith('/api/credits/quotes'))return Response.json({error:'Champagne label details extraction has no free runs remaining this week.'},{status:429});
    execute();return Response.json({run});
  }));
  await bootstrapAccount();await expect(startChampagneExtraction('wine',['front'])).rejects.toThrow('no free runs remaining');expect(execute).not.toHaveBeenCalled();
});

it('reads status without a new quote or provider submission',async()=>{
  const fetcher=vi.fn(async(target:string)=>target==='/api/me'?Response.json({user:{id:'alice'}}):Response.json({run}));vi.stubGlobal('fetch',fetcher);
  await bootstrapAccount();await expect(getChampagneExtraction('wine')).resolves.toEqual({run});
  expect(fetcher.mock.calls.map(call=>call[0])).toEqual(['/api/me','/api/wines/wine/champagne-extraction']);
});

it('does not submit photos after the account changes during preparation',async()=>{
  let user='alice';const quoted=vi.fn();
  vi.stubGlobal('fetch',vi.fn(async(target:string)=>{
    if(target==='/api/me')return Response.json({user:{id:user}});
    if(target.startsWith('/api/images/')){user='bob';await bootstrapAccount();return new Response(new Uint8Array(30),{headers:{'Content-Type':'image/jpeg'}})}
    quoted();return Response.json({run});
  }));
  await bootstrapAccount();await expect(startChampagneExtraction('wine',['front'])).rejects.toThrow('Account changed');expect(quoted).not.toHaveBeenCalled();
});

it('follows the accepted operation through staging and ignores an older completed extraction',async()=>{
  const old={...run,requestId:'old-run',status:'complete',details:{dosageGPerL:9},imageIds:['old-photo']};
  const fresh={...run,requestId:'new-run',status:'complete',details:{dosageGPerL:3}};
  let submissions=0,operationReads=0,quotes=0;
  const fetcher=vi.fn(async(target:string,init?:RequestInit)=>{
    if(target==='/api/me')return Response.json({user:{id:'alice',role:'member'}});
    if(target.startsWith('/api/images/'))return new Response(new Uint8Array(30),{headers:{'Content-Type':'image/jpeg'}});
    if(target.startsWith('/api/credits/quotes')){quotes++;return Response.json({id:'q-new',total:0,available:0,units:[]})}
    if(init?.method==='POST'){
      submissions++;if(submissions===1)throw new Error('Response connection lost while photos are staged');
      return Response.json({accepted:true,creditOperationId:'new-operation',status:'running'},{status:202});
    }
    if(target==='/api/credits/operations/new-operation'){
      operationReads++;
      // The run is bound before the HTTP response, including when the queue
      // has already settled it by the time the browser recovers.
      return Response.json({status:operationReads===3?'complete':'running',runId:operationReads===1?null:fresh.requestId,result:null});
    }
    return Response.json({run:operationReads<3?old:fresh});
  });
  vi.stubGlobal('fetch',fetcher);await bootstrapAccount();
  expect(await startChampagneExtraction('wine',['front','back'])).toEqual({run:fresh});
  expect(operationReads).toBe(3);expect(submissions).toBe(2);expect(quotes).toBe(1);
  expect(fetcher.mock.calls.filter(([target,init])=>target==='/api/wines/wine/champagne-extraction'&&init?.method!=='POST')).toHaveLength(2);
});

it('surfaces an accepted operation failure without reading the previous wine result',async()=>{
  const readWine=vi.fn();
  vi.stubGlobal('fetch',vi.fn(async(target:string,init?:RequestInit)=>{
    if(target==='/api/me')return Response.json({user:{id:'alice'}});
    if(target.startsWith('/api/images/'))return new Response(new Uint8Array(30),{headers:{'Content-Type':'image/jpeg'}});
    if(target.startsWith('/api/credits/quotes'))return Response.json({id:'q-new',total:0,available:0,units:[]});
    if(init?.method==='POST')return Response.json({accepted:true,creditOperationId:'failed-operation'},{status:202});
    if(target==='/api/credits/operations/failed-operation')return Response.json({status:'failed',runId:null,result:{error:'Could not queue extraction. Please try again.'}});
    readWine();return Response.json({run});
  }));
  await bootstrapAccount();await expect(startChampagneExtraction('wine',['front'])).rejects.toThrow('Could not queue extraction');expect(readWine).not.toHaveBeenCalled();
});

it('cancels acceptance recovery without another submission or status poll',async()=>{
  const abort=new AbortController();let operationRead!:()=>void,reads=0,submissions=0;
  const seen=new Promise<void>(resolve=>{operationRead=resolve});
  vi.stubGlobal('fetch',vi.fn(async(target:string,init?:RequestInit)=>{
    if(target==='/api/me')return Response.json({user:{id:'alice'}});
    if(target.startsWith('/api/images/'))return new Response(new Uint8Array(30),{headers:{'Content-Type':'image/jpeg'}});
    if(target.startsWith('/api/credits/quotes'))return Response.json({id:'q-new',total:0,available:0,units:[]});
    if(init?.method==='POST'){submissions++;return Response.json({accepted:true,creditOperationId:'pending-operation'},{status:202})}
    reads++;operationRead();return Response.json({status:'running',runId:null,result:null});
  }));
  await bootstrapAccount();const pending=startChampagneExtraction('wine',['front'],abort.signal),rejected=expect(pending).rejects.toMatchObject({name:'AbortError'});
  await seen;abort.abort();await rejected;expect(reads).toBe(1);expect(submissions).toBe(1);
});

it('bounds acceptance recovery and never resubmits an operation that is still staging',async()=>{
  vi.useFakeTimers();let operationRead!:()=>void,reads=0,submissions=0;
  const seen=new Promise<void>(resolve=>{operationRead=resolve});
  vi.stubGlobal('fetch',vi.fn(async(target:string,init?:RequestInit)=>{
    if(target==='/api/me')return Response.json({user:{id:'alice'}});
    if(target.startsWith('/api/images/'))return new Response(new Uint8Array(30),{headers:{'Content-Type':'image/jpeg'}});
    if(target.startsWith('/api/credits/quotes'))return Response.json({id:'q-new',total:0,available:0,units:[]});
    if(init?.method==='POST'){submissions++;return Response.json({accepted:true,creditOperationId:'pending-operation'},{status:202})}
    reads++;operationRead();return Response.json({status:'running',runId:null,result:null});
  }));
  await bootstrapAccount();const rejected=expect(startChampagneExtraction('wine',['front'])).rejects.toThrow('Extraction was accepted. Reopen this wine');
  await seen;await vi.runAllTimersAsync();await rejected;expect(reads).toBe(8);expect(submissions).toBe(1);
});
