import { authHeaders } from '../../lib/auth/client';

export type CuveeResolution={
  matched:boolean;
  inputName:string;
  cuvee?:{
    id:string;
    producerId:string;
    canonicalName:string;
    appellation:string|null;
    wineStyle:string|null;
    catalogBacked:boolean;
    matchedName:string;
    matchType:'canonical'|'alias'|'structured';
    tastedCount:number;
    vintages:number[];
  };
};

async function json<T>(r:Response,message:string):Promise<T>{const body=await r.json().catch(()=>({})) as T&{error?:string};if(!r.ok)throw new Error(body.error||message);return body}

export function resolveCuvee(producerId:string,name:string,appellation?:string|null,style?:string|null){
  const params=new URLSearchParams({producerId,name});
  if(appellation)params.set('appellation',appellation);
  if(style)params.set('style',style);
  return fetch(`/api/cuvees/resolve?${params.toString()}`,{headers:authHeaders()}).then(r=>json<CuveeResolution>(r,'Could not resolve cuvée'));
}
