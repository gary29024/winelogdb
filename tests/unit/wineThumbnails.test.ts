import { afterEach,describe,expect,it,vi } from 'vitest';
import app from '../../worker/structureEntry';
import { createSession } from '../../src/lib/auth/session';
import { createD1Stub } from './support/d1Stub';
const SECRET='test-secret-value-long-enough-for-hmac';
function setup(){
  let exists=true;
  const stub=createD1Stub((sql,args)=>/SELECT object_key FROM wine_images/.test(sql)&&exists&&args[1]==='owner'?{first:{object_key:'owner/original.jpg'}}:undefined);
  const entries=new Map<string,Response>();
  const cache={match:vi.fn(async(req:Request)=>entries.get(req.url)?.clone()),put:vi.fn(async(req:Request,res:Response)=>{entries.set(req.url,res.clone())})};
  vi.stubGlobal('caches',{default:cache});
  const get=vi.fn(async()=>({body:new Response('original-photo').body!,httpMetadata:{contentType:'image/jpeg'}}));
  const output=vi.fn(async()=>({response:()=>new Response('small-webp',{headers:{'Content-Type':'image/webp'}})}));
  const transform=vi.fn(()=>({output}));
  const input=vi.fn(()=>({transform}));
  const env={DB:stub.db,WINE_IMAGES:{get},IMAGES:{input},AUTH_SECRET:SECRET,APP_PASSWORD:'p',APP_URL:'https://x',ASSETS:{fetch:async()=>new Response('spa')}};
  async function request(variant='?variant=thumbnail',owner:string|null='owner'){
    return app.fetch(new Request(`https://x/api/images/i1${variant}`,{headers:owner?{authorization:`Bearer ${await createSession(owner,SECRET)}`}:{}}),env as never,{waitUntil:()=>{},passThroughOnException:()=>{}} as never);
  }
  return {stub,cache,get,input,transform,output,env,request,remove:()=>{exists=false}};
}
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks()});
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
    expect(input).toHaveBeenCalledTimes(1);expect(get).toHaveBeenCalledTimes(1);expect(cache.put).toHaveBeenCalledTimes(1);
  });
  it('requires authentication and ownership even with a cached thumbnail',async()=>{
    const {request,cache,get,remove}=setup();await request();
    const hits=cache.match.mock.calls.length;
    expect((await request('?variant=thumbnail',null)).status).toBe(401);
    expect((await request('?variant=thumbnail','other-owner')).status).toBe(404);
    remove();expect((await request()).status).toBe(404);
    expect(cache.match).toHaveBeenCalledTimes(hits);expect(get).toHaveBeenCalledTimes(1);
  });
  it('continues to serve original bytes for enlargements and exports',async()=>{
    const {request,input,cache}=setup();
    const response=await request('');expect(await response.text()).toBe('original-photo');
    expect(response.headers.get('content-type')).toBe('image/jpeg');expect(input).not.toHaveBeenCalled();expect(cache.match).not.toHaveBeenCalled();
  });
  it('falls back at the Free allowance without caching the original as a thumbnail',async()=>{
    const {request,output,cache,get}=setup();output.mockRejectedValueOnce(new Error('9422: free allowance reached'));
    const response=await request();expect(await response.text()).toBe('original-photo');
    expect(response.headers.get('cache-control')).toBe('private, max-age=300');expect(cache.put).not.toHaveBeenCalled();expect(get).toHaveBeenCalledTimes(2);
  });
  it('falls back when the binding is unavailable',async()=>{
    const {request,env,input}=setup();delete (env as {IMAGES?:unknown}).IMAGES;
    const response=await request();expect(await response.text()).toBe('original-photo');expect(input).not.toHaveBeenCalled();
  });
  it('tolerates Cache API failures',async()=>{
    const {request,cache}=setup();cache.match.mockRejectedValueOnce(new Error('cache unavailable'));cache.put.mockRejectedValueOnce(new Error('cache full'));
    expect(await (await request()).text()).toBe('small-webp');
  });
  it('refuses arbitrary transformation variants',async()=>{
    const {request,input,get}=setup();expect((await request('?variant=huge')).status).toBe(400);expect(input).not.toHaveBeenCalled();expect(get).not.toHaveBeenCalled();
  });
});
