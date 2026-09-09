import { THUMBNAIL_VERSION,thumbnailObjectKey } from '../src/lib/r2/thumbnails';

type ImageBindings={DB:D1Database;WINE_IMAGES:R2Bucket;IMAGES?:ImagesBinding};
const PRIVATE_CACHE='private, max-age=86400, immutable';
const FALLBACK_CACHE='private, max-age=300';

function privateImage(response:Response,cacheControl=PRIVATE_CACHE){
  const headers=new Headers(response.headers);
  headers.set('Cache-Control',cacheControl);
  headers.set('Content-Security-Policy',"default-src 'none'");
  headers.set('X-Content-Type-Options','nosniff');
  return new Response(response.body,{status:response.status,headers});
}

/** One fixed variant, authenticated before even checking the internal edge cache. */
export async function serveWineImage(request:Request,env:ImageBindings,owner:string,id:string,ctx:Pick<ExecutionContext,'waitUntil'>){
  const variant=new URL(request.url).searchParams.get('variant');
  if(variant&&variant!=='thumbnail')return Response.json({error:'Unknown image variant'}, {status:400});
  const row=await env.DB.prepare('SELECT object_key FROM wine_images WHERE id=? AND owner_id=?').bind(id,owner).first<{object_key:string}>();
  if(!row)return Response.json({error:'Not found'},{status:404});
  const thumbnail=variant==='thumbnail';
  // This is an internal Cache API key, never a publicly routable image URL.
  // Ownership is rechecked above even on cache hits, including after deletion.
  const cacheKey=new Request(new URL(`/__wine_thumbnails/r2/${THUMBNAIL_VERSION}/${encodeURIComponent(owner)}/${encodeURIComponent(row.object_key)}`,request.url));
  const cache=thumbnail&&typeof caches!=='undefined'?(caches as CacheStorage&{default?:Cache}).default:undefined;
  if(cache){
    const cached=await cache.match(cacheKey).catch(()=>undefined);
    if(cached)return privateImage(cached);
  }
  const derivativeKey=thumbnailObjectKey(row.object_key);
  const cacheWrite=(response:Response)=>{
    if(!cache)return Promise.resolve();
    const cached=new Response(response.clone().body,{headers:{'Content-Type':'image/webp','Cache-Control':'public, max-age=2592000'}});
    return cache.put(cacheKey,cached).catch(()=>undefined);
  };
  let canGenerate=thumbnail&&Boolean(env.IMAGES);
  if(thumbnail){
    try{
      const stored=await env.WINE_IMAGES.get(derivativeKey);
      if(stored){
        const response=new Response(stored.body,{headers:{'Content-Type':'image/webp'}});
        ctx.waitUntil(cacheWrite(response));
        return privateImage(response);
      }
    }catch(error){
      // A failed read is not proof the derivative is missing. Avoid paying for
      // another transform during a storage outage; the original is the fallback.
      canGenerate=false;
      console.warn(JSON.stringify({event:'thumbnail-read-failed',imageId:id,error:(error as Error).message}));
    }
  }
  let original=await env.WINE_IMAGES.get(row.object_key);
  if(!original)return Response.json({error:'Not found'},{status:404});
  if(canGenerate&&env.IMAGES){
    try{
      // Preserve the full aspect ratio and let the existing card CSS frame it.
      // One fixed variant; monthly unique usage is distinct from cache misses.
      const output=await env.IMAGES.input(original.body)
        .transform({width:640,height:640,fit:'scale-down'})
        .output({format:'image/webp',quality:75,anim:false});
      const response=output.response();
      if(!response.ok)throw new Error(`Image transform returned ${response.status}`);
      const persist=async()=>{
        try{
          // R2 receives a known-length body, independent of the Images stream.
          const bytes=await response.clone().arrayBuffer();
          await env.WINE_IMAGES.put(derivativeKey,bytes,{httpMetadata:{contentType:'image/webp'},storageClass:'Standard'});
          // Deletion can race a background transform/write. If deletion won,
          // remove the newly written derivative rather than orphaning it.
          const live=await env.DB.prepare('SELECT object_key FROM wine_images WHERE id=? AND owner_id=?').bind(id,owner).first<{object_key:string}>();
          if(live?.object_key!==row.object_key)await env.WINE_IMAGES.delete(derivativeKey);
        }catch(error){
          console.warn(JSON.stringify({event:'thumbnail-persist-failed',imageId:id,error:(error as Error).message}));
        }
      };
      // Both writes outlive delivery, and neither can turn a good image into
      // an error response. Future cache misses read the retained R2 WebP.
      ctx.waitUntil(Promise.all([persist(),cacheWrite(response)]).then(()=>undefined));
      return privateImage(response);
    }catch(error){
      // Images Free rejects new transformations at its allowance, without
      // overage charges. The original remains viewable, and is not cached as
      // an immutable thumbnail. Re-read because Images consumed the stream.
      console.warn(JSON.stringify({event:'thumbnail-fallback',imageId:id,error:(error as Error).message}));
      original=await env.WINE_IMAGES.get(row.object_key);
      if(!original)return Response.json({error:'Not found'},{status:404});
    }
  }
  return privateImage(new Response(original.body,{headers:{'Content-Type':original.httpMetadata?.contentType||'application/octet-stream'}}),thumbnail?FALLBACK_CACHE:PRIVATE_CACHE);
}
