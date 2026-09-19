import { FriendResearchStatus } from '../auth/FriendResearchStatus';
import { accountStorageKey,getAccount } from '../../lib/auth/client';
import { useEffect,useMemo,useRef,useState } from 'react';
import { Link,useLocation,useNavigate,useParams } from 'react-router-dom';
import { WineImage } from '../wines/WineImage';
import { producerLinkChoices } from '../../lib/producers/linkChoices';
import { confirmProducerName,getProducerNameSuggestions,type ProducerNameSuggestion,cancelProducerResearch,deleteProducer,getProducer,removeProducerHeroImage,getProducerResearchStatus,listProducers,mergeProducer,researchProducer,saveProducerCatalogDecision,setPrimaryProducerName,undoProducerCatalogDecision,unlinkProducer,type CatalogDecision,type LinkedProducer,type ProducerDetail,type ProducerResearchRun,type ProducerSummary } from './api';
import { ProducerHeroImage } from './ProducerHeroImage';
import { ProducerContacts } from './ProducerContacts';
import { ProducerRangeMissing } from './ProducerRangeMissing';
import { CuveeCatalogLinks,type TastedCuveeGroup } from './CuveeCatalogLinks';
import { normalizeProducerAlias } from '../../lib/producers/entities';
import { catalogNote,verboseCatalogStyle } from '../../lib/producers/catalogNote';
import { stripProducerCatalogPrefix } from '../../lib/producers/catalogName';
import { catalogDecisionKey,catalogDecisionLabel } from '../../lib/producers/catalogDecisions';
import { cuveeStyleFamily,normalizeCuveeAlias } from '../../lib/cuvees/entities';
import { CATALOG_HIERARCHY_LABELS,catalogHierarchyLabel,catalogVillageLabel,type CatalogHierarchyLabel } from '../../lib/cuvees/catalogPresentation';
import { CompositionBar } from '../../components/CompositionBar';
import { SectionLabel } from '../../components/SectionLabel';
import { foldToOther,OTHER_TONE,SERIES_TONES } from '../../lib/ui/composition';
import { isResearchStale } from '../../lib/research/freshness';
import '../../producer.css';
import { startBackoffPoll,type Poller } from '../../lib/polling/backoff';
import { backTargetFromState,linkFrom,readBackTarget,rememberBackTarget,PRODUCERS_BACK } from '../wines/backTarget';
import { ElapsedSeconds } from '../../components/ElapsedSeconds';

const stageLabel:Record<ProducerResearchRun['stage'],string>={preparing:'Queued for research',searching:'Researching in the background',retrying:'Retrying research',parsing:'Checking research result',saving:'Saving producer research',image:'Finding a domaine image',complete:'Research complete',failed:'Research failed'};
type CatalogCategory='red'|'white'|'rose'|'sparkling'|'dessert'|'fortified'|'orange'|'other';
const categoryOrder:CatalogCategory[]=['red','white','rose','sparkling','dessert','fortified','orange','other'];
const categoryLabels:Record<CatalogCategory,string>={red:'Red',white:'White',rose:'Rosé',sparkling:'Sparkling',dessert:'Dessert / sweet',fortified:'Fortified',orange:'Orange',other:'Other'};
/**
 * The three questions a range can answer.
 *
 * It only ever grouped by style, which is the least interesting of the three
 * for a Burgundy domaine: how good the holdings are, and where they are, were
 * both already computed and thrown away. The rows are the same rows - this
 * regroups them in the browser and fetches nothing.
 */
type RangeAxis='classification'|'village'|'style';
const RANGE_AXES:RangeAxis[]=['classification','village','style'];
const RANGE_AXIS_LABELS:Record<RangeAxis,string>={classification:'Classification',village:'Village',style:'Style'};
const isRangeAxis=(value:unknown):value is RangeAxis=>RANGE_AXES.includes(value as RangeAxis);
/** A group name is free text once the axis is a village, so it cannot go straight into an id. */
const slug=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'group';

/** The cru ramp, in rank order; anything unclassified is not a rank and stays neutral. */
const HIERARCHY_TONES:Record<CatalogHierarchyLabel,string>={
 'Grand Cru':'cru-grand','Premier Cru / 1er Cru':'cru-premier',
 'Village / appellation':'cru-village','Regional':'cru-regional','Other / unclassified':OTHER_TONE
};

const RANGE_COLLAPSE_KEY='winelog.producerRange.collapsed';
const RANGE_AXIS_KEY='winelog.producerRange.axis';
/**
 * Collapse state is keyed by axis as well as by group, because "Red" collapsed
 * says nothing about whether "Grand Cru" should be. The stored value was a bare
 * list of style categories, so anything that does not parse as the new shape is
 * simply dropped rather than migrated: it costs one expanded group, once.
 */
function readCollapsedGroups():Set<string>{
 try{
  const raw=window.localStorage.getItem(accountStorageKey(RANGE_COLLAPSE_KEY));if(!raw)return new Set();
  const parsed=JSON.parse(raw) as unknown;
  if(!Array.isArray(parsed))return new Set();
  return new Set(parsed.filter((x):x is string=>typeof x==='string').map(x=>x.includes(':')?x:`style:${x}`));
 }catch{return new Set()}
}
function writeCollapsedGroups(next:Set<string>){try{window.localStorage.setItem(accountStorageKey(RANGE_COLLAPSE_KEY),JSON.stringify([...next]))}catch{/* storage unavailable */}}
function readStoredAxis():RangeAxis|null{
 try{const raw=window.localStorage.getItem(accountStorageKey(RANGE_AXIS_KEY));return isRangeAxis(raw)?raw:null}catch{return null}
}
function writeStoredAxis(axis:RangeAxis){try{window.localStorage.setItem(accountStorageKey(RANGE_AXIS_KEY),axis)}catch{/* storage unavailable */}}
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

const suggestionReason:Record<ProducerNameSuggestion['reason'],string>={
  abbreviation:'a longer form of this name',
  prefix:'the same name with its estate word',
  spelling:'a slightly different spelling'
};
export function ProducerDetailPage(){
 const {id=''}=useParams(),{state:navState}=useLocation(),[producer,setProducer]=useState<ProducerDetail>(),[available,setAvailable]=useState<ProducerSummary[]>([]),[availableLoaded,setAvailableLoaded]=useState(false),[availableLoading,setAvailableLoading]=useState(false),[availableError,setAvailableError]=useState(''),[selectedAlias,setSelectedAlias]=useState(''),[primaryName,setPrimaryName]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[researching,setResearching]=useState(false),[researchRun,setResearchRun]=useState<ProducerResearchRun|null>(null),[researchCancelling,setResearchCancelling]=useState(false),[merging,setMerging]=useState(false),[unlinking,setUnlinking]=useState(''),[savingPrimary,setSavingPrimary]=useState(false),[collapsedGroups,setCollapsedGroups]=useState<Set<string>>(readCollapsedGroups),[storedAxis,setStoredAxis]=useState<RangeAxis|null>(readStoredAxis),[rangeFilter,setRangeFilter]=useState(''),[fixingKey,setFixingKey]=useState(''),[mergeTargetKey,setMergeTargetKey]=useState(''),[catalogBusy,setCatalogBusy]=useState(false),[deleting,setDeleting]=useState(false),[removingPhoto,setRemovingPhoto]=useState(false),[friendOperation,setFriendOperation]=useState(''),[nameSuggestions,setNameSuggestions]=useState<ProducerNameSuggestion[]>([]),[confirmingName,setConfirmingName]=useState('');
 const nav=useNavigate(),account=getAccount();
 const memberView=account?.role==='member';
 const technicalView=account?.role==='owner';
 const researchPoll=useRef<Poller|undefined>(undefined);
 function stopResearchTimers(){researchPoll.current?.stop();researchPoll.current=undefined}
 async function reload(){const detail=await getProducer(id);setProducer(detail);setPrimaryName(detail.canonicalName);setSelectedAlias('')}
 async function refreshAvailable(){const directory=await listProducers();setAvailable(producerLinkChoices(directory.items.filter(item=>!item.sharedOnly),id));setAvailableLoaded(true);setSelectedAlias('')}
 // The whole producer directory is a big read, and linking an alias is rare, so
 // it is fetched when someone asks to link rather than on every producer visit.
 async function loadAvailable(){
  if(availableLoading)return;
  setAvailableLoading(true);setAvailableError('');
  try{await refreshAvailable()}catch(e){setAvailableError((e as Error).message||'Could not load producer names')}finally{setAvailableLoading(false)}
 }
 function watchResearch(run:ProducerResearchRun){
  stopResearchTimers();setResearchRun(run);setResearching(run.status==='running');
  if(run.status!=='running')return;
  const poll=async()=>{
   const next=await getProducerResearchStatus(id,run.requestId).catch(()=>null);if(!next)return;setResearchRun(next);
   if(next.status==='running')return;
   stopResearchTimers();setResearching(false);
   if(next.status==='complete'){await reload().catch(()=>undefined);if(technicalView)setNotice(`Producer research completed${next.durationMs!=null?` in ${(next.durationMs/1000).toFixed(1)}s`:''}.`);else setNotice('');setError('')}
   else setError(technicalView?`${next.message||'Producer research failed.'} · Research request ${next.requestId}`:`Producer research failed · Support ID ${next.requestId}`);
  };
  researchPoll.current=startBackoffPoll(poll);void poll();
 }
 useEffect(()=>{
  let active=true;
  setLoading(true);setProducer(undefined);setAvailable([]);setAvailableLoaded(false);setAvailableError('');setError('');
  Promise.all([reload(),id.startsWith('shared::')?Promise.resolve(null):getProducerResearchStatus(id).catch(()=>null)]).then(([,run])=>{
   if(!active)return;if(run)watchResearch(run);
  }).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false;stopResearchTimers()};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[id]);
 const linkedByName=useMemo(()=>new Map((producer?.linkedProducers??[]).map(link=>[normalizeProducerAlias(link.name),link])),[producer]);
 // Every catalogue row, with all three axes resolved once. Regrouping is then a
 // pure rearrangement, so switching axis costs nothing and fetches nothing.
 const catalogRows=useMemo(()=>{
  if(!producer)return [];
  const producerNames=[producer.canonicalName,...producer.aliases];
  return producer.catalog.map((wine,index)=>{
   const category=catalogCategory(wine),identity=catalogCuveeFor(wine,producer);
   return {key:`${wine.name}-${index}`,displayName:displayCatalogName(wine.name,producer),identity,
    meta:catalogMeta(wine,category),note:catalogNote(wine.notes,wine.style),releaseCount:identity?.tastedReleases?.length??0,
    decisionKey:catalogDecisionKey(wine,producerNames),label:catalogDecisionLabel(wine,producerNames),
    category,hierarchy:catalogHierarchyLabel(wine),village:catalogVillageLabel(wine)};
  });
 },[producer]);

 /**
  * How many distinct answers an axis gives. An axis that puts every wine in one
  * group has told the reader nothing, which is what decides the opening view.
  */
 const axisSpread=useMemo(()=>({
  classification:new Set(catalogRows.map(row=>row.hierarchy)).size,
  village:new Set(catalogRows.map(row=>row.village)).size,
  style:new Set(catalogRows.map(row=>row.category)).size
 }),[catalogRows]);

 /**
  * Classification first where it separates anything, then village, then style.
  * A Burgundy domaine opens on its cru mix; a Napa producer, where every wine
  * is unclassified, opens on something that actually varies instead of on one
  * group called "Other". A choice the reader makes is remembered and wins.
  */
 const defaultAxis:RangeAxis=axisSpread.classification>1?'classification':axisSpread.village>1?'village':'style';
 const axis:RangeAxis=storedAxis??defaultAxis;

 const catalogGroups=useMemo(()=>{
  if(!catalogRows.length)return [];
  const groupOf=(row:typeof catalogRows[number])=>
   axis==='classification'?row.hierarchy:axis==='village'?row.village:row.category;
  const map=new Map<string,typeof catalogRows>();
  for(const row of catalogRows){const key=String(groupOf(row));const list=map.get(key)??[];list.push(row);map.set(key,list)}

  const built=[...map.entries()].map(([key,rows])=>({
   key,
   label:axis==='style'?categoryLabels[key as CatalogCategory]??key:key,
   rows,
   tasted:rows.filter(row=>Boolean(row.identity?.tastedCount)).length,
   tone:axis==='classification'?HIERARCHY_TONES[key as CatalogHierarchyLabel]??OTHER_TONE
    :axis==='style'?`style-${key}`
    :OTHER_TONE
  }));

  // Ranked axes keep their rank order; a nominal one is ordered by size, which
  // is also the order its colours are handed out in.
  if(axis==='classification')
   built.sort((a,b)=>CATALOG_HIERARCHY_LABELS.indexOf(a.key as CatalogHierarchyLabel)-CATALOG_HIERARCHY_LABELS.indexOf(b.key as CatalogHierarchyLabel));
  else if(axis==='style')
   built.sort((a,b)=>categoryOrder.indexOf(a.key as CatalogCategory)-categoryOrder.indexOf(b.key as CatalogCategory));
  else{
   built.sort((a,b)=>b.rows.length-a.rows.length||a.label.localeCompare(b.label));
   // Colour follows the entity: slots are assigned to villages by size once,
   // here, so filtering the list below cannot repaint the ones that remain.
   built.forEach((group,index)=>{group.tone=SERIES_TONES[index]??OTHER_TONE});
  }
  return built;
 },[catalogRows,axis]);
 /**
  * How big the estate is, before any of it is read. It counts appellations
  * rather than groups so the line means the same thing on every axis.
  */
 const rangeStats=useMemo(()=>{
  if(!catalogRows.length)return '';
  const appellations=new Set(catalogRows.map(row=>row.village).filter(name=>name&&name!=='Appellation not stated')).size;
  const tasted=catalogRows.filter(row=>Boolean(row.identity?.tastedCount)).length;
  return [
   `${catalogRows.length} wine${catalogRows.length===1?'':'s'}`,
   appellations?`${appellations} appellation${appellations===1?'':'s'}`:'',
   tasted?`${tasted} tasted`:''
  ].filter(Boolean).join(' · ');
 },[catalogRows]);
 const catalogTotals=useMemo(()=>catalogGroups.reduce((totals,group)=>({wines:totals.wines+group.rows.length,tasted:totals.tasted+group.tasted}),{wines:0,tasted:0}),[catalogGroups]);
 // Named by style rather than by the current grouping: which wine survives a
 // merge is a question about the wines, and the answer would otherwise be
 // worded differently depending on which pivot happened to be showing.
 const catalogRowIndex=useMemo(()=>catalogRows.map(row=>({decisionKey:row.decisionKey,label:row.label,groupLabel:categoryLabels[row.category]})).filter(row=>row.decisionKey),[catalogRows]);
 // The bar always shows the whole range. A chip narrows the list underneath it,
 // never the shape above it: the point of the bar is the proportions, and a
 // filtered bar would redraw them as 100% of whatever survived.
 const compositionEntries=useMemo(()=>{
  const entries=catalogGroups.map(group=>({key:group.key,label:group.label,count:group.rows.length,tone:group.tone}));
  // Past the documented slots a village joins Other rather than being handed a
  // repeated hue, which would say two villages were the same place.
  return axis==='village'?foldToOther(entries,SERIES_TONES.length,OTHER_TONE):entries;
 },[catalogGroups,axis]);
 const visibleGroups=useMemo(()=>rangeFilter?catalogGroups.filter(group=>group.key===rangeFilter):catalogGroups,[catalogGroups,rangeFilter]);
 const collapseKey=(groupKey:string)=>`${axis}:${groupKey}`;
 const allCategoriesCollapsed=visibleGroups.length>0&&visibleGroups.every(group=>collapsedGroups.has(collapseKey(group.key)));
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
 function toggleCategory(groupKey:string){
  const stored=collapseKey(groupKey);
  setCollapsedGroups(current=>{const next=new Set(current);if(next.has(stored))next.delete(stored);else next.add(stored);writeCollapsedGroups(next);return next});
 }
 function toggleAllCategories(){
  setCollapsedGroups(current=>{
   const next=new Set(current);
   for(const group of visibleGroups){if(allCategoriesCollapsed)next.delete(collapseKey(group.key));else next.add(collapseKey(group.key))}
   writeCollapsedGroups(next);return next;
  });
 }
 function chooseAxis(next:RangeAxis){
  // A filter names a group on the axis it was picked on, so it cannot survive a
  // switch: "Grand Cru" means nothing once the range is grouped by village.
  setStoredAxis(next);writeStoredAxis(next);setRangeFilter('');setFixingKey('');
 }
 const tastedGroups=useMemo<TastedCuveeGroup[]>(()=>{
  const map=new Map<string,ProducerDetail['tastedWines']>();
  for(const wine of producer?.tastedWines??[]){const style=cuveeStyleFamily(wine.wineStyle)||'unknown',key=wine.releaseParentCuveeId?`release:${wine.releaseParentCuveeId}::${style}`:`${wine.cuveeId??normalizeProducerAlias(wine.wineName)}::${style}`,list=map.get(key)??[];list.push(wine);map.set(key,list)}
  return [...map.values()].map(wines=>{
   const first=wines[0],releaseFamily=Boolean(first?.releaseParentCuveeId),grapes=[...new Set(wines.flatMap(wine=>wine.grapes??[]).map(grape=>grape.trim()).filter(Boolean))];
   const ordered=[...wines].sort((a,b)=>releaseFamily?(b.releaseSequence??-1)-(a.releaseSequence??-1):(b.vintage??-1)-(a.vintage??-1));
   return {cuveeId:first?.cuveeId??null,catalogCuveeId:first?.releaseParentCuveeId??first?.catalogCuveeId??null,name:releaseFamily?(first?.releaseParentName??first?.wineName??''):(first?.wineName??''),appellation:first?.appellation??null,wineStyle:first?.wineStyle??null,grapes,releaseFamily,wines:ordered};
  })
  // Alphabetical, because a cuvee is looked up by name here. The order fell out
  // of when each wine was last drunk, which is the Journal's question, not this
  // page's: on a producer you have tasted for years the same cuvee moves every
  // time you open another bottle. Base sensitivity so Ca di Pian and Campe sit
  // where an eye expects them rather than after every unaccented name.
   .sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:'base'})||(a.wineStyle??'').localeCompare(b.wineStyle??''));
 },[producer]);
 // The wine range is the expensive half of producer research, so members get the
 // profile, practices and contacts only. There is nothing to refresh range-only.
 const rangeAllowed=!memberView&&!producer?.sharedOnly;
 useEffect(()=>{
  if(!id||producer?.sharedOnly){setNameSuggestions([]);return}
  let active=true;
  // A suggestion is worth nothing if it costs the page: failures stay silent.
  // Defensive on the body as well as the request: this is an optional prompt and
  // must never be able to break the producer page.
  getProducerNameSuggestions(id).then(result=>{if(active)setNameSuggestions(Array.isArray(result?.items)?result.items:[])}).catch(()=>{if(active)setNameSuggestions([])});
  return()=>{active=false};
 },[id,producer?.canonicalName,producer?.sharedOnly]);

 async function confirmSuggestedName(name:string){
  setConfirmingName(name);setError('');setNotice('');
  try{await confirmProducerName(id,name);setNameSuggestions([]);setNotice(`Saved. Research filed under “${name}” is now available to you at no cost. Your producer and wines are unchanged.`)}
  catch(e){setError((e as Error).message)}
  finally{setConfirmingName('')}
 }

 async function runResearch(refreshProfile=false){
  if(producer?.sharedOnly)return;
  const rangeOnly=rangeAllowed&&Boolean(producer?.researchedAt)&&!refreshProfile;
  const scope=rangeAllowed?'current/recent wine range':'producer-wide winemaking practices';
  if(!confirm((rangeOnly?'Refresh this producer’s wine range only? AI usage may be incurred. The job continues in the background if you close WineLog.':(refreshProfile?'Refresh the saved profile even if it is still current? This uses an additional research request. ':'')+`Research this producer’s home location, public contacts and ${scope}? The job runs in the background and continues even if you close WineLog.`)))return;
  setError('');setNotice('');
  try{
   const accepted=await researchProducer(id,undefined,refreshProfile,rangeOnly);if(accepted.cached){window.location.reload();return}if(accepted.waitingForFriend){setFriendOperation(accepted.creditOperationId??'');return}const run=await getProducerResearchStatus(id,accepted.researchRequestId);
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
 /**
  * Removing a producer nothing points at any more.
  *
  * Reported as: correcting a bottle's producer leaves the one it used to be
  * behind, empty, with no way to remove it and a place in every producer list
  * from then on. Offered only when the record is empty - a producer with wines
  * is the identity those wines hang from, and merging is what moves them.
  */
 /**
  * Throwing away a photograph that says nothing about the producer.
  *
  * Reported as: research often comes back with a meaningless picture - a stock
  * close-up of grapes rather than the estate. No rule can judge "meaningful",
  * so the person looking at it decides, and the picture's own address is
  * remembered as refused: the next research run would otherwise fetch the same
  * one straight back.
  */
 async function removePhoto(){
  if(!producer||removingPhoto)return;
  if(!confirm('Remove this photo?\n\nIt will not come back on the next research run. If the site later publishes a different picture, that one can still arrive.'))return;
  setRemovingPhoto(true);setError('');setNotice('');
  try{await removeProducerHeroImage(id);await reload();setNotice('Photo removed. Research will not offer that picture again.')}
  catch(e){setError((e as Error).message)}finally{setRemovingPhoto(false)}
 }
 async function removeProducer(){
  if(!producer||deleting)return;
  const researchData=rangeAllowed?'profile, researched range, contacts and catalogue corrections':'profile and contacts';
  if(!confirm(`Delete “${producer.canonicalName}”?\n\nNothing is logged under this producer. Its ${researchData} go with it, along with the record of any producers merged into it. This cannot be undone.`))return;
  setDeleting(true);setError('');setNotice('');
  try{await deleteProducer(id);nav('/producers',{replace:true})}
  catch(e){setError((e as Error).message);setDeleting(false)}
 }
 async function savePrimaryName(){if(!producer||!primaryName||primaryName===producer.canonicalName)return;setSavingPrimary(true);setError('');setNotice('');try{const result=await setPrimaryProducerName(id,primaryName);await reload();setNotice(`${result.canonicalName} is now the primary producer name. Bottle-level recognised names and research remain attached to the same producer identity.`)}catch(e){setError((e as Error).message)}finally{setSavingPrimary(false)}}
 async function addAlias(){const source=available.find(x=>x.id===selectedAlias);if(!producer||!source)return;const ok=confirm(`Link “${source.canonicalName}” to “${producer.canonicalName}”?\n\n${producer.canonicalName} will remain the canonical producer. All wines and aliases from ${source.canonicalName} will be linked here. If both names already have research, WineLog will keep the newest complete result active, combine sources, and preserve the previous research in history.`);if(!ok)return;setMerging(true);setError('');setNotice('');try{const result=await mergeProducer(id,source.id);await reload();void refreshAvailable().catch(()=>undefined);setNotice(`${result.mergedName} is now linked as an alias of ${result.canonicalName}.`)}catch(e){setError((e as Error).message)}finally{setMerging(false)}}
 async function unlinkAlias(link:LinkedProducer){if(!producer)return;const ok=confirm(`Unlink “${link.name}” from “${producer.canonicalName}”?\n\nWineLog will recreate ${link.name} as a separate producer, move back the wines that belonged to it when it was linked, and restore its archived research. Research added to ${producer.canonicalName} after the link will stay with ${producer.canonicalName}.`);if(!ok)return;setUnlinking(link.mergeId);setError('');setNotice('');try{const result=await unlinkProducer(id,link.mergeId);await reload();void refreshAvailable().catch(()=>undefined);setNotice(`${result.unlinkedName} has been restored as a separate producer.`)}catch(e){setError((e as Error).message)}finally{setUnlinking('')}}
 // A producer is reached from the library or from a batch run, and the useful
 // way back is the one it was reached from. The stored copy carries it through
 // a reload, and the library is the fallback for a bookmarked producer.
 const back=useMemo(()=>{
  const handed=backTargetFromState(navState);
  if(handed){rememberBackTarget(id,handed,'producer');return handed}
  return readBackTarget(id,'producer')??PRODUCERS_BACK;
 },[navState,id]);
 if(loading)return <p>Loading producer…</p>;
 // A producer that could not be fetched is worth asking for again: without this
 // the message stayed until the app was restarted.
 if(!producer)return <div className="producer-load-error" role="alert"><p>{error||'Producer not found'}</p>
  <button type="button" onClick={()=>{setLoading(true);setError('');void reload().catch(e=>setError((e as Error).message)).finally(()=>setLoading(false))}}>Try again</button></div>;
 const location=[producer.homeLocality,producer.homeRegion,producer.homeCountry].filter(Boolean).join(','+' '),primaryKey=normalizeProducerAlias(producer.canonicalName);
 // Members have profile-only producer research. Do not leak owner-only range
 // concepts back through counts, stale warnings, correction tools or source copy.
 const visibleSources=rangeAllowed?producer.sources:producer.sources.filter(source=>!/\b(?:wine )?range\b|\bcatalog(?:ue)?\b/i.test(source.title));
 const sourceWebsiteCount=new Set(visibleSources.map(source=>sourceHost(source.url)).filter(Boolean)).size;
 const profileStale=isResearchStale(producer.profileResearchedAt),rangeStale=rangeAllowed&&isResearchStale(producer.researchedAt),staleLabel=profileStale&&rangeStale?'profile & range':profileStale?'profile':rangeStale?'range':'';
 const inheritedResearch=Boolean(producer.researchContributorId&&producer.researchContributorId!==account?.id),hasProducerResearch=Boolean(producer.profile||producer.researchedAt),hasOwnProducerResearch=Boolean(!inheritedResearch&&(producer.profileResearchedAt||producer.researchedAt));
 return <article className="producer-detail"><Link className="back-pill" to={back.to}>← {back.label}</Link>
  <header className={`producer-header${producer.heroImageAvailable?' has-hero':''}`}>
   {producer.heroImageAvailable&&<ProducerHeroImage producerId={producer.id} alt={`${producer.canonicalName} domaine`}/>}<div className="producer-header-shade"/>
   <div className="producer-header-content"><p className="eyebrow">PRODUCER</p><h1>{producer.canonicalName}</h1><p>{location||'Home location not researched yet'}</p>{rangeStats&&<p className="producer-header-stats">{rangeStats}</p>}{producer.aliases.length>1&&<small>Known aliases: {producer.aliases.join(' · ')}</small>}{producer.sharedOnly&&<small>Shown because a friend shared wine from this producer with you.</small>}{!producer.sharedOnly&&producer.heroImageAvailable&&<button type="button" className="producer-photo-remove" disabled={removingPhoto} onClick={()=>void removePhoto()}>{removingPhoto?'Removing…':'Remove this photo'}</button>}</div>
  </header>
  {!producer.sharedOnly&&nameSuggestions.length>0&&<section className="producer-name-suggestion" aria-labelledby="name-suggestion-title">
   <h2 id="name-suggestion-title">A friend may have researched this producer</h2>
   <p>Research is filed under the name each person writes. A friend has research under {nameSuggestions.length===1?'a name':'names'} close to yours. If it is the same producer, confirming lets you use their research at no cost. Nothing about your producer or your wines changes.</p>
   <ul>{nameSuggestions.map(item=><li key={item.name}>
    <strong>{item.name}</strong> <span className="suggestion-reason">({suggestionReason[item.reason]})</span>
    <button type="button" disabled={Boolean(confirmingName)} onClick={()=>void confirmSuggestedName(item.name)}>{confirmingName===item.name?'Saving…':'Same producer'}</button>
   </li>)}</ul>
  </section>}
  {error&&<p className="producer-error" role="alert">{error}</p>}{friendOperation&&<FriendResearchStatus operationId={friendOperation} onComplete={()=>window.location.reload()}/>}{notice&&<p className="producer-notice" role="status">{notice}</p>}
  <section className="detail-section"><div className="producer-section-title"><div><p className="section-label">Producer research</p><h2>{rangeAllowed?'Profile & range':'Producer profile'}</h2></div>{!producer.sharedOnly&&(memberView?<button type="button" className="primary" disabled={researching} onClick={()=>void runResearch(hasProducerResearch||inheritedResearch)}>{researching?'Research running…':hasOwnProducerResearch?'Refresh profile':'Research producer'}</button>:<><button type="button" className="primary" disabled={researching} onClick={()=>void runResearch()}>{researching?'Research running…':rangeAllowed&&producer.researchedAt?'Refresh wine range':'Research producer'}</button>{hasProducerResearch&&<button type="button" disabled={researching} onClick={()=>void runResearch(true)}>{rangeAllowed?'Refresh profile & range':'Refresh profile'}</button>}</>)}</div>
   {researchRun&&(!memberView||researchRun.status!=='complete')&&<div className={`producer-research-status ${researchRun.status}`} role="status" aria-live="polite"><div><strong>{stageLabel[researchRun.stage]}</strong>{technicalView&&<span>{researchRun.message}</span>}</div><div><strong>{researching?<ElapsedSeconds startedAt={researchRun.startedAt}/>:researchRun.durationMs!=null?`${(researchRun.durationMs/1000).toFixed(1)}s`:''}</strong><small>{technicalView?'Request':'Support ID'} {researchRun.requestId}</small></div>{researching&&<><p>This is a background job. You can leave this page or close WineLog; the saved result will appear automatically when you return.</p><button type="button" className="secondary-danger" disabled={researchCancelling} onClick={cancelResearch}>{researchCancelling?'Cancelling…':'Cancel Deep Search'}</button></>}</div>}
   {producer.profile?<p className="producer-profile">{producer.profile}</p>:<p>{producer.sharedOnly?'No shared producer profile is available yet.':rangeAllowed?'Research this producer to establish its physical base, broad region and commune, public contact details, official website, general producer-wide practices, header image and a sourced current/recent wine range.':'Research this producer to establish its physical base, broad region and commune, public contact details, official website, general producer-wide practices and header image.'}</p>}
   {producer.winemakingPractices&&<div className="producer-practices"><p className="section-label">General winemaking practices</p><p className="producer-profile">{producer.winemakingPractices}</p>{!memberView&&<small>Producer-wide context only. Exact cuvée/vintage techniques are researched separately on the wine page.</small>}</div>}
   <ProducerContacts producer={producer} onChanged={reload} readOnly={producer.sharedOnly}/>
   {rangeAllowed&&catalogGroups.length>0&&<div className="producer-range">
    <div className="producer-range-head">
     <div><SectionLabel>Wine range</SectionLabel><strong>{catalogTotals.wines} wine{catalogTotals.wines===1?'':'s'} · {catalogGroups.length} {axis==='style'?`style${catalogGroups.length===1?'':'s'}`:axis==='village'?`village${catalogGroups.length===1?'':'s'}`:`tier${catalogGroups.length===1?'':'s'}`}{catalogTotals.tasted?` · ${catalogTotals.tasted} tasted`:''}</strong></div>
     <button type="button" className="range-toggle-all" onClick={toggleAllCategories}>{allCategoriesCollapsed?'Expand all':'Collapse all'}</button>
    </div>
    {/* One set of wines, three questions. Whichever axis separates them opens
        first, and a choice made here is remembered. */}
    <div className="range-axis-tabs" role="group" aria-label="Group the range by">
     {RANGE_AXES.map(option=><button type="button" key={option} className={option===axis?'active':''} aria-pressed={option===axis} onClick={()=>chooseAxis(option)}>{RANGE_AXIS_LABELS[option]}</button>)}
    </div>
    <CompositionBar entries={compositionEntries} unit="wines" label={`Range by ${RANGE_AXIS_LABELS[axis].toLowerCase()}`}/>
    {/* Collapse hides what you have decided against; a chip narrows to the one
        thing you want. On a forty-wine domaine the chip is much the faster. */}
    {catalogGroups.length>1&&<div className="range-filters" role="group" aria-label="Show one group only">
     <button type="button" className={rangeFilter?'':'active'} aria-pressed={!rangeFilter} onClick={()=>setRangeFilter('')}>All <b>{catalogTotals.wines}</b></button>
     {catalogGroups.map(group=><button type="button" key={group.key} className={rangeFilter===group.key?'active':''} aria-pressed={rangeFilter===group.key} onClick={()=>setRangeFilter(current=>current===group.key?'':group.key)}>
      <span className="range-filter-dot" data-tone={group.tone} aria-hidden="true"/>{group.label} <b>{group.rows.length}</b>
     </button>)}
    </div>}
    {visibleGroups.map(group=>{
     const collapsed=collapsedGroups.has(collapseKey(group.key)),panelId=`producer-range-${slug(group.key)}`;
     return <section className={`producer-catalog-group${collapsed?' is-collapsed':''}`} key={group.key}>
      <h3><button type="button" className="catalog-group-toggle" aria-expanded={!collapsed} aria-controls={panelId} onClick={()=>toggleCategory(group.key)}>
       <span className="catalog-swatch" data-tone={group.tone} aria-hidden="true"/>
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
   {rangeAllowed&&<ProducerRangeMissing producerId={producer.id} onChanged={reload}/>} 
   {visibleSources.length>0&&<details className="producer-sources"><summary>{visibleSources.length} {rangeAllowed?'profile & range':'research'} reference{visibleSources.length===1?'':'s'}{sourceWebsiteCount?` · ${sourceWebsiteCount} website${sourceWebsiteCount===1?'':'s'}`:''}</summary>{visibleSources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title}</a>)}</details>}{producer.researchedAt&&<small>{technicalView?<>Latest producer research: {producer.researchModel} · </>:<>Research updated </>}{new Date(producer.researchedAt).toLocaleDateString()}{staleLabel&&<> · ⚠ {staleLabel} may be outdated</>}</small>}
  </section>
  <section className="detail-section"><p className="section-label">{producer.sharedOnly?'Shared wines':'Your tastings'}</p><h2>{tastedGroups.length} cuvée{tastedGroups.length===1?'':'s'} · {producer.tastedWines.length} tasting{producer.tastedWines.length===1?'':'s'}</h2>{tastedGroups.length?<div className="producer-tasted-groups">{tastedGroups.map(group=>{const releaseCount=group.releaseFamily?new Set(group.wines.map(w=>w.releaseDesignation).filter(Boolean)).size:0,identityMeta=[releaseCount?`${releaseCount} release${releaseCount===1?'':'s'}`:null,group.wineStyle,group.grapes.length?group.grapes.join(' / '):null].filter(Boolean).join(' · '),firstOwned=group.wines.findIndex(item=>!item.shared);return <div className="tasted-cuvee-group" key={`${group.catalogCuveeId??group.cuveeId??normalizeProducerAlias(group.name)}-${cuveeStyleFamily(group.wineStyle)||'unknown'}`}><div className="tasted-cuvee-title"><div><strong>{group.name}</strong>{identityMeta&&<small>{identityMeta}</small>}</div></div><div className="producer-tasted">{group.wines.map((w,index)=>{const release=String(w.releaseDesignation??'').trim(),subline=[release?(w.vintage??'NV'):null,w.appellation,w.region].filter(Boolean).join(' · '),href=w.shared?`/shared/wines/${w.id}`:`/wines/${w.id}`;return <div className="tasted-row tasted-vintage-row" key={w.id}><Link to={href} state={linkFrom({to:`/producers/${producer.id}`,label:producer.canonicalName})} className="tasted-row-link"><div className="tasted-thumb">{w.imageUrl?<img src={w.imageUrl} alt={`${w.wineName} ${w.vintage??'NV'} bottle`} className="tasted-thumb-image" loading="lazy" decoding="async"/>:w.imageId?<WineImage imageId={w.imageId} alt={`${w.wineName} ${w.vintage??'NV'} bottle`} className="tasted-thumb-image"/>:<span className="tasted-thumb-fallback">W</span>}</div><div className="tasted-copy"><strong>{release||w.vintage||'NV'}</strong><span>{subline}</span></div></Link><div className="tasted-meta">{w.rating!=null&&<strong>{w.rating}</strong>}{w.tastingDate&&<span>{w.tastingDate}</span>}{!w.shared&&index===firstOwned&&<CuveeCatalogLinks producer={producer} group={group} onChanged={reload}/>}</div></div>})}</div></div>})}</div>:<p>No tasting records linked to this producer yet.</p>}
  </section>
  {!producer.sharedOnly&&<section className="detail-section producer-identity"><p className="section-label">Identity & aliases</p><h2>Known producer names</h2>
   <div className="primary-name-control"><label>Primary display name<select value={primaryName} onChange={e=>setPrimaryName(e.target.value)}>{producer.aliases.map(alias=><option key={alias} value={alias}>{alias}</option>)}</select></label><button type="button" disabled={savingPrimary||!primaryName||primaryName===producer.canonicalName} onClick={savePrimaryName}>{savingPrimary?'Saving…':'Set primary'}</button></div>
   <p className="producer-help">The primary name is used in the Producers directory and profile heading. Changing it does not rewrite the producer name recorded on individual bottles, change the stable producer ID, or regenerate research.</p>
   <div className="alias-chips">{producer.aliases.map(alias=>{const normalized=normalizeProducerAlias(alias),link=linkedByName.get(normalized),isPrimary=normalized===primaryKey;return <span className="alias-chip" key={alias}>{alias}{isPrimary&&<em>Primary</em>}{link&&!isPrimary&&<button type="button" disabled={unlinking===link.mergeId} onClick={()=>unlinkAlias(link)}>{unlinking===link.mergeId?'Unlinking…':'Unlink'}</button>}{link&&isPrimary&&<small>Choose another primary before unlinking</small>}</span>})}</div><p className="producer-help">Add alias only links another producer name that already exists in your WineLog database. It does not accept free-text names or create a new identity. Linked producer identities can be unlinked again from here.</p>
   {!availableLoaded?<div className="alias-link-load"><button type="button" disabled={availableLoading} onClick={()=>{void loadAvailable()}}>{availableLoading?'Loading producer names…':'Choose a producer to link'}</button>{availableError&&<small role="alert">{availableError}</small>}</div>:available.length>0?<div className="alias-link-control"><select aria-label="Existing producer name to link" value={selectedAlias} onChange={e=>setSelectedAlias(e.target.value)}><option value="">Select an existing producer…</option>{available.map(item=><option key={item.id} value={item.id}>{item.canonicalName}</option>)}</select><button type="button" disabled={!selectedAlias||merging} onClick={addAlias}>{merging?'Linking…':'Add alias'}</button></div>:<small>No other producer names are available to link.</small>}
   {producer.researchHistoryCount>0&&<small>{producer.researchHistoryCount} prior research version{producer.researchHistoryCount===1?' is':'s are'} preserved in merge history.</small>}
   {producer.tastedWines.every(wine=>wine.shared)&&<div className="producer-remove">
    <button type="button" className="secondary-danger" disabled={deleting} onClick={()=>void removeProducer()}>{deleting?'Deleting…':'Delete this producer'}</button>
    <small>Nothing is logged under this producer. A producer with wines is merged into the right one instead, which moves the wines with it.</small>
   </div>}
  </section>}
 </article>
}
