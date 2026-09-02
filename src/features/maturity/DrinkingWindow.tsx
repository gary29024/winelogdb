import { maturityVerdict,readinessLabel,windowLabel,type Readiness } from '../../lib/maturity/ageing';
import '../../maturity.css';

type Wine={country?:string|null;region?:string|null;appellation?:string|null;
  classification?:string|null;wineStyle?:string|null;vintage?:number|null};

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
export function DrinkingWindow({wine,compact=false}:{wine:Wine;compact?:boolean}){
  const verdict=maturityVerdict(wine);
  if(!verdict)return null;
  const {readiness}=verdict;
  // The list badge carries the years as well as the verdict: "Ready" answers
  // whether to open it, but not the question underneath - by when. This is the
  // rule-of-thumb window, the same one the verdict is derived from, so the two
  // cannot disagree with each other.
  if(compact)return <span className={`maturity-dot maturity-${readiness}`} title={`${readinessLabel[readiness]} · ${windowLabel(verdict)}`}>
    <span className="maturity-dot-mark" aria-hidden="true"/>
    <span>{readinessLabel[readiness]}</span>
    <span className="maturity-dot-window">{windowLabel(verdict)}</span>
  </span>;
  return <div className={`maturity-line maturity-${readiness}`}>
    <span className="maturity-dot-mark" aria-hidden="true"/>
    <strong>{readinessLabel[readiness]}</strong>
    <span className="maturity-window">Drink {windowLabel(verdict)}</span>
    <small>Typical for {verdict.basis.label} — a rule of thumb, not research{opensNote(readiness,verdict.opensIn)}</small>
  </div>;
}

const opensNote=(readiness:Readiness,opensIn:number)=>
  readiness==='hold'&&opensIn>0?`. Opens in ${opensIn} year${opensIn===1?'':'s'}`:'';
