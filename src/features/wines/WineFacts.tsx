import type { ReactNode } from 'react';
import { placeLabels,wineFactRows,type FactRow,type WineFacts as Facts } from '../../lib/wine/detailFields';
import { SectionLabel } from '../../components/SectionLabel';
import { BurgundyAtlasLink } from '../../components/BurgundyAtlasLink';
import { burgundyAtlasWinePlace } from '../../lib/places/burgundyAtlas';
// The markup below and the rules it needs travel together. A page used to be
// able to render .detail-classification while forgetting this import, which is
// how a shared Village pill shipped with no styling at all; owning the import
// here makes that impossible for any page that renders the pill.
import '../../wineClassification.css';
import '../../wineFacts.css';

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
 const atlasPlace=burgundyAtlasWinePlace(wine);
 return <><div className="detail-pills">
  {wine.appellation&&<span>{wine.appellation}{denomination&&<small className="detail-denomination">{denomination}</small>}</span>}
  {!wine.appellation&&wine.region&&denomination&&<span>{wine.region}<small className="detail-denomination">{denomination}</small></span>}
  {wine.classification&&<span className={`detail-classification detail-classification-${wine.classification}`}>{classificationLabel[wine.classification]}</span>}
  {grapes.map(grape=><span key={grape}>{grape}</span>)}
  {extra}
 </div>{atlasPlace&&<div className="wine-atlas-context"><BurgundyAtlasLink place={atlasPlace}/></div>}</>;
}

/** A ruled label/value table. One shape for Wine details and Your experience. */
export function FactList({rows,className,pairedLabels=[]}:{rows:FactRow[];className?:string;pairedLabels?:string[]}){
 if(!rows.length)return null;
 return <dl className={`detail-facts${className?` ${className}`:''}`}>
  {rows.map(([label,value])=><div key={label} className={pairedLabels.includes(label)?`detail-fact-paired${pairedLabels.indexOf(label)%2===0?' detail-fact-paired-start':''}`:undefined}><dt>{label}</dt><dd>{value}</dd></div>)}
 </dl>;
}

/** The Wine details panel. `extra` appends rows only one viewer is entitled to. */
export function WineDetailsSection({wine,extra=[],canEditReference=false}:{wine:Facts;extra?:FactRow[];canEditReference?:boolean}){
 const rows=[...wineFactRows(wine,{canEditReference}),...extra];
 if(!rows.length)return null;
 const pairedLabels=wine.identityMatchStatus==='conflict'?[]:[['Type','Alcohol'],['LWIN7','LWIN11']].flatMap(pair=>{
  const labels=pair.map(name=>rows.find(([label])=>label===name)?.[0]);
  return labels.every((label):label is string=>Boolean(label))?labels:[];
 });
 return <section className="detail-section">
  <SectionLabel>Wine details</SectionLabel>
  <FactList rows={rows} className="detail-wine-facts" pairedLabels={pairedLabels}/>
 </section>;
}
