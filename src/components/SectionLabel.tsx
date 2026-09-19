import type { ReactNode } from 'react';
import { AppIcon,type AppIconKey } from './AppIcons';
import '../sectionProvenance.css';

/**
 * Who is answerable for the facts under this heading.
 *
 * WineLog already knows: research carries a source tier and a quality score,
 * LWIN identifiers are matched and stored, and everything else on a wine was
 * either typed by its owner or derived from what they typed. None of that
 * reached the page, because every section was the same white card - so a
 * Liv-ex registry number, a researched paragraph and a score somebody invented
 * over dinner all read as equally authoritative.
 *
 * Four ranks, of which only three are marked. Derived is the default and stays
 * silent: a badge on every section marks nothing, which is exactly what
 * happened to the tracked-uppercase treatment before section labels became
 * sentence case.
 */
export type Provenance='yours'|'reference'|'researched';

const badges:Record<Provenance,{label:string;icon:AppIconKey;title:string}>={
  yours:{label:'Yours',icon:'pen',title:'You recorded this, and you can change it.'},
  reference:{label:'Reference',icon:'lock',title:'From the LWIN reference catalogue. It cannot be edited here.'},
  researched:{label:'Researched',icon:'sparkle',title:'Researched by WineLog from cited sources.'}
};

export function SectionLabel({children,origin,trailing}:{
  children:ReactNode;
  origin?:Provenance;
  /** Anything that shares the row, such as a quality pill or a collapse-all button. */
  trailing?:ReactNode;
}){
  const badge=origin?badges[origin]:null;
  return <p className="section-label">
    <span className="section-label-text">{children}</span>
    {badge&&<span className="chip provenance-chip" data-origin={origin} title={badge.title}>
      <span className="provenance-icon" aria-hidden="true"><AppIcon kind={badge.icon}/></span>{badge.label}
    </span>}
    {trailing}
  </p>;
}
