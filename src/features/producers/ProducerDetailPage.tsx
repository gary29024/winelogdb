import { useEffect,useMemo,useState } from 'react';
import { Link,useParams } from 'react-router-dom';
import { getProducer,researchProducer,type ProducerDetail } from './api';
import { normalizeProducerAlias } from '../../lib/producers/entities';
import '../../producer.css';

const wineKey=(name:string)=>normalizeProducerAlias(name).replace(/\b(grand cru|premier cru|1er cru|village)\b/g,'').trim();

export function ProducerDetailPage(){
 const {id=''}=useParams(),[producer,setProducer]=useState<ProducerDetail>(),[loading,setLoading]=useState(true),[error,setError]=useState(''),[researching,setResearching]=useState(false);
 useEffect(()=>{getProducer(id).then(setProducer).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[id]);
 const tastedKeys=useMemo(()=>new Set((producer?.tastedWines??[]).map(w=>wineKey(w.wineName))),[producer]);
 async function runResearch(){if(!confirm('Research this producer’s home location and current wine range with Gemini 3.7 Flash and Google Search?'))return;setResearching(true);setError('');try{const updated=await researchProducer(id);setProducer(p=>p?{...p,...updated}:p)}catch(e){setError((e as Error).message)}finally{setResearching(false)}}
 if(loading)return <p>Loading producer…</p>;if(!producer)return <p role="alert">{error||'Producer not found'}</p>;
 const location=[producer.homeLocality,producer.homeRegion,producer.homeCountry].filter(Boolean).join(', ');
 return <article className="producer-detail"><Link className="back-pill" to="/producers">← Producers</Link><header className="producer-header"><p className="eyebrow">PRODUCER</p><h1>{producer.canonicalName}</h1><p>{location||'Home location not researched yet'}</p>{producer.aliases.length>1&&<small>Known aliases: {producer.aliases.join(' · ')}</small>}</header>
  {error&&<p className="producer-error" role="alert">{error}</p>}
  <section className="detail-section"><div className="producer-section-title"><div><p className="section-label">PRODUCER RESEARCH</p><h2>Profile & range</h2></div><button type="button" disabled={researching} onClick={runResearch}>{researching?'Researching…':producer.researchedAt?'Refresh producer research':'Research producer'}</button></div>{producer.profile?<p className="producer-profile">{producer.profile}</p>:<p>Research this producer to establish its physical base and a sourced current/recent wine range. This is stored once at producer level and reused.</p>}
   {producer.catalog.length>0&&<div className="producer-catalog">{producer.catalog.map((wine,index)=>{const tasted=tastedKeys.has(wineKey(wine.name));return <div className="catalog-row" key={`${wine.name}-${index}`}><div><strong>{wine.name}</strong><span>{[wine.appellation,wine.classification,wine.style].filter(Boolean).join(' · ')}</span>{wine.notes&&<small>{wine.notes}</small>}</div>{tasted&&<span className="tasted-badge">Tasted</span>}</div>})}</div>}
   {producer.sources.length>0&&<div className="producer-sources"><strong>Sources</strong>{producer.sources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title}</a>)}</div>}{producer.researchedAt&&<small>Latest producer research: {producer.researchModel} · {new Date(producer.researchedAt).toLocaleDateString()}</small>}
  </section>
  <section className="detail-section"><p className="section-label">YOUR TASTINGS</p><h2>{producer.tastedWines.length} tasted wine{producer.tastedWines.length===1?'':'s'}</h2>{producer.tastedWines.length?<div className="producer-tasted">{producer.tastedWines.map(w=><Link to={`/wines/${w.id}`} className="tasted-row" key={w.id}><div><strong>{w.wineName}</strong><span>{[w.vintage??'NV',w.appellation,w.region].filter(Boolean).join(' · ')}</span></div><div>{w.rating!=null&&<strong>{w.rating}</strong>}{w.tastingDate&&<span>{w.tastingDate}</span>}</div></Link>)}</div>:<p>No tasting records linked to this producer yet.</p>}</section>
 </article>
}
