import { maturityVerdict,readinessLabel,windowLabel,type Readiness } from '../../lib/maturity/ageing';
import { shiftVerdict,type VintageWindow } from '../../lib/maturity/vintageWindow';
import '../../maturity.css';

type Wine={country?:string|null;region?:string|null;appellation?:string|null;
  classification?:string|null;wineStyle?:string|null;vintage?:number|null;
  /** Read only to recognise a bottling the region's window would misjudge. */
  producer?:string|null;wineName?:string|null};

/**
 * When a bottle is worth opening, said in one line.
 *
 * The figure is a rule of thumb from the place and the style, and the line says
 * so rather than letting a derived window pass for research. It costs nothing:
 * the table is a lookup in the same tree the wine was already filed by, so
 * every wine in the journal gets an answer, not only the ones somebody has paid
 * to research.
 *
 * Renders nothing for a wine with no vintage or no place to go on. A window
 * nobody can stand behind is worse than no window.
 */
export function DrinkingWindow({wine,compact=false,researched=null}:{wine:Wine;compact?:boolean;researched?:VintageWindow|null}){
  const base=maturityVerdict(wine);
  if(!base)return null;
  // Where a year has been looked up, that is the window shown. A search was
  // spent on it, and it is the better answer: what a source said about this
  // growing season rather than what the place and the style usually do. The
  // shift moves this wine's own window, so the readiness follows the years the
  // reader is actually looking at.
  const shifted=shiftVerdict(base,researched);
  const verdict=shifted.verdict,{readiness}=verdict;
  // The list badge carries the years as well as the verdict: "Ready" answers
  // whether to open it, but not the question underneath - by when.
  if(compact)return <span className={`maturity-dot maturity-${readiness}`}
    title={`${readinessLabel[readiness]} · ${windowLabel(verdict)} · ${shifted.researched?`${wine.vintage} looked up`:'typical, not researched'}`}>
    <span className="maturity-dot-mark" aria-hidden="true"/>
    <span>{readinessLabel[readiness]}</span>
    <span className="maturity-dot-window">{windowLabel(verdict)}</span>
    {shifted.researched&&<span className="maturity-dot-researched" aria-label="from a vintage lookup">✦</span>}
  </span>;
  return <div className={`maturity-line maturity-${readiness}`}>
    <span className="maturity-dot-mark" aria-hidden="true"/>
    <strong>{readinessLabel[readiness]}</strong>
    <span className="maturity-window">Drink {windowLabel(verdict)}</span>
    <small>{shifted.researched
      ?`${verdict.basis.label}'s usual window, moved by what ${wine.vintage} did`
      :`Typical for ${verdict.basis.label} — a rule of thumb, not research`}{opensNote(readiness,verdict.opensIn)}</small>
  </div>;
}

const opensNote=(readiness:Readiness,opensIn:number)=>
  readiness==='hold'&&opensIn>0?`. Opens in ${opensIn} year${opensIn===1?'':'s'}`:'';
