import { useEffect,useId,useRef,useState } from 'react';
import { getAiSpend,type UsageRun,type UsageSummary } from './api';

/**
 * What the AI has cost, per run.
 *
 * Neither half of the bill is visible in Cloudflare: tokens are priced by the
 * model, and grounding is priced by Google per search query the model chose to
 * run - which is most of the money. This reads the ledger the app keeps as the
 * calls happen, so "what does one producer Deep Search cost" is a number rather
 * than an estimate.
 */
// Three decimals under a unit, because that is where the interesting numbers
// live: a scanned wine costs a few thousandths, and two decimals rounded every
// one of them to the same 0.01 - which said nothing about which mode or which
// model was the expensive one. Whole units above a hundred; a month total does
// not need its cents.
const money=(currency:string,value:number)=>{
  const digits=value>0&&value<1?3:value<100?2:0;
  try{return new Intl.NumberFormat(undefined,{style:'currency',currency,maximumFractionDigits:digits,minimumFractionDigits:digits}).format(value)}
  catch{return `${currency} ${value.toFixed(digits)}`}
};
const count=(value:number)=>new Intl.NumberFormat().format(Math.round(value));
const oneDecimal=(value:number)=>value.toFixed(1);
const when=(iso:string)=>{
  const at=new Date(iso);
  if(Number.isNaN(at.getTime()))return 'Unknown time';
  return new Intl.DateTimeFormat(undefined,{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'}).format(at);
};
/**
 * The allowance resets at midnight Pacific on the 1st, which from most of the
 * world is some other date and time entirely - so it is shown in the reader's
 * own clock rather than in Google's.
 */
const resetLabel=(iso:string)=>{
  const at=new Date(iso);
  if(Number.isNaN(at.getTime()))return '';
  return new Intl.DateTimeFormat(undefined,{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(at);
};

const DRILLDOWN_KINDS=new Set(['producer_research','wine_research','vintage_window']);
const runTitle=(run:UsageRun,label:string)=>run.targetLabel||(
  run.kind==='vintage_window'?'Vintage window research':label.replace('Deep Search','research')
);

function AiSpendRunDialog({label,runs,totalRuns,currency,days,onClose}:{
  label:string;runs:UsageRun[];totalRuns:number;currency:string;days:number;onClose:()=>void;
}){
  const ref=useRef<HTMLDialogElement>(null),titleId=useId();
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const selected=runs.find(run=>run.runId===selectedId)??null;

  useEffect(()=>{
    const dialog=ref.current!;
    const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const previousOverflow=document.body.style.overflow;
    dialog.showModal();document.body.style.overflow='hidden';
    return()=>{
      dialog.close();document.body.style.overflow=previousOverflow;
      if(previousFocus?.isConnected)previousFocus.focus();
    };
  },[]);

  return <dialog ref={ref} className="ai-spend-dialog" aria-labelledby={titleId}
    onCancel={event=>{event.preventDefault();onClose()}}
    onClick={event=>{if(event.target===event.currentTarget)onClose()}}>
    <div className="ai-spend-dialog-body">
      <div className="ai-spend-dialog-head">
        <div>
          {selected&&<button type="button" className="ai-spend-back" onClick={()=>setSelectedId(null)}>← All runs</button>}
          <p className="section-label">AI spend</p>
          <h2 id={titleId}>{selected?runTitle(selected,label):label}</h2>
          <p>{selected?when(selected.createdAt):`Individual runs · last ${days} days`}</p>
        </div>
        <button type="button" className="quiet" onClick={onClose} aria-label="Close AI spend details">Close</button>
      </div>

      {!selected?<>
        <p className="ai-spend-dialog-note">
          Marginal cost prices grounded searches at list price so runs are comparable. Your actual billing-month cost can be lower while the free search allowance remains.
        </p>
        {runs.length?<div className="ai-spend-run-list">
          {runs.map(run=><button type="button" key={run.runId} className="ai-spend-run-row" onClick={()=>setSelectedId(run.runId)}>
            <span className="ai-spend-run-main"><strong>{runTitle(run,label)}</strong><small>{when(run.createdAt)}</small></span>
            <span className="ai-spend-run-cost"><b>{money(currency,run.cost)}</b><small>marginal</small></span>
            <span className="ai-spend-run-meta">
              {count(run.searchQueries)} search{run.searchQueries===1?'':'es'} · {count(run.requests)} request{run.requests===1?'':'s'} · {count(run.promptTokens+run.outputTokens)} tokens
            </span>
            <span className="ai-spend-run-chevron" aria-hidden="true">›</span>
          </button>)}
        </div>:<p className="journey-muted">No individual run records are available in this window.</p>}
        {totalRuns>runs.length&&<p className="journey-muted small">Showing the latest {count(runs.length)} of {count(totalRuns)} runs.</p>}
      </>:<>
        <div className="ai-spend-run-summary">
          <article><small>Marginal cost</small><strong>{money(currency,selected.cost)}</strong></article>
          <article><small>Grounded searches</small><strong>{count(selected.searchQueries)}</strong></article>
          <article><small>Requests</small><strong>{count(selected.requests)}</strong></article>
          <article><small>Total tokens</small><strong>{count(selected.promptTokens+selected.outputTokens)}</strong></article>
        </div>
        <div className="ai-spend-run-token-split">
          <span>Input {count(selected.promptTokens)}</span><span>Output + thinking {count(selected.outputTokens)}</span>
        </div>
        <div className="ai-spend-run-parts">
          <h3>Request breakdown</h3>
          {selected.parts.map((part,index)=><article key={`${part.model}-${part.tier}-${part.createdAt}-${index}`}>
            <div><strong>{part.model}</strong><small>{part.tier} tier · {when(part.createdAt)}</small></div>
            <b>{money(currency,part.cost)}</b>
            <p>{count(part.requests)} request{part.requests===1?'':'s'} · {count(part.searchQueries)} search{part.searchQueries===1?'':'es'} · {count(part.promptTokens)} input · {count(part.outputTokens)} output/thinking</p>
          </article>)}
        </div>
        <details className="ai-spend-run-id"><summary>Technical run ID</summary><code>{selected.runId}</code></details>
        <p className="ai-spend-dialog-note">This is the marginal run cost used for comparing research efficiency. The billing-month tile applies the shared grounding allowance separately.</p>
      </>}
    </div>
  </dialog>;
}

export function AiSpendCard(){
  const [spend,setSpend]=useState<UsageSummary|null>(null);
  const [error,setError]=useState('');
  const [selectedKind,setSelectedKind]=useState<string|null>(null);

  useEffect(()=>{
    let live=true;
    void getAiSpend().then(next=>{if(live)setSpend(next)}).catch(e=>{if(live)setError((e as Error).message)});
    return()=>{live=false};
  },[]);

  // Insights is about the wine, not the bill: anything wrong here - a failed
  // request, a payload that is not a summary - leaves the page as it was.
  if(error||!spend||!Array.isArray(spend.kinds)||!spend.month)return null;
  if(spend.empty)return <section className="journey-card ai-spend-card">
    <div className="journey-section-heading"><div><p className="section-label">AI spend</p><h2>Nothing metered yet</h2></div></div>
    <p className="journey-muted">Deep Search and label recognition record what they cost as they run. The first one will show up here.</p>
  </section>;

  const {month}=spend;
  const selectedKindSpend=selectedKind?spend.kinds.find(kind=>kind.kind===selectedKind):null;
  const selectedRuns=selectedKind?(spend.recentRuns?.[selectedKind]??[]):[];
  return <section className="journey-card ai-spend-card">
    <div className="journey-section-heading">
      <div><p className="section-label">AI spend</p><h2>What each run costs</h2></div>
      <span>last {spend.days} days</span>
    </div>
    {/* Recognition is quoted per wine, research per run. A batch scan session
        of a dozen bottles and a group photo of nine are not comparable to each
        other, let alone to a producer Deep Search, until they are. */}
    <div className="ai-spend-grid">{spend.kinds.map(kind=>{
      const unit=kind.unit==='wine'?'wine':'run',count_=kind.unitCount??kind.runs;
      const drillable=DRILLDOWN_KINDS.has(kind.kind);
      const open=()=>{if(drillable)setSelectedKind(kind.kind)};
      return <article key={kind.kind} className={drillable?'is-clickable':undefined}
        role={drillable?'button':undefined} tabIndex={drillable?0:undefined} aria-haspopup={drillable?'dialog':undefined}
        onClick={open} onKeyDown={event=>{if(!drillable)return;if(event.key==='Enter'||event.key===' '){event.preventDefault();open()}}}>
        <div><strong>{kind.label}</strong><span>{count(count_)} {unit}{count_===1?'':'s'}</span></div>
        <div><b>{money(spend.currency,kind.costPerUnit??kind.costPerRun)}</b><small>per {unit}</small></div>
        <footer>
          {money(spend.currency,kind.cost)} total · {count(kind.requests)} request{kind.requests===1?'':'s'}
          {unit==='wine'&&kind.runs>0&&<> · {count(kind.runs)} run{kind.runs===1?'':'s'}</>}
          {kind.searchQueries>0&&<> · {oneDecimal(kind.searchesPerRun)} searches/run</>}
          {drillable&&<span className="ai-spend-view-runs">View runs ›</span>}
        </footer>
      </article>;
    })}</div>
    {/* Reported as: twenty producer runs at HK$2.54 is fifty dollars, and the
        month says five. Both are right and neither said so. These figures are
        marginal - what one more run would cost - so they price their searches
        as if billable, while the allowance below means they are not. */}
    {month.freeRemaining>0&&<p className="ai-spend-marginal">Each figure is what one more would cost, searches priced in. While the allowance below lasts, the searches are free and the month's bill is the tokens alone.</p>}
    {/* The free allowance resets monthly and is the reason the bill is a step
        function rather than a slope, so it is worth seeing before it runs out.

        The figure is the month's whole bill, and it used to sit unlabelled
        beside the search count with the allowance under it - which read as the
        price of those searches. It is usually the opposite: until the 5,000 are
        gone the searches are the free half and every cent of this is tokens. So
        the number says what is in it, and the period is named, because the
        cards above are the last 30 days while this is the billing month.

        The amount sits on the title's row and each fact gets the tile's whole
        width beneath it. Sharing a row with the amount left the facts a phone's
        half-width, where every one of them wrapped: three short lines became
        six, which is the opposite of a summary. */}
    <div className={`ai-spend-month${month.freeRemaining===0?' is-billing':''}`}>
      <strong>This billing month</strong>
      <b>{money(spend.currency,month.cost)}</b>
      <span>{count(month.searchQueries)} grounded searches · {month.freeRemaining>0
        ?`${count(month.freeRemaining)} free left`
        :`${count(month.billableSearches)} past the allowance`}</span>
      <span>{month.billableSearches>0
        ?`Tokens plus ${count(month.billableSearches)} billed searches`
        :'Tokens only — searches still free'}</span>
      {month.resetsAt&&<span>Allowance resets {resetLabel(month.resetsAt)}</span>}
    </div>
    <p className="journey-muted ai-spend-note">
      Priced from the dated rates in the Worker configuration, each run at the price in force on the day it ran and the tier it
      was billed on - batch scans queue on the flex tier, at about half of standard. Grounding is billed per search the model
      runs, and is what dominates once the free allowance is gone; tokens are the rest, and until then all of it. A price that
      changes from a date leaves earlier runs at what they cost; correcting a rate that was always wrong reprices the history,
      as it should.
    </p>
    {selectedKind&&selectedKindSpend&&<AiSpendRunDialog key={selectedKind} label={selectedKindSpend.label}
      runs={selectedRuns} totalRuns={selectedKindSpend.runs} currency={spend.currency} days={spend.days} onClose={()=>setSelectedKind(null)}/>} 
  </section>;
}
