import { useEffect,useRef,useState } from 'react';
import { askableVintage,maturityPair,vintageCell,vintageScoreLabel,windowShift,type VintageSubject,type VintageWindow } from '../../lib/maturity/vintageWindow';
import { getVintageWindow,lookUpVintageWindow } from './api';
import { DrinkingWindow } from './DrinkingWindow';
import '../../maturity.css';

type Wine=VintageSubject&{classification?:string|null};
type Props={wine:Wine;onResearched?:()=>void};

const sameYears=(shift:{from:number;to:number}|null)=>shift!=null&&shift.from===0&&shift.to===0;
const years=(value:number)=>`${value>0?'+':''}${value}`;

/**
 * The usual model and the researched vintage stay separate. Vintage Intelligence
 * belongs to the researched answer: it is source-aware context about the year,
 * not another input into the deterministic ageing table.
 */
export function VintageCheck(props:Props){
  // A changed year/place/style must never inherit another cell's result or
  // pending request. Wines within the same cell still share the loaded answer.
  const key=askableVintage(props.wine)?vintageCell(props.wine).key:'';
  return <VintageCellCheck key={key} {...props}/>;
}

function VintageCellCheck({wine,onResearched}:Props){
  const [researched,setResearched]=useState<VintageWindow|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const requests=useRef({version:0}).current;
  const subject:VintageSubject={country:wine.country,region:wine.region,appellation:wine.appellation,
    vintage:wine.vintage,wineStyle:wine.wineStyle,classification:wine.classification,
    producer:wine.producer,wineName:wine.wineName};
  const askable=askableVintage(subject);
  const cell=askable?vintageCell(subject):null;
  const asked=cell?.label||wine.region||wine.country;
  const cellKey=cell?.key??'';

  useEffect(()=>{
    if(!cellKey)return;
    const version=requests.version;
    const timer=setTimeout(()=>{
      if(version!==requests.version)return;
      getVintageWindow(subject).then(found=>{
        if(version===requests.version)setResearched(found);
      }).catch(()=>{});
    },300);
    return()=>{requests.version++;clearTimeout(timer)};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[cellKey,requests]);

  async function look(again=false){
    const version=++requests.version;
    setBusy(true);setError('');
    try{
      const {window}=await lookUpVintageWindow(subject,again);
      if(version!==requests.version)return;
      setResearched(window);if(window)onResearched?.();
    }catch(e){
      if(version===requests.version)setError((e as Error).message||'Could not look up that vintage');
    }finally{if(version===requests.version)setBusy(false)}
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
          {quality?.score!=null&&<span className="vintage-quality">WineLog estimate <b>{quality.score}</b>/100 · {scoreLabel}</span>}
          {quality&&<span className={`vintage-confidence vintage-confidence-${quality.confidence}`}>{quality.confidence} AI-assessed confidence</span>}
          {pair.researched&&<span className="maturity-window">Drink {pair.researched.from}–{pair.researched.to}</span>}
          {shift&&!sameYears(shift)&&<span className="vintage-shift">{years(shift.from)} / {years(shift.to)} on the usual</span>}
          {sameYears(shift)&&<span className="vintage-shift">Same as the usual window</span>}
        </div>
        <details className="vintage-sources">
          <summary>Why this vintage · {researched.sources.length} source{researched.sources.length===1?'':'s'} · {researched.researchedAt.slice(0,10)}{researched.model?` · ${researched.model}`:''}</summary>
          {quality&&<p>An AI synthesis of vintage commentary for {asked} {wine.vintage}. The score describes the vintage, not this individual bottle.</p>}
          {quality&&quality.score==null&&<p>No score: the available evidence did not support a quality estimate.</p>}
          {quality?.consensus&&<p className="vintage-consensus">{quality.consensus}</p>}
          {quality&&(quality.strengths.length>0||quality.cautions.length>0)&&<div className="vintage-evidence-grid">
            {quality.strengths.length>0&&<div><strong>Strengths</strong><ul>{quality.strengths.map(item=><li key={`strength-${item}`}>{item}</li>)}</ul></div>}
            {quality.cautions.length>0&&<div><strong>Watch</strong><ul>{quality.cautions.map(item=><li key={`caution-${item}`}>{item}</li>)}</ul></div>}
          </div>}
          {researched.note&&<p className="vintage-note">{researched.note}</p>}
          <ul>{researched.sources.map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}</ul>
          {!quality&&<p className="vintage-legacy-note"><small>No vintage quality assessment is stored with this lookup. Refresh it to request one.</small></p>}
          <p className="vintage-again">
            <button type="button" className="quiet" onClick={()=>void look(true)} disabled={busy}>{busy?'Searching…':'Look it up again'}</button>
            <small>Uses AI search and replaces this for every wine you own from {asked} {wine.vintage}.</small>
          </p>
        </details>
      </div>
      :askable&&<div className="vintage-ask">
        <button type="button" onClick={()=>void look()} disabled={busy}>{busy?'Searching…':`Look up ${wine.vintage}`}</button>
        <small>One lookup requests the vintage window and WineLog Vintage Intelligence, then keeps it for every wine you own from {asked} {wine.vintage}.</small>
      </div>}

    {error&&<p className="cellar-error" role="alert">{error}</p>}
  </div>;
}
