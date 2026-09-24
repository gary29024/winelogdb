// @vitest-environment jsdom
import { File as NativeFile,Blob as NativeBlob } from 'node:buffer';
import { FormData as NativeFormData } from 'undici';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { bootstrapAccount,clearSession } from '../../src/lib/auth/client';
import { getChampagneExtraction,startChampagneExtraction } from '../../src/features/wines/champagneExtractionApi';
import { prepareRecognitionImageWithinBytes } from '../../src/features/uploads/prepareImage';

vi.mock('../../src/features/uploads/prepareImage',()=>({prepareRecognitionImageWithinBytes:vi.fn(async(file:File)=>({file}))}));
const run={requestId:'run-1',status:'queued',details:null,error:null,imageIds:['front','back']};
beforeEach(()=>{vi.stubGlobal('File',NativeFile);vi.stubGlobal('Blob',NativeBlob);vi.stubGlobal('FormData',NativeFormData)});
afterEach(()=>{clearSession();vi.unstubAllGlobals();vi.clearAllMocks();localStorage.clear();sessionStorage.clear()});

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
