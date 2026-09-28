import {useEffect,useId,useMemo,useState} from 'react';
import type {Map as MapLibreMap,FilterSpecification} from 'maplibre-gl';
import type {FeatureCollection,Polygon,MultiPolygon} from 'geojson';
import manifest from '../../lib/places/echezeauxParcelManifest.json';

type Right={holderId:string;siren:string|null;name:string;rightCode:string;rightLabel:string;legalForm:string;legalFormLabel:string};
type DomaineLink={status:'verified'|'proposed';name:string;producerId:string;role:'operator';effectiveDate:string;evidence:{url:string;note:string}[]};
type Parcel={id:string;reference:string;commune:string;cadastreAreaM2:number;geometryAreaM2:number;bounds:number[];labelPoint:number[];
 overlaps:{parentFeatureId:string;name:string;areaM2:number;parcelPercent:number}[];recordedRights:Right[];
 recordMatch:'unknown'|'reference-and-area'|'area-mismatch';recordAreasM2:number[];domaineLinks:DomaineLink[]};
type Parcels=FeatureCollection<Polygon|MultiPolygon,Parcel>;
const sourceId='cadastral-parcels';
const layers=['cadastral-parcel-fill','cadastral-parcel-outline','cadastral-parcel-selected','cadastral-parcel-hit'];
const byIds=(ids:string[]):FilterSpecification=>['in',['get','id'],['literal',ids]];

export function GrandCruParcels({map,parentId}:{map:MapLibreMap|null;parentId:string}){
 const [show,setShow]=useState(false),[data,setData]=useState<Parcels|null>(null),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
 const [holder,setHolder]=useState(''),[domaine,setDomaine]=useState(''),[selectedId,setSelectedId]=useState('');
 const checkboxId=useId(),holderId=useId(),parcelId=useId(),domaineId=useId();
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
 const parcels=useMemo(()=>data?.features.filter(f=>f.properties.overlaps.some(o=>o.parentFeatureId===parentId))??[],[data,parentId]);
 const holders=useMemo(()=>[...new Map(parcels.flatMap(f=>f.properties.recordedRights.map(r=>[r.holderId,r] as const))).values()].sort((a,b)=>a.name.localeCompare(b.name)),[parcels]);
 const domaines=useMemo(()=>[...new Map(parcels.flatMap(f=>f.properties.domaineLinks.filter(l=>l.status==='verified').map(l=>[l.producerId,l] as const))).values()],[parcels]);
 const visible=useMemo(()=>parcels.filter(f=>(!holder||(holder==='unknown'?!f.properties.recordedRights.length:f.properties.recordedRights.some(r=>r.holderId===holder)))&&
  (!domaine||f.properties.domaineLinks.some(l=>l.status==='verified'&&l.producerId===domaine))),[parcels,holder,domaine]);
 const selected=visible.find(f=>f.properties.id===selectedId);
 useEffect(()=>{
  if(!map||!show||!data)return;
  const attach=()=>{
   if(!map.getStyle())return;
   if(!map.getSource(sourceId))map.addSource(sourceId,{type:'geojson',data:{type:'FeatureCollection',features:parcels}});
   if(!map.getLayer(layers[0])){
    map.addLayer({id:layers[0],type:'fill',source:sourceId,paint:{'fill-color':'#24646b','fill-opacity':0.08}});
    map.addLayer({id:layers[1],type:'line',source:sourceId,paint:{'line-color':'#24646b','line-width':1.1}});
    map.addLayer({id:layers[2],type:'line',source:sourceId,paint:{'line-color':'#136fba','line-width':3}});
    map.addLayer({id:layers[3],type:'fill',source:sourceId,paint:{'fill-opacity':0}});
   }
   for(const id of [layers[0],layers[1],layers[3]])map.setFilter(id,byIds(visible.map(f=>f.properties.id)));
   map.setFilter(layers[2],byIds(selected?[selected.properties.id]:[]));
  };
  const click=(event:{point:{x:number;y:number}})=>{
   if(!map.getLayer(layers[3]))return;
   const hits=map.queryRenderedFeatures([event.point.x,event.point.y],{layers:[layers[3]]});
   if(hits[0]?.properties.id)setSelectedId(hits[0].properties.id as string);
  };
  attach();map.on('style.load',attach);map.on('click',click);
  return()=>{
   map.off('style.load',attach);map.off('click',click);
   // The parent may already have disposed the MapLibre instance.
   if(map.getStyle()){
    for(const id of [...layers].reverse())if(map.getLayer(id))map.removeLayer(id);
    if(map.getSource(sourceId))map.removeSource(sourceId);
   }
  };
 },[map,show,data,parcels,visible,selected]);
 const selectParcel=(id:string)=>{
  setSelectedId(id);const f=visible.find(f=>f.properties.id===id);
  if(f&&map){const b=f.properties.bounds;map.fitBounds([[b[0],b[1]],[b[2],b[3]]],{padding:70,maxZoom:18,duration:0})}
 };
 const rights=selected?.properties.recordedRights??[];
 const overlap=selected?.properties.overlaps.find(o=>o.parentFeatureId===parentId);
 const name=parentId==='inao-denom-565'?'Échezeaux':'Grands-Échezeaux';
 return <section className="village-map-parcels" aria-label="Cadastral parcels">
  <label className="village-map-parcel-toggle" htmlFor={checkboxId}><input id={checkboxId} type="checkbox" checked={show} disabled={!map} onChange={event=>{setShow(event.target.checked);setError(false)}}/> Show parcels · {name}</label>
  {show&&<>
   {!data&&!error&&<p role="status">Loading cadastral parcels…</p>}
   {error&&<div role="alert"><p>Parcel data could not load. The cru map remains available.</p><button type="button" onClick={()=>{setError(false);setAttempt(a=>a+1)}}>Retry parcels</button></div>}
   {data&&<>
    <div className="village-map-legend" aria-label="Parcel legend"><span><i className="map-swatch-parcel"/>Cadastral parcel</span><span><i className="map-swatch-parcel-selected"/>Selected parcel</span></div>
    <p className="village-map-note">{parcels.length} cadastral parcels overlap {name}. Full parcel outlines can extend outside the cru. Select a parcel to see its overlap.</p>
    <label htmlFor={holderId}>Recorded right holder</label>
    <select id={holderId} value={holder} onChange={e=>{setHolder(e.target.value);setSelectedId('')}}><option value="">All parcels</option><option value="unknown">No published rights record</option>{holders.map(r=><option key={r.holderId} value={r.holderId}>{r.name}</option>)}</select>
    {domaines.length>0&&<><label htmlFor={domaineId}>Verified farming domaine</label><select id={domaineId} value={domaine} onChange={e=>{setDomaine(e.target.value);setSelectedId('')}}><option value="">All verified domaines</option>{domaines.map(d=><option key={d.producerId} value={d.producerId}>{d.name}</option>)}</select></>}
    <label htmlFor={parcelId}>Explore a cadastral parcel</label>
    <select id={parcelId} value={selectedId} onChange={e=>selectParcel(e.target.value)}><option value="">Choose from {visible.length} parcels</option>{visible.map(f=><option key={f.properties.id} value={f.properties.id}>{f.properties.reference}{f.properties.recordedRights.length?'':' · rights unknown'}</option>)}</select>
    {selected&&<div className="village-map-parcel-details" aria-live="polite">
     <h4>Parcel {selected.properties.reference}</h4><p>Cadastral reference: {selected.properties.id}</p>
     <p>Recorded parcel area: {selected.properties.cadastreAreaM2.toLocaleString('en')} m². {name} overlap: {Math.round(overlap?.areaM2??0).toLocaleString('en')} m² ({overlap?.parcelPercent.toFixed(1)}% of its mapped geometry).</p>
     <p>Recorded rights as of 1 January 2025</p>
     {rights.length?<ul>{rights.map(r=><li key={`${r.holderId}:${r.rightCode}`}>{r.name} · {r.rightCode} — {r.rightLabel}<br/>{r.siren?`SIREN ${r.siren}`:`DGFiP identifier ${r.holderId} (not a SIREN)`}</li>)}</ul>:<p>No published legal-entity rights record matched. This does not establish that the parcel has no owner.</p>}
     {selected.properties.recordMatch==='area-mismatch'&&<p className="village-map-overlap">The parcel reference matches, but its recorded area differs between snapshots. These historical rights must not be treated as a verified current holding.</p>}
     {selected.properties.domaineLinks.length?selected.properties.domaineLinks.map(d=><p key={`${d.producerId}:${d.status}`}>{d.status==='verified'?'Verified farming domaine':'Proposed domaine match'}: {d.name} · {d.effectiveDate}. {d.evidence.map(e=><a key={e.url} href={e.url} target="_blank" rel="noopener noreferrer">{e.note}</a>)}</p>):<p>Farming domaine: not verified for this parcel.</p>}
    </div>}
    <p className="village-map-note">Legal ownership does not establish who farms the vines or a bottle’s exact origin. Private individuals and some businesses are absent from the published rights data.</p>
    <p className="village-map-note"><a href={manifest.sourceUrl} target="_blank" rel="noopener noreferrer">Cadastre Etalab</a> · June 2026. <a href={manifest.rightsUrl} target="_blank" rel="noopener noreferrer">DGFiP rights</a> · 1 January 2025. Both Licence Ouverte 2.0. Parcel IDs can change between snapshots.</p>
   </>}
  </>}
 </section>;
}

export type {Parcel,Parcels};
