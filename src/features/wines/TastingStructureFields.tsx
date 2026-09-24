import { structureFields,type TastingStructure,type TastingStructureKey } from '../../lib/wine/tastingStructure';

// The owner's wine form and a recipient's experience form both render this, so
// the two cannot drift into different controls, orders or scales again.

type Props={structure:TastingStructure;open:boolean;onToggle:(open:boolean)=>void;onChoose:(key:TastingStructureKey,value:string)=>void};
export function TastingStructureFields({structure,open,onToggle,onChoose}:Props){
  return <details className="structure-fields structure-disclosure" open={open} onToggle={e=>onToggle(e.currentTarget.open)}><summary><span>Structure</span><small>Optional</small></summary><div className="structure-disclosure-body"><small className="structure-helper">Tap the value itself. Tap the selected value again to clear it.</small>{structureFields.map(item=><div className="structure-row" key={item.key}><span>{item.label}</span><div className="structure-options" role="group" aria-label={item.label}>{item.options.map(([value,label])=><button key={value} type="button" className={`structure-option${structure[item.key]===value?' selected':''}`} aria-pressed={structure[item.key]===value} onClick={()=>onChoose(item.key,value)}>{label}</button>)}</div></div>)}</div></details>;
}
