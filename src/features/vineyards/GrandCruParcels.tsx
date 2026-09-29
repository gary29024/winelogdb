import {useEffect,useId,useMemo,useRef,useState} from 'react';
import type {Map as MapLibreMap,GeoJSONSource} from 'maplibre-gl';
import type {Feature,FeatureCollection,Polygon,MultiPolygon} from 'geojson';
import {placeKey} from '../../lib/places/resolve';
import {ownerName,possibleOwnerMatch} from '../../lib/places/echezeauxParcelOwners';
import manifest from '../../lib/places/echezeauxParcelManifest.json';
import {ParcelProducerLinker} from './ParcelProducerLinker';
import {ParcelEvidence} from './ParcelEvidence';

type Right={holderId:string;siren:string|null;name:string;rightCode:string;rightLabel:string;legalForm:string;legalFormLabel:string};
// producerNames are reviewed spellings of the producer field, as in
// burgundyProducerLocations: producer records are per-user, so no static ID can join them.
type DomaineLink={status:'verified'|'proposed';name:string;producerId:string;producerNames:string[];role:'operator';effectiveDate:string;evidence:{url:string;note:string}[]};
type Parcel={id:string;reference:string;commune:string;cadastreAreaM2:number;geometryAreaM2:number;bounds:number[];labelPoint:number[];
 overlaps:{parentFeatureId:string;name:string;areaM2:number;parcelPercent:number}[];recordedRights:Right[];
 recordMatch:'unknown'|'reference-and-area'|'area-mismatch';recordAreasM2:number[];domaineLinks:DomaineLink[]};
type Parcels=FeatureCollection<Polygon|MultiPolygon,Parcel>;
type ParcelFeature=Feature<Polygon|MultiPolygon,Parcel>;
type Match=''|'owner'|'verified'|'possible';
export type ParcelLegendKey='recorded'|'unrecorded'|'owner'|'verified'|'possible'|'selected';

const sourceId='cadastral-parcels',hatchId='cadastral-parcel-hatch';
const layers=['cadastral-parcel-hatch','cadastral-parcel-owner','cadastral-parcel-producer','cadastral-parcel-possible','cadastral-parcel-outline',
 'cadastral-parcel-possible-line','cadastral-parcel-selected-casing','cadastral-parcel-selected','cadastral-parcel-hit'];
// Ink for the parcel grid, ochre for a chosen holder, crimson for the wine's
// verified producer and blue/dashes for unverified name suggestions.
const ink='#26324a',ochre='#8a5a12',crimson='#c51f45',possibleBlue='#0067b1';
const ha=(m2:number)=>`${(m2/10000).toFixed(2)} ha`;
const plural=(n:number,one:string,many=`${one}s`)=>`${n} ${n===1?one:many}`;

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
 possible:['map-swatch-parcel-possible','Producer · possible (unverified)'],selected:['map-swatch-parcel-selected','Selected parcel'],
};
/** Parcel keys join the map's single legend while the layer is on. */
export function ParcelLegend({keys}:{keys:ParcelLegendKey[]}){
 if(!keys.length)return null;
 return <><span className="village-map-legend-divider" aria-hidden="true"/>{keys.map(key=><span key={key}><i className={swatches[key][0]}/>{swatches[key][1]}</span>)}</>;
}

export function GrandCruParcels({map,parentId,producer,onLegend}:{map:MapLibreMap|null;parentId:string;producer?:string|null;onLegend?:(keys:ParcelLegendKey[])=>void}){
 const [show,setShow]=useState(false),[data,setData]=useState<Parcels|null>(null),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
 const [owner,setOwner]=useState(''),[selectedId,setSelectedId]=useState(''),[allOwners,setAllOwners]=useState(false),[query,setQuery]=useState('');
 const [showPossible,setShowPossible]=useState(false);
 const [linkingHolder,setLinkingHolder]=useState('');
 const switchId=useId(),parcelId=useId(),searchId=useId(),possibleId=useId(),ownersId=useId();
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
 },[show,data,attempt]);
 const name=parentId==='inao-denom-565'?'Échezeaux':'Grands-Échezeaux';
 const overlapOf=(f:ParcelFeature)=>overlapIn(f,parentId);
 const parcels=useMemo(()=>data?.features.filter(f=>f.properties.overlaps.some(o=>o.parentFeatureId===parentId))??[],[data,parentId]);
 const owners=useMemo(()=>rightHolders(parcels,parentId),[parcels,parentId]);
 const wineProducer=producer?.trim()??'';
 const verified=useMemo(()=>parcels.filter(f=>f.properties.domaineLinks.some(l=>producerIs(l,wineProducer))),[parcels,wineProducer]);
 // Possible matches come from the wine's own producer field, are off by
 // default and never enter the verified style or wording.
 const possibleOwners=useMemo(()=>wineProducer?rightHolders(parcels.filter(f=>!verified.includes(f)),parentId).filter(o=>possibleOwnerMatch(wineProducer,o.name)):[],[parcels,parentId,wineProducer,verified]);
 const possible=useMemo(()=>{
  const ids=new Set(possibleOwners.map(o=>o.id));
  return parcels.filter(f=>!verified.includes(f)&&f.properties.recordedRights.some(r=>ids.has(r.holderId)));
 },[parcels,possibleOwners,verified]);
 const matches=useMemo(()=>new Map<string,Match>(parcels.map(f=>[f.properties.id,
  owner&&f.properties.recordedRights.some(r=>r.holderId===owner)?'owner':verified.includes(f)?'verified':showPossible&&possible.includes(f)?'possible':''])),[parcels,owner,verified,possible,showPossible]);
 const styled=useMemo<FeatureCollection>(()=>({type:'FeatureCollection',features:parcels.map(f=>{
  const match=matches.get(f.properties.id)??'';
  return {...f,properties:{id:f.properties.id,recorded:f.properties.recordedRights.length>0,match,dim:Boolean(owner)&&match===''}};
 })}),[parcels,matches,owner]);
 const selected=parcels.find(f=>f.properties.id===selectedId);
 const legend=useMemo<ParcelLegendKey[]>(()=>!show||!data?[]:[
  'recorded','unrecorded',...(owner?['owner' as const]:[]),...(verified.length?['verified' as const]:[]),
  ...(showPossible&&possible.length?['possible' as const]:[]),...(selected?['selected' as const]:[])],[show,data,owner,verified,possible,showPossible,selected]);
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
 useEffect(()=>{
  if(!map||!show||!data)return;
  const faded=new Map<string,unknown>();
  const attach=()=>{
   if(!map.getStyle())return;
   if(!map.getSource(sourceId))map.addSource(sourceId,{type:'geojson',data:styled});
   else (map.getSource(sourceId) as GeoJSONSource).setData?.(styled);
   if(map.hasImage&&!map.hasImage(hatchId))map.addImage(hatchId,hatch());
   if(!map.getLayer(layers[0])){
    const dim=(on:number,off:number)=>['case',['get','dim'],off,on];
    map.addLayer({id:layers[0],type:'fill',source:sourceId,filter:['!',['get','recorded']],paint:{'fill-pattern':hatchId,'fill-opacity':dim(1,0.35) as never}});
    map.addLayer({id:layers[1],type:'fill',source:sourceId,filter:['==',['get','match'],'owner'],paint:{'fill-color':ochre,'fill-opacity':0.75}});
    map.addLayer({id:layers[2],type:'fill',source:sourceId,filter:['==',['get','match'],'verified'],paint:{'fill-color':crimson,'fill-opacity':0.72}});
    map.addLayer({id:layers[3],type:'fill',source:sourceId,filter:['==',['get','match'],'possible'],paint:{'fill-color':possibleBlue,'fill-opacity':0.58}});
    map.addLayer({id:layers[4],type:'line',source:sourceId,filter:['!=',['get','match'],'possible'],paint:{
     'line-color':['match',['get','match'],'owner',ochre,'verified',crimson,ink],
     'line-width':['match',['get','match'],'',0.6,1.1],
     'line-opacity':['case',['get','dim'],0.25,['==',['get','match'],''],0.55,1]}});
    map.addLayer({id:layers[5],type:'line',source:sourceId,filter:['==',['get','match'],'possible'],paint:{'line-color':'#003e73','line-width':2.8,'line-dasharray':[2,1.5]}});
    map.addLayer({id:layers[6],type:'line',source:sourceId,filter:['==',['get','id'],''],paint:{'line-color':'#ffffff','line-width':5}});
    map.addLayer({id:layers[7],type:'line',source:sourceId,filter:['==',['get','id'],''],paint:{'line-color':'#10182d','line-width':2.4}});
    map.addLayer({id:layers[8],type:'fill',source:sourceId,paint:{'fill-opacity':0}});
   }
   for(const id of [layers[6],layers[7]])map.setFilter(id,['==',['get','id'],selected?.properties.id??'']);
   // The wine's crimson and this cru's tier fill fade while parcels are on,
   // so the parcel grid and hatching stay legible. Other crus keep theirs.
   for(const [id,value] of fades)if(map.getLayer(id)&&map.getPaintProperty){
    if(!faded.has(id))faded.set(id,map.getPaintProperty(id,'fill-opacity'));
    map.setPaintProperty(id,'fill-opacity',value(faded.get(id)) as number);
   }
  };
  const fades:[string,(original:unknown)=>unknown][]=[['selected-fill',()=>0.08],['vineyard-fill',original=>['case',['==',['get','id'],parentId],0.12,original]]];
  const click=(event:{point:{x:number;y:number}})=>{
   if(!map.getLayer(layers[8]))return;
   const hits=map.queryRenderedFeatures([event.point.x,event.point.y],{layers:[layers[8]]});
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
 },[map,show,data,styled,selected,parentId]);
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
  setSelectedId(id);const f=parcels.find(f=>f.properties.id===id);
  if(f)fit(union([f]));
 };
 const chooseOwner=(id:string)=>{
  const next=owner===id?'':id;setOwner(next);setSelectedId('');
  if(next)fit(union(parcels.filter(f=>f.properties.recordedRights.some(r=>r.holderId===next))));
 };
 const recorded=parcels.filter(f=>f.properties.recordedRights.length);
 const areaOf=(list:ParcelFeature[])=>list.reduce((sum,f)=>sum+(overlapOf(f)?.areaM2??0),0);
 const totalArea=areaOf(parcels),recordedArea=areaOf(recorded);
 const listed=owners;
 const needle=placeKey(query);
 const shown=allOwners?listed.filter(o=>!needle||placeKey(o.name).includes(needle)):listed.slice(0,6);
 const largest=listed[0]?.areaM2||1;
 const rights=selected?.properties.recordedRights??[];
 const overlap=selected&&overlapOf(selected);
 const selectedMatch=selected?matches.get(selected.properties.id)??'':'';
 return <section className="village-map-parcels" aria-label="Parcel rights">
  <label className="village-map-parcel-toggle" htmlFor={switchId}>
   <span>Parcel rights<small> · {name}</small></span>
   <input id={switchId} type="checkbox" role="switch" checked={show} disabled={!map} onChange={event=>{setShow(event.target.checked);setError(false);setOwner('');setSelectedId('')}}/>
  </label>
  <p className="village-map-note">Legal-entity rights recorded on 1 January 2025. These do not establish who currently farms the vines.</p>
  {show&&<>
   {!data&&!error&&<p className="village-map-note" role="status">Loading cadastral parcels…</p>}
   {error&&<div className="village-map-parcel-error" role="alert"><p>Parcel data could not load. The cru map remains available.</p><button type="button" onClick={()=>{setError(false);setAttempt(a=>a+1)}}>Retry parcels</button></div>}
   {data&&<>
    {verified.length>0&&<div className="village-map-producer">
     <p className="village-map-eyebrow is-wine">THIS WINE’S PRODUCER</p>
     <strong>{wineProducer}</strong>
     <span className="village-map-producer-meta">{plural(verified.length,'parcel')} · {ha(areaOf(verified))} in {name}</span>
     <span className="village-map-badge is-verified">Verified parcel links</span>
     <span className="village-map-note">Select a parcel for its farming evidence and effective date.</span>
     <button type="button" className="village-map-link-button" onClick={()=>{setOwner('');setSelectedId('');showOnMap(verified)}}>Show on map</button>
    </div>}
    {possibleOwners.length>0&&<>
     <label className="village-map-parcel-check" htmlFor={possibleId}><input id={possibleId} type="checkbox" checked={showPossible} onChange={event=>{setShowPossible(event.target.checked);setOwner('')}}/>Show possible matches for {wineProducer} (unverified)</label>
     {showPossible&&<div className="village-map-producer is-possible">
      <span className="village-map-badge is-possible">Possible match · name only</span>
      {possibleOwners.map(o=><div key={o.id}><strong>{ownerName(o.name)}</strong><br/><span className="village-map-producer-meta">{plural(o.count,'parcel')} · {ha(o.areaM2)}</span>
       <button type="button" className="village-map-link-button" onClick={()=>setLinkingHolder(o.id)}>Link {ownerName(o.name)} to an app producer</button>
      </div>)}
      <p className="village-map-note">These recorded right holders’ names resemble the producer’s. This dataset has no verified evidence that {wineProducer} farms these parcels.</p>
      <button type="button" className="village-map-link-button" onClick={()=>{setOwner('');setSelectedId('');showOnMap(possible)}}>Show possible matches on map</button>
     </div>}
    </>}
    <ParcelProducerLinker parentId={parentId} holders={owners} editing={linkingHolder} onEdit={setLinkingHolder} onShow={id=>{setOwner(id);setSelectedId('');showOnMap(parcels.filter(f=>f.properties.recordedRights.some(r=>r.holderId===id)))}}/>
    <div className="village-map-parcel-share">
     <span><strong>{parcels.length}</strong> parcels in {name}</span>
     <span className="village-map-parcel-bar" role="img" aria-label={`${Math.round(recordedArea/totalArea*100)}% of the parcel area has recorded rights`}><b style={{width:`${recordedArea/totalArea*100}%`}}/></span>
     <span className="village-map-parcel-key"><span>{recorded.length} with recorded rights · {ha(recordedArea)}</span><span>{parcels.length-recorded.length} without a matched record</span></span>
    </div>
    {selected&&<div className="village-map-parcel-details" aria-live="polite" ref={detailsRef}>
     <div className="village-map-parcel-head"><h4>Parcel {selected.properties.reference}</h4><button type="button" className="village-map-link-button" onClick={()=>setSelectedId('')}>Clear</button></div>
     <dl>
      <dt>Recorded rights</dt><dd>{rights.length?rights.map(r=><div key={`${r.holderId}:${r.rightCode}`}>{ownerName(r.name)} · {r.rightLabel}</div>):'No matched rights record'}</dd>
      <dt>Current farming domaine</dt><dd>Not established by this rights snapshot</dd>
      <dt>Area</dt><dd>{ha(selected.properties.cadastreAreaM2)}{overlap&&overlap.parcelPercent<99?` · ${Math.round(overlap.parcelPercent)}% inside ${name}`:''}</dd>
      {selectedMatch==='possible'&&<><dt>Producer</dt><dd className="is-possible">Possible match, unverified</dd></>}
     </dl>
     <ParcelEvidence parcelId={selected.properties.id}/>
     {[...new Map(rights.map(r=>[r.holderId,r])).values()].map(r=><button key={r.holderId} type="button" className="village-map-link-button" onClick={()=>setLinkingHolder(r.holderId)}>Link {ownerName(r.name)} to an app producer</button>)}
     {selected.properties.domaineLinks.map((link,index)=><div key={`${link.producerId}:${index}`} className="village-map-note">
      <strong>{link.name}</strong> · {link.status==='verified'?'Verified operator':'Proposed operator (unverified)'} · effective {link.effectiveDate}
      <div>{link.evidence.map((e,i)=><span key={`${e.url}:${i}`}>{i>0&&' · '}<a href={e.url} target="_blank" rel="noopener noreferrer">{e.note}</a></span>)}</div>
     </div>)}
     {selected.properties.recordMatch==='area-mismatch'&&<p className="village-map-overlap">The parcel reference matches, but its recorded area differs between snapshots. These historical rights must not be treated as a verified current holding.</p>}
     {rights.length?<details><summary>Record details</summary>
      <ul>{rights.map(r=><li key={`${r.holderId}:${r.rightCode}`}>{r.name} · {r.rightCode} — {r.rightLabel} · {r.legalFormLabel}<br/>{r.siren?`SIREN ${r.siren}`:`DGFiP identifier ${r.holderId} (not a SIREN)`}</li>)}</ul>
      <p>Cadastral reference {selected.properties.id}. Rights recorded as of 1 January 2025. Recorded parcel area {selected.properties.cadastreAreaM2.toLocaleString('en')} m²; {name} overlap {Math.round(overlap?.areaM2??0).toLocaleString('en')} m² ({overlap?.parcelPercent.toFixed(1)}% of its mapped geometry).</p>
     </details>:<p className="village-map-note">No matching published legal-entity record was found. Coverage exclusions and parcel changes can leave gaps; this doesn’t mean the parcel has no owner.</p>}
    </div>}
    <div>
     <p className="village-map-parcel-label" id={ownersId}>Recorded right holders by mapped area</p>
     <p className="village-map-note">A parcel can have several right holders. Areas show parcel coverage, not ownership shares.</p>
     {allOwners&&<><label className="visually-hidden" htmlFor={searchId}>Search right holders</label><input id={searchId} type="search" placeholder="Search right holders" value={query} onChange={event=>setQuery(event.target.value)}/></>}
     <ul className="village-map-owners" aria-labelledby={ownersId}>{shown.map(o=><li key={o.id}><button type="button" aria-pressed={owner===o.id} onClick={()=>chooseOwner(o.id)}>
      <span>{ownerName(o.name)}</span><span className="village-map-owner-qty">{ha(o.areaM2)} · {o.count}</span><span className="village-map-owner-bar" aria-hidden="true"><b style={{width:`${o.areaM2/largest*100}%`}}/></span>
     </button></li>)}</ul>
     {owner&&<button type="button" className="village-map-link-button" onClick={()=>setLinkingHolder(owner)}>Link chosen right holder to an app producer</button>}
     {listed.length>6&&<button type="button" className="village-map-link-button" onClick={()=>{setAllOwners(!allOwners);setQuery('')}}>{allOwners?'Show fewer':`Show all ${listed.length} right holders`}</button>}
    </div>
    <details className="village-map-parcel-finder"><summary>Find a parcel by cadastral reference</summary>
     <label htmlFor={parcelId}>Cadastral parcel</label>
     <select id={parcelId} value={selectedId} onChange={e=>selectParcel(e.target.value)}><option value="">Choose from {parcels.length} parcels</option>{parcels.map(f=><option key={f.properties.id} value={f.properties.id}>{f.properties.reference} · {f.properties.recordedRights.length?[...new Set(f.properties.recordedRights.map(r=>ownerName(r.name)))].join(', '):'no matched rights record'}</option>)}</select>
    </details>
    <p className="village-map-note">Recorded rights and name matches do not establish who farms the vines or made this bottle.</p>
    <details><summary>About this data</summary>
     <p><a href={manifest.sourceUrl} target="_blank" rel="noopener noreferrer">Cadastre Etalab</a>, June 2026, and <a href={manifest.rightsUrl} target="_blank" rel="noopener noreferrer">DGFiP legal-entity rights</a> as of 1 January 2025, both Licence Ouverte 2.0. Private individuals and some businesses are not published. Full parcel outlines can extend past the cru boundary. Parcel IDs can change between snapshots.</p>
    </details>
   </>}
  </>}
 </section>;
}

export type {Parcel,Parcels};
