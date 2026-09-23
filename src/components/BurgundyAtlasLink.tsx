import type { BurgundyAtlasPlace } from '../lib/places/burgundyAtlas';
import '../burgundyAtlas.css';

export function BurgundyAtlasLink({place,compact=false}:{place:BurgundyAtlasPlace|null;compact?:boolean}){
  if(!place)return null;
  // The cru name follows the visible words rather than interrupting them, so the
  // accessible name still contains the label a speech user reads off the
  // screen. "Explore {name} on Burgundy Atlas" reads well and fails WCAG 2.5.3:
  // nobody saying "Explore on Burgundy Atlas" would reach it.
  const label=compact?'Burgundy Atlas':place.scope==='appellation'?'Explore appellation on Burgundy Atlas':'Explore on Burgundy Atlas';
  return <a className={`burgundy-atlas-link${compact?' burgundy-atlas-link-compact':''}`}
    href={place.url} target="_blank" rel="noopener noreferrer"
    aria-label={`${label}: ${place.name} (opens in a new tab)`}>
    <span>{label}</span><span aria-hidden="true">↗</span>
  </a>;
}
