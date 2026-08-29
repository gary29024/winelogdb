import { useEffect,useRef,useState,type FormEvent } from 'react';
import { AppIcon } from '../../components/AppIcons';
import { localTastingDate,startTasting,type Tasting } from './api';
import { setActiveTasting } from './useActiveTasting';
import '../../tastings.css';

/**
 * Starting an evening: a name, a date and optionally a venue.
 *
 * It borrows the scan sheet's chrome rather than inventing a second modal
 * shape, because it is reached from that sheet and should read as one more
 * step of it.
 *
 * The date defaults to the browser's local day - see localTastingDate - and is
 * editable, because a tasting is sometimes logged the morning after.
 */
export function StartTastingSheet({onClose,onStarted}:{onClose:()=>void;onStarted:(tasting:Tasting)=>void}){
  const sheet=useRef<HTMLElement>(null);
  const [name,setName]=useState(''),[venue,setVenue]=useState(''),[date,setDate]=useState(()=>localTastingDate());
  const [busy,setBusy]=useState(false),[error,setError]=useState('');

  useEffect(()=>{
    sheet.current?.focus();
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();onClose()}};
    document.addEventListener('keydown',onKeyDown);
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return()=>{document.removeEventListener('keydown',onKeyDown);document.body.style.overflow=previousOverflow};
  },[onClose]);

  async function submit(event:FormEvent){
    event.preventDefault();
    if(!name.trim()){setError('Give the tasting a name.');return}
    setBusy(true);setError('');
    try{
      const {tasting}=await startTasting({name:name.trim(),tastingDate:date,venue:venue.trim()||null});
      setActiveTasting(tasting);
      onStarted(tasting);
    }catch(e){setError((e as Error).message);setBusy(false)}
  }

  return <div className="scan-sheet-backdrop" onClick={onClose}>
    <section ref={sheet} tabIndex={-1} className="scan-sheet tasting-start-sheet" role="dialog" aria-modal="true" aria-labelledby="start-tasting-title" onClick={event=>event.stopPropagation()}>
      <span className="sheet-grabber" aria-hidden="true"/>
      <div className="scan-sheet-header"><div><p className="eyebrow">TASTING</p><h2 id="start-tasting-title">Start a tasting</h2></div><button type="button" className="sheet-close" onClick={onClose} aria-label="Close"><AppIcon kind="close"/></button></div>
      <form className="tasting-start-form" onSubmit={submit}>
        <label>Tasting name<input type="text" value={name} onChange={event=>setName(event.target.value)} placeholder="Burgundy portfolio tasting" autoFocus required/></label>
        <div className="tasting-start-row">
          <label>Date<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label>
          <label>Venue<input type="text" value={venue} onChange={event=>setVenue(event.target.value)} placeholder="Optional"/></label>
        </div>
        <p className="tasting-start-note">Every wine you log from now on joins this tasting, with the name, date and venue already filled in. It stays open across refreshes and past midnight until you end it.</p>
        {error&&<p className="tasting-error" role="alert">{error}</p>}
        <div className="tasting-start-actions"><button type="button" className="quiet" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="primary" disabled={busy}>{busy?'Starting…':'Start tasting'}</button></div>
      </form>
    </section>
  </div>;
}
