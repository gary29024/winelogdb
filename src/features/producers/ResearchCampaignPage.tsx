import { PageHeader } from '../../components/PageHeader';
import { useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import { listProducers } from './api';
import { ResearchCampaignPanel } from './ResearchCampaignPanel';
import { ResearchCampaignHistory } from './ResearchCampaignHistory';

/**
 * Batch research has a page of its own rather than a panel on the producer
 * library: it is a run you set going and come back to, and the library is a
 * list you scan. The library keeps only a one-line link, which turns into the
 * status of a live run.
 */
export function ResearchCampaignPage(){
  const [unresearched,setUnresearched]=useState(0),[loading,setLoading]=useState(true),[finished,setFinished]=useState(0);
  const load=()=>listProducers()
    .then(result=>setUnresearched(result.items.filter(item=>!item.sharedOnly&&!item.researchedAt).length))
    .catch(()=>undefined)
    .finally(()=>setLoading(false));

  useEffect(()=>{void load()},[]);

  return <section className="producer-page research-campaign-page">
    <Link className="back-pill" to="/producers">← Producer library</Link>
    <PageHeader title="Batch Deep Search" subtitle="Research producers in the background. Review the cost before starting."/>
    {loading?<p>Loading producers…</p>:<ResearchCampaignPanel unresearchedHint={unresearched} onFinished={()=>{void load();setFinished(count=>count+1)}}/>}
    {!loading&&unresearched===0&&<p className="research-campaign-none">Every producer in the library has been researched. New producers appear here as you add wines.</p>}
    <section className="research-history-section"><h2>Research history</h2><ResearchCampaignHistory refreshKey={finished}/></section>
  </section>;
}
