import { useEffect,useState } from 'react';
import { hasSparklingDetails,type SparklingDetails } from '../../lib/wine/sparklingDetails';
import '../../sparklingDetails.css';

type Props={details:SparklingDetails;onChange:(next:SparklingDetails)=>void;showHelper?:boolean};

export function SparklingDetailsFields({details,onChange,showHelper=true}:Props){
  const [open,setOpen]=useState(()=>hasSparklingDetails(details));
  const populated=hasSparklingDetails(details);
  useEffect(()=>{if(populated)setOpen(true)},[populated]);
  const set=<K extends keyof SparklingDetails>(key:K,value:SparklingDetails[K])=>onChange({...details,[key]:value});
  const numberValue=(value:string)=>value.trim()===''?null:Number(value);
  return <details className="sparkling-details-editor" open={open} onToggle={e=>setOpen(e.currentTarget.open)}>
    <summary><span>Champagne / sparkling details</span><small>Optional · release-specific</small></summary>
    <div className="sparkling-details-body">
      {showHelper&&<p className="sparkling-details-helper">WineLog already tries to auto-fill these during identification when they are readable in the scanned photos. Leave anything not printed blank; the separate photo extraction is for backfilling saved wines. These details stay with this logged wine, not the whole cuvée.</p>}
      <div className="sparkling-spec-grid">
        <label>Dosage <span>g/L</span><input type="number" min="0" max="100" step="0.1" value={details.dosageGPerL??''} onChange={e=>set('dosageGPerL',numberValue(e.target.value))}/></label>
        <label>Dosage style<input value={details.dosageCategory??''} placeholder="e.g. Extra Brut" onChange={e=>set('dosageCategory',e.target.value||null)}/></label>
        <label>Disgorged<input value={details.disgorgement??''} placeholder="e.g. 03/2024" onChange={e=>set('disgorgement',e.target.value||null)}/></label>
        <label>Tirage / bottled<input value={details.tirage??''} placeholder="e.g. 07/2019" onChange={e=>set('tirage',e.target.value||null)}/></label>
        <label>Base vintage<input type="number" min="1000" max="2200" value={details.baseVintage??''} onChange={e=>set('baseVintage',numberValue(e.target.value))}/></label>
        <label>Reserve wines <span>%</span><input type="number" min="0" max="100" step="0.1" value={details.reserveWinePercentage??''} onChange={e=>set('reserveWinePercentage',numberValue(e.target.value))}/></label>
        <label>Lees ageing <span>months</span><input type="number" min="0" max="600" step="1" value={details.leesAgeingMonths??''} onChange={e=>set('leesAgeingMonths',numberValue(e.target.value))}/></label>
        <label>Lot / release<input value={details.lotCode??''} placeholder="e.g. L23 / DT0324" onChange={e=>set('lotCode',e.target.value||null)}/></label>
      </div>
      <div className="sparkling-text-grid">
        <label>Assemblage<textarea rows={2} value={details.assemblage??''} placeholder="e.g. 2019 base + 30% reserve wines…" onChange={e=>set('assemblage',e.target.value||null)}/></label>
        <label>Reserve wine detail<textarea rows={2} value={details.reserveWineDetail??''} placeholder="e.g. Perpetual reserve, 2015–2018…" onChange={e=>set('reserveWineDetail',e.target.value||null)}/></label>
        <label>Malolactic<input value={details.malolactic??''} placeholder="e.g. blocked / partial / full" onChange={e=>set('malolactic',e.target.value||null)}/></label>
        <label>Fermentation / élevage<input value={details.fermentationElevage??''} placeholder="e.g. 70% steel, 30% oak…" onChange={e=>set('fermentationElevage',e.target.value||null)}/></label>
      </div>
      <label className="sparkling-other">Other technical details<textarea rows={2} value={details.otherTechnicalDetails??''} onChange={e=>set('otherTechnicalDetails',e.target.value||null)}/></label>
    </div>
  </details>;
}
