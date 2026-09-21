import type { BurgundyAtlasPlace } from '../lib/places/burgundyAtlas';
import '../burgundyAtlas.css';

export function BurgundyAtlasLink({place,compact=false}:{place:BurgundyAtlasPlace|null;compact?:boolean}){
  if(!place)return null;
  return <a className={`burgundy-atlas-link${compact?' burgundy-atlas-link-compact':''}`}
    href={place.url} target="_blank" rel="noopener noreferrer"
    aria-label={`Explore ${place.name} on Burgundy Atlas (opens in a new tab)`}>
    <span>{compact?'Burgundy Atlas':'Explore on Burgundy Atlas'}</span><span aria-hidden="true">↗</span>
  </a>;
}
