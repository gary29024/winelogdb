import { useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import { getResearchCampaign,type ResearchCampaign } from './api';
import { campaignSummary } from './campaignCopy';
import '../../researchCampaign.css';

/**
 * The producer library's one line about batch research: how much of the library
 * has never been researched, or - while a run is going or after one failed -
 * where it got to. Everything else lives on its own page.
 */
export function ResearchCampaignLink({unresearched}:{unresearched:number}){
  const [campaign,setCampaign]=useState<ResearchCampaign|null>(null);

  useEffect(()=>{
    let cancelled=false;
    void getResearchCampaign().then(next=>{if(!cancelled)setCampaign(next)}).catch(()=>undefined);
    return()=>{cancelled=true};
  },[]);

  const running=campaign?.status==='running';
  const outcome=campaign&&!running&&!campaign.dismissedAt?campaign:null;
  if(!running&&!outcome&&!unresearched)return null;

  const tone=running?' is-running':outcome?.counts.failed?' is-failed':'';
  return <Link className={`research-campaign-link${tone}`} to="/producers/research-batch">
    <span>{running?'Batch research running':outcome?outcome.status==='cancelled'?'Batch research stopped':'Batch research finished'
      :`${unresearched} producer${unresearched===1?'':'s'} never researched`}</span>
    <small>{campaign&&(running||outcome)?campaignSummary(campaign):'Batch Deep Search'}</small>
    <span className="research-campaign-chevron" aria-hidden="true">›</span>
  </Link>;
}
