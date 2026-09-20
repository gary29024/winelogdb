import { useLocation,useSearchParams } from 'react-router-dom';
import type { SectionItem } from './SectionNavigation';
export function usePageSection(items:SectionItem[],fallback:string,legacyHash?:{hash:string;section:string}){
 const [params,setParams]=useSearchParams(),location=useLocation();
 const requested=params.get('section')??(legacyHash?.hash===location.hash?legacyHash.section:fallback);
 const selected=items.some(item=>item.id===requested)?requested:fallback;
 const select=(id:string)=>setParams(previous=>{const next=new URLSearchParams(previous);next.set('section',id);return next});
 return [selected,select] as const;
}
