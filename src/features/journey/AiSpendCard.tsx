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
    <div className="ai-spend-grid">{spend.kinds.map(kind=><article key={kind.kind}>
      <div><strong>{kind.label}</strong><span>{count(kind.runs)} run{kind.runs===1?'':'s'}</span></div>
      <div><b>{money(spend.currency,kind.costPerRun)}</b><small>per run</small></div>
      <footer>
        {money(spend.currency,kind.cost)} total · {count(kind.requests)} request{kind.requests===1?'':'s'}
        {kind.searchQueries>0&&<> · {oneDecimal(kind.searchesPerRun)} searches/run</>}
      </footer>
    </article>)}</div>
    {/* The free allowance resets monthly and is the reason the bill is a step
        function rather than a slope, so it is worth seeing before it runs out. */}
    <div className={`ai-spend-month${month.freeRemaining===0?' is-billing':''}`}>
      <div><strong>This month</strong><span>{count(month.searchQueries)} grounded searches</span></div>
      <div>
        <b>{money(spend.currency,month.cost)}</b>
        <small>{month.freeRemaining>0
          ?`${count(month.freeRemaining)} free searches left`
          :`${count(month.billableSearches)} past the free allowance`}</small>
      </div>
    </div>
    <p className="journey-muted ai-spend-note">
      Priced from the rates in the Worker configuration. Grounding is billed per search the model runs, which is most of this;
      tokens are the rest. Costs are recomputed from the rates each time, so correcting a rate reprices the history too.
    </p>
  </section>;
}
