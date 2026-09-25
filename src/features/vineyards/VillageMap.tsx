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
const vineyardCount=(tier:string)=>catalogue.features.filter(f=>f.kind==='vineyard'&&f.tier===tier).length;
const boundsOf=(b:number[]):[[number,number],[number,number]]=>[[b[0],b[1]],[b[2],b[3]]];
// The light end of the app's --cru ramp (styles.css), one hue stepped dark to
// light so rank reads without the legend. The map stays light in both themes,
// so these are fixed rather than the tokens. The wine's own cru takes the app
// accent, which the ramp never uses, over a white casing.
const cru={grand_cru:'#543c0c',premier_cru:'#785819',village:'#9c7629'},accent='#c51f45';
const groups=[{tier:'grand_cru',label:'Grand Crus'},{tier:'premier_cru',label:'Premier Crus'},{tier:'village',label:'Village appellation'}];
const selectionFilter=(id:string):FilterSpecification=>['==',['get','id'],id];
function mapStyle(data:FeatureCollection,base?:StyleSpecification):StyleSpecification{
 return {
  ...(base??{version:8}),
  sources:{...base?.sources,'wine-boundaries':{type:'geojson',data},'wine-labels':{type:'geojson',data:labels}},
  layers:[...(base?.layers??[{id:'paper',type:'background' as const,paint:{'background-color':'#f3f1ec'}}]),
   {id:'commune-outline',type:'line',source:'wine-boundaries',filter:['==',['get','kind'],'commune'],paint:{'line-color':'#7d899c','line-width':1.5,'line-dasharray':[4,3]}},
   {id:'vineyard-fill',type:'fill',source:'wine-boundaries',filter:['!=',['get','kind'],'commune'],layout:{'fill-sort-key':['match',['get','tier'],'village',0,'premier_cru',1,2]},paint:{
    'fill-color':['match',['get','tier'],'grand_cru',cru.grand_cru,'premier_cru',cru.premier_cru,cru.village],
    'fill-opacity':['match',['get','kind'],'appellation',0.1,['match',['get','tier'],'grand_cru',0.62,0.4]]}},
   {id:'vineyard-outline',type:'line',source:'wine-boundaries',filter:['!=',['get','kind'],'commune'],paint:{
    'line-color':['match',['get','tier'],'grand_cru',cru.grand_cru,'premier_cru',cru.premier_cru,cru.village],'line-width':0.8}},
   {id:'selected-fill',type:'fill',source:'wine-boundaries',filter:['==',['get','id'],''],paint:{'fill-color':accent,'fill-opacity':0.55}},
   {id:'selected-casing',type:'line',source:'wine-boundaries',filter:['==',['get','id'],''],paint:{'line-color':'#ffffff','line-width':6}},
   {id:'selected-outline',type:'line',source:'wine-boundaries',filter:['==',['get','id'],''],paint:{'line-color':accent,'line-width':2.5}},
   ...(base?.glyphs?[{id:'vineyard-labels',type:'symbol' as const,source:'wine-labels',minzoom:13,layout:{
    'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':12,'text-max-width':10,'text-padding':5},
    paint:{'text-color':'#10182d','text-halo-color':'#ffffff','text-halo-width':1.5}} as NonNullable<StyleSpecification['layers']>[number]]:[])
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
    const own=catalogue.features.find(f=>f.id===target.featureId);
    // Open on the wine's own cru - on a phone the village view leaves it a few
    // pixels wide under its label. A broad appellation has no cru to show.
    const opening=target.scope==='vineyard'&&own?{bounds:boundsOf(own.bounds),fitBoundsOptions:{padding:70,maxZoom:15}}:{bounds:boundsOf(catalogue.bounds),fitBoundsOptions:{padding:30}};
    map=new MapLibreMap({container:host.current,style:mapStyle(data),...opening,
     minZoom:11,maxZoom:18,attributionControl:{compact:true,customAttribution:'Boundaries: INAO · Cadastre Etalab'},
     dragRotate:false,pitchWithRotate:false,touchPitch:false});
    mapRef.current=map;
    map.addControl(new NavigationControl({showCompass:false}),'top-right');
    map.addControl(new ScaleControl({unit:'metric'}),'bottom-left');
    map.getCanvas().setAttribute('aria-label',`${catalogue.name} vineyard map. Use the vineyard selector to explore boundaries.`);
    map.on('error',()=>{if(!disposed)setBaseWarning(true)});
    const select=(id:string)=>{
     if(!map?.getLayer('selected-fill'))return;
     map.setFilter('selected-fill',selectionFilter(id));
     map.setFilter('selected-casing',selectionFilter(id));
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
     // Smallest first, so Clos de Bèze is reachable inside Chambertin. A second
     // click on the same spot steps to the next designation there, which is the
     // only way to reach Mazoyères: it shares Charmes' geometry exactly.
     candidates.sort((a,b)=>Number(a.properties.areaHa)-Number(b.properties.areaHa)||String(a.properties.id).localeCompare(String(b.properties.id)));
     const ids=[...new Set(candidates.map(f=>f.properties.id))];
     const id=ids[(ids.indexOf(selectedRef.current)+1)%ids.length];
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
 // eslint-disable-next-line react-hooks/exhaustive-deps -- the map is built once per attempt; the target is fixed by the parent's key
 },[attempt]);

 const villageView=()=>mapRef.current?.fitBounds(boundsOf(catalogue.bounds),{padding:30,duration:0});
 const zoomTo=(feature:VillageMapFeature)=>mapRef.current?.fitBounds(boundsOf(feature.bounds),{padding:65,maxZoom:16.5,duration:0});
 const backToWine=()=>{
  setSelectedId(target.featureId);
  const own=catalogue.features.find(f=>f.id===target.featureId);
  if(target.scope==='vineyard'&&own)mapRef.current?.fitBounds(boundsOf(own.bounds),{padding:70,maxZoom:15,duration:0});else villageView();
 };
 return <>
  <div className="village-map-body">
   <div className="village-map-main">
    <div className="village-map-toolbar"><button type="button" disabled={!ready||Boolean(error)} onClick={villageView}>Village view</button><button type="button" disabled={!ready||Boolean(error)} onClick={()=>zoomTo(selected)}>Zoom to selection</button></div>
    <div className="village-map-canvas" ref={host} aria-busy={!ready&&!error}/>
    {!ready&&!error&&<p className="village-map-loading" role="status">Loading vineyard boundaries…</p>}
    {error&&<div className="village-map-error" role="alert"><p>{error}</p><button type="button" onClick={()=>{setError('');setReady(false);setBaseWarning(false);setAttempt(value=>value+1)}}>Try again</button></div>}
    <div className="village-map-legend" aria-label="Map legend"><span><i className="map-swatch-grand_cru"/>Grand Cru</span><span><i className="map-swatch-premier_cru"/>Premier Cru</span><span><i className="map-swatch-village"/>Village</span><span><i className="map-swatch-selected"/>{selectedId===target.featureId?'This wine':'Selected'}</span></div>
   </div>
   <aside className="village-map-sidebar">
    <label htmlFor={selectId}>Explore a vineyard</label>
    <select id={selectId} value={selectedId} onChange={event=>setSelectedId(event.target.value)} aria-describedby={statusId}>
     {groups.map(group=><optgroup key={group.tier} label={group.label}>{catalogue.features.filter(f=>f.tier===group.tier).sort((a,b)=>a.name.localeCompare(b.name)).map(feature=><option key={feature.id} value={feature.id}>{feature.name}</option>)}</optgroup>)}
    </select>
    <div className="village-map-selection" id={statusId} aria-live="polite" aria-atomic="true">
     <p className={`village-map-eyebrow${selectedId===target.featureId?' is-wine':''}`}>{selectedId===target.featureId?'THIS WINE':'EXPLORING'}</p>
     <h3>{selected.name}</h3><span className={`village-map-tier map-tier-${selected.tier}`}>{tiers[selected.tier]}</span>
     <p>{selected.kind==='vineyard'?'The highlighted area is the INAO production boundary for this cru.':'Appellation area shown; no single vineyard is identified.'}</p>
     {selected.denominationId===447&&<p>Chambertin’s appellation area also includes Clos de Bèze.</p>}
     {[477,809].includes(selected.denominationId)&&<p>Charmes-Chambertin and Mazoyères-Chambertin share the same INAO production area.</p>}
    </div>
    {selectedId!==target.featureId&&<button type="button" className="village-map-return" onClick={backToWine}>Back to this wine</button>}
    <p className="village-map-hint">Tap a vineyard on the map to explore it.</p>
    <p className="village-map-context">{vineyardCount('grand_cru')} Grand Crus · {vineyardCount('premier_cru')} Premier Cru climats<br/>{catalogue.name} & Brochon</p>
    <BurgundyAtlasLink place={{placeId:selected.matchId,name:selected.name,url:selected.atlasUrl,...(selected.kind==='appellation'?{scope:'appellation' as const}:{})}}/>
    {baseWarning&&!error&&<p className="village-map-note" role="status">Some street-map details are unavailable. Vineyard boundaries remain available.</p>}
   </aside>
  </div>
  <footer className="village-map-footer"><p>Wine boundaries: <a href="https://www.data.gouv.fr/datasets/delimitation-parcellaire-des-aoc-viticoles-de-linao" target="_blank" rel="noopener noreferrer">INAO</a> · 21 Sep 2026. Commune outlines: <a href="https://cadastre.data.gouv.fr/datasets/cadastre-etalab" target="_blank" rel="noopener noreferrer">Cadastre Etalab</a> · Jun 2026. Licence Ouverte.</p><p>For geographic context; boundaries do not identify a producer’s holding or establish a bottle’s exact origin.</p></footer>
 </>;
}
