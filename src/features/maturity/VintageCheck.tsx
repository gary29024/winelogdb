import { useEffect,useState } from 'react';
import { maturityPair,vintageCell,vintageScoreLabel,windowShift,type VintageSubject,type VintageWindow } from '../../lib/maturity/vintageWindow';
import { getVintageWindow,lookUpVintageWindow } from './api';
import { DrinkingWindow } from './DrinkingWindow';
import '../../maturity.css';

type Wine=VintageSubject&{classification?:string|null};

const sameYears=(shift:{from:number;to:number}|null)=>shift!=null&&shift.from===0&&shift.to===0;
const years=(value:number)=>`${value>0?'+':''}${value}`;

/**
 * The usual model and the researched vintage stay separate. Vintage Intelligence
 * belongs to the researched answer: it is source-aware context about the year,
 * not another input into the deterministic ageing table.
 */
export function VintageCheck({wine,onResearched}:{wine:Wine;onResearched?:()=>void}){
  const [researched,setResearched]=useState<VintageWindow|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const subject:VintageSubject={country:wine.country,region:wine.region,appellation:wine.appellation,
    vintage:wine.vintage,wineStyle:wine.wineStyle,classification:wine.classification,
    producer:wine.producer,wineName:wine.wineName};
  const askable=Boolean(wine.vintage&&(wine.appellation||wine.region||wine.country));
  const cell=askable?vintageCell(subject):null;
  const asked=cell?.label||wine.region||wine.country;
  const cellKey=cell?.key??'';

  useEffect(()=>{
    if(!cellKey){setResearched(null);return}
    let live=true;
    const timer=setTimeout(()=>{getVintageWindow(subject).then(found=>{if(live)setResearched(found)}).catch(()=>{})},300);
    return()=>{live=false;clearTimeout(timer)};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[cellKey]);

  async function look(again=false){
    setBusy(true);setError('');
    try{const {window}=await lookUpVintageWindow(subject,again);setResearched(window);if(window)onResearched?.()}
    catch(e){setError((e as Error).message||'Could not look up that vintage')}
    finally{setBusy(false)}
  }

  const pair=maturityPair(wine,researched);
  const shift=windowShift(pair);
  const quality=researched?.quality??null;
  const scoreLabel=vintageScoreLabel(quality?.score);
  if(!pair.calculated&&!researched&&!askable)return null;

  return <div className="vintage-check">
    <DrinkingWindow wine={wine}/>

    {researched
      ?<div className="vintage-researched">
        <div className="vintage-researched-head">
          <strong>{wine.vintage} in {asked}</strong>
          {quality?.score!=null&&<span className="vintage-quality"><b>{quality.score}</b> · {scoreLabel}</span>}
          {quality&&<span className={`vintage-confidence vintage-confidence-${quality.confidence}`}>{quality.confidence} confidence</span>}
          {pair.researched&&<span className="maturity-window">Drink {pair.researched.from}–{pair.researched.to}</span>}
          {shift&&!sameYears(shift)&&<span className="vintage-shift">{years(shift.from)} / {years(shift.to)} on the usual</span>}
          {sameYears(shift)&&<span className="vintage-shift">Same as the usual window</span>}
        </div>
        <details className="vintage-sources">
          <summary>Why this vintage · {researched.sources.length} source{researched.sources.length===1?'':'s'} · {researched.researchedAt.slice(0,10)}{researched.model?` · ${researched.model}`:''}</summary>
          {quality?.consensus&&<p className="vintage-consensus">{quality.consensus}</p>}
          {quality&&(quality.strengths.length>0||quality.cautions.length>0)&&<div className="vintage-evidence-grid">
            {quality.strengths.length>0&&<div><strong>Strengths</strong><ul>{quality.strengths.map(item=><li key={`strength-${item}`}>{item}</li>)}</ul></div>}
            {quality.cautions.length>0&&<div><strong>Watch</strong><ul>{quality.cautions.map(item=><li key={`caution-${item}`}>{item}</li>)}</ul></div>}
          </div>}
          {researched.note&&<p className="vintage-note">{researched.note}</p>}
          <ul>{researched.sources.map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}</ul>
          {!quality&&<p className="vintage-legacy-note"><small>This lookup predates Vintage Intelligence. Refresh it to add a source-aware score and consensus.</small></p>}
          <p className="vintage-again">
            <button type="button" className="quiet" onClick={()=>void look(true)} disabled={busy}>{busy?'Searching…':'Look it up again'}</button>
            <small>Spends one search and replaces this for every wine you own from {asked} {wine.vintage}.</small>
          </p>
        </details>
      </div>
      :askable&&<div className="vintage-ask">
        <button type="button" onClick={()=>void look()} disabled={busy}>{busy?'Searching…':`Look up ${wine.vintage}`}</button>
        <small>One grounded search adds the vintage window and WineLog Vintage Intelligence, then keeps it for every wine you own from {asked} {wine.vintage}.</small>
      </div>}

    {error&&<p className="cellar-error" role="alert">{error}</p>}
  </div>;
}
