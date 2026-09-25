import { Component,lazy,Suspense,useId,useRef,useState,type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { BurgundyVillageMapTarget } from '../../lib/places/burgundyVillageMap';
import { useModalFocus } from '../../components/useModalFocus';
import '../../villageMap.css';

const VillageMap=lazy(()=>import('./VillageMap'));

class MapBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 render(){return this.state.failed?<p className="village-map-message" role="alert">The map could not load. Close it and reload the page to try again.</p>:this.props.children}
}

export function WineVillageMap({target}:{target:BurgundyVillageMapTarget}){
 const [open,setOpen]=useState(false);
 const dialog=useRef<HTMLDivElement>(null),opener=useRef<HTMLButtonElement>(null);
 const title=useId();
 useModalFocus(open,dialog,()=>setOpen(false),false,opener);
 return <>
  <button type="button" ref={opener} className="wine-village-map-button" onClick={()=>setOpen(true)} aria-haspopup="dialog">
   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16"/></svg>
   View village map
  </button>
  {open&&createPortal(<div className="village-map-backdrop" onClick={event=>{if(event.target===event.currentTarget)setOpen(false)}}>
   <div className="village-map-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby={title} tabIndex={-1}>
    <header className="village-map-header"><div><p>BURGUNDY · {target.region.toLocaleUpperCase('en')}</p><h2 id={title}>{target.villageName}</h2></div><button type="button" className="village-map-close" aria-label="Close village map" onClick={()=>setOpen(false)}>×</button></header>
    <MapBoundary><Suspense fallback={<p className="village-map-message" role="status">Loading village map…</p>}><VillageMap key={`${target.villageId}:${target.featureId}`} target={target}/></Suspense></MapBoundary>
   </div>
  </div>,document.body)}
 </>;
}
