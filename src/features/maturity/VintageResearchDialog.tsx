import { useEffect,useId,useRef } from 'react';
import type { VintageSubject,VintageWindow } from '../../lib/maturity/vintageWindow';
import { VintageCheck } from './VintageCheck';

/** Native modal focus handling keeps keyboard navigation inside the research. */
export function VintageResearchDialog({wine,initialWindow,onClose,onResearched}:{
  wine:VintageSubject;initialWindow?:VintageWindow|null;onClose:()=>void;onResearched:()=>void;
}){
  const ref=useRef<HTMLDialogElement>(null);
  const titleId=useId();
  useEffect(()=>{
    const dialog=ref.current!;
    const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const previousOverflow=document.body.style.overflow;
    dialog.showModal();document.body.style.overflow='hidden';
    return()=>{
      dialog.close();document.body.style.overflow=previousOverflow;
      if(previousFocus?.isConnected)previousFocus.focus();
    };
  },[]);

  return <dialog ref={ref} className="vintage-dialog" aria-labelledby={titleId}
    onCancel={event=>{event.preventDefault();onClose()}}
    onClick={event=>{if(event.target===event.currentTarget)onClose()}}>
    <div className="vintage-dialog-body">
      <div className="vintage-dialog-head">
        <div><p className="eyebrow">Vintage intelligence</p><h2 id={titleId}>{wine.wineName||'Vintage research'}</h2>
          {wine.producer&&<p className="vintage-dialog-producer">{wine.producer}</p>}</div>
        <button type="button" className="quiet" onClick={onClose} aria-label="Close vintage research">Close</button>
      </div>
      <VintageCheck wine={wine} initialWindow={initialWindow} onResearched={onResearched}/>
    </div>
  </dialog>;
}
