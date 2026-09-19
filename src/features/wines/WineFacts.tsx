import type { ReactNode } from 'react';
import { hasReference,placeLabels,referenceRows,wineFactRows,type FactRow,type WineFacts as Facts,type WineReference } from '../../lib/wine/detailFields';
import { SectionLabel } from '../../components/SectionLabel';
// The markup below and the rules it needs travel together. A page used to be
// able to render .detail-classification while forgetting this import, which is
// how a shared Village pill shipped with no styling at all; owning the import
// here makes that impossible for any page that renders the pill.
import '../../wineClassification.css';
// Same rule, for the reference panel: the component that renders the class owns
// the stylesheet, so a page cannot show the panel without its rules.
import '../../wineReference.css';

const classificationLabel:Record<string,string>={grand_cru:'Grand Cru',premier_cru:'Premier Cru',village:'Village'};

type PillWine=Facts&{classification?:'grand_cru'|'premier_cru'|'village'|null};

/**
 * The identity pills: appellation with its denomination, the cru tier, grapes.
 * Both wine detail pages render this, so the row cannot drift between them.
 * `extra` carries anything only one viewer gets, such as the owner's score.
 */
export function WineFactPills({wine,extra}:{wine:PillWine;extra?:ReactNode}){
 const {denomination}=placeLabels(wine);
 const blend=wine.grapeBlend??[],grapes=blend.length?blend.map(part=>part.grape):wine.grapes??[];
 return <div className="detail-pills">
  {wine.appellation&&<span>{wine.appellation}{denomination&&<small className="detail-denomination">{denomination}</small>}</span>}
  {!wine.appellation&&wine.region&&denomination&&<span>{wine.region}<small className="detail-denomination">{denomination}</small></span>}
  {wine.classification&&<span className={`detail-classification detail-classification-${wine.classification}`}>{classificationLabel[wine.classification]}</span>}
  {grapes.map(grape=><span key={grape}>{grape}</span>)}
  {extra}
 </div>;
}

/** A ruled label/value table. One shape for Wine details and Your experience. */
export function FactList({rows,className}:{rows:FactRow[];className?:string}){
 if(!rows.length)return null;
 return <dl className={`detail-facts${className?` ${className}`:''}`}>
  {rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
 </dl>;
}

/** The Wine details panel. `extra` appends rows only one viewer is entitled to. */
export function WineDetailsSection({wine,extra=[]}:{wine:Facts;extra?:FactRow[]}){
 return <section className="detail-section">
  <SectionLabel>Wine details</SectionLabel>
  <FactList rows={[...wineFactRows(wine),...extra]}/>
 </section>;
}

/**
 * The Official reference panel: what LWIN and ELID say, marked as theirs.
 *
 * Both wine pages render it, so a recipient sees the same identifiers under the
 * same heading. It disappears entirely when nothing matched - an empty
 * reference panel would imply the catalogues had been consulted and come back
 * blank, which is a different claim from never having matched at all.
 */
export function WineReferenceSection({wine}:{wine:WineReference}){
 if(!hasReference(wine))return null;
 return <section className="detail-section reference-panel">
  <SectionLabel origin="reference">Official reference</SectionLabel>
  <FactList rows={referenceRows(wine)}/>
  <p className="reference-note">LWIN identifies the appellation a wine is registered under, not the parcel inside it.</p>
 </section>;
}
