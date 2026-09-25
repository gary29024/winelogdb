import { useEffect,useId,useRef,useState } from 'react';
import { Map as MapLibreMap,Marker,NavigationControl,ScaleControl,type FilterSpecification,type MapGeoJSONFeature,type StyleSpecification } from 'maplibre-gl';
import type { FeatureCollection,Geometry } from 'geojson';
import { gevreyMapCatalogue as catalogue,type BurgundyVillageMapTarget,type VillageMapFeature } from '../../lib/places/burgundyVillageMap';
import { BurgundyAtlasLink } from '../../components/BurgundyAtlasLink';
import 'maplibre-gl/dist/maplibre-gl.css';

const tiers:Record<string,string>={grand_cru:'Grand Cru',premier_cru:'Premier Cru',village:'Village'};
const baseStyleUrl='https://tiles.openfreemap.org/styles/liberty';
const labels={type:'FeatureCollection' as const,features:catalogue.features.filter(f=>f.kind==='vineyard').map(f=>({
 type:'Feature' as const,properties:{id:f.id,name:f.name},geometry:{type:'Point' as const,coordinates:f.labelPoint}
}))};
const groups=[{tier:'grand_cru',label:'Grand Crus'},{tier:'premier_cru',label:'Premier Crus'},{tier:'village',label:'Village appellation'}];
const selectionFilter=(id:string):FilterSpecification=>['==',['get','id'],id];
function mapStyle(data:FeatureCollection,base?:StyleSpecification):StyleSpecification{
 return {
  ...(base??{version:8}),
  sources:{...base?.sources,'wine-boundaries':{type:'geojson',data},'wine-labels':{type:'geojson',data:labels}},
  layers:[...(base?.layers??[{id:'paper',type:'background' as const,paint:{'background-color':'#f1eee5'}}]),
   {id:'commune-outline',type:'line',source:'wine-boundaries',filter:['==',['get','kind'],'commune'],paint:{'line-color':'#66776b','line-width':1.5,'line-dasharray':[4,3]}},
   {id:'vineyard-fill',type:'fill',source:'wine-boundaries',filter:['!=',['get','kind'],'commune'],layout:{'fill-sort-key':['match',['get','tier'],'village',0,'premier_cru',1,2]},paint:{
    'fill-color':['match',['get','tier'],'grand_cru','#853e61','premier_cru','#c09542','#7c9d79'],
    'fill-opacity':['match',['get','kind'],'appellation',0.12,0.42]}},
   {id:'vineyard-outline',type:'line',source:'wine-boundaries',filter:['!=',['get','kind'],'commune'],paint:{
    'line-color':['match',['get','tier'],'grand_cru','#753652','premier_cru','#907023','#4f7652'],'line-width':1}},
   {id:'selected-fill',type:'fill',source:'wine-boundaries',filter:['==',['get','id'],''],paint:{'fill-color':'#ffdd86','fill-opacity':0.7}},
   {id:'selected-outline',type:'line',source:'wine-boundaries',filter:['==',['get','id'],''],paint:{'line-color':'#442236','line-width':3}},
   ...(base?.glyphs?[{id:'vineyard-labels',type:'symbol' as const,source:'wine-labels',minzoom:13,layout:{
    'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':12,'text-max-width':10,'text-padding':5},
    paint:{'text-color':'#392d30','text-halo-color':'#fffdf6','text-halo-width':1.5}} as NonNullable<StyleSpecification['layers']>[number]]:[])
  ]
 };
}

function isBoundaryData(value:unknown):value is FeatureCollection<Geometry>{
 if(!value||typeof value!=='object'||!('type' in value)||value.type!=='FeatureCollection'||!('features' in value)||!Array.isArray(value.features))return false;
 const features=value.features as Array<{id?:string;geometry?:{type?:string}}>;
 return catalogue.features.every(expected=>features.some(f=>f.id===expected.id&&['Polygon','MultiPolygon'].includes(f.geometry?.type??'')));
}

export default function VillageMap({target}:{target:BurgundyVillageMapTarget}){
 const host=useRef<HTMLDivElement>(null),mapRef=useRef<MapLibreMap|null>(null),markerRef=useRef<Marker|null>(null);
 const [selectedId,setSelectedId]=useState(target.featureId),[ready,setReady]=useState(false),[error,setError]=useState(''),[baseWarning,setBaseWarning]=useState(false),[attempt,setAttempt]=useState(0);
 const selectedRef=useRef(selectedId),selectionAction=useRef<((id:string)=>void)|null>(null);
 const selected=catalogue.features.find(feature=>feature.id===selectedId)!;
 const selectId=useId(),statusId=useId();
 useEffect(()=>{selectedRef.current=selectedId;selectionAction.current?.(selectedId)},[selectedId]);

 useEffect(()=>{
  if(!host.current)return;
  let disposed=false,map:MapLibreMap|undefined,observer:ResizeObserver|undefined;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),20000);
  const baseController=new AbortController();
  let baseTimeout:ReturnType<typeof setTimeout>|undefined;
  async function start(){
   try{
    const response=await fetch(catalogue.dataUrl,{signal:controller.signal});
    if(!response.ok)throw new Error('Boundary download failed');
    const data:unknown=await response.json();
    if(!isBoundaryData(data))throw new Error('Boundary data is incomplete');
    clearTimeout(timeout);
    if(disposed||!host.current)return;
    map=new MapLibreMap({container:host.current,style:mapStyle(data),
     bounds:[[catalogue.bounds[0],catalogue.bounds[1]],[catalogue.bounds[2],catalogue.bounds[3]]],fitBoundsOptions:{padding:30},
     minZoom:11,maxZoom:18,attributionControl:{compact:true,customAttribution:'Boundaries: INAO · Cadastre Etalab'},
     dragRotate:false,pitchWithRotate:false,touchPitch:false});
    mapRef.current=map;
    map.addControl(new NavigationControl({showCompass:false}),'top-right');
    map.addControl(new ScaleControl({unit:'metric'}),'bottom-left');
    map.getCanvas().setAttribute('aria-label','Gevrey-Chambertin vineyard map. Use the vineyard selector to explore boundaries.');
    map.on('error',()=>{if(!disposed)setBaseWarning(true)});
    const select=(id:string)=>{
     if(!map?.getLayer('selected-fill'))return;
     map.setFilter('selected-fill',selectionFilter(id));
     map.setFilter('selected-outline',selectionFilter(id));
     if(map.getLayer('vineyard-labels'))map.setFilter('vineyard-labels',['!=',['get','id'],id]);
     const feature=catalogue.features.find(f=>f.id===id);
     markerRef.current?.remove();markerRef.current=null;
     if(feature?.kind==='vineyard'){
      const element=document.createElement('span');element.className='village-map-selected-label';element.textContent=feature.name;
      markerRef.current=new Marker({element,anchor:'bottom',offset:[0,-6]}).setLngLat([feature.labelPoint[0],feature.labelPoint[1]]).addTo(map);
      element.removeAttribute('tabindex');element.removeAttribute('role');element.setAttribute('aria-hidden','true');
     }
    };
    selectionAction.current=select;
    map.on('style.load',()=>{if(!disposed){select(selectedRef.current);setReady(true)}});
    map.on('click','vineyard-fill',event=>{
     const candidates=(event.features??[]).filter((f:MapGeoJSONFeature)=>f.properties.kind==='vineyard');
     // Smaller overlapping denominations remain selectable, with every legal
     // identity also available through the accessible list.
     candidates.sort((a,b)=>Number(a.properties.areaHa)-Number(b.properties.areaHa));
     const id=candidates[0]?.properties.id;
     if(typeof id==='string'&&catalogue.features.some(f=>f.id===id))setSelectedId(id);
    });
    map.on('mouseenter','vineyard-fill',()=>{if(map)map.getCanvas().style.cursor='pointer'});
    map.on('mouseleave','vineyard-fill',()=>{if(map)map.getCanvas().style.cursor=''});
    observer=new ResizeObserver(()=>map?.resize());observer.observe(host.current);
    // Boundaries work immediately; an unavailable street map must not hide them.
    baseTimeout=setTimeout(()=>baseController.abort(),10000);
    try{
     const baseResponse=await fetch(baseStyleUrl,{signal:baseController.signal,referrerPolicy:'no-referrer'});
     if(!baseResponse.ok)throw new Error('Street map unavailable');
     const base=await baseResponse.json() as StyleSpecification;
     if(base.version!==8||!base.sources||!Array.isArray(base.layers))throw new Error('Invalid base map');
     if(!disposed)map.setStyle(mapStyle(data,base));
    }catch{if(!disposed)setBaseWarning(true)}finally{clearTimeout(baseTimeout)}
   }catch{if(!disposed)setError('The map could not load. Check your connection, or try another browser if maps are unavailable on this device.')}
   finally{clearTimeout(timeout)}
  }
  void start();
  return()=>{disposed=true;controller.abort();baseController.abort();clearTimeout(timeout);clearTimeout(baseTimeout);observer?.disconnect();markerRef.current?.remove();markerRef.current=null;selectionAction.current=null;mapRef.current=null;map?.remove()};
 },[attempt]);

 const villageView=()=>mapRef.current?.fitBounds([[catalogue.bounds[0],catalogue.bounds[1]],[catalogue.bounds[2],catalogue.bounds[3]]],{padding:30,duration:0});
 const zoomTo=(feature:VillageMapFeature)=>mapRef.current?.fitBounds([[feature.bounds[0],feature.bounds[1]],[feature.bounds[2],feature.bounds[3]]],{padding:65,maxZoom:16.5,duration:0});
 return <>
  <div className="village-map-body">
   <div className="village-map-main">
    <div className="village-map-toolbar"><button type="button" disabled={!ready||Boolean(error)} onClick={villageView}>Village view</button><button type="button" disabled={!ready||Boolean(error)} onClick={()=>zoomTo(selected)}>Zoom to selection</button></div>
    <div className="village-map-canvas" ref={host} aria-busy={!ready&&!error}/>
    {!ready&&!error&&<p className="village-map-loading" role="status">Loading vineyard boundaries…</p>}
    {error&&<div className="village-map-error" role="alert"><p>{error}</p><button type="button" onClick={()=>{setError('');setReady(false);setBaseWarning(false);setAttempt(value=>value+1)}}>Try again</button></div>}
    <div className="village-map-legend" aria-label="Map legend"><span><i className="map-tier-grand_cru"/>Grand Cru</span><span><i className="map-tier-premier_cru"/>Premier Cru</span><span><i className="map-tier-village"/>Village</span><span><i className="map-tier-selected"/>Selected</span></div>
   </div>
   <aside className="village-map-sidebar">
    <label htmlFor={selectId}>Explore a vineyard</label>
    <select id={selectId} value={selectedId} onChange={event=>setSelectedId(event.target.value)} aria-describedby={statusId}>
     {groups.map(group=><optgroup key={group.tier} label={group.label}>{catalogue.features.filter(f=>f.tier===group.tier).sort((a,b)=>a.name.localeCompare(b.name)).map(feature=><option key={feature.id} value={feature.id}>{feature.name}</option>)}</optgroup>)}
    </select>
    <div className="village-map-selection" id={statusId} aria-live="polite" aria-atomic="true">
     <p className="village-map-eyebrow">{selectedId===target.featureId?'THIS WINE':'EXPLORING'}</p>
     <h3>{selected.name}</h3><span className={`village-map-tier map-tier-${selected.tier}`}>{tiers[selected.tier]}</span>
     <p>{selected.kind==='vineyard'?'The highlighted area is the INAO production boundary for this cru.':'Appellation area shown; no single vineyard is identified.'}</p>
     {selected.denominationId===447&&<p>Chambertin’s appellation area also includes Clos de Bèze.</p>}
     {[477,809].includes(selected.denominationId)&&<p>Charmes-Chambertin and Mazoyères-Chambertin share the same INAO production area.</p>}
    </div>
    {selectedId!==target.featureId&&<button type="button" className="village-map-return" onClick={()=>{setSelectedId(target.featureId);villageView()}}>Back to this wine</button>}
    <p className="village-map-context">9 Grand Crus · 26 Premier Cru climats<br/>Gevrey-Chambertin & Brochon</p>
    <BurgundyAtlasLink place={{placeId:selected.matchId,name:selected.name,url:selected.atlasUrl}}/>
    {baseWarning&&!error&&<p className="village-map-note" role="status">Some street-map details are unavailable. Vineyard boundaries remain available.</p>}
   </aside>
  </div>
  <footer className="village-map-footer"><p>Wine boundaries: <a href="https://www.data.gouv.fr/datasets/delimitation-parcellaire-des-aoc-viticoles-de-linao" target="_blank" rel="noopener noreferrer">INAO</a> · 21 Sep 2026. Commune outlines: <a href="https://cadastre.data.gouv.fr/datasets/cadastre-etalab" target="_blank" rel="noopener noreferrer">Cadastre Etalab</a> · Jun 2026. Licence Ouverte.</p><p>For geographic context; boundaries do not identify a producer’s holding or establish a bottle’s exact origin.</p></footer>
 </>;
}
