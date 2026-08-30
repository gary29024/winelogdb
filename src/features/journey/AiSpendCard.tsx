import { useEffect,useState } from 'react';
import { getAiSpend,type UsageSummary } from './api';

/**
 * What the AI has cost, per run.
 *
 * Neither half of the bill is visible in Cloudflare: tokens are priced by the
 * model, and grounding is priced by Google per search query the model chose to
 * run - which is most of the money. This reads the ledger the app keeps as the
 * calls happen, so "what does one producer Deep Search cost" is a number rather
 * than an estimate.
 */
const money=(currency:string,value:number)=>{
  const digits=value>0&&value<1?2:value<100?2:0;
  try{return new Intl.NumberFormat(undefined,{style:'currency',currency,maximumFractionDigits:digits,minimumFractionDigits:digits}).format(value)}
  catch{return `${currency} ${value.toFixed(digits)}`}
};
const count=(value:number)=>new Intl.NumberFormat().format(Math.round(value));
const oneDecimal=(value:number)=>value.toFixed(1);
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

export function AiSpendCard(){
  const [spend,setSpend]=useState<UsageSummary|null>(null);
  const [error,setError]=useState('');

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
      return <article key={kind.kind}>
        <div><strong>{kind.label}</strong><span>{count(count_)} {unit}{count_===1?'':'s'}</span></div>
        <div><b>{money(spend.currency,kind.costPerUnit??kind.costPerRun)}</b><small>per {unit}</small></div>
        <footer>
          {money(spend.currency,kind.cost)} total · {count(kind.requests)} request{kind.requests===1?'':'s'}
          {unit==='wine'&&kind.runs>0&&<> · {count(kind.runs)} run{kind.runs===1?'':'s'}</>}
          {kind.searchQueries>0&&<> · {oneDecimal(kind.searchesPerRun)} searches/run</>}
        </footer>
      </article>;
    })}</div>
    {/* The free allowance resets monthly and is the reason the bill is a step
        function rather than a slope, so it is worth seeing before it runs out. */}
    <div className={`ai-spend-month${month.freeRemaining===0?' is-billing':''}`}>
      <div><strong>This month</strong><span>{count(month.searchQueries)} grounded searches</span></div>
      <div>
        <b>{money(spend.currency,month.cost)}</b>
        <small>{month.freeRemaining>0
          ?`${count(month.freeRemaining)} free searches left`
          :`${count(month.billableSearches)} past the free allowance`}</small>
        {month.resetsAt&&<small>resets {resetLabel(month.resetsAt)}</small>}
      </div>
    </div>
    <p className="journey-muted ai-spend-note">
      Priced from the dated rates in the Worker configuration, each run at the price in force on the day it ran and the tier it
      was billed on - batch scans queue on the flex tier, at about half of standard. Grounding is billed per search the model
      runs, which is most of this; tokens are the rest. A price that changes from a date leaves earlier runs at what they cost;
      correcting a rate that was always wrong reprices the history, as it should.
    </p>
  </section>;
}
