import { useEffect,useState } from 'react';
import { authHeaders } from '../../lib/auth/client';

export function ProducerHeroImage({producerId,alt}:{producerId:string;alt:string}){
  const [src,setSrc]=useState<string>();
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    let active=true,objectUrl:string|undefined;
    setSrc(undefined);setFailed(false);
    fetch(`/api/producers/${producerId}/hero-image`,{headers:authHeaders()})
      .then(async response=>{if(!response.ok)throw new Error(`Producer image failed (${response.status})`);return response.blob()})
      .then(blob=>{if(!active)return;objectUrl=URL.createObjectURL(blob);setSrc(objectUrl)})
      .catch(()=>{if(active)setFailed(true)});
    return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)};
  },[producerId]);
  if(failed)return null;
  if(!src)return <span className="producer-hero-loading" aria-label={`${alt} image loading`}/>;
  return <img className="producer-hero-image" src={src} alt={alt}/>;
}
