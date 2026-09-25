import type { BurgundyAtlasPlace } from '../lib/places/burgundyAtlas';
import '../burgundyAtlas.css';

export function BurgundyAtlasLink({place,compact=false}:{place:BurgundyAtlasPlace|null;compact?:boolean}){
  if(!place)return null;
  // The cru name follows the visible words rather than interrupting them, so the
  // accessible name still contains the label a speech user reads off the
  // screen. "Explore {name} on Burgundy Atlas" reads well and fails WCAG 2.5.3:
  // nobody saying "Explore on Burgundy Atlas" would reach it.
  // One visible wording for every scope, so the link fits on one line beside
  // "View village map" on a phone. An appellation-level destination is still
  // announced as one, after the visible words.
  const label=compact?'Burgundy Atlas':'Explore on Burgundy Atlas';
  const destination=place.scope==='appellation'?`${place.name} appellation`:place.name;
  return <a className={`burgundy-atlas-link${compact?' burgundy-atlas-link-compact':''}`}
    href={place.url} target="_blank" rel="noopener noreferrer"
    aria-label={`${label}: ${destination} (opens in a new tab)`}>
    <span>{label}</span><span aria-hidden="true">↗</span>
  </a>;
}
