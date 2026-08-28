import { useEffect,useRef,useState } from 'react';
import { authHeaders } from '../../lib/auth/client';
import { labelFocusPosition } from '../../lib/wine/labelFocus';
import '../../wineImages.css';

const MAX_CACHED_IMAGES=144;
const imageUrls=new Map<string,string>();
const imageRequests=new Map<string,Promise<string>>();

function cachedImageUrl(imageId:string){
  const src=imageUrls.get(imageId);if(!src)return undefined;
  imageUrls.delete(imageId);imageUrls.set(imageId,src);return src;
}

function rememberImageUrl(imageId:string,src:string){
  const previous=imageUrls.get(imageId);if(previous&&previous!==src)URL.revokeObjectURL(previous);
  imageUrls.delete(imageId);imageUrls.set(imageId,src);
  while(imageUrls.size>MAX_CACHED_IMAGES){
    const oldest=imageUrls.entries().next().value as [string,string]|undefined;if(!oldest)break;
    imageUrls.delete(oldest[0]);URL.revokeObjectURL(oldest[1]);
  }
}

function loadImageUrl(imageId:string){
  const cached=cachedImageUrl(imageId);if(cached)return Promise.resolve(cached);
  const pending=imageRequests.get(imageId);if(pending)return pending;
  const request=fetch(`/api/images/${imageId}`,{headers:authHeaders(),cache:'default'})
    .then(async response=>{if(!response.ok)throw new Error(`Image failed (${response.status})`);return response.blob()})
    .then(blob=>{const src=URL.createObjectURL(blob);rememberImageUrl(imageId,src);return src})
    .finally(()=>imageRequests.delete(imageId));
  imageRequests.set(imageId,request);return request;
}

export function WineImage({imageId,alt,className}:{imageId:string;alt:string;className?:string}){
  const placeholderRef=useRef<HTMLSpanElement|null>(null);
  const [shouldLoad,setShouldLoad]=useState(()=>Boolean(cachedImageUrl(imageId)));
  const [src,setSrc]=useState<string|undefined>(()=>cachedImageUrl(imageId));
  const [failed,setFailed]=useState(false);
  // Measured off the loaded image rather than plumbed through the API, so it
  // works the same in the journal list, on the detail page and in the passport.
  const [objectPosition,setObjectPosition]=useState<string>();

  useEffect(()=>{
    const cached=cachedImageUrl(imageId);setShouldLoad(Boolean(cached));setSrc(cached);setFailed(false);setObjectPosition(undefined);
  },[imageId]);

  useEffect(()=>{
    if(src||shouldLoad)return;
    const node=placeholderRef.current;if(!node)return;
    if(typeof IntersectionObserver==='undefined'){setShouldLoad(true);return}
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){setShouldLoad(true);observer.disconnect()}
    },{rootMargin:'320px 0px'});
    observer.observe(node);
    return()=>observer.disconnect();
  },[imageId,shouldLoad,src]);

  useEffect(()=>{
    if(!shouldLoad||src)return;
    let active=true;
    loadImageUrl(imageId)
      .then(url=>{if(active)setSrc(url)})
      .catch(()=>{if(active)setFailed(true)});
    return()=>{active=false};
  },[imageId,shouldLoad,src]);

  if(failed)return <span className={`wine-image-fallback ${className??''}`} aria-label={`${alt} unavailable`}>W</span>;
  if(!src)return <span ref={placeholderRef} className={`wine-image-loading ${className??''}`} aria-label={`${alt} loading`}/>;
  return <img className={className} src={src} alt={alt} loading="lazy" decoding="async" style={objectPosition?{objectPosition}:undefined}
    onLoad={event=>setObjectPosition(labelFocusPosition(event.currentTarget.naturalWidth,event.currentTarget.naturalHeight))}/>;
}
