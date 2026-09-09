import { afterEach,describe,expect,it,vi } from 'vitest';
import app from '../../worker/structureEntry';
import { createSession } from '../../src/lib/auth/session';
import { thumbnailObjectKey } from '../../src/lib/r2/thumbnails';
import { createD1Stub } from './support/d1Stub';
const tasks:Promise<unknown>[]=[];
const SECRET='test-secret-value-long-enough-for-hmac';
function setup(){
  let exists=true;
  const stub=createD1Stub((sql,args)=>/SELECT object_key FROM wine_images/.test(sql)&&exists&&args[1]==='owner'?{first:{object_key:'owner/original.jpg'}}:undefined);
  const entries=new Map<string,Response>();
  const cache={match:vi.fn(async(req:Request)=>entries.get(req.url)?.clone()),put:vi.fn(async(req:Request,res:Response)=>{entries.set(req.url,res.clone())})};
  vi.stubGlobal('caches',{default:cache});
  const objects=new Map<string,string>([['owner/original.jpg','original-photo']]);
  const get=vi.fn(async(key:string)=>objects.has(key)?{body:new Response(objects.get(key)!).body!,httpMetadata:{contentType:key.startsWith('thumb/')?'image/webp':'image/jpeg'}}:null);
  const put=vi.fn(async(key:string,body:ArrayBuffer|ReadableStream|null)=>{objects.set(key,await new Response(body).text())});
  const del=vi.fn(async(key:string)=>{objects.delete(key)});
  const output=vi.fn(async()=>({response:()=>new Response('small-webp',{headers:{'Content-Type':'image/webp'}})}));
  const transform=vi.fn(()=>({output}));
  const input=vi.fn(()=>({transform}));
  const env={DB:stub.db,WINE_IMAGES:{get,put,delete:del},IMAGES:{input},AUTH_SECRET:SECRET,APP_PASSWORD:'p',APP_URL:'https://x',ASSETS:{fetch:async()=>new Response('spa')}};
  const background:Promise<unknown>[]=[];
  const waitUntil=vi.fn((task:Promise<unknown>)=>{background.push(task);tasks.push(task)});
  async function request(variant='?variant=thumbnail',owner:string|null='owner'){
    return app.fetch(new Request(`https://x/api/images/i1${variant}`,{headers:owner?{authorization:`Bearer ${await createSession(owner,SECRET)}`}:{}}),env as never,{waitUntil,passThroughOnException:()=>{}} as never);
  }
  return {stub,cache,entries,objects,get,put,del,input,transform,output,env,request,background,waitUntil,remove:()=>{exists=false}};
}
afterEach(async()=>{await Promise.all(tasks.splice(0));vi.unstubAllGlobals();vi.restoreAllMocks()});
describe('private wine thumbnails through the deployed entrypoint',()=>{
  it('resizes once, preserves aspect ratio, and serves repeat requests from cache',async()=>{
    const {request,cache,get,input,transform,output}=setup();
    const first=await request();expect(await first.text()).toBe('small-webp');
    expect(first.headers.get('content-type')).toBe('image/webp');
    expect(first.headers.get('cache-control')).toBe('private, max-age=86400, immutable');
    expect(transform).toHaveBeenCalledWith({width:640,height:640,fit:'scale-down'});
    expect(output).toHaveBeenCalledWith({format:'image/webp',quality:75,anim:false});
    const second=await request();expect(await second.text()).toBe('small-webp');
    expect(second.headers.get('cache-control')).toContain('private');
    expect(input).toHaveBeenCalledTimes(1);expect(get).toHaveBeenCalledTimes(2);expect(cache.put).toHaveBeenCalledTimes(1);
  });
  it('requires authentication and ownership even with a cached thumbnail',async()=>{
    const {request,cache,get,remove}=setup();await request();
    const hits=cache.match.mock.calls.length;
    expect((await request('?variant=thumbnail',null)).status).toBe(401);
    expect((await request('?variant=thumbnail','other-owner')).status).toBe(404);
    remove();expect((await request()).status).toBe(404);
    expect(cache.match).toHaveBeenCalledTimes(hits);expect(get).toHaveBeenCalledTimes(2);
  });
  it('continues to serve original bytes for enlargements and exports',async()=>{
    const {request,input,cache}=setup();
    const response=await request('');expect(await response.text()).toBe('original-photo');
    expect(response.headers.get('content-type')).toBe('image/jpeg');expect(input).not.toHaveBeenCalled();expect(cache.match).not.toHaveBeenCalled();
  });
  it('falls back at the Free allowance without caching the original as a thumbnail',async()=>{
    const {request,output,cache,get}=setup();output.mockRejectedValueOnce(new Error('9422: free allowance reached'));
    const response=await request();expect(await response.text()).toBe('original-photo');
    expect(response.headers.get('cache-control')).toBe('private, max-age=300');expect(cache.put).not.toHaveBeenCalled();expect(get).toHaveBeenCalledTimes(3);
  });
  it('falls back when the binding is unavailable',async()=>{
    const {request,env,input}=setup();delete (env as {IMAGES?:unknown}).IMAGES;
    const response=await request();expect(await response.text()).toBe('original-photo');expect(input).not.toHaveBeenCalled();
  });
  it('tolerates Cache API failures',async()=>{
    const {request,cache}=setup();cache.match.mockRejectedValueOnce(new Error('cache unavailable'));cache.put.mockRejectedValueOnce(new Error('cache full'));
    expect(await (await request()).text()).toBe('small-webp');
  });
  it('returns the thumbnail while its cache write is still pending',async()=>{
    const {request,cache,background,waitUntil}=setup();
    let finish!:()=>void;
    cache.put.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve}));
    const response=await request();
    try{
      expect(await response.text()).toBe('small-webp');
      expect(waitUntil).toHaveBeenCalledTimes(1);
      expect(background).toHaveLength(1);
    }finally{finish();await Promise.all(background)}
  },1000);
  it('handles a cache rejection after the thumbnail has been delivered',async()=>{
    const {request,cache,background}=setup();
    let fail!:(error:Error)=>void;
    cache.put.mockImplementationOnce(()=>new Promise<void>((_resolve,reject)=>{fail=reject}));
    const response=await request();
    expect(await response.text()).toBe('small-webp');
    fail(new Error('late cache failure'));
    await expect(Promise.all(background)).resolves.toEqual([undefined]);
  },1000);
  it('retains a WebP in R2 and reuses it after the edge cache is emptied',async()=>{
    const {request,entries,objects,background,input,get,put}=setup();
    expect(await (await request()).text()).toBe('small-webp');await Promise.all(background);
    expect(objects.get(thumbnailObjectKey('owner/original.jpg'))).toBe('small-webp');
    expect(put).toHaveBeenCalledTimes(1);
    entries.clear();get.mockClear();
    expect(await (await request()).text()).toBe('small-webp');
    expect(get).toHaveBeenCalledExactlyOnceWith(thumbnailObjectKey('owner/original.jpg'));
    expect(input).toHaveBeenCalledTimes(1);expect(put).toHaveBeenCalledTimes(1);
  });
  it('serves a retained thumbnail even with no Images binding',async()=>{
    const {request,env,objects,get,input}=setup();
    objects.set(thumbnailObjectKey('owner/original.jpg'),'retained-webp');delete (env as {IMAGES?:unknown}).IMAGES;
    expect(await (await request()).text()).toBe('retained-webp');
    expect(get).toHaveBeenCalledTimes(1);expect(input).not.toHaveBeenCalled();
  });
  it('does not regenerate on a failed thumbnail read',async()=>{
    const {request,get,input,put}=setup();get.mockRejectedValueOnce(new Error('R2 read unavailable'));
    expect(await (await request()).text()).toBe('original-photo');
    expect(input).not.toHaveBeenCalled();expect(put).not.toHaveBeenCalled();
  });
  it('still delivers the thumbnail if persistence fails',async()=>{
    const {request,put,background,objects}=setup();put.mockRejectedValueOnce(new Error('R2 write unavailable'));
    expect(await (await request()).text()).toBe('small-webp');await expect(Promise.all(background)).resolves.toEqual([undefined]);
    expect(objects.has(thumbnailObjectKey('owner/original.jpg'))).toBe(false);
  });
  it('cleans a derivative when deletion races the background write',async()=>{
    const {request,put,remove,background,objects,del}=setup();
    let finish!:()=>void;
    put.mockImplementationOnce(async(key,body)=>{await new Promise<void>(resolve=>{finish=resolve});objects.set(key,await new Response(body).text())});
    const response=await request();expect(await response.text()).toBe('small-webp');
    await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));
    remove();finish();await Promise.all(background);
    expect(del).toHaveBeenCalledWith(thumbnailObjectKey('owner/original.jpg'));
    expect(objects.has(thumbnailObjectKey('owner/original.jpg'))).toBe(false);
  });
  it('never persists an original fallback',async()=>{
    const {request,output,put,background}=setup();output.mockRejectedValueOnce(new Error('9422'));
    expect(await (await request()).text()).toBe('original-photo');await Promise.all(background);expect(put).not.toHaveBeenCalled();
  });
  it('refuses arbitrary transformation variants',async()=>{
    const {request,input,get}=setup();expect((await request('?variant=huge')).status).toBe(400);expect(input).not.toHaveBeenCalled();expect(get).not.toHaveBeenCalled();
  });
});
