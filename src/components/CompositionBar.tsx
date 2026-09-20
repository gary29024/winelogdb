import { compositionShares,type CompositionEntry } from '../lib/ui/composition';
import '../compositionBar.css';

/**
 * The shape of a set, before its contents.
 *
 * A producer page used to open on a list of wine names, which means reading
 * twenty rows to learn that a domaine is mostly premier cru. One stacked track
 * says it at a glance, and the list underneath answers the next question rather
 * than the first one.
 *
 * The legend is not decoration and is not optional above one segment: colour is
 * never the only thing carrying identity, and because the legend prints every
 * count and percentage it doubles as the table view that the light-mode slots
 * need in order to be read at all.
 */
export function CompositionBar({entries,unit,label}:{
  entries:readonly CompositionEntry[];
  /** The thing being counted, e.g. "wines" - already plural. */
  unit:string;
  /** Describes the whole bar to a screen reader, e.g. "Range by classification". */
  label:string;
}){
  const segments=compositionShares(entries).filter(segment=>segment.percent>0);
  if(!segments.length)return null;
  const summary=segments.map(segment=>`${segment.label} ${segment.percent}%, ${segment.count} ${unit}`).join('; ');
  return <div className="composition">
    <div className="composition-track" role="img" aria-label={`${label}: ${summary}`}>
      {segments.map(segment=><span
        key={segment.key}
        className="composition-segment"
        data-tone={segment.tone}
        style={{width:`${segment.percent}%`}}
        title={`${segment.label} — ${segment.count} ${unit} (${segment.percent}%)`}
      />)}
    </div>
    {segments.length>1&&<ul className="composition-legend">
      {segments.map(segment=><li key={segment.key}>
        <span className="composition-swatch" data-tone={segment.tone} aria-hidden="true"/>
        <span className="composition-legend-label">{segment.label}</span>
        <span className="composition-legend-value">{segment.percent}% · {segment.count} {unit}</span>
      </li>)}
    </ul>}
  </div>;
}
