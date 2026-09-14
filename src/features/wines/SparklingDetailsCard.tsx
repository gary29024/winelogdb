import { hasSparklingDetails,type SparklingDetails } from '../../lib/wine/sparklingDetails';
import '../../sparklingDetails.css';

type Props={details:SparklingDetails|null|undefined};

export function SparklingDetailsCard({details}:Props){
  if(!hasSparklingDetails(details)||!details)return null;
  const chips:Array<[string,string|number|null|undefined,string?]>=[
    ['Dosage',details.dosageGPerL,' g/L'],
    ['Style',details.dosageCategory],
    ['Disgorged',details.disgorgement],
    ['Tirage',details.tirage],
    ['Base',details.baseVintage],
    ['Reserve',details.reserveWinePercentage,'%'],
    ['Lees',details.leesAgeingMonths,' mo'],
    ['Lot',details.lotCode]
  ];
  const notes:Array<[string,string|null|undefined]>=[
    ['Assemblage',details.assemblage],['Reserve wines',details.reserveWineDetail],['Malolactic',details.malolactic],['Fermentation / élevage',details.fermentationElevage],['Other',details.otherTechnicalDetails]
  ];
  return <section className="sparkling-detail-card" aria-label="Champagne and sparkling production details">
    <h2>Production details</h2>
    <div className="sparkling-detail-chips">{chips.filter(([,value])=>value!==null&&value!==undefined&&String(value).trim()!=='').map(([label,value,suffix])=><span className="sparkling-detail-chip" key={label}><strong>{label}</strong><span>{value}{suffix??''}</span></span>)}</div>
    {notes.some(([,value])=>Boolean(value?.trim()))&&<div className="sparkling-detail-notes">{notes.filter(([,value])=>Boolean(value?.trim())).map(([label,value])=><div className="sparkling-detail-note" key={label}><strong>{label}</strong><span>{value}</span></div>)}</div>}
  </section>;
}
