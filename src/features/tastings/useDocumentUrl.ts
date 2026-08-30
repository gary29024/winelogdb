import { useEffect,useState } from 'react';
import { authHeaders } from '../../lib/auth/client';

/**
 * A stored wine list page as something an <img> can show.
 *
 * Its own module rather than an export from the component that first needed it:
 * the sheet page shows the same thumbnails to choose which saved page to read,
 * and a file that exports both a component and a hook loses fast refresh.
 */
export function useDocumentUrl(documentId:string){
  const [src,setSrc]=useState<string>();
  useEffect(()=>{
    let active=true,created='';
    fetch(`/api/tastings/documents/${documentId}`,{headers:authHeaders()})
      .then(response=>{if(!response.ok)throw new Error('unavailable');return response.blob()})
      .then(blob=>{if(!active)return;created=URL.createObjectURL(blob);setSrc(created)})
      .catch(()=>undefined);
    return()=>{active=false;if(created)URL.revokeObjectURL(created)};
  },[documentId]);
  return src;
}
