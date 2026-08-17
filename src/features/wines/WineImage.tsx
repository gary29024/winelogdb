import { useEffect,useState } from 'react';
import { authHeaders } from '../../lib/auth/client';

export function WineImage({imageId,alt,className}:{imageId:string;alt:string;className?:string}){
  const [src,setSrc]=useState<string>();
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    let active=true,objectUrl:string|undefined;
    setSrc(undefined);setFailed(false);
    fetch(`/api/images/${imageId}`,{headers:authHeaders()})
      .then(async r=>{if(!r.ok)throw new Error(`Image failed (${r.status})`);return r.blob()})
      .then(blob=>{if(!active)return;objectUrl=URL.createObjectURL(blob);setSrc(objectUrl)})
      .catch(()=>{if(active)setFailed(true)});
    return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)};
  },[imageId]);
  if(failed)return <span className={`wine-image-fallback ${className??''}`} aria-label={`${alt} unavailable`}>W</span>;
  if(!src)return <span className={`wine-image-loading ${className??''}`} aria-label={`${alt} loading`}/>;
  return <img className={className} src={src} alt={alt}/>;
}
