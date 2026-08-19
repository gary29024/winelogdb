import { useEffect,useMemo,useRef,useState } from 'react';
import { Link,useParams } from 'react-router-dom';
import { WineImage } from '../wines/WineImage';
import { getProducer,getProducerResearchStatus,listProducers,mergeProducer,researchProducer,setPrimaryProducerName,unlinkProducer,type LinkedProducer,type ProducerDetail,type ProducerResearchRun,type ProducerSummary } from './api';
import { ProducerHeroImage } from './ProducerHeroImage';
import { CuveeCatalogLinks } from './CuveeCatalogLinks';
import { normalizeProducerAlias } from '../../lib/producers/entities';
import { normalizeCuveeAlias } from '../../lib/cuvees/entities';
import '../../producer.css';

const stageLabel:Record<ProducerResearchRun['stage'],string>={preparing:'Queued for research',searching:'Researching in the background',retrying:'Retrying Gemini research',parsing:'Validating Gemini response',saving:'Saving producer research',image:'Finding a domaine image',complete:'Research complete',failed:'Research failed'};
type CatalogCategory='red'|'white'|'rose'|'sparkling'|'dessert'|'fortified'|'orange'|'other';
const categoryOrder:CatalogCategory[]=['red','white','rose','sparkling','dessert','fortified','orange','other'];
const categoryLabels:Record<CatalogCategory,string>={red:'Red',white:'White',rose:'Rosé',sparkling:'Sparkling',dessert:'Dessert / sweet',fortified:'Fortified',orange:'Orange',other:'Other'};
function catalogCategory(wine:ProducerDetail['catalog'][number]):CatalogCategory{
 const value=String(wine.category??wine.style??'other').toLowerCase();
 if(value.includes('sparkling')||value.includes('champagne'))return 'sparkling';
 if(value.includes('white'))return 'white';
 if(value.includes('rosé')||value.includes('rose'))return 'rose';
 if(value.includes('dessert')||value.includes('sweet'))return 'dessert';
 if(value.includes('fortified'))return 'fortified';
 if(value.includes('orange'))return 'orange';
 if(value.includes('red'))return 'red';
 return 'other';
}
const escapeRegExp=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function displayCatalogName(name:string,producer:ProducerDetail){
 const aliases=[producer.canonicalName,...producer.aliases].filter(Boolean).sort((a,b)=>b.length-a.length);
 for(const alias of aliases){
  const match=new RegExp(`^${escapeRegExp(alias)}(?:\\s+|\\s*[-–—:]\\s*)`,'i');
  const stripped=name.replace(match,'').trim();
  if(stripped&&stripped!==name)return stripped;
 }
 return name;
}
function catalogCuveeFor(wine:ProducerDetail['catalog'][number],producer:ProducerDetail){
 const raw=normalizeCuveeAlias(String(wine.name??'')),display=normalizeCuveeAlias(displayCatalogName(String(wine.name??''),producer)),app=normalizeCuveeAlias(String(wine.appellation??''));
 const candidates=producer.catalogCuvees.filter(item=>{const key=normalizeCuveeAlias(item.canonicalName);return key===raw||key===display});
 if(candidates.length<=1)return candidates[0];
 if(app){const exact=candidates.find(item=>normalizeCuveeAlias(item.appellation??'')===app);if(exact)return exact}
 return candidates[0];
}
function verboseCatalogStyle(value:unknown){
 const text=String(value??'').trim();
 return text.length>36||text.split(/\s+/).length>5||/[.;]/.test(text);
}
function catalogMeta(wine:ProducerDetail['catalog'][number],category:CatalogCategory){
 const parts:string[]=[];
 const add=(value:unknown)=>{const text=String(value??'').trim();if(!text)return;const key=normalizeProducerAlias(text);if(parts.some(existing=>normalizeProducerAlias(existing)===key))return;parts.push(text)};
 add(wine.appellation);
 const classification=String(wine.classification??'').trim(),appellation=String(wine.appellation??'').trim();
 if(classification&&!normalizeProducerAlias(appellation).includes(normalizeProducerAlias(classification)))add(classification);
 const style=String(wine.style??'').trim();add(style&&!verboseCatalogStyle(style)?style:categoryLabels[category]);
 return parts;
}
function catalogNote(wine:ProducerDetail['catalog'][number]){
 const explicit=String(wine.notes??'').trim(),style=String(wine.style??'').trim();
 const full=explicit||(style&&verboseCatalogStyle(style)?style:'');
 if(!full)return {short:'',full:''};
 if(full.length<=180)return {short:full,full};
 const clipped=full.slice(0,177).replace(/\s+\S*$/,'').trim();
 return {short:`${clipped||full.slice(0,177)}…`,full};
}

export function ProducerDetailPage(){
 const {id=''}=useParams(),[producer,setProducer]=useState<ProducerDetail>(),[available,setAvailable]=useState<ProducerSummary[]>([]),[selectedAlias,setSelectedAlias]=useState(''),[primaryName,setPrimaryName]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[researching,setResearching]=useState(false),[researchRun,setResearchRun]=useState<ProducerResearchRun|null>(null),[researchElapsed,setResearchElapsed]=useState(0),[merging,setMerging]=useState(false),[unlinking,setUnlinking]=useState(''),[savingPrimary,setSavingPrimary]=useState(false);
 const researchPoll=useRef<number|undefined>(undefined),researchClock=useRef<number|undefined>(undefined);
 function stopResearchTimers(){if(researchPoll.current)window.clearInterval(researchPoll.current);if(researchClock.current)window.clearInterval(researchClock.current);researchPoll.current=undefined;researchClock.current=undefined}
 async function reload(){const [detail,directory]=await Promise.all([getProducer(id),listProducers()]);setProducer(detail);setPrimaryName(detail.canonicalName);setAvailable(directory.items.filter(x=>x.id!==id));setSelectedAlias('')}
 function watchResearch(run:ProducerResearchRun){
  stopResearchTimers();setResearchRun(run);setResearching(run.status==='running');
  const started=Date.parse(run.startedAt);setResearchElapsed(Number.isFinite(started)?Math.max(0,Math.floor((Date.now()-started)/1000)):0);
  if(run.status!=='running')return;
  researchClock.current=window.setInterval(()=>setResearchElapsed(Number.isFinite(started)?Math.max(0,Math.floor((Date.now()-started)/1000)):0),1000);
  const poll=async()=>{
   const next=await getProducerResearchStatus(id,run.requestId).catch(()=>null);if(!next)return;setResearchRun(next);
   if(next.status==='running')return;
   stopResearchTimers();setResearching(false);setResearchElapsed(next.durationMs!=null?Math.floor(next.durationMs/1000):researchElapsed);
   if(next.status==='complete'){await reload().catch(()=>undefined);setNotice(`Producer research completed${next.durationMs!=null?` in ${(next.durationMs/1000).toFixed(1)}s`:''}.`);setError('')}
   else setError(`${next.message||'Producer research failed.'} · Research request ${next.requestId}`);
  };
  researchPoll.current=window.setInterval(()=>void poll(),2000);void poll();
 }
 useEffect(()=>{
  let active=true;
  Promise.all([reload(),getProducerResearchStatus(id).catch(()=>null)]).then(([,run])=>{if(active&&run)watchResearch(run)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false;stopResearchTimers()};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[id]);
 const linkedByName=useMemo(()=>new Map((producer?.linkedProducers??[]).map(link=>[normalizeProducerAlias(link.name),link])),[producer]);
 const catalogGroups=useMemo(()=>{
  const map=new Map<CatalogCategory,ProducerDetail['catalog']>();
  for(const wine of producer?.catalog??[]){const category=catalogCategory(wine),list=map.get(category)??[];list.push(wine);map.set(category,list)}
  return categoryOrder.flatMap(category=>{const wines=map.get(category);return wines?.length?[{category,label:categoryLabels[category],wines}]:[]});
 },[producer]);
 const tastedGroups=useMemo(()=>{
  const map=new Map<string,ProducerDetail['tastedWines']>();
  for(const wine of producer?.tastedWines??[]){const key=wine.cuveeId??normalizeProducerAlias(wine.wineName),list=map.get(key)??[];list.push(wine);map.set(key,list)}
  return [...map.values()].map(wines=>({name:wines[0]?.wineName??'',wines:[...wines].sort((a,b)=>(b.vintage??-1)-(a.vintage??-1))}));
 },[producer]);
 async function runResearch(){
  if(!confirm('Research this producer’s home location, public contacts, producer-wide winemaking practices and current/recent wine range with Gemini + Google Search? The job runs in the background and continues even if you close WineLog.'))return;
  setError('');setNotice('');
  try{
   const accepted=await researchProducer(id);const run=await getProducerResearchStatus(id,accepted.researchRequestId);
   if(run)watchResearch(run);else setNotice('Producer research has been queued in the background. You can leave this page safely.');
  }catch(e){setError((e as Error).message)}
 }
 async function savePrimaryName(){if(!producer||!primaryName||primaryName===producer.canonicalName)return;setSavingPrimary(true);setError('');setNotice('');try{const result=await setPrimaryProducerName(id,primaryName);await reload();setNotice(`${result.canonicalName} is now the primary producer name. Bottle-level recognised names and research remain attached to the same producer identity.`)}catch(e){setError((e as Error).message)}finally{setSavingPrimary(false)}}
 async function addAlias(){const source=available.find(x=>x.id===selectedAlias);if(!producer||!source)return;const ok=confirm(`Link “${source.canonicalName}” to “${producer.canonicalName}”?\n\n${producer.canonicalName} will remain the canonical producer. All wines and aliases from ${source.canonicalName} will be linked here. If both names already have research, WineLog will keep the newest complete result active, combine sources, and preserve the previous research in history.`);if(!ok)return;setMerging(true);setError('');setNotice('');try{const result=await mergeProducer(id,source.id);await reload();setNotice(`${result.mergedName} is now linked as an alias of ${result.canonicalName}.`)}catch(e){setError((e as Error).message)}finally{setMerging(false)}}
 async function unlinkAlias(link:LinkedProducer){if(!producer)return;const ok=confirm(`Unlink “${link.name}” from “${producer.canonicalName}”?\n\nWineLog will recreate ${link.name} as a separate producer, move back the wines that belonged to it when it was linked, and restore its archived research. Research added to ${producer.canonicalName} after the link will stay with ${producer.canonicalName}.`);if(!ok)return;setUnlinking(link.mergeId);setError('');setNotice('');try{const result=await unlinkProducer(id,link.mergeId);await reload();setNotice(`${result.unlinkedName} has been restored as a separate producer.`)}catch(e){setError((e as Error).message)}finally{setUnlinking('')}}
 if(loading)return <p>Loading producer…</p>;if(!producer)return <p role="alert">{error||'Producer not found'}</p>;
 const location=[producer.homeLocality,producer.homeRegion,producer.homeCountry].filter(Boolean).join(', '),primaryKey=normalizeProducerAlias(producer.canonicalName),hasContact=Boolean(producer.officialWebsiteUrl||producer.instagramUrl||producer.contactEmail||producer.contactPhone);
 return <article className="producer-detail"><Link className="back-pill" to="/producers">← Producers</Link>
  <header className={`producer-header${producer.heroImageAvailable?' has-hero':''}`}>
   {producer.heroImageAvailable&&<ProducerHeroImage producerId={producer.id} alt={`${producer.canonicalName} domaine`}/>}<div className="producer-header-shade"/>
   <div className="producer-header-content"><p className="eyebrow">PRODUCER</p><h1>{producer.canonicalName}</h1><p>{location||'Home location not researched yet'}</p>{producer.officialWebsiteUrl&&<a className="producer-site-link" href={producer.officialWebsiteUrl} target="_blank" rel="noreferrer">Official website ↗</a>}{producer.aliases.length>1&&<small>Known aliases: {producer.aliases.join(' · ')}</small>}</div>
  </header>
  {error&&<p className="producer-error" role="alert">{error}</p>}{notice&&<p className="producer-notice" role="status">{notice}</p>}
  <section className="detail-section"><div className="producer-section-title"><div><p className="section-label">PRODUCER RESEARCH</p><h2>Profile & range</h2></div><button type="button" disabled={researching} onClick={runResearch}>{researching?'Research running…':producer.researchedAt?'Refresh producer research':'Research producer'}</button></div>
   {researchRun&&<div className={`producer-research-status ${researchRun.status}`} role="status" aria-live="polite"><div><strong>{stageLabel[researchRun.stage]}</strong><span>{researchRun.message}</span></div><div><strong>{researching?`${researchElapsed}s`:researchRun.durationMs!=null?`${(researchRun.durationMs/1000).toFixed(1)}s`:''}</strong><small>Request {researchRun.requestId}</small></div>{researching&&<p>This is a background job. You can leave this page or close WineLog; the saved result will appear automatically when you return.</p>}</div>}
   {producer.profile?<p className="producer-profile">{producer.profile}</p>:<p>Research this producer to establish its physical base, broad region and commune, public contact details, official website, general producer-wide practices, header image and a sourced current/recent wine range.</p>}
   {producer.winemakingPractices&&<div className="producer-practices"><p className="section-label">GENERAL WINEMAKING PRACTICES</p><p className="producer-profile">{producer.winemakingPractices}</p><small>Producer-wide context only. Exact cuvée/vintage techniques are researched separately on the wine page.</small></div>}
   {hasContact&&<div className="producer-contact"><p className="section-label">CONTACT</p><div className="producer-contact-grid">
    {producer.officialWebsiteUrl&&<div><span>Website</span><a href={producer.officialWebsiteUrl} target="_blank" rel="noreferrer">Official website ↗</a></div>}
    {producer.instagramUrl&&<div><span>Instagram</span><a href={producer.instagramUrl} target="_blank" rel="noreferrer">Instagram ↗</a></div>}
    {producer.contactEmail&&<div><span>Email</span><a href={`mailto:${producer.contactEmail}`}>{producer.contactEmail}</a></div>}
    {producer.contactPhone&&<div><span>Phone</span><a href={`tel:${producer.contactPhone.replace(/[^+\d]/g,'')}`}>{producer.contactPhone}</a></div>}
   </div>{producer.contactSources.length>0&&<div className="producer-contact-sources"><span>Gemini contact references</span>{producer.contactSources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</div>}</div>}
   {catalogGroups.map(group=><div className="producer-catalog-group" key={group.category}><h3>{group.label}<span>{group.wines.length}</span></h3><div className="producer-catalog">{group.wines.map((wine,index)=>{const displayName=displayCatalogName(wine.name,producer),catalogIdentity=catalogCuveeFor(wine,producer),meta=catalogMeta(wine,group.category),note=catalogNote(wine);return <div className="catalog-row" key={`${wine.name}-${index}`}><div><strong>{displayName}</strong>{meta.length>0&&<span className="catalog-meta">{meta.join(' · ')}</span>}{note.short&&<small className="catalog-notes" title={note.full}>{note.short}</small>}</div>{Boolean(catalogIdentity?.tastedCount)&&<span className="tasted-badge">Tasted{catalogIdentity&&catalogIdentity.tastedCount>1?` · ${catalogIdentity.tastedCount}`:''}</span>}</div>})}</div></div>)}
   {producer.sources.length>0&&<div className="producer-sources"><strong>Profile & range references</strong>{producer.sources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title}</a>)}</div>}{producer.researchedAt&&<small>Latest producer research: {producer.researchModel} · {new Date(producer.researchedAt).toLocaleDateString()}</small>}
  </section>
  <section className="detail-section"><p className="section-label">YOUR TASTINGS</p><h2>{tastedGroups.length} cuvée{tastedGroups.length===1?'':'s'} · {producer.tastedWines.length} tasting{producer.tastedWines.length===1?'':'s'}</h2>{tastedGroups.length?<div className="producer-tasted-groups">{tastedGroups.map(group=><div className="tasted-cuvee-group" key={group.wines[0]?.cuveeId??normalizeProducerAlias(group.name)}><div className="tasted-cuvee-title"><strong>{group.name}</strong><span>{[...new Set(group.wines.map(w=>w.vintage??'NV'))].join(' · ')}</span></div><div className="producer-tasted">{group.wines.map(w=><Link to={`/wines/${w.id}`} className="tasted-row tasted-vintage-row" key={w.id}><div className="tasted-thumb">{w.imageId?<WineImage imageId={w.imageId} alt={`${w.wineName} ${w.vintage??'NV'} bottle`} className="tasted-thumb-image"/>:<span className="tasted-thumb-fallback">W</span>}</div><div className="tasted-copy"><strong>{w.vintage??'NV'}</strong><span>{[w.appellation,w.region].filter(Boolean).join(' · ')}</span></div><div className="tasted-meta">{w.rating!=null&&<strong>{w.rating}</strong>}{w.tastingDate&&<span>{w.tastingDate}</span>}</div></Link>)}</div></div>)}</div>:<p>No tasting records linked to this producer yet.</p>}
   <CuveeCatalogLinks producer={producer} onChanged={reload}/>
  </section>
  <section className="detail-section producer-identity"><p className="section-label">IDENTITY & ALIASES</p><h2>Known producer names</h2>
   <div className="primary-name-control"><label>Primary display name<select value={primaryName} onChange={e=>setPrimaryName(e.target.value)}>{producer.aliases.map(alias=><option key={alias} value={alias}>{alias}</option>)}</select></label><button type="button" disabled={savingPrimary||!primaryName||primaryName===producer.canonicalName} onClick={savePrimaryName}>{savingPrimary?'Saving…':'Set primary'}</button></div>
   <p className="producer-help">The primary name is used in the Producers directory and profile heading. Changing it does not rewrite the producer name recorded on individual bottles, change the stable producer ID, or regenerate research.</p>
   <div className="alias-chips">{producer.aliases.map(alias=>{const normalized=normalizeProducerAlias(alias),link=linkedByName.get(normalized),isPrimary=normalized===primaryKey;return <span className="alias-chip" key={alias}>{alias}{isPrimary&&<em>Primary</em>}{link&&!isPrimary&&<button type="button" disabled={unlinking===link.mergeId} onClick={()=>unlinkAlias(link)}>{unlinking===link.mergeId?'Unlinking…':'Unlink'}</button>}{link&&isPrimary&&<small>Choose another primary before unlinking</small>}</span>})}</div><p className="producer-help">Add alias only links another producer name that already exists in your WineLog database. It does not accept free-text names or create a new identity. Linked producer identities can be unlinked again from here.</p>
   {available.length>0?<div className="alias-link-control"><select aria-label="Existing producer name to link" value={selectedAlias} onChange={e=>setSelectedAlias(e.target.value)}><option value="">Select an existing producer…</option>{available.map(item=><option key={item.id} value={item.id}>{item.canonicalName}</option>)}</select><button type="button" disabled={!selectedAlias||merging} onClick={addAlias}>{merging?'Linking…':'Add alias'}</button></div>:<small>No other producer names are available to link.</small>}
   {producer.researchHistoryCount>0&&<small>{producer.researchHistoryCount} prior research version{producer.researchHistoryCount===1?' is':'s are'} preserved in merge history.</small>}
  </section>
 </article>
}