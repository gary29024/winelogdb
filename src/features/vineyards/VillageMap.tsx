import { useEffect,useId,useRef,useState } from 'react';
import { Map as MapLibreMap,Marker,NavigationControl,ScaleControl,type FilterSpecification,type MapGeoJSONFeature,type StyleSpecification } from 'maplibre-gl';
import type { Feature,FeatureCollection,Geometry } from 'geojson';
import { clickOrder,countLabel,joinPlaces,snapshotLabel,umbrellaNote,type BurgundyVillageMapTarget,type VillageMapCatalogue,type VillageMapFeature } from '../../lib/places/burgundyVillageMap';
import { loadVillageMapCatalogue } from '../../lib/places/loadVillageMapCatalogue';
import { BurgundyAtlasLink } from '../../components/BurgundyAtlasLink';
import 'maplibre-gl/dist/maplibre-gl.css';

const tiers:Record<string,string>={grand_cru:'Grand Cru',premier_cru:'Premier Cru',village:'Village'};
const baseStyleUrl='https://tiles.openfreemap.org/styles/liberty';
const boundsOf=(b:number[]):[[number,number],[number,number]]=>[[b[0],b[1]],[b[2],b[3]]];
// Leave room for the toolbar above the northernmost vineyard in long or split
// areas, and for a part's name above it. On a phone the toolbar wraps onto a
// second row, so measure it rather than assume one row.
function overviewFit(host:HTMLElement|null){
 const toolbar=host?.parentElement?.querySelector<HTMLElement>('.village-map-toolbar');
 const top=toolbar?toolbar.offsetTop+toolbar.offsetHeight+40:80;
 return {padding:{top,right:30,bottom:30,left:30}};
}
// The light end of the app's --cru ramp (styles.css), one hue stepped dark to
// light so rank reads without the legend. The map stays light in both themes,
// so these are fixed rather than the tokens. The wine's own cru takes the app
// accent, which the ramp never uses, over a white casing.
const cru={grand_cru:'#543c0c',premier_cru:'#785819',village:'#9c7629'},accent='#c51f45';
const groups=[{tier:'grand_cru',label:'Grand Crus'},{tier:'premier_cru',label:'Premier Crus'},{tier:'village',label:'Village appellation'}];
// Each spot is painted once, so every shade on the map is one legend entry.
// The village and Premier Cru appellation areas contain every named cru, so as
// washes they stacked under them and made extra shades; the village area is an
// outline instead, and the Premier Cru area shows only when selected.
const selectionFilter=(id:string):FilterSpecification=>['==',['get','id'],id];
function mapStyle(data:FeatureCollection,catalogue:VillageMapCatalogue,base?:StyleSpecification):StyleSpecification{
 const unpainted=Object.entries(catalogue.notes).filter(([,entry])=>entry.paintedBy).map(([id])=>id);
 const painted:FilterSpecification=['all',['==',['get','kind'],'vineyard'],['!',['in',['get','id'],['literal',unpainted]]]];
 // Derived overview fills avoid stacking colours over overlapping names.
 // Original production boundaries remain the source for selection and clicks.
 const overviewFills=(data as FeatureCollection&{overviewFills?:Feature[]}).overviewFills;
 const contextFeatures=overviewFills??data.features.map(feature=>{
  const geometry=(feature as Feature<Geometry>&{contextGeometry?:Geometry}).contextGeometry;
  return geometry?{...feature,geometry}:feature;
 });
 const separateContext=Boolean(overviewFills)||contextFeatures.some((feature,index)=>feature!==data.features[index]);
 return {
  ...(base??{version:8}),
  sources:{...base?.sources,'wine-boundaries':{type:'geojson',data},
   ...(separateContext?{'wine-context':{type:'geojson' as const,data:{...data,features:contextFeatures}}}:{})},
  layers:[...(base?.layers??[{id:'paper',type:'background' as const,paint:{'background-color':'#f3f1ec'}}]),
   {id:'commune-outline',type:'line',source:'wine-boundaries',filter:['==',['get','kind'],'commune'],paint:{'line-color':'#7d899c','line-width':1.5,'line-dasharray':[4,3]}},
   {id:'village-outline',type:'line',source:'wine-boundaries',filter:['all',['==',['get','kind'],'appellation'],['==',['get','tier'],'village']],paint:{'line-color':cru.village,'line-width':1.4}},
   {id:'vineyard-fill',type:'fill',source:separateContext?'wine-context':'wine-boundaries',filter:painted,paint:{
    'fill-color':['match',['get','tier'],'grand_cru',cru.grand_cru,cru.premier_cru],
    'fill-opacity':['match',['get','tier'],'grand_cru',0.62,0.4]}},
   // Invisible, but every cru - painted or not - answers a click and the cursor.
   {id:'vineyard-hit',type:'fill',source:'wine-boundaries',filter:['any',['==',['get','kind'],'vineyard'],['==',['get','tier'],'grand_cru']],paint:{'fill-color':'#000000','fill-opacity':0}},
   {id:'vineyard-outline',type:'line',source:'wine-boundaries',filter:['==',['get','kind'],'vineyard'],paint:{
    'line-color':['match',['get','tier'],'grand_cru',cru.grand_cru,cru.premier_cru],'line-width':0.8}},
   // A cru is one plot and takes the full highlight. An appellation is
   // hundreds of hectares with every excluded parcel cut out as a hole, so the
   // same treatment floods the village and rings each hole in red; it gets a
   // tint the tiers show through, edged by the village outline already drawn.
   {id:'selected-fill',type:'fill',source:'wine-boundaries',filter:['==',['get','id'],''],paint:{'fill-color':accent,'fill-opacity':['match',['get','kind'],'appellation',0.2,0.55]}},
   {id:'selected-casing',type:'line',source:'wine-boundaries',filter:['==',['get','id'],''],paint:{'line-color':'#ffffff','line-width':['match',['get','kind'],'appellation',0,6]}},
   {id:'selected-outline',type:'line',source:'wine-boundaries',filter:['==',['get','id'],''],paint:{'line-color':accent,'line-width':['match',['get','kind'],'appellation',0,2.5]}},
  ]
 };
}

function isBoundaryData(value:unknown,catalogue:VillageMapCatalogue):value is FeatureCollection<Geometry>{
 if(!value||typeof value!=='object'||!('type' in value)||value.type!=='FeatureCollection'||!('features' in value)||!Array.isArray(value.features))return false;
 const features=value.features as Array<{id?:string;geometry?:{type?:string}}>;
 return catalogue.features.every(expected=>features.some(f=>f.id===expected.id&&['Polygon','MultiPolygon'].includes(f.geometry?.type??'')));
}

export default function VillageMap({target}:{target:BurgundyVillageMapTarget}){
 const [catalogue,setCatalogue]=useState<VillageMapCatalogue|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{
  let disposed=false;
  void loadVillageMapCatalogue(target.villageId).then(value=>{
   if(!value.features.some(feature=>feature.id===target.featureId))throw new Error('Vineyard is unavailable');
   if(!disposed)setCatalogue(value);
  }).catch(()=>{if(!disposed)setFailed(true)});
  return()=>{disposed=true};
 },[target.villageId,target.featureId]);
 // Browsers cache failed module imports. Repeating the same import cannot
 // reliably recover; a fresh page can. GeoJSON download failures retry below.
 if(failed)return <div className="village-map-message" role="alert"><p>The village map could not load. Reload the page to try again.</p><button type="button" className="village-map-return" onClick={()=>window.location.reload()}>Reload page</button></div>;
 if(!catalogue)return <p className="village-map-message" role="status">Loading village map…</p>;
 return <VillageMapView target={target} catalogue={catalogue}/>;
}

function VillageMapView({target,catalogue}:{target:BurgundyVillageMapTarget;catalogue:VillageMapCatalogue}){
 const host=useRef<HTMLDivElement>(null),mapRef=useRef<MapLibreMap|null>(null),markerRef=useRef<Marker|null>(null);
 const [selectedId,setSelectedId]=useState(target.featureId),[ready,setReady]=useState(false),[error,setError]=useState(''),[baseWarning,setBaseWarning]=useState(false),[attempt,setAttempt]=useState(0);
 const selectedRef=useRef(selectedId),selectionAction=useRef<((id:string)=>void)|null>(null);
 const selected=catalogue.features.find(feature=>feature.id===selectedId)!;
 // A reviewed note, then what the cru's umbrella relationships mean for a label.
 const selectionNotes=[catalogue.notes[selected.id]?.note,umbrellaNote(catalogue,selected.id)].filter(Boolean);
 // Reviewed alternative designations remain selectable without counting the
 // same climat twice (Santenay's two names for Clos de Tavannes).
 const vineyardCount=(tier:string)=>catalogue.features.filter(f=>f.kind==='vineyard'&&f.tier===tier&&!catalogue.notes[f.id]?.sameBoundaryAs).length;
 const grandCount=new Set(catalogue.features.filter(f=>f.tier==='grand_cru').map(f=>f.appellationId)).size;
 const grandClimats=catalogue.features.filter(f=>f.parentAppellation);
 const hasVineyards=catalogue.features.some(f=>f.kind==='vineyard');
 const selectId=useId(),statusId=useId();
 useEffect(()=>{selectedRef.current=selectedId;selectionAction.current?.(selectedId)},[selectedId]);

 useEffect(()=>{
  if(!host.current)return;
  let disposed=false,map:MapLibreMap|undefined,observer:ResizeObserver|undefined,disposeNames:(()=>void)|undefined;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),20000);
  const baseController=new AbortController();
  let baseTimeout:ReturnType<typeof setTimeout>|undefined;
  async function start(){
   try{
    const response=await fetch(catalogue.dataUrl,{signal:controller.signal});
    if(!response.ok)throw new Error('Boundary download failed');
    const data:unknown=await response.json();
    if(!isBoundaryData(data,catalogue))throw new Error('Boundary data is incomplete');
    clearTimeout(timeout);
    if(disposed||!host.current)return;
    const own=catalogue.features.find(f=>f.id===target.featureId);
    // Open on the wine's own cru - on a phone the village view leaves it a few
    // pixels wide under its label. A broad appellation has no cru to show.
    const opening=target.scope==='vineyard'&&own?{bounds:boundsOf(own.bounds),fitBoundsOptions:{padding:70,maxZoom:15}}:{bounds:boundsOf(catalogue.bounds),fitBoundsOptions:overviewFit(host.current)};
    map=new MapLibreMap({container:host.current,style:mapStyle(data,catalogue),...opening,
     minZoom:9,maxZoom:18,attributionControl:{compact:true,customAttribution:'Boundaries: INAO · Cadastre Etalab'},
     dragRotate:false,pitchWithRotate:false,touchPitch:false});
    mapRef.current=map;
    map.addControl(new NavigationControl({showCompass:false}),'top-right');
    map.addControl(new ScaleControl({unit:'metric'}),'bottom-left');
    map.getCanvas().setAttribute('aria-label',`${catalogue.name} vineyard map. Use the vineyard selector to explore boundaries.`);
    map.on('error',()=>{if(!disposed)setBaseWarning(true)});
    // HTML labels work even without the street map's font server. Grand Crus
    // claim space first, then larger crus; colliding names wait for closer zoom.
    const labelOrder=catalogue.features.filter(f=>f.kind==='vineyard')
     .sort((a,b)=>Number(b.tier==='grand_cru')-Number(a.tier==='grand_cru')||b.areaHa-a.areaHa);
    // Every cru is also in the accessible list, so these are visual only.
    const names=labelOrder.map(feature=>{
     const element=document.createElement('span');element.className=`village-map-name village-map-name-${feature.tier}`;element.textContent=feature.name;
     const marker=new Marker({element,anchor:'center'}).setLngLat([feature.labelPoint[0],feature.labelPoint[1]]).addTo(map!);
     element.removeAttribute('tabindex');element.removeAttribute('role');element.setAttribute('aria-hidden','true');
     return {feature,element,marker};
    });
    // An appellation in separate parts (Côte de Nuits-Villages) names each part
    // on the overview, where the parts are otherwise small, unlabelled patches.
    const areaNames=(catalogue.areas??[]).map(area=>{
     const element=document.createElement('span');element.className='village-map-area-name';element.textContent=area.name;
     // Just above the part rather than on it, so its few small vineyards stay visible.
     const marker=new Marker({element,anchor:'bottom',offset:[0,-6]}).setLngLat([(area.bounds[0]+area.bounds[2])/2,area.bounds[3]]).addTo(map!);
     element.removeAttribute('tabindex');element.removeAttribute('role');element.setAttribute('aria-hidden','true');
     return {element,marker};
    });
    let frame=0;
    function placeLabels(){
     if(!map)return;
     const {width,height}=map.getContainer().getBoundingClientRect(),placed:DOMRect[]=[];
     const own=markerRef.current?.getElement().getBoundingClientRect();
     if(own)placed.push(own);
     // Names never sit under the buttons, zoom control, scale or credits.
     map.getContainer().closest('.village-map-main')?.querySelectorAll('.village-map-toolbar button,.maplibregl-ctrl')
      .forEach(control=>placed.push(control.getBoundingClientRect()));
     const overlaps=(a:DOMRect)=>placed.some(b=>a.left<b.right+4&&b.left<a.right+4&&a.top<b.bottom+2&&b.top<a.bottom+2);
     const origin=map.getContainer().getBoundingClientRect();
     // Part names take the overview; vineyard names take over from 12.8.
     for(const {element} of areaNames){
      element.style.visibility='visible';
      const box=element.getBoundingClientRect();
      const show=map.getZoom()<12.8&&!overlaps(box);
      element.style.visibility=show?'visible':'hidden';
      if(show)placed.push(box);
     }
     for(const {feature,element} of names){
      element.style.visibility='visible';
      const box=element.getBoundingClientRect();
      const inside=box.left>=origin.left&&box.right<=origin.left+width&&box.top>=origin.top&&box.bottom<=origin.top+height;
      const show=feature.id!==selectedRef.current&&map.getZoom()>=12.8&&inside&&!overlaps(box);
      element.style.visibility=show?'visible':'hidden';
      if(show)placed.push(box);
     }
    }
    const select=(id:string)=>{
     if(!map?.getLayer('selected-fill'))return;
     map.setFilter('selected-fill',selectionFilter(id));
     map.setFilter('selected-casing',selectionFilter(id));
     map.setFilter('selected-outline',selectionFilter(id));
     const feature=catalogue.features.find(f=>f.id===id);
     markerRef.current?.remove();markerRef.current=null;
     if(feature?.kind==='vineyard'){
      const element=document.createElement('span');element.className='village-map-selected-label';element.textContent=feature.name;
      markerRef.current=new Marker({element,anchor:'bottom',offset:[0,-6]}).setLngLat([feature.labelPoint[0],feature.labelPoint[1]]).addTo(map);
      element.removeAttribute('tabindex');element.removeAttribute('role');element.setAttribute('aria-hidden','true');
     }
     placeLabels();
    };
    const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(placeLabels)};
    map.on('move',schedule);map.on('resize',schedule);
    disposeNames=()=>{cancelAnimationFrame(frame);names.forEach(name=>name.marker.remove());areaNames.forEach(area=>area.marker.remove())};
    selectionAction.current=select;
    map.on('style.load',()=>{if(!disposed){select(selectedRef.current);setReady(true)}});
    map.on('click','vineyard-hit',event=>{
     const candidates=(event.features??[]).filter((f:MapGeoJSONFeature)=>f.properties.kind==='vineyard'||f.properties.tier==='grand_cru');
     // A second click on the same spot steps to the next designation there,
     // which is the only way to reach Mazoyères: it shares Charmes' geometry.
     const ids=clickOrder(candidates.map(f=>f.properties as {id:string;tier:string;areaHa:number}));
     const id=ids[(ids.indexOf(selectedRef.current)+1)%ids.length];
     if(typeof id==='string'&&catalogue.features.some(f=>f.id===id))setSelectedId(id);
    });
    map.on('mouseenter','vineyard-hit',()=>{if(map)map.getCanvas().style.cursor='pointer'});
    map.on('mouseleave','vineyard-hit',()=>{if(map)map.getCanvas().style.cursor=''});
    observer=new ResizeObserver(()=>map?.resize());observer.observe(host.current);
    // Boundaries work immediately; an unavailable street map must not hide them.
    baseTimeout=setTimeout(()=>baseController.abort(),10000);
    try{
     const baseResponse=await fetch(baseStyleUrl,{signal:baseController.signal,referrerPolicy:'no-referrer'});
     if(!baseResponse.ok)throw new Error('Street map unavailable');
     const base=await baseResponse.json() as StyleSpecification;
     if(base.version!==8||!base.sources||!Array.isArray(base.layers))throw new Error('Invalid base map');
     if(!disposed)map.setStyle(mapStyle(data,catalogue,base));
    }catch{if(!disposed)setBaseWarning(true)}finally{clearTimeout(baseTimeout)}
   }catch{if(!disposed)setError('The map could not load. Check your connection, or try another browser if maps are unavailable on this device.')}
   finally{clearTimeout(timeout)}
  }
  void start();
  return()=>{disposed=true;controller.abort();baseController.abort();clearTimeout(timeout);clearTimeout(baseTimeout);observer?.disconnect();disposeNames?.();markerRef.current?.remove();markerRef.current=null;selectionAction.current=null;mapRef.current=null;map?.remove()};
 // eslint-disable-next-line react-hooks/exhaustive-deps -- the map is built once per attempt; the target is fixed by the parent's key
 },[attempt]);

 const villageView=()=>mapRef.current?.fitBounds(boundsOf(catalogue.bounds),{...overviewFit(host.current),duration:0});
 const zoomTo=(feature:VillageMapFeature)=>mapRef.current?.fitBounds(boundsOf(feature.bounds),{padding:65,maxZoom:16.5,duration:0});
 const backToWine=()=>{
  setSelectedId(target.featureId);
  const own=catalogue.features.find(f=>f.id===target.featureId);
  if(target.scope==='vineyard'&&own)mapRef.current?.fitBounds(boundsOf(own.bounds),{padding:70,maxZoom:15,duration:0});else villageView();
 };
 return <>
  <div className="village-map-body">
   <div className="village-map-main">
    <div className="village-map-toolbar"><button type="button" disabled={!ready||Boolean(error)} onClick={villageView}>Village view</button><button type="button" disabled={!ready||Boolean(error)} onClick={()=>zoomTo(selected)}>Zoom to selection</button>{catalogue.areas?.map(area=><button type="button" key={area.id} disabled={!ready||Boolean(error)} aria-label={`${area.label}: ${area.name}`} onClick={()=>mapRef.current?.fitBounds(boundsOf(area.bounds),{padding:50,duration:0})}>{area.label}</button>)}</div>
    <div className="village-map-canvas" ref={host} aria-busy={!ready&&!error}/>
    {!ready&&!error&&<p className="village-map-loading" role="status">Loading vineyard boundaries…</p>}
    {error&&<div className="village-map-error" role="alert"><p>{error}</p><button type="button" onClick={()=>{setError('');setReady(false);setBaseWarning(false);setAttempt(value=>value+1)}}>Try again</button></div>}
    <div className="village-map-legend" aria-label="Map legend">{vineyardCount('grand_cru')>0&&<span><i className="map-swatch-grand_cru"/>Grand Cru</span>}{vineyardCount('premier_cru')>0&&<span><i className="map-swatch-premier_cru"/>Premier Cru</span>}<span><i className="map-swatch-village"/>Village appellation</span><span><i className="map-swatch-commune"/>Commune boundary</span><span><i className={`map-swatch-selected${selected.kind==='appellation'?' is-area':''}`}/>{selectedId===target.featureId?'This wine':'Selected'}</span></div>
   </div>
   <aside className="village-map-sidebar">
    <label htmlFor={selectId}>{hasVineyards?'Explore a vineyard':'Explore an area'}</label>
    <select id={selectId} value={selectedId} onChange={event=>setSelectedId(event.target.value)} aria-describedby={statusId}>
     {groups.map(group=><optgroup key={group.tier} label={group.label}>{catalogue.features.filter(f=>f.tier===group.tier).sort((a,b)=>a.name.localeCompare(b.name)).map(feature=><option key={feature.id} value={feature.id}>{feature.name}</option>)}</optgroup>)}
    </select>
    <div className="village-map-selection" id={statusId} aria-live="polite" aria-atomic="true">
     <p className={`village-map-eyebrow${selectedId===target.featureId?' is-wine':''}`}>{selectedId===target.featureId?'THIS WINE':'EXPLORING'}</p>
     <h3>{selected.name}</h3><span className={`village-map-tier map-tier-${selected.tier}`}>{tiers[selected.tier]}</span>
     <p className="village-map-description">{selected.kind==='vineyard'?'The highlighted area is the INAO production boundary for this cru.':'Appellation area shown; no single vineyard is identified.'}</p>
     {selectionNotes.map(note=><p className="village-map-overlap" key={note}>{note}</p>)}
    </div>
    {selectedId!==target.featureId&&<button type="button" className="village-map-return" onClick={backToWine}>Back to this wine</button>}
    <p className="village-map-hint">{hasVineyards?'Tap a vineyard on the map to explore it.':'The map shows the appellation area across its producing communes.'}</p>
    <p className="village-map-context">{hasVineyards?<>{countLabel(grandCount,'Grand Cru','Grand Crus')}{grandClimats.length>0&&<> · {countLabel(grandClimats.length,'Grand Cru climat','Grand Cru climats')}</>} · {countLabel(vineyardCount('premier_cru'),'Premier Cru climat','Premier Cru climats')}</>:'Village appellation area'}<br/>{joinPlaces(catalogue.communes.map(commune=>commune.name))}</p>
    {catalogue.coverageNote&&<p className="village-map-note">{catalogue.coverageNote}</p>}
    <BurgundyAtlasLink place={selected.atlasUrl?{placeId:selected.matchId,name:selected.name,url:selected.atlasUrl,...(selected.kind==='appellation'?{scope:'appellation' as const}:{})}:null}/>
    {baseWarning&&!error&&<p className="village-map-note" role="status">Some street-map details are unavailable. Vineyard boundaries remain available.</p>}
   </aside>
  </div>
  <footer className="village-map-footer"><p>Wine boundaries: <a href="https://www.data.gouv.fr/datasets/delimitation-parcellaire-des-aoc-viticoles-de-linao" target="_blank" rel="noopener noreferrer">INAO</a> · {snapshotLabel(catalogue.sources.find(source=>source.name==='INAO')?.date)}. Commune outlines: <a href="https://cadastre.data.gouv.fr/datasets/cadastre-etalab" target="_blank" rel="noopener noreferrer">Cadastre Etalab</a> · {snapshotLabel(catalogue.sources.find(source=>source.name==='Cadastre Etalab')?.date,true)}. Licence Ouverte.</p><p>For geographic context; boundaries do not identify a producer’s holding or establish a bottle’s exact origin.</p></footer>
 </>;
}
