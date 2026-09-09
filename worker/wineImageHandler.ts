type ImageBindings={DB:D1Database;WINE_IMAGES:R2Bucket;IMAGES?:ImagesBinding};
const THUMBNAIL_VERSION='v1';
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
  const cacheKey=new Request(new URL(`/__wine_thumbnails/${THUMBNAIL_VERSION}/${encodeURIComponent(owner)}/${encodeURIComponent(row.object_key)}`,request.url));
  const cache=thumbnail&&typeof caches!=='undefined'?(caches as CacheStorage&{default?:Cache}).default:undefined;
  if(cache){
    const cached=await cache.match(cacheKey).catch(()=>undefined);
    if(cached)return privateImage(cached);
  }
  let original=await env.WINE_IMAGES.get(row.object_key);
  if(!original)return Response.json({error:'Not found'},{status:404});
  if(thumbnail&&env.IMAGES){
    try{
      // Preserve the full aspect ratio and let the existing card CSS frame it.
      // One fixed variant; monthly unique usage is distinct from cache misses.
      const output=await env.IMAGES.input(original.body)
        .transform({width:640,height:640,fit:'scale-down'})
        .output({format:'image/webp',quality:75,anim:false});
      const response=output.response();
      if(!response.ok)throw new Error(`Image transform returned ${response.status}`);
      if(cache){
        const cached=new Response(response.clone().body,{headers:{'Content-Type':'image/webp','Cache-Control':'public, max-age=2592000'}});
        // Keep the write alive without delaying delivery of the thumbnail.
        // A late cache failure must not hide the successfully transformed image.
        ctx.waitUntil(cache.put(cacheKey,cached).catch(()=>undefined));
      }
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
