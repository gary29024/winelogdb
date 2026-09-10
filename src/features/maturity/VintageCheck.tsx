import { useEffect,useRef,useState } from 'react';
import { askableVintage,maturityPair,vintageCell,vintageScoreLabel,windowShift,type VintageSubject,type VintageWindow } from '../../lib/maturity/vintageWindow';
import { ElapsedSeconds } from '../../components/ElapsedSeconds';
import { getVintageWindow,lookUpVintageWindow } from './api';
import { DrinkingWindow } from './DrinkingWindow';
import '../../maturity.css';

type Wine=VintageSubject&{classification?:string|null};
type Props={wine:Wine;onResearched?:()=>void;initialWindow?:VintageWindow|null;debounceMs?:number};

const shiftDescription=(shift:{from:number;to:number})=>{
  if(shift.from===0&&shift.to===0)return 'Same as the typical window.';
  const timing=(years:number)=>years===0?'at the usual time':`${Math.abs(years)} year${Math.abs(years)===1?'':'s'} ${years>0?'later':'earlier'}`;
  return `Estimated window starts ${timing(shift.from)} and ends ${timing(shift.to)}.`;
};

/** A changed cell gets fresh UI state; wines within one cell share the answer. */
export function VintageCheck(props:Props){
  const key=askableVintage(props.wine)?vintageCell(props.wine).key:'';
  return <VintageCellCheck key={key} {...props}/>;
}

function VintageCellCheck({wine,onResearched,initialWindow,debounceMs=0}:Props){
  const [researched,setResearched]=useState<VintageWindow|null>(initialWindow??null);
  const [readState,setReadState]=useState<'loading'|'ready'|'error'>(askableVintage(wine)&&initialWindow===undefined?'loading':'ready');
  const [readSeq,setReadSeq]=useState(0);
  const [startedAt,setStartedAt]=useState<string|null>(null);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const requests=useRef({version:0}).current;
  const busy=startedAt!==null;
  const subject:VintageSubject={country:wine.country,region:wine.region,appellation:wine.appellation,
    vintage:wine.vintage,wineStyle:wine.wineStyle,classification:wine.classification,
    producer:wine.producer,wineName:wine.wineName};
  const askable=askableVintage(subject);
  const cell=askable?vintageCell(subject):null;
  const asked=cell?.label||wine.region||wine.country;
  const cellKey=cell?.key??'';
  const style=wine.wineStyle==='rose'?'Rosé':wine.wineStyle?wine.wineStyle[0].toUpperCase()+wine.wineStyle.slice(1):null;
  const scope=[asked,style,wine.vintage].filter(Boolean).join(' · ');

  useEffect(()=>{
    const version=++requests.version;
    let timer:ReturnType<typeof setTimeout>|undefined;
    // The cellar list already fetched this cell. Opening its details uses that
    // result, including a known cache miss, without another read or AI request.
    if(cellKey&&(initialWindow===undefined||readSeq>0)){
      setReadState('loading');setError('');setNotice('');
      const read=()=>{
        getVintageWindow(subject).then(found=>{
          if(version!==requests.version)return;
          setResearched(found);setReadState('ready');
          setNotice(found?'Saved research loaded.':'');
        }).catch(()=>{
          if(version!==requests.version)return;
          setReadState('error');setError('Could not load saved research. Please retry.');
        });
      };
      // Only editable forms debounce changing cells; opening details and retries read immediately.
      if(debounceMs>0&&readSeq===0)timer=setTimeout(read,debounceMs);
      else read();
    }
    return()=>{requests.version++;clearTimeout(timer)};
    // Subject changes within this cell do not need another read. initialWindow
    // seeds this mounted cell only; new research is owned by the state above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[cellKey,readSeq,requests,debounceMs]);

  async function look(again=false){
    if(busy||readState!=='ready')return;
    const version=++requests.version;
    setStartedAt(new Date().toISOString());setError('');setNotice('');
    try{
      const {window,cached}=await lookUpVintageWindow(subject,again);
      if(version!==requests.version)return;
      if(!window)throw new Error('No research was returned. Please try again.');
      setResearched(window);setNotice(cached?'Saved research loaded.':'Research updated.');onResearched?.();
    }catch(e){
      if(version===requests.version)setError(researched
        ?'Refresh failed. Your previous research is still shown. Please try again.'
        :(e as Error).message||'Could not look up that vintage. Please try again.');
    }finally{if(version===requests.version)setStartedAt(null)}
  }

  const pair=maturityPair(wine,researched);
  const shift=windowShift(pair);
  const quality=researched?.quality??null;
  const scoreLabel=vintageScoreLabel(quality?.score);
  if(!pair.calculated&&!researched&&!askable)return null;

  return <div className="vintage-check">
    {askable&&<div className="vintage-overview">
      <strong className="vintage-scope">{scope}</strong>
      {quality?.score!=null&&<div className="vintage-quality"><strong>{scoreLabel}</strong><span>WineLog estimate <b>{quality.score}</b>/100</span></div>}
      {quality&&quality.score==null&&<span className="vintage-quality-unavailable">Quality estimate unavailable</span>}
    </div>}
    <DrinkingWindow wine={wine} researched={researched}/>
    {pair.researched&&pair.calculated&&<p className="vintage-comparison">Typical window: {pair.calculated.from}–{pair.calculated.to}</p>}

    <div className="vintage-progress">
      <p className="vintage-status" role="status" aria-live="polite" aria-atomic="true">{busy?'Researching vintage…':readState==='loading'?'Checking saved research…':notice}</p>
      {startedAt&&<span className="vintage-elapsed" aria-hidden="true"><ElapsedSeconds startedAt={startedAt}/></span>}
    </div>

    {researched
      ?<div className="vintage-researched">
        <details className="vintage-sources">
          <summary>Evidence &amp; sources · {researched.sources.length} source{researched.sources.length===1?'':'s'}</summary>
          <div className="vintage-research-meta">
            {quality&&<span className={`vintage-confidence vintage-confidence-${quality.confidence}`}>{quality.confidence} AI-assessed confidence</span>}
            <span>Researched <time dateTime={researched.researchedAt}>{researched.researchedAt.slice(0,10)}</time></span>
            {researched.model&&<span>Model: {researched.model}</span>}
          </div>
          {quality&&<p>An AI synthesis of vintage commentary for {scope}. The score describes the vintage, not this individual bottle.</p>}
          {quality&&quality.score==null&&<p>No numeric estimate was returned for this vintage.</p>}
          {shift&&<p className="vintage-shift">{shiftDescription(shift)}</p>}
          {quality?.consensus&&<p className="vintage-consensus">{quality.consensus}</p>}
          {quality&&(quality.strengths.length>0||quality.cautions.length>0)&&<div className="vintage-evidence-grid">
            {quality.strengths.length>0&&<div><strong>Strengths</strong><ul>{[...new Set(quality.strengths)].map(item=><li key={`strength-${item}`}>{item}</li>)}</ul></div>}
            {quality.cautions.length>0&&<div><strong>Watch</strong><ul>{[...new Set(quality.cautions)].map(item=><li key={`caution-${item}`}>{item}</li>)}</ul></div>}
          </div>}
          {researched.note&&<p className="vintage-note">{researched.note}</p>}
          <ul>{researched.sources.map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}</ul>
          {!quality&&<p className="vintage-legacy-note"><small>No vintage quality assessment is stored with this lookup.</small></p>}
          <p className="vintage-again">
            <button type="button" className="quiet" onClick={()=>void look(true)} disabled={busy||readState!=='ready'}>{busy?'Researching…':'Refresh research'}</button>
            <small>Uses AI search. Updates saved research for your wines in {scope}.</small>
          </p>
        </details>
      </div>
      :askable&&readState==='ready'&&<div className="vintage-ask">
        <button type="button" onClick={()=>void look()} disabled={busy}>{busy?'Researching…':`Look up ${wine.vintage}`}</button>
        <small>Research the vintage once, then reuse it for your wines in {scope}.</small>
      </div>}

    {error&&<p className="cellar-error" role="alert">{error}</p>}
    {readState==='error'&&<div className="vintage-ask"><button type="button" onClick={()=>setReadSeq(seq=>seq+1)}>Retry saved research</button></div>}
  </div>;
}
