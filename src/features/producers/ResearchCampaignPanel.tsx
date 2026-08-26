import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import { cancelResearchCampaign,dismissResearchCampaign,getResearchCampaign,getResearchCampaignPlan,startResearchCampaign,
  type ResearchCampaign,type ResearchCampaignPlan } from './api';
import { startBackoffPoll,type Poller } from '../../lib/polling/backoff';
import { campaignSummary,planSummary } from './campaignCopy';
import { CampaignItemList } from './ResearchCampaignHistory';
import '../../researchCampaign.css';

const CHOICES=[10,25,50,100] as const;

type Mode='idle'|'confirm'|'busy';

export function ResearchCampaignPanel({unresearchedHint,onFinished}:{unresearchedHint:number;onFinished?:()=>void}){
  const [plan,setPlan]=useState<ResearchCampaignPlan|null>(null);
  const [campaign,setCampaign]=useState<ResearchCampaign|null>(null);
  const [limit,setLimit]=useState<number>(10);
  const [mode,setMode]=useState<Mode>('idle');
  const [error,setError]=useState('');
  const poll=useRef<Poller|undefined>(undefined);
  const wasRunning=useRef(false);

  const refresh=useCallback(async()=>{
    const next=await getResearchCampaign().catch(()=>null);
    setCampaign(next);
    if(wasRunning.current&&next?.status!=='running'){wasRunning.current=false;onFinished?.()}
    if(next?.status==='running')wasRunning.current=true;
  },[onFinished]);

  useEffect(()=>{void refresh()},[refresh]);

  useEffect(()=>{
    if(campaign?.status!=='running'){poll.current?.stop();poll.current=undefined;return}
    if(poll.current)return;
    poll.current=startBackoffPoll(()=>refresh(),{initialMs:5000,maxMs:30000});
    return()=>{poll.current?.stop();poll.current=undefined};
  },[campaign?.status,refresh]);

  useEffect(()=>()=>poll.current?.stop(),[]);

  const openConfirm=async()=>{
    setError('');setMode('confirm');
    setPlan(await getResearchCampaignPlan(limit).catch(e=>{setError((e as Error).message);return null}));
  };
  const choose=async(value:number)=>{
    setLimit(value);
    setPlan(await getResearchCampaignPlan(value).catch(()=>null));
  };
  const start=async()=>{
    setMode('busy');setError('');
    try{setCampaign(await startResearchCampaign(limit));wasRunning.current=true;setMode('idle')}
    catch(e){setError((e as Error).message||'The batch run could not be queued');setMode('confirm')}
  };
  const stop=async()=>{
    if(!campaign)return;
    setMode('busy');
    try{setCampaign(await cancelResearchCampaign(campaign.id))}catch(e){setError((e as Error).message)}finally{setMode('idle')}
  };
  const clear=async()=>{
    if(!campaign)return;
    try{await dismissResearchCampaign(campaign.id);setCampaign(null)}catch(e){setError((e as Error).message)}
  };

  const running=campaign?.status==='running';
  // A finished run with nothing to report dismisses itself server-side, so the
  // only outcome that reaches here is one worth reading.
  const outcome=campaign&&!running&&!campaign.dismissedAt?campaign:null;
  const unresearched=plan?.unresearched??unresearchedHint;
  const progress=useMemo(()=>{
    if(!campaign||!campaign.requested)return 0;
    const {complete,failed,skipped}=campaign.counts;
    return Math.round((complete+failed+skipped)/campaign.requested*100);
  },[campaign]);

  if(running)return <section className="research-campaign is-running" aria-live="polite">
    <div className="research-campaign-head"><strong>Researching producers</strong><span>{campaignSummary(campaign!)}</span></div>
    <div className="research-campaign-bar"><span style={{width:`${progress}%`}}/></div>
    {campaign!.running.length>0&&<p className="research-campaign-now">{campaign!.running.map(item=>item.producerName).join(' · ')}</p>}
    <p className="research-campaign-note">This continues even if you close WineLog. Come back for the result.</p>
    <button type="button" className="secondary-danger" disabled={mode==='busy'} onClick={stop}>Stop after the current producers</button>
  </section>;

  if(outcome)return <section className="research-campaign is-outcome" role="status">
    <div className="research-campaign-head"><strong>{outcome.status==='cancelled'?'Batch research stopped':'Batch research finished'}</strong><span>{campaignSummary(outcome)}</span></div>
    {outcome.failures.length>0&&<ul className="research-campaign-failures">{outcome.failures.map(item=>
      <li key={item.producerId}><strong>{item.producerName}</strong><span>{item.message||'Research failed.'}</span></li>)}</ul>}
    {/* The failures are listed above; this is the rest of the run, which is
        otherwise invisible - a finished batch should be able to say which
        producers it researched. */}
    {outcome.items.some(item=>item.status!=='failed')&&<details className="campaign-outcome-items">
      <summary>{outcome.counts.complete} researched{outcome.counts.skipped?` · ${outcome.counts.skipped} skipped`:''}</summary>
      <CampaignItemList items={outcome.items.filter(item=>item.status!=='failed')}/>
    </details>}
    {outcome.failures.length>0&&<p className="research-campaign-note">Failed producers stay unresearched, so the next batch picks them up again.</p>}
    <button type="button" onClick={clear}>Dismiss</button>
  </section>;

  if(!unresearched)return null;

  return <section className="research-campaign">
    <div className="research-campaign-head">
      <strong>{unresearched} producer{unresearched===1?'':'s'} never researched</strong>
      {mode==='idle'&&<button type="button" onClick={openConfirm}>Deep Search in batch</button>}
    </div>
    {mode!=='idle'&&<div className="research-campaign-confirm">
      <div className="research-campaign-choices" role="group" aria-label="How many producers to research">
        {CHOICES.filter(value=>value<=Math.max(unresearched,CHOICES[0])).map(value=>
          <button type="button" key={value} className={limit===value?'is-chosen':''} aria-pressed={limit===value}
            disabled={mode==='busy'} onClick={()=>choose(value)}>{value}</button>)}
        <button type="button" className={limit>=unresearched?'is-chosen':''} aria-pressed={limit>=unresearched}
          disabled={mode==='busy'} onClick={()=>choose(unresearched)}>All {unresearched}</button>
      </div>
      <p className="research-campaign-cost">{plan?planSummary(plan):'Working out what this would involve…'}</p>
      <p className="research-campaign-note">
        Only producers that have never been researched are queued, {plan?.concurrency??2} at a time. Each one runs a grounded
        profile and five catalogue slices through Gemini Batch, so this bills real API usage.
      </p>
      {error&&<p className="research-campaign-error" role="alert">{error}</p>}
      <div className="research-campaign-actions">
        <button type="button" className="primary" disabled={mode==='busy'||!plan?.willRun} onClick={start}>
          {mode==='busy'?'Queueing…':`Research ${plan?.willRun??limit} producer${(plan?.willRun??limit)===1?'':'s'}`}
        </button>
        <button type="button" className="secondary-danger" disabled={mode==='busy'} onClick={()=>{setMode('idle');setError('')}}>Cancel</button>
      </div>
    </div>}
  </section>;
}
