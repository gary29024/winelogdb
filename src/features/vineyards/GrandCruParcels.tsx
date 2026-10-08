import {useCallback,useEffect,useId,useMemo,useRef,useState} from 'react';
import type {Map as MapLibreMap,GeoJSONSource} from 'maplibre-gl';
import type {Feature,FeatureCollection,Polygon,MultiPolygon} from 'geojson';
import {placeKey} from '../../lib/places/resolve';
import {ownerName} from '../../lib/places/parcelOwners';
import {grandCruFor,parcelBundles,type GrandCru} from '../../lib/places/grandCruParcels/registry';
import {climatParents,loadClimatParcels,type ClimatParcelFile} from '../../lib/places/grandCruParcels/climats';
import {hasParcelEvidence,loadParcelEvidence,type ParcelEvidenceData} from '../../lib/places/grandCruParcels/evidence';
import {ProducerLinkCard} from './ParcelProducerLinker';
import {useParcelProducerLinks} from './useParcelProducerLinks';
import type {ParcelProducerLink} from '../../lib/places/parcelProducerLinks';
import {ParcelEvidence} from './ParcelEvidence';
import {confidenceLabels,confidenceOrder,groupParcelRightHolders,matchesLinkedProducer,type HolderConfidence,type HolderGroup} from '../../lib/places/parcelPresentation';

type Right={holderId:string;siren:string|null;name:string;rightCode:string;rightLabel:string;legalForm:string;legalFormLabel:string};
// producerNames are reviewed spellings of the producer field, as in
// burgundyProducerLocations: producer records are per-user, so no static ID can join them.
type DomaineLink={status:'verified'|'proposed';name:string;producerId:string;producerNames:string[];role:'operator';effectiveDate:string;evidence:{url:string;note:string}[]};
type Parcel={id:string;reference:string;commune:string;cadastreAreaM2:number;geometryAreaM2:number;bounds:number[];labelPoint:number[];
 overlaps:{parentFeatureId:string;name:string;areaM2:number;parcelPercent:number}[];recordedRights:Right[];
 recordMatch:'unknown'|'reference-and-area'|'area-mismatch';recordAreasM2:number[];domaineLinks:DomaineLink[]};
type Parcels=FeatureCollection<Polygon|MultiPolygon,Parcel>;
type ParcelFeature=Feature<Polygon|MultiPolygon,Parcel>;
type Match=''|'owner'|'verified';
export type ParcelLegendKey='recorded'|'unrecorded'|'owner'|'verified'|'selected';

const sourceId='cadastral-parcels',hatchId='cadastral-parcel-hatch';
const layers=['cadastral-parcel-hatch','cadastral-parcel-owner','cadastral-parcel-producer','cadastral-parcel-outline',
 'cadastral-parcel-selected-casing','cadastral-parcel-selected','cadastral-parcel-hit'];
// Ink for the parcel grid, gold edged in dark brown for a chosen holder (the Grand Cru browns
// swallowed the old ochre) and crimson for the wine's verified producer.
const ink='#26324a',gold='#f5b800',goldEdge='#3d2800',crimson='#c51f45';
const ha=(m2:number)=>`${(m2/10000).toFixed(2)} ha`;
const plural=(n:number,one:string,many=`${one}s`)=>`${n} ${n===1?one:many}`;
// Snapshot dates come from the cru's bundle manifest, e.g. "1 January 2025" and "June 2026".
const utc=(iso:string)=>new Date(`${iso}T00:00:00Z`);
const longDate=(iso:string)=>utc(iso).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
const monthYear=(iso:string)=>utc(iso).toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});

const overlapIn=(f:ParcelFeature,parentId:string)=>f.properties.overlaps.find(o=>o.parentFeatureId===parentId);
const producerIs=(link:DomaineLink,producer:string)=>link.status==='verified'&&Boolean(placeKey(producer))&&link.producerNames.some(name=>placeKey(name)===placeKey(producer));
function rightHolders(parcels:ParcelFeature[],parentId:string){
 const byHolder=new Map<string,{id:string;name:string;areaM2:number;count:number}>();
 for(const f of parcels){
  const seen=new Set<string>();
  for(const r of f.properties.recordedRights){
   if(seen.has(r.holderId))continue;
   seen.add(r.holderId);
   const entry=byHolder.get(r.holderId)??{id:r.holderId,name:r.name,areaM2:0,count:0};
   entry.areaM2+=overlapIn(f,parentId)?.areaM2??0;entry.count++;byHolder.set(r.holderId,entry);
  }
 }
 return [...byHolder.values()].sort((a,b)=>b.areaM2-a.areaM2||a.name.localeCompare(b.name));
}

function hatch(){
 const size=8,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)if((x+y)%size<2)data.set([89,105,131,110],(y*size+x)*4);
 return {width:size,height:size,data};
}
const reducedMotion=()=>typeof window!=='undefined'&&Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
function union(features:ParcelFeature[]):[[number,number],[number,number]]|null{
 if(!features.length)return null;
 const b=features.map(f=>f.properties.bounds);
 return [[Math.min(...b.map(x=>x[0])),Math.min(...b.map(x=>x[1]))],[Math.max(...b.map(x=>x[2])),Math.max(...b.map(x=>x[3]))]];
}

const swatches:Record<ParcelLegendKey,[string,string]>={
 recorded:['map-swatch-parcel','Recorded rights'],unrecorded:['map-swatch-parcel-unrecorded','No matched rights'],
 owner:['map-swatch-parcel-owner','Chosen right holder'],verified:['map-swatch-parcel-producer','Producer · verified'],
 selected:['map-swatch-parcel-selected','Selected parcel'],
};
/** Parcel keys join the map's single legend while the layer is on. */
export function ParcelLegend({keys}:{keys:ParcelLegendKey[]}){
 if(!keys.length)return null;
 return <><span className="village-map-legend-divider" aria-hidden="true"/>{keys.map(key=><span key={key}><i className={swatches[key][0]}/>{swatches[key][1]}</span>)}</>;
}

// A rosette seal per link strength, after the name like a profile check. Only a domaine's own
// confirmation is solid; a weak lead carries "?" instead of a check. None of them verifies farming.
const sealPath=(()=>{
 const points=Array.from({length:24},(_,i)=>{const r=i%2?9.3:11,a=Math.PI*i/12-Math.PI/2;return `${(12+r*Math.cos(a)).toFixed(2)} ${(12+r*Math.sin(a)).toFixed(2)}`});
 return `M${points.join('L')}Z`;
})();
function StrengthSeal({level}:{level:HolderConfidence}){
 return <svg className={`village-map-seal is-${level}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <path className="village-map-seal-shape" d={sealPath}/>
  {level==='weak'?<><path className="village-map-seal-mark" d="M9.6 9.7a2.4 2.4 0 1 1 3.3 2.2c-.6.3-.9.8-.9 1.4v.5"/><circle className="village-map-seal-dot" cx="12" cy="16.6" r="1.05"/></>
   :<path className="village-map-seal-mark" d="M8.1 12.3l2.7 2.7 5.1-5.5"/>}
 </svg>;
}
// The specific reason stays in the tooltip and accessible name, prefixed by its strength when it does not name it.
const sealLabel=(group:HolderGroup)=>{
 const level=confidenceLabels[group.confidence!],reason=group.lead?`Weak lead · ${group.lead.label}`:group.basisLabel;
 return reason.startsWith(level)?reason:`${level}: ${reason}`;
};

type Climat={id:string;name:string};
type Props={map:MapLibreMap|null;parentId:string;climat?:Climat|null;producer?:string|null;producerId?:string|null;onLegend?:(keys:ParcelLegendKey[])=>void};
const climatsOf=(parentId:string)=>Object.keys(climatParents).filter(id=>climatParents[id]===parentId);
/** Parcel rights for any cru in the registry; renders nothing for a feature without parcel data.
 * With a climat (Corton Les Bressandes), it starts on that climat's parcels; rights and links stay the cru's. */
export function GrandCruParcels(props:Props){
 const cru=grandCruFor(props.parentId);
 if(!cru)return null;
 // A wine/producer or cru change must not inherit another view's links or selection.
 return <GrandCruParcelsView key={`${props.parentId}:${props.producerId??''}:${props.producer??''}`} {...props} cru={cru}/>;
}
function GrandCruParcelsView({map,parentId,climat,producer,producerId,onLegend,cru}:Props&{cru:GrandCru}){
 // The holder list needs research only for domaine headings; the evidence panel loads its own copy when a parcel opens.
 const manifest=parcelBundles[cru.bundle],withResearch=cru.domaineGrouping&&hasParcelEvidence(parentId);
 const [show,setShow]=useState(false),[data,setData]=useState<Parcels|null>(null),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
 const [owner,setOwner]=useState(''),[selectedId,setSelectedId]=useState(''),[allOwners,setAllOwners]=useState(false),[ownersOpen,setOwnersOpen]=useState(true),[query,setQuery]=useState('');
 // Tapping another climat on the map keeps the layer on, but starts again on that climat's parcels.
 const climatId=climat?.id??'',[wide,setWide]=useState(false),[shownClimat,setShownClimat]=useState(climatId);
 if(climatId!==shownClimat){setShownClimat(climatId);setWide(false);setOwner('');setSelectedId('')}
 const inClimat=Boolean(climat)&&!wide,scopeId=inClimat?climatId:parentId;
 const [climatData,setClimatData]=useState<ClimatParcelFile|null>(null);
 const [research,setResearch]=useState<ParcelEvidenceData|null>(null),[researchFailed,setResearchFailed]=useState(false);
 useEffect(()=>{
  if(!show||research||!withResearch)return;
  let active=true;
  void loadParcelEvidence(parentId).then(value=>{if(active){setResearch(value);setResearchFailed(false)}}).catch(()=>{if(active)setResearchFailed(true)});
  return()=>{active=false};
 },[show,parentId,withResearch,research,attempt]);
 const autoFocused=useRef(false);
 const switchId=useId(),parcelId=useId(),searchId=useId(),ownersId=useId();
 useEffect(()=>{
  if(!show||data)return;
  const controller=new AbortController();let disposed=false;
  const timeout=setTimeout(()=>controller.abort(),20000);
  void fetch(manifest.dataUrl,{signal:controller.signal}).then(async response=>{
   if(!response.ok)throw new Error('Parcel download failed');
   const value=await response.json() as Parcels;
   if(value.type!=='FeatureCollection'||!Array.isArray(value.features)||value.features.length!==manifest.counts.parcels||
    value.features.some(f=>!f.properties?.id||!['Polygon','MultiPolygon'].includes(f.geometry?.type)||!Array.isArray(f.properties.overlaps)||!Array.isArray(f.properties.recordedRights)||!Array.isArray(f.properties.domaineLinks)))throw new Error('Invalid parcel data');
   if(!disposed)setData(value);
  }).catch(()=>{if(!disposed)setError(true)}).finally(()=>clearTimeout(timeout));
  return()=>{disposed=true;controller.abort();clearTimeout(timeout)};
 },[show,data,attempt,manifest]);
 // The climat file is checked against this parcel snapshot, so stale areas never reach the list.
 useEffect(()=>{
  if(!show||!climatId||climatData)return;
  let active=true;
  void loadClimatParcels(parentId).then(value=>{
   if(!value||value.inputs.parcelSnapshotSha256!==manifest.sha256||!value.climats[climatId])throw new Error('Invalid climat parcels');
   if(active)setClimatData(value);
  }).catch(()=>{if(active)setError(true)});
  return()=>{active=false};
 },[show,climatId,climatData,parentId,manifest,attempt]);
 const name=inClimat?climat!.name:cru.name;
 // Each parcel's climat areas join its overlaps, so every total below follows the scope.
 const features=useMemo(()=>{
  if(!data||!climatData)return data?.features??[];
  const extra=new Map<string,Parcel['overlaps']>();
  for(const [id,entry] of Object.entries(climatData.climats))for(const [parcelId,[areaM2,parcelPercent]] of Object.entries(entry.parcels)){
   extra.set(parcelId,[...extra.get(parcelId)??[],{parentFeatureId:id,name:entry.name,areaM2,parcelPercent}]);
  }
  return data.features.map(f=>{const more=extra.get(f.properties.id);return more?{...f,properties:{...f.properties,overlaps:[...f.properties.overlaps,...more]}}:f});
 },[data,climatData]);
 const ready=Boolean(data)&&(!inClimat||Boolean(climatData));
 const overlapOf=(f:ParcelFeature)=>overlapIn(f,scopeId);
 const parcels=useMemo(()=>ready?features.filter(f=>f.properties.overlaps.some(o=>o.parentFeatureId===scopeId)):[],[ready,features,scopeId]);
 const owners=useMemo(()=>rightHolders(parcels,scopeId),[parcels,scopeId]);
 // Rows are always grouped by researched domaine where a cru has research; recorded company names stay
 // searchable and appear in each parcel's details. Without research every row is a legal holder.
 const domaineOwners=useMemo(()=>groupParcelRightHolders(parcels,scopeId,research?.holderDomains),[parcels,scopeId,research]);
 const chosenHolders=useMemo(()=>new Set(domaineOwners.find(g=>g.id===owner)?.holderIds??(owners.some(h=>h.id===owner)?[owner]:[])),[domaineOwners,owners,owner]);
 const isChosen=(group:HolderGroup)=>group.holderIds.length===chosenHolders.size&&group.holderIds.every(id=>chosenHolders.has(id));
 const wineProducer=producer?.trim()??'';
 const verified=useMemo(()=>parcels.filter(f=>f.properties.domaineLinks.some(l=>producerIs(l,wineProducer))),[parcels,wineProducer]);
 const links=useParcelProducerLinks(parentId,wineProducer,producerId);
 const matches=useMemo(()=>new Map<string,Match>(parcels.map(f=>[f.properties.id,
  chosenHolders.size>0&&f.properties.recordedRights.some(r=>chosenHolders.has(r.holderId))?'owner':verified.includes(f)?'verified':''])),[parcels,chosenHolders,verified]);
 const styled=useMemo<FeatureCollection>(()=>({type:'FeatureCollection',features:parcels.map(f=>{
  const match=matches.get(f.properties.id)??'';
  return {...f,properties:{id:f.properties.id,recorded:f.properties.recordedRights.length>0,match,dim:Boolean(owner)&&match===''}};
 })}),[parcels,matches,owner]);
 const selected=parcels.find(f=>f.properties.id===selectedId);
 const legend=useMemo<ParcelLegendKey[]>(()=>!show||!ready?[]:[
  'recorded','unrecorded',...(owner?['owner' as const]:[]),...(verified.length?['verified' as const]:[]),...(selected?['selected' as const]:[])],[show,ready,owner,verified,selected]);
 useEffect(()=>{onLegend?.(legend)},[legend,onLegend]);
 // A parcel picked from the finder at the foot of the panel, or tapped on the map, shows its details
 // above the owner list. Bring them into view below the pinned map (or beside it on a wide screen).
 // scrollIntoView cannot be used: it counts details hidden behind the pinned map as visible.
 const detailsRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const details=detailsRef.current,dialog=details?.closest<HTMLElement>('.village-map-dialog');
  if(!selectedId||!details||!dialog?.scrollBy)return;
  const pinned=dialog.querySelector<HTMLElement>('.village-map-main'),header=dialog.querySelector<HTMLElement>('.village-map-header');
  const rect=details.getBoundingClientRect(),view=dialog.getBoundingClientRect();
  const stacked=Boolean(pinned)&&getComputedStyle(pinned!).position==='sticky'&&pinned!.getBoundingClientRect().right>rect.left+1;
  const clear=(stacked?pinned!.getBoundingClientRect().bottom:header?.getBoundingClientRect().bottom??view.top)+8;
  const delta=rect.top<clear?rect.top-clear:rect.bottom>view.bottom?Math.min(rect.bottom-view.bottom,rect.top-clear):0;
  if(delta)dialog.scrollBy({top:delta,behavior:reducedMotion()?'instant':'smooth'});
 },[selectedId]);
 useEffect(()=>()=>onLegend?.([]),[onLegend]);
 // The cru's tier fill fades by id, with its climats. Maps whose Grand Crus overlap (Corton's and
 // Chablis's hills, Montrachet's) paint them as one merged fill (build_burgundy_village_map.py),
 // which no cru id reaches, so that fill fades as a whole.
 const fadeKey=[parentId,...climatsOf(parentId),'overview-grand_cru'].join(',');
 useEffect(()=>{
  if(!map||!show||!ready)return;
  const faded=new Map<string,unknown>();
  const attach=()=>{
   if(!map.getStyle())return;
   if(!map.getSource(sourceId))map.addSource(sourceId,{type:'geojson',data:styled});
   else (map.getSource(sourceId) as GeoJSONSource).setData?.(styled);
   if(map.hasImage&&!map.hasImage(hatchId))map.addImage(hatchId,hatch());
   if(!map.getLayer(layers[0])){
    const dim=(on:number,off:number)=>['case',['get','dim'],off,on];
    map.addLayer({id:layers[0],type:'fill',source:sourceId,filter:['!',['get','recorded']],paint:{'fill-pattern':hatchId,'fill-opacity':dim(1,0.35) as never}});
    map.addLayer({id:layers[1],type:'fill',source:sourceId,filter:['==',['get','match'],'owner'],paint:{'fill-color':gold,'fill-opacity':0.85}});
    map.addLayer({id:layers[2],type:'fill',source:sourceId,filter:['==',['get','match'],'verified'],paint:{'fill-color':crimson,'fill-opacity':0.72}});
    map.addLayer({id:layers[3],type:'line',source:sourceId,paint:{
     'line-color':['match',['get','match'],'owner',goldEdge,'verified',crimson,ink],
     'line-width':['match',['get','match'],'',0.6,'owner',1.8,1.1],
     'line-opacity':['case',['get','dim'],0.25,['==',['get','match'],''],0.55,1]}});
    map.addLayer({id:layers[4],type:'line',source:sourceId,filter:['==',['get','id'],''],paint:{'line-color':'#ffffff','line-width':5}});
    map.addLayer({id:layers[5],type:'line',source:sourceId,filter:['==',['get','id'],''],paint:{'line-color':'#10182d','line-width':2.4}});
    map.addLayer({id:layers[6],type:'fill',source:sourceId,paint:{'fill-opacity':0}});
   }
   for(const id of [layers[4],layers[5]])map.setFilter(id,['==',['get','id'],selected?.properties.id??'']);
   // The wine's crimson and the drawn area's tier fill fade while parcels are on,
   // so the parcel grid, hatching and gold stay legible. Other crus keep theirs.
   for(const [id,value] of fades)if(map.getLayer(id)&&map.getPaintProperty){
    if(!faded.has(id))faded.set(id,map.getPaintProperty(id,'fill-opacity'));
    map.setPaintProperty(id,'fill-opacity',value(faded.get(id)) as number);
   }
  };
  const fades:[string,(original:unknown)=>unknown][]=[['selected-fill',()=>0.08],['vineyard-fill',original=>['case',['in',['get','id'],['literal',fadeKey.split(',')]],0.12,original]]];
  const click=(event:{point:{x:number;y:number}})=>{
   if(!map.getLayer(layers[6]))return;
   const hits=map.queryRenderedFeatures([event.point.x,event.point.y],{layers:[layers[6]]});
   if(hits[0]?.properties.id)setSelectedId(hits[0].properties.id as string);
  };
  attach();map.on('style.load',attach);map.on('click',click);
  return()=>{
   map.off('style.load',attach);map.off('click',click);
   // The parent may already have disposed the MapLibre instance.
   if(map.getStyle()){
    for(const id of [...layers].reverse())if(map.getLayer(id))map.removeLayer(id);
    if(map.getSource(sourceId))map.removeSource(sourceId);
    for(const [id,value] of faded)if(map.getLayer(id))map.setPaintProperty(id,'fill-opacity',value as number);
   }
  };
 },[map,show,ready,styled,selected,fadeKey]);
 const fit=(bounds:[[number,number],[number,number]]|null)=>{
  if(bounds&&map)map.fitBounds(bounds,{padding:70,maxZoom:17,duration:reducedMotion()?0:400});
 };
 // The map sticks under the header, so it is normally already in view; only scroll when it is not.
 const ensureMapVisible=()=>{
  const canvas=map?.getContainer?.();
  if(!canvas?.getBoundingClientRect)return;
  const dialog=canvas.closest<HTMLElement>('.village-map-dialog'),bounds=dialog?.getBoundingClientRect();
  const top=(bounds?.top??0)+(dialog?.querySelector<HTMLElement>('.village-map-header')?.offsetHeight??0),rect=canvas.getBoundingClientRect();
  if(rect.top>=top-1&&rect.bottom<=(bounds?.bottom??window.innerHeight)+1)return;
  canvas.scrollIntoView?.({block:'start',behavior:reducedMotion()?'instant':'smooth'});
 };
 const showOnMap=(features:ParcelFeature[])=>{
  fit(union(features));
  ensureMapVisible();
 };
 const selectParcel=(id:string)=>{
  autoFocused.current=true;setSelectedId(id);const f=parcels.find(f=>f.properties.id===id);
  if(f)fit(union([f]));
 };
 const chooseOwner=(id:string)=>{
  const group=domaineOwners.find(g=>g.id===id);
  if(!group)return;
  autoFocused.current=true;
  const next=isChosen(group)?'':id;setOwner(next);setSelectedId('');
  if(next)fit(union(parcels.filter(f=>f.properties.recordedRights.some(r=>group.holderIds.includes(r.holderId)))));
 };
 // A right holder linked to this wine's producer is the likeliest place for the wine, so the map
 // opens on that holder's parcels instead of the whole cru, once each time the layer is turned on.
 const focusLinked=useCallback((saved:ParcelProducerLink[])=>{
  if(autoFocused.current||(!wineProducer&&!producerId))return;
  const link=saved.find(l=>matchesLinkedProducer(l,wineProducer,producerId));
  const holderParcels=link?parcels.filter(f=>f.properties.recordedRights.some(r=>r.holderId===link.holderId)):[];
  if(!link||!holderParcels.length)return;
  const bounds=union(holderParcels);
  autoFocused.current=true;setOwner(link.holderId);
  if(bounds&&map)map.fitBounds(bounds,{padding:70,maxZoom:17,duration:0});
 },[parcels,wineProducer,producerId,map]);
 useEffect(()=>{if(links.loaded)focusLinked(links.mine)},[links.loaded,links.mine,focusLinked]);
 const chooseScope=(next:boolean)=>{
  if(next===wide)return;
  setWide(next);setOwner('');setSelectedId('');
  const id=next?parentId:climatId;
  showOnMap(features.filter(f=>f.properties.overlaps.some(o=>o.parentFeatureId===id)));
 };
 const showRow=(row:HolderGroup)=>{
  autoFocused.current=true;setOwner(row.id);setSelectedId('');
  showOnMap(parcels.filter(f=>f.properties.recordedRights.some(r=>row.holderIds.includes(r.holderId))));
 };
 const recorded=parcels.filter(f=>f.properties.recordedRights.length);
 const areaOf=(list:ParcelFeature[])=>list.reduce((sum,f)=>sum+(overlapOf(f)?.areaM2??0),0);
 // cru.domaineGrouping comes from the registry, so research notes and the key appear only for crus with domaine research.
 const listed=domaineOwners;
 const needle=placeKey(query);
 const shown=allOwners?listed.filter(o=>!needle||placeKey([o.name,...o.legalNames,o.lead?.name??''].join(' ')).includes(needle)):listed.slice(0,6);
 const largest=listed[0]?.areaM2||1;
 // The key names only the link strengths this list uses, strongest first.
 const strengths=cru.domaineGrouping?confidenceOrder.filter(level=>listed.some(o=>o.confidence===level)):[];
 const rights=selected?.properties.recordedRights??[];
 const overlap=selected&&overlapOf(selected);
 return <section className="village-map-parcels" aria-label="Parcel rights">
  <label className="village-map-parcel-toggle" htmlFor={switchId}>
   <span>Parcel rights<small> · {name}</small></span>
   <input id={switchId} type="checkbox" role="switch" checked={show} disabled={!map} onChange={event=>{setShow(event.target.checked);setError(false);setOwner('');setSelectedId('');autoFocused.current=false}}/>
  </label>
  <p className="village-map-note">Legal-entity rights recorded on {longDate(manifest.rightsAsOf)}. Shows who holds recorded rights, not who farms the vines.</p>
  {show&&<>
   {climat&&<>
    <div className="village-map-scope" role="group" aria-label="Parcels shown">
     <button type="button" aria-pressed={!wide} onClick={()=>chooseScope(false)}>{climat.name}</button>
     <button type="button" aria-pressed={wide} onClick={()=>chooseScope(true)}>All of {cru.name}</button>
    </div>
    {inClimat&&<p className="village-map-note">Parcels inside the INAO boundary of {climat.name}; areas count only the part inside it. Rights and your producer links are shared across {cru.name}.</p>}
   </>}
   {!ready&&!error&&<p className="village-map-note" role="status">Loading cadastral parcels…</p>}
   {error&&<div className="village-map-parcel-error" role="alert"><p>Parcel data could not load. The cru map remains available.</p><button type="button" onClick={()=>{setError(false);setAttempt(a=>a+1)}}>Retry parcels</button></div>}
   {ready&&<>
    {verified.length>0&&<div className="village-map-producer">
     <p className="village-map-eyebrow is-wine">THIS WINE’S PRODUCER</p>
     <strong>{wineProducer}</strong>
     <span className="village-map-producer-meta">{plural(verified.length,'parcel')} · {ha(areaOf(verified))} in {name}</span>
     <span className="village-map-badge is-verified">Verified parcel links</span>
     <span className="village-map-note">Select a parcel for its farming evidence and effective date.</span>
     <button type="button" className="village-map-link-button" onClick={()=>{setOwner('');setSelectedId('');showOnMap(verified)}}>Show on map</button>
    </div>}
    {!verified.length&&wineProducer&&<ProducerLinkCard producer={wineProducer} rows={domaineOwners} links={links} onShow={showRow}/>}
    <p className="village-map-parcel-share"><strong>{parcels.length}</strong> parcels in {name} · {recorded.length} with recorded rights</p>
    {selected&&<div className="village-map-parcel-details" aria-live="polite" ref={detailsRef}>
     <div className="village-map-parcel-head"><h4>Parcel {selected.properties.reference}</h4><button type="button" className="village-map-link-button" onClick={()=>setSelectedId('')}>Clear</button></div>
     <dl>
      <dt>Recorded rights</dt><dd>{rights.length?rights.map(r=><div key={`${r.holderId}:${r.rightCode}`}>{ownerName(r.name)} · {r.rightLabel}</div>):'No matched rights record'}</dd>
      <dt>Area</dt><dd>{ha(selected.properties.cadastreAreaM2)}{overlap&&overlap.parcelPercent<99?` · ${Math.round(overlap.parcelPercent)}% inside ${name}`:''}</dd>
     </dl>
     <ParcelEvidence parcelId={selected.properties.id} parentId={parentId}/>
     {selected.properties.domaineLinks.map((link,index)=><div key={`${link.producerId}:${index}`} className="village-map-note">
      <strong>{link.name}</strong> · {link.status==='verified'?'Verified operator':'Proposed operator (unverified)'} · effective {link.effectiveDate}
      <div>{link.evidence.map((e,i)=><span key={`${e.url}:${i}`}>{i>0&&' · '}<a href={e.url} target="_blank" rel="noopener noreferrer">{e.note}</a></span>)}</div>
     </div>)}
     {selected.properties.recordMatch==='area-mismatch'&&<p className="village-map-overlap">The parcel reference matches, but its recorded area differs between snapshots. These historical rights must not be treated as a verified current holding.</p>}
     {rights.length?<details><summary>Record details</summary>
      <ul>{rights.map(r=><li key={`${r.holderId}:${r.rightCode}`}>{r.name} · {r.rightCode} — {r.rightLabel} · {r.legalFormLabel}<br/>{r.siren?`SIREN ${r.siren}`:`DGFiP identifier ${r.holderId} (not a SIREN)`}</li>)}</ul>
      <p>Cadastral reference {selected.properties.id}. Rights recorded as of {longDate(manifest.rightsAsOf)}. Recorded parcel area {selected.properties.cadastreAreaM2.toLocaleString('en')} m²; {name} overlap {Math.round(overlap?.areaM2??0).toLocaleString('en')} m² ({overlap?.parcelPercent.toFixed(1)}% of its mapped geometry).</p>
     </details>:<p className="village-map-note">No matching published legal-entity record was found. Coverage exclusions and parcel changes can leave gaps; this doesn’t mean the parcel has no owner.</p>}
    </div>}
    <div>
     <details className="village-map-owner-section" open={ownersOpen}><summary onClick={event=>{event.preventDefault();setOwnersOpen(!ownersOpen)}}><span className="village-map-parcel-label" id={ownersId}>Recorded right holders by mapped area</span><span className="village-map-count">{listed.length}</span></summary>
     <p className="village-map-note">Areas show parcel coverage, not ownership shares.</p>
     {strengths.length>0&&<p className="village-map-seal-key"><span>Link strength</span>{strengths.map(level=><span key={level} className="village-map-seal-key-item"><StrengthSeal level={level}/>{confidenceLabels[level]}</span>)}</p>}
     {cru.domaineGrouping&&!research&&!researchFailed&&<p className="village-map-note" role="status">Loading domaine research…</p>}
     {cru.domaineGrouping&&researchFailed&&<div role="alert"><p>Domaine research could not load. Showing recorded company names instead.</p><button type="button" className="village-map-link-button" onClick={()=>{setResearchFailed(false);setAttempt(n=>n+1)}}>Retry domaine research</button></div>}
     {allOwners&&<><label className="visually-hidden" htmlFor={searchId}>Search right holders</label><input id={searchId} type="search" placeholder="Search right holders" value={query} onChange={event=>setQuery(event.target.value)}/></>}
     <ul className="village-map-owners" aria-labelledby={ownersId}>{shown.map(o=><li key={o.id}><button type="button" aria-pressed={isChosen(o)} onClick={()=>chooseOwner(o.id)}>
      <span className="village-map-owner-name">{o.name}{o.confidence&&<>{'\u00a0'}<span role="img" className="village-map-seal-label" aria-label={sealLabel(o)} title={sealLabel(o)}><StrengthSeal level={o.confidence}/></span></>}</span><span className="village-map-owner-qty">{ha(o.areaM2)} · {o.count}</span><span className="village-map-owner-bar" aria-hidden="true"><b style={{width:`${o.areaM2/largest*100}%`}}/></span>
     </button>
      {isChosen(o)&&links.canLink&&<div className="village-map-row-link">{o.holderIds.every(id=>links.linked.has(id))
       ?<><span>Linked to {wineProducer}</span><button type="button" className="village-map-link-button" disabled={Boolean(links.busy)} onClick={()=>void links.unlink(o)}>{links.busy===o.id?'Unlinking…':'Unlink'}</button></>
       :<button type="button" className="village-map-link-button" disabled={Boolean(links.busy)} onClick={()=>void links.link(o)}>{links.busy===o.id?'Linking…':`Link to ${wineProducer}`}</button>}</div>}
     </li>)}</ul>
     <div className="village-map-link-actions">
      {listed.length>6&&<button type="button" className="village-map-link-button" onClick={()=>{setAllOwners(!allOwners);setQuery('')}}>{allOwners?'Show fewer':`Show all ${listed.length} ${cru.domaineGrouping?'entries':'right holders'}`}</button>}
     </div>
     </details>
    </div>
    <details className="village-map-parcel-finder"><summary>Find a parcel by cadastral reference</summary>
     <label htmlFor={parcelId}>Cadastral parcel</label>
     <select id={parcelId} value={selectedId} onChange={e=>selectParcel(e.target.value)}><option value="">Choose from {parcels.length} parcels</option>{parcels.map(f=><option key={f.properties.id} value={f.properties.id}>{f.properties.reference} · {f.properties.recordedRights.length?[...new Set(f.properties.recordedRights.map(r=>ownerName(r.name)))].join(', '):'no matched rights record'}</option>)}</select>
    </details>
    <details><summary>About this data</summary>
     <p><a href={manifest.sourceUrl} target="_blank" rel="noopener noreferrer">Cadastre Etalab</a>, {monthYear(manifest.cadastreDate)} (<a href={manifest.cadastreLicenceUrl} target="_blank" rel="noopener noreferrer">{manifest.cadastreLicence}</a>), and <a href={manifest.rightsUrl} target="_blank" rel="noopener noreferrer">DGFiP legal-entity rights</a> as of {longDate(manifest.rightsAsOf)} (<a href={manifest.rightsLicenceUrl} target="_blank" rel="noopener noreferrer">{manifest.rightsLicence}</a>). Private individuals and some businesses are not published. Full parcel outlines can extend past the cru boundary. Parcel IDs can change between snapshots.</p>
     {cru.domaineGrouping&&research&&<p>Domaine headings are research links, not proof of ownership. The list groups {plural(owners.length,'recorded legal holder')} into {plural(listed.length,'row')}; company names stay searchable and appear in each parcel’s details. Headings and leads come from reviewed research: company registers and filings, estate publications and independent articles ({plural(Object.keys(research.sources).length,'cited source')} for {cru.name}). Seals rank each link from a company record down to a weak lead; “{confidenceLabels.domaine}” is kept for a domaine’s own dated confirmation{domaineOwners.some(o=>o.confidence==='domaine')?'':', and none is recorded yet'}. None of these sources shows who farms the vines.</p>}
    </details>
   </>}
  </>}
 </section>;
}

export type {Parcel,Parcels};
