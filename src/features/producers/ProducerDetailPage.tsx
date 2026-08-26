import { useEffect,useMemo,useRef,useState } from 'react';
import { Link,useParams } from 'react-router-dom';
import { WineImage } from '../wines/WineImage';
import { cancelProducerResearch,getProducer,getProducerResearchStatus,listProducers,mergeProducer,researchProducer,saveProducerCatalogDecision,setPrimaryProducerName,undoProducerCatalogDecision,unlinkProducer,type CatalogDecision,type LinkedProducer,type ProducerDetail,type ProducerResearchRun,type ProducerSummary } from './api';
import { ProducerHeroImage } from './ProducerHeroImage';
import { ProducerContacts } from './ProducerContacts';
import { CuveeCatalogLinks,type TastedCuveeGroup } from './CuveeCatalogLinks';
import { normalizeProducerAlias } from '../../lib/producers/entities';
import { catalogNote,verboseCatalogStyle } from '../../lib/producers/catalogNote';
import { stripProducerCatalogPrefix } from '../../lib/producers/catalogName';
import { catalogDecisionKey,catalogDecisionLabel } from '../../lib/producers/catalogDecisions';
import { cuveeStyleFamily,normalizeCuveeAlias } from '../../lib/cuvees/entities';
import '../../producer.css';
import { startBackoffPoll,type Poller } from '../../lib/polling/backoff';
import { linkFrom } from '../wines/backTarget';

const stageLabel:Record<ProducerResearchRun['stage'],string>={preparing:'Queued for research',searching:'Researching in the background',retrying:'Retrying Gemini research',parsing:'Validating Gemini response',saving:'Saving producer research',image:'Finding a domaine image',complete:'Research complete',failed:'Research failed'};
type CatalogCategory='red'|'white'|'rose'|'sparkling'|'dessert'|'fortified'|'orange'|'other';
const categoryOrder:CatalogCategory[]=['red','white','rose','sparkling','dessert','fortified','orange','other'];
const categoryLabels:Record<CatalogCategory,string>={red:'Red',white:'White',rose:'Rosé',sparkling:'Sparkling',dessert:'Dessert / sweet',fortified:'Fortified',orange:'Orange',other:'Other'};
const RANGE_COLLAPSE_KEY='winelog.producerRange.collapsed';
function readCollapsedCategories():Set<CatalogCategory>{
 try{
  const raw=window.localStorage.getItem(RANGE_COLLAPSE_KEY);if(!raw)return new Set();
  const parsed=JSON.parse(raw) as unknown;
  return new Set(Array.isArray(parsed)?parsed.filter((x):x is CatalogCategory=>categoryOrder.includes(x as CatalogCategory)):[]);
 }catch{return new Set()}
}
function writeCollapsedCategories(next:Set<CatalogCategory>){try{window.localStorage.setItem(RANGE_COLLAPSE_KEY,JSON.stringify([...next]))}catch{/* storage unavailable */}}
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
function displayCatalogName(name:string,producer:ProducerDetail){return stripProducerCatalogPrefix(name,[producer.canonicalName,...producer.aliases])}
function catalogCuveeFor(wine:ProducerDetail['catalog'][number],producer:ProducerDetail){
 const raw=normalizeCuveeAlias(String(wine.name??'')),display=normalizeCuveeAlias(displayCatalogName(String(wine.name??''),producer)),app=normalizeCuveeAlias(String(wine.appellation??'')),style=cuveeStyleFamily(String(wine.category??wine.style??''));
 const candidates=producer.catalogCuvees.filter(item=>{const key=normalizeCuveeAlias(item.canonicalName);return key===raw||key===display});
 if(candidates.length<=1)return candidates[0];
 const styleMatches=style?candidates.filter(item=>cuveeStyleFamily(item.wineStyle)===style):[];
 const narrowed=styleMatches.length?styleMatches:candidates;
 if(app){const exact=narrowed.find(item=>normalizeCuveeAlias(item.appellation??'')===app);if(exact)return exact}
 return narrowed[0];
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
function sourceHost(value:string){try{return new URL(value).hostname.toLowerCase().replace(/^www\./,'')}catch{return ''}}

export function ProducerDetailPage(){
 const {id=''}=useParams(),[producer,setProducer]=useState<ProducerDetail>(),[available,setAvailable]=useState<ProducerSummary[]>([]),[availableLoaded,setAvailableLoaded]=useState(false),[selectedAlias,setSelectedAlias]=useState(''),[primaryName,setPrimaryName]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[researching,setResearching]=useState(false),[researchRun,setResearchRun]=useState<ProducerResearchRun|null>(null),[researchElapsed,setResearchElapsed]=useState(0),[researchCancelling,setResearchCancelling]=useState(false),[merging,setMerging]=useState(false),[unlinking,setUnlinking]=useState(''),[savingPrimary,setSavingPrimary]=useState(false),[collapsedCategories,setCollapsedCategories]=useState<Set<CatalogCategory>>(readCollapsedCategories),[fixingKey,setFixingKey]=useState(''),[mergeTargetKey,setMergeTargetKey]=useState(''),[catalogBusy,setCatalogBusy]=useState(false);
 const researchPoll=useRef<Poller|undefined>(undefined),researchClock=useRef<number|undefined>(undefined);
 function stopResearchTimers(){researchPoll.current?.stop();if(researchClock.current)window.clearInterval(researchClock.current);researchPoll.current=undefined;researchClock.current=undefined}
 async function reload(){const detail=await getProducer(id);setProducer(detail);setPrimaryName(detail.canonicalName);setSelectedAlias('')}
 async function refreshAvailable(){const directory=await listProducers();setAvailable(directory.items.filter(x=>x.id!==id));setAvailableLoaded(true);setSelectedAlias('')}
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
  researchPoll.current=startBackoffPoll(poll);void poll();
 }
 useEffect(()=>{
  let active=true,aliasTimer:number|undefined;
  setLoading(true);setProducer(undefined);setAvailable([]);setAvailableLoaded(false);setError('');
  Promise.all([reload(),getProducerResearchStatus(id).catch(()=>null)]).then(([,run])=>{
   if(!active)return;if(run)watchResearch(run);
   aliasTimer=window.setTimeout(()=>{void listProducers().then(directory=>{if(!active)return;setAvailable(directory.items.filter(x=>x.id!==id));setAvailableLoaded(true)}).catch(()=>{if(active)setAvailableLoaded(true)})},250);
  }).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false;if(aliasTimer)window.clearTimeout(aliasTimer);stopResearchTimers()};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[id]);
 const linkedByName=useMemo(()=>new Map((producer?.linkedProducers??[]).map(link=>[normalizeProducerAlias(link.name),link])),[producer]);
 const catalogGroups=useMemo(()=>{
  if(!producer)return [];
  const map=new Map<CatalogCategory,ProducerDetail['catalog']>();
  for(const wine of producer.catalog){const category=catalogCategory(wine),list=map.get(category)??[];list.push(wine);map.set(category,list)}
  return categoryOrder.flatMap(category=>{
   const wines=map.get(category);if(!wines?.length)return [];
   const rows=wines.map((wine,index)=>{
    const identity=catalogCuveeFor(wine,producer),producerNames=[producer.canonicalName,...producer.aliases];
    return {key:`${wine.name}-${index}`,displayName:displayCatalogName(wine.name,producer),identity,meta:catalogMeta(wine,category),note:catalogNote(wine.notes,wine.style),releaseCount:identity?.tastedReleases?.length??0,
     decisionKey:catalogDecisionKey(wine,producerNames),label:catalogDecisionLabel(wine,producerNames),category};
   });
   return [{category,label:categoryLabels[category],rows,tasted:rows.filter(row=>Boolean(row.identity?.tastedCount)).length}];
  });
 },[producer]);
 const catalogTotals=useMemo(()=>catalogGroups.reduce((totals,group)=>({wines:totals.wines+group.rows.length,tasted:totals.tasted+group.tasted}),{wines:0,tasted:0}),[catalogGroups]);
 const catalogRowIndex=useMemo(()=>catalogGroups.flatMap(group=>group.rows.map(row=>({decisionKey:row.decisionKey,label:row.label,groupLabel:group.label}))).filter(row=>row.decisionKey),[catalogGroups]);
 const allCategoriesCollapsed=catalogGroups.length>0&&catalogGroups.every(group=>collapsedCategories.has(group.category));
 function startFixing(decisionKey:string){setFixingKey(current=>current===decisionKey?'':decisionKey);setMergeTargetKey('');setError('')}
 async function applyCatalogDecision(row:{decisionKey:string;label:string},decision:'merge'|'hide'){
  if(!producer||catalogBusy)return;
  const target=decision==='merge'?catalogRowIndex.find(item=>item.decisionKey===mergeTargetKey):undefined;
  if(decision==='merge'&&!target)return;
  const ok=confirm(decision==='hide'
   ?`Hide “${row.label}” from ${producer.canonicalName}’s range?\n\nThe wine is removed from the researched range and future producer research will not bring it back. Your own tastings are not deleted. You can undo this under Manual catalogue corrections.`
   :`Record “${row.label}” as the same wine as “${target!.label}”?\n\nOnly “${target!.label}” will be listed, and future producer research will keep applying this correction. Your own tastings are not deleted. You can undo this under Manual catalogue corrections.`);
  if(!ok)return;
  setCatalogBusy(true);setError('');setNotice('');
  try{
   await saveProducerCatalogDecision(id,{decision,sourceKey:row.decisionKey,sourceName:row.label,targetKey:target?.decisionKey??null,targetName:target?.label??null});
   await reload();setFixingKey('');setMergeTargetKey('');
   setNotice(decision==='hide'?`“${row.label}” is hidden from the range. Producer research will not restore it.`:`“${row.label}” is now recorded as the same wine as “${target!.label}”.`);
  }catch(e){setError((e as Error).message)}finally{setCatalogBusy(false)}
 }
 async function undoCatalogDecision(decision:CatalogDecision){
  if(!producer||catalogBusy)return;
  if(!confirm(`Undo this catalogue correction?\n\n“${decision.sourceName}” will be listed again the next time producer research returns it.`))return;
  setCatalogBusy(true);setError('');setNotice('');
  try{await undoProducerCatalogDecision(id,decision.id);await reload();setNotice(`The correction for “${decision.sourceName}” has been undone.`)}
  catch(e){setError((e as Error).message)}finally{setCatalogBusy(false)}
 }
 function toggleCategory(category:CatalogCategory){
  setCollapsedCategories(current=>{const next=new Set(current);if(next.has(category))next.delete(category);else next.add(category);writeCollapsedCategories(next);return next});
 }
 function toggleAllCategories(){
  setCollapsedCategories(current=>{
   const next=new Set(current);
   for(const group of catalogGroups){if(allCategoriesCollapsed)next.delete(group.category);else next.add(group.category)}
   writeCollapsedCategories(next);return next;
  });
 }
 const tastedGroups=useMemo<TastedCuveeGroup[]>(()=>{
  const map=new Map<string,ProducerDetail['tastedWines']>();
  for(const wine of producer?.tastedWines??[]){const style=cuveeStyleFamily(wine.wineStyle)||'unknown',key=wine.releaseParentCuveeId?`release:${wine.releaseParentCuveeId}::${style}`:`${wine.cuveeId??normalizeProducerAlias(wine.wineName)}::${style}`,list=map.get(key)??[];list.push(wine);map.set(key,list)}
  return [...map.values()].map(wines=>{
   const first=wines[0],releaseFamily=Boolean(first?.releaseParentCuveeId),grapes=[...new Set(wines.flatMap(wine=>wine.grapes??[]).map(grape=>grape.trim()).filter(Boolean))];
   const ordered=[...wines].sort((a,b)=>releaseFamily?(b.releaseSequence??-1)-(a.releaseSequence??-1):(b.vintage??-1)-(a.vintage??-1));
   return {cuveeId:first?.cuveeId??null,catalogCuveeId:first?.releaseParentCuveeId??first?.catalogCuveeId??null,name:releaseFamily?(first?.releaseParentName??first?.wineName??''):(first?.wineName??''),appellation:first?.appellation??null,wineStyle:first?.wineStyle??null,grapes,releaseFamily,wines:ordered};
  });
 },[producer]);
 async function runResearch(){
  if(!confirm('Research this producer’s home location, public contacts, producer-wide winemaking practices and current/recent wine range with Gemini + Google Search? The job runs in the background and continues even if you close WineLog.'))return;
  setError('');setNotice('');
  try{
   const accepted=await researchProducer(id);const run=await getProducerResearchStatus(id,accepted.researchRequestId);
   if(run)watchResearch(run);else setNotice('Producer research has been queued in the background. You can leave this page safely.');
  }catch(e){setError((e as Error).message)}
 }
 async function cancelResearch(){
  if(!researchRun||researchRun.status!=='running'||researchCancelling)return;
  if(!confirm('Cancel this producer Deep Search? Any profile or catalogue data already saved will be kept.'))return;
  setResearchCancelling(true);setError('');setNotice('');
  try{
   const result=await cancelProducerResearch(id,researchRun.requestId);stopResearchTimers();setResearching(false);setResearchRun(null);await reload().catch(()=>undefined);
   setNotice(result.alreadyTerminal?'Producer research had already reached a terminal state.':'Producer Deep Search cancelled. Any profile or catalogue data already saved was kept.');
  }catch(e){setError((e as Error).message)}finally{setResearchCancelling(false)}
 }
 async function savePrimaryName(){if(!producer||!primaryName||primaryName===producer.canonicalName)return;setSavingPrimary(true);setError('');setNotice('');try{const result=await setPrimaryProducerName(id,primaryName);await reload();setNotice(`${result.canonicalName} is now the primary producer name. Bottle-level recognised names and research remain attached to the same producer identity.`)}catch(e){setError((e as Error).message)}finally{setSavingPrimary(false)}}
 async function addAlias(){const source=available.find(x=>x.id===selectedAlias);if(!producer||!source)return;const ok=confirm(`Link “${source.canonicalName}” to “${producer.canonicalName}”?\n\n${producer.canonicalName} will remain the canonical producer. All wines and aliases from ${source.canonicalName} will be linked here. If both names already have research, WineLog will keep the newest complete result active, combine sources, and preserve the previous research in history.`);if(!ok)return;setMerging(true);setError('');setNotice('');try{const result=await mergeProducer(id,source.id);await reload();void refreshAvailable().catch(()=>undefined);setNotice(`${result.mergedName} is now linked as an alias of ${result.canonicalName}.`)}catch(e){setError((e as Error).message)}finally{setMerging(false)}}
 async function unlinkAlias(link:LinkedProducer){if(!producer)return;const ok=confirm(`Unlink “${link.name}” from “${producer.canonicalName}”?\n\nWineLog will recreate ${link.name} as a separate producer, move back the wines that belonged to it when it was linked, and restore its archived research. Research added to ${producer.canonicalName} after the link will stay with ${producer.canonicalName}.`);if(!ok)return;setUnlinking(link.mergeId);setError('');setNotice('');try{const result=await unlinkProducer(id,link.mergeId);await reload();void refreshAvailable().catch(()=>undefined);setNotice(`${result.unlinkedName} has been restored as a separate producer.`)}catch(e){setError((e as Error).message)}finally{setUnlinking('')}}
 if(loading)return <p>Loading producer…</p>;if(!producer)return <p role="alert">{error||'Producer not found'}</p>;
 const location=[producer.homeLocality,producer.homeRegion,producer.homeCountry].filter(Boolean).join(', '),primaryKey=normalizeProducerAlias(producer.canonicalName),sourceWebsiteCount=new Set(producer.sources.map(source=>sourceHost(source.url)).filter(Boolean)).size;
 return <article className="producer-detail"><Link className="back-pill" to="/producers">← Producers</Link>
  <header className={`producer-header${producer.heroImageAvailable?' has-hero':''}`}>
   {producer.heroImageAvailable&&<ProducerHeroImage producerId={producer.id} alt={`${producer.canonicalName} domaine`}/>}<div className="producer-header-shade"/>
   <div className="producer-header-content"><p className="eyebrow">PRODUCER</p><h1>{producer.canonicalName}</h1><p>{location||'Home location not researched yet'}</p>{producer.aliases.length>1&&<small>Known aliases: {producer.aliases.join(' · ')}</small>}</div>
  </header>
  {error&&<p className="producer-error" role="alert">{error}</p>}{notice&&<p className="producer-notice" role="status">{notice}</p>}
  <section className="detail-section"><div className="producer-section-title"><div><p className="section-label">Producer research</p><h2>Profile & range</h2></div><button type="button" className="primary" disabled={researching} onClick={runResearch}>{researching?'Research running…':producer.researchedAt?'Refresh producer research':'Research producer'}</button></div>
   {researchRun&&<div className={`producer-research-status ${researchRun.status}`} role="status" aria-live="polite"><div><strong>{stageLabel[researchRun.stage]}</strong><span>{researchRun.message}</span></div><div><strong>{researching?`${researchElapsed}s`:researchRun.durationMs!=null?`${(researchRun.durationMs/1000).toFixed(1)}s`:''}</strong><small>Request {researchRun.requestId}</small></div>{researching&&<><p>This is a background job. You can leave this page or close WineLog; the saved result will appear automatically when you return.</p><button type="button" className="secondary-danger" disabled={researchCancelling} onClick={cancelResearch}>{researchCancelling?'Cancelling…':'Cancel Deep Search'}</button></>}</div>}
   {producer.profile?<p className="producer-profile">{producer.profile}</p>:<p>Research this producer to establish its physical base, broad region and commune, public contact details, official website, general producer-wide practices, header image and a sourced current/recent wine range.</p>}
   {producer.winemakingPractices&&<div className="producer-practices"><p className="section-label">General winemaking practices</p><p className="producer-profile">{producer.winemakingPractices}</p><small>Producer-wide context only. Exact cuvée/vintage techniques are researched separately on the wine page.</small></div>}
   <ProducerContacts producer={producer} onChanged={reload}/>
   {catalogGroups.length>0&&<div className="producer-range">
    <div className="producer-range-head">
     <div><p className="section-label">Wine range</p><strong>{catalogTotals.wines} wine{catalogTotals.wines===1?'':'s'} · {catalogGroups.length} style{catalogGroups.length===1?'':'s'}{catalogTotals.tasted?` · ${catalogTotals.tasted} tasted`:''}</strong></div>
     <button type="button" className="range-toggle-all" onClick={toggleAllCategories}>{allCategoriesCollapsed?'Expand all':'Collapse all'}</button>
    </div>
    {catalogGroups.map(group=>{
     const collapsed=collapsedCategories.has(group.category),panelId=`producer-range-${group.category}`;
     return <section className={`producer-catalog-group${collapsed?' is-collapsed':''}`} key={group.category}>
      <h3><button type="button" className="catalog-group-toggle" aria-expanded={!collapsed} aria-controls={panelId} onClick={()=>toggleCategory(group.category)}>
       <span className={`catalog-swatch ${group.category}`} aria-hidden="true"/>
       <span className="catalog-group-name">{group.label}</span>
       <span className="catalog-group-count">{group.rows.length}</span>
       {group.tasted>0&&<span className="catalog-group-tasted">{group.tasted} tasted</span>}
       <span className="catalog-chevron" aria-hidden="true"/>
      </button></h3>
      <div className="producer-catalog" id={panelId} hidden={collapsed}>{group.rows.map(row=>{
       const fixing=Boolean(row.decisionKey)&&fixingKey===row.decisionKey,mergeChoices=catalogRowIndex.filter(item=>item.decisionKey!==row.decisionKey);
       return <div className={`catalog-row${fixing?' is-fixing':''}`} key={row.key}>
        <div style={{minWidth:0}}><strong>{row.displayName}</strong>{row.meta.length>0&&<span className="catalog-meta">{row.meta.join(' · ')}</span>}{row.note.short&&<small className="catalog-notes" style={{overflowWrap:'anywhere',wordBreak:'break-word'}} title={row.note.full}>{row.note.short}</small>}</div>
        <div className="catalog-row-actions">
         {Boolean(row.identity?.tastedCount)&&<span className="tasted-badge">Tasted{row.releaseCount?` · ${row.releaseCount} release${row.releaseCount===1?'':'s'}`:row.identity&&row.identity.tastedCount>1?` · ${row.identity.tastedCount}`:''}</span>}
         {Boolean(row.decisionKey)&&<button type="button" className="catalog-fix" aria-expanded={fixing} onClick={()=>startFixing(row.decisionKey)}>{fixing?'Close':'Duplicate?'}</button>}
        </div>
        {fixing&&<div className="catalog-fix-panel">
         <p>Is “{row.label}” a duplicate of another wine in this range, or not a real wine at all? Producer research keeps re-applying whichever you choose.</p>
         {mergeChoices.length>0?<div className="catalog-fix-merge">
          <label>Same wine as<select value={mergeTargetKey} onChange={e=>setMergeTargetKey(e.target.value)} aria-label={`Wine to merge ${row.label} into`}><option value="">Choose the wine to keep…</option>{mergeChoices.map(item=><option key={item.decisionKey} value={item.decisionKey}>{item.label} · {item.groupLabel}</option>)}</select></label>
          <button type="button" disabled={!mergeTargetKey||catalogBusy} onClick={()=>applyCatalogDecision(row,'merge')}>{catalogBusy?'Saving…':'Merge'}</button>
         </div>:<small>No other wine in this range to merge into.</small>}
         <button type="button" className="secondary-danger" disabled={catalogBusy} onClick={()=>applyCatalogDecision(row,'hide')}>Hide from range</button>
        </div>}
       </div>;
      })}</div>
     </section>;
    })}
    {producer.catalogDecisions.length>0&&<details className="catalog-corrections">
     <summary>{producer.catalogDecisions.length} manual catalogue correction{producer.catalogDecisions.length===1?'':'s'}</summary>
     {producer.catalogDecisions.map(decision=><div className="catalog-correction" key={decision.id}>
      <div><strong>{decision.sourceName}</strong><span>{decision.decision==='merge'?`Merged into ${decision.targetName??'another wine'}`:'Hidden from the range'}</span></div>
      <button type="button" disabled={catalogBusy} onClick={()=>undoCatalogDecision(decision)}>Undo</button>
     </div>)}
     <small>Corrections are re-applied after every producer research run, so a resolved duplicate does not come back.</small>
    </details>}
   </div>}
   {producer.sources.length>0&&<details className="producer-sources"><summary>{producer.sources.length} profile & range reference{producer.sources.length===1?'':'s'}{sourceWebsiteCount?` · ${sourceWebsiteCount} website${sourceWebsiteCount===1?'':'s'}`:''}</summary>{producer.sources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title}</a>)}</details>}{producer.researchedAt&&<small>Latest producer research: {producer.researchModel} · {new Date(producer.researchedAt).toLocaleDateString()}</small>}
  </section>
  <section className="detail-section"><p className="section-label">Your tastings</p><h2>{tastedGroups.length} cuvée{tastedGroups.length===1?'':'s'} · {producer.tastedWines.length} tasting{producer.tastedWines.length===1?'':'s'}</h2>{tastedGroups.length?<div className="producer-tasted-groups">{tastedGroups.map(group=>{const releaseCount=group.releaseFamily?new Set(group.wines.map(w=>w.releaseDesignation).filter(Boolean)).size:0,identityMeta=[releaseCount?`${releaseCount} release${releaseCount===1?'':'s'}`:null,group.wineStyle,group.grapes.length?group.grapes.join(' / '):null].filter(Boolean).join(' · ');return <div className="tasted-cuvee-group" key={`${group.catalogCuveeId??group.cuveeId??normalizeProducerAlias(group.name)}-${cuveeStyleFamily(group.wineStyle)||'unknown'}`}><div className="tasted-cuvee-title"><div><strong>{group.name}</strong>{identityMeta&&<small>{identityMeta}</small>}</div></div><div className="producer-tasted">{group.wines.map((w,index)=>{const release=String(w.releaseDesignation??'').trim(),subline=[release?(w.vintage??'NV'):null,w.appellation,w.region].filter(Boolean).join(' · ');return <div className="tasted-row tasted-vintage-row" key={w.id}><Link to={`/wines/${w.id}`} state={linkFrom({to:`/producers/${producer.id}`,label:producer.canonicalName})} className="tasted-row-link"><div className="tasted-thumb">{w.imageId?<WineImage imageId={w.imageId} alt={`${w.wineName} ${w.vintage??'NV'} bottle`} className="tasted-thumb-image"/>:<span className="tasted-thumb-fallback">W</span>}</div><div className="tasted-copy"><strong>{release||w.vintage||'NV'}</strong><span>{subline}</span></div></Link><div className="tasted-meta">{w.rating!=null&&<strong>{w.rating}</strong>}{w.tastingDate&&<span>{w.tastingDate}</span>}{index===0&&<CuveeCatalogLinks producer={producer} group={group} onChanged={reload}/>}</div></div>})}</div></div>})}</div>:<p>No tasting records linked to this producer yet.</p>}
  </section>
  <section className="detail-section producer-identity"><p className="section-label">Identity & aliases</p><h2>Known producer names</h2>
   <div className="primary-name-control"><label>Primary display name<select value={primaryName} onChange={e=>setPrimaryName(e.target.value)}>{producer.aliases.map(alias=><option key={alias} value={alias}>{alias}</option>)}</select></label><button type="button" disabled={savingPrimary||!primaryName||primaryName===producer.canonicalName} onClick={savePrimaryName}>{savingPrimary?'Saving…':'Set primary'}</button></div>
   <p className="producer-help">The primary name is used in the Producers directory and profile heading. Changing it does not rewrite the producer name recorded on individual bottles, change the stable producer ID, or regenerate research.</p>
   <div className="alias-chips">{producer.aliases.map(alias=>{const normalized=normalizeProducerAlias(alias),link=linkedByName.get(normalized),isPrimary=normalized===primaryKey;return <span className="alias-chip" key={alias}>{alias}{isPrimary&&<em>Primary</em>}{link&&!isPrimary&&<button type="button" disabled={unlinking===link.mergeId} onClick={()=>unlinkAlias(link)}>{unlinking===link.mergeId?'Unlinking…':'Unlink'}</button>}{link&&isPrimary&&<small>Choose another primary before unlinking</small>}</span>})}</div><p className="producer-help">Add alias only links another producer name that already exists in your WineLog database. It does not accept free-text names or create a new identity. Linked producer identities can be unlinked again from here.</p>
   {!availableLoaded?<small>Loading available producer names…</small>:available.length>0?<div className="alias-link-control"><select aria-label="Existing producer name to link" value={selectedAlias} onChange={e=>setSelectedAlias(e.target.value)}><option value="">Select an existing producer…</option>{available.map(item=><option key={item.id} value={item.id}>{item.canonicalName}</option>)}</select><button type="button" disabled={!selectedAlias||merging} onClick={addAlias}>{merging?'Linking…':'Add alias'}</button></div>:<small>No other producer names are available to link.</small>}
   {producer.researchHistoryCount>0&&<small>{producer.researchHistoryCount} prior research version{producer.researchHistoryCount===1?' is':'s are'} preserved in merge history.</small>}
  </section>
 </article>
}