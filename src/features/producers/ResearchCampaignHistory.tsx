import { useCallback,useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import { getResearchCampaignById,listResearchCampaigns,
  type ResearchCampaign,type ResearchCampaignItem,type ResearchCampaignSummary } from './api';
import { campaignOutcomeLine } from './campaignCopy';
import '../../researchCampaign.css';

const when=(value:string)=>{
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'':date.toLocaleString();
};

/** The producers of one run, researched ones included - a finished run should
 *  show what it did, not only what it could not do. */
export function CampaignItemList({items}:{items:ResearchCampaignItem[]}){
  if(!items.length)return null;
  const order:ResearchCampaignItem['status'][]=['failed','running','pending','complete','skipped'];
  const sorted=[...items].sort((a,b)=>order.indexOf(a.status)-order.indexOf(b.status)||a.producerName.localeCompare(b.producerName));
  return <ul className="campaign-item-list">{sorted.map(item=>
    <li key={item.producerId} className={`campaign-item is-${item.status}`}>
      <Link to={`/producers/${item.producerId}`}>{item.producerName}</Link>
      <span>{item.status==='complete'?'Researched':item.status==='failed'?'Failed':item.status==='skipped'?'Skipped':item.status==='running'?'Researching…':'Waiting'}</span>
      {item.message&&item.status!=='complete'&&<small>{item.message}</small>}
    </li>)}</ul>;
}

/**
 * Every batch run this library has done. The newest is expanded by default,
 * since after a run finishes that is the one being looked for; the rest open on
 * demand, and only the one opened is fetched with its producers.
 */
export function ResearchCampaignHistory({refreshKey}:{refreshKey?:number}){
  const [runs,setRuns]=useState<ResearchCampaignSummary[]>([]);
  const [openId,setOpenId]=useState('');
  const [detail,setDetail]=useState<ResearchCampaign|null>(null);
  const [loadingDetail,setLoadingDetail]=useState(false);

  useEffect(()=>{
    let cancelled=false;
    void listResearchCampaigns().then(next=>{if(!cancelled)setRuns(next)}).catch(()=>undefined);
    return()=>{cancelled=true};
  },[refreshKey]);

  const open=useCallback(async(id:string)=>{
    if(openId===id){setOpenId('');setDetail(null);return}
    setOpenId(id);setDetail(null);setLoadingDetail(true);
    try{setDetail(await getResearchCampaignById(id))}catch{setDetail(null)}finally{setLoadingDetail(false)}
  },[openId]);

  if(!runs.length)return null;

  return <section className="campaign-history">
    <h2>Batch runs</h2>
    {runs.map(run=><div className="campaign-history-run" key={run.id}>
      <button type="button" aria-expanded={openId===run.id} onClick={()=>{void open(run.id)}}>
        <span>{when(run.createdAt)}</span>
        <strong>{campaignOutcomeLine(run.counts)}</strong>
        <small>{run.requested} requested{run.status==='cancelled'?' · stopped':run.status==='running'?' · in progress':''}</small>
      </button>
      {openId===run.id&&(loadingDetail?<p className="research-campaign-note">Loading…</p>:detail?<CampaignItemList items={detail.items}/>:
        <p className="research-campaign-note">That run could not be loaded.</p>)}
    </div>)}
  </section>;
}
