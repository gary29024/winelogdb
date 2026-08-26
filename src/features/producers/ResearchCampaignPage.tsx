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
    .then(result=>setUnresearched(result.items.filter(item=>!item.researchedAt).length))
    .catch(()=>undefined)
    .finally(()=>setLoading(false));

  useEffect(()=>{void load()},[]);

  return <section className="producer-page research-campaign-page">
    <Link className="back-pill" to="/producers">← Producer library</Link>
    <div className="hero compact">
      <p className="eyebrow">PRODUCERS</p>
      <h1>Batch Deep Search.</h1>
      <p>Research producers that have never been researched, a few at a time, in the background. The run keeps going when you close WineLog, and what it costs is shown before anything is queued.</p>
    </div>
    {loading?<p>Loading producers…</p>:<ResearchCampaignPanel unresearchedHint={unresearched} onFinished={()=>{void load();setFinished(count=>count+1)}}/>}
    {!loading&&unresearched===0&&<p className="research-campaign-none">Every producer in the library has been researched. New producers appear here as you add wines.</p>}
    <ResearchCampaignHistory refreshKey={finished}/>
  </section>;
}
