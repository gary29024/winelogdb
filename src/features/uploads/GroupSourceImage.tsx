import { useEffect,useRef,useState } from 'react';
import { authHeaders } from '../../lib/auth/client';

export function GroupSourceImage({sessionId,alt,className}:{sessionId:string;alt:string;className?:string}){
  const placeholderRef=useRef<HTMLSpanElement|null>(null),[shouldLoad,setShouldLoad]=useState(false),[src,setSrc]=useState<string>(),[failed,setFailed]=useState(false);
  useEffect(()=>{setShouldLoad(false);setSrc(undefined);setFailed(false)},[sessionId]);
  useEffect(()=>{if(shouldLoad)return;const node=placeholderRef.current;if(!node)return;if(typeof IntersectionObserver==='undefined'){setShouldLoad(true);return}const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setShouldLoad(true);observer.disconnect()}},{rootMargin:'320px 0px'});observer.observe(node);return()=>observer.disconnect()},[sessionId,shouldLoad]);
  useEffect(()=>{if(!shouldLoad)return;let active=true,objectUrl:string|undefined;fetch(`/api/group-recognition/sessions/${encodeURIComponent(sessionId)}/image/preview`,{headers:authHeaders(),cache:'default'}).then(async response=>{if(!response.ok)throw new Error(`Group Photo failed (${response.status})`);return response.blob()}).then(blob=>{if(!active)return;objectUrl=URL.createObjectURL(blob);setSrc(objectUrl)}).catch(()=>{if(active)setFailed(true)});return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)}},[sessionId,shouldLoad]);
  if(failed)return <span className={`wine-image-fallback ${className??''}`} aria-label={`${alt} unavailable`}>G</span>;
  if(!src)return <span ref={placeholderRef} className={`wine-image-loading ${className??''}`} aria-label={`${alt} loading`}/>;
  return <img className={className} src={src} alt={alt} loading="lazy" decoding="async"/>;
}
