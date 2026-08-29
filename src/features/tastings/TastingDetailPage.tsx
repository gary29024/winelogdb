import { useEffect,useState } from 'react';
import { Link,useNavigate,useParams } from 'react-router-dom';
import { WineImage } from '../wines/WineImage';
import { linkFrom } from '../wines/backTarget';
import { deleteTasting,detachWineFromTasting,endTasting,getTasting,reopenTasting,updateTasting,
  type Tasting,type TastingDocument,type TastingWine } from './api';
import { setActiveTasting } from './useActiveTasting';
import { TastingDocuments } from './TastingDocuments';
import '../../tastings.css';

const dateLabel=(value:string|null)=>{
  if(!value)return 'No date';
  const parsed=new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())?value:parsed.toLocaleDateString('en-US',{day:'numeric',month:'short',year:'numeric'});
};

function Lineup({tastingId,name,wines,onRemoved}:{tastingId:string;name:string;wines:TastingWine[];onRemoved:(wineId:string)=>void}){
  const [busy,setBusy]=useState('');
  const back={to:`/tastings/${tastingId}`,label:name};
  async function remove(wine:TastingWine){
    if(!confirm(`Remove ${wine.producer} ${wine.wineName} from this tasting? The wine itself is kept.`))return;
    setBusy(wine.wineId);
    try{await detachWineFromTasting(tastingId,wine.wineId);onRemoved(wine.wineId)}
    catch{/* the row stays; the next load is the truth */}
    finally{setBusy('')}
  }
  // A wine poured twice in one evening appears twice: that is two pours, and
  // collapsing them would lose one. The key carries the position for that reason.
  return <ol className="tasting-lineup">{wines.map((wine,index)=>
    <li key={`${wine.wineId}-${index}`}>
      <Link className="tasting-lineup-wine" to={`/wines/${wine.wineId}`} state={linkFrom(back)}>
        <span className="tasting-pour-number">{index+1}</span>
        {wine.imageId?<WineImage imageId={wine.imageId} alt={`${wine.producer} ${wine.wineName} label`} className="tasting-lineup-thumb"/>:<span className="tasting-lineup-thumb tasting-lineup-blank" aria-hidden="true"/>}
        <span className="tasting-lineup-body">
          <strong>{wine.wineName}</strong>
          <span className="tasting-lineup-producer">{wine.producer}{wine.vintage?` · ${wine.vintage}`:' · NV'}</span>
          <small>{[wine.appellation,wine.region,wine.country].filter(Boolean).join(' · ')}</small>
        </span>
        {wine.rating!=null&&<span className="tasting-lineup-score">{wine.rating}</span>}
      </Link>
      <button type="button" className="tasting-lineup-remove" disabled={busy===wine.wineId} onClick={()=>void remove(wine)} aria-label={`Remove ${wine.producer} ${wine.wineName} from this tasting`}>Remove</button>
    </li>)}</ol>;
}

/** One evening: its lineup in pour order, its wine list, and the way to edit it. */
export function TastingDetailPage(){
  const {id=''}=useParams(),navigate=useNavigate();
  const [tasting,setTasting]=useState<Tasting|null>(null),[wines,setWines]=useState<TastingWine[]>([]),[documents,setDocuments]=useState<TastingDocument[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [editing,setEditing]=useState(false),[nameDraft,setNameDraft]=useState(''),[venueDraft,setVenueDraft]=useState('');

  useEffect(()=>{
    if(!id)return;
    let active=true;setLoading(true);setError('');
    getTasting(id).then(detail=>{
      if(!active)return;
      setTasting(detail.tasting);setWines(detail.wines);setDocuments(detail.documents);
      setNameDraft(detail.tasting.name);setVenueDraft(detail.tasting.venue??'');
    }).catch(e=>{if(active)setError((e as Error).message)}).finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[id]);

  const open=Boolean(tasting?.startedAt&&!tasting.endedAt);
  const rated=wines.filter(wine=>wine.rating!=null).map(wine=>wine.rating as number);
  const average=rated.length?rated.reduce((total,value)=>total+value,0)/rated.length:null;

  async function run(action:()=>Promise<{tasting:Tasting}>){
    setBusy(true);setError('');
    try{const {tasting:next}=await action();setTasting(next);setActiveTasting(next)}
    catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }

  async function saveDetails(){
    setBusy(true);setError('');
    try{
      const {tasting:next}=await updateTasting(id,{name:nameDraft.trim(),venue:venueDraft.trim()||null});
      setTasting(next);setEditing(false);
      // The strip shows the name, so a rename must reach it while the tasting is
      // still the open one.
      if(next.startedAt&&!next.endedAt)setActiveTasting(next);
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }

  async function removeTasting(){
    if(!confirm('Delete this tasting? The wines and their notes are kept — only the evening that grouped them goes.'))return;
    setBusy(true);setError('');
    try{await deleteTasting(id);if(open)setActiveTasting(null);navigate('/tastings',{replace:true})}
    catch(e){setError((e as Error).message);setBusy(false)}
  }

  if(loading)return <p aria-live="polite">Loading tasting…</p>;
  if(!tasting)return <article className="tasting-detail"><Link className="back-pill" to="/tastings">← Tastings</Link><p role="alert">{error||'That tasting no longer exists.'}</p></article>;

  return <article className="tasting-detail">
    <Link className="back-pill" to="/tastings">← Tastings</Link>
    <header className={`tasting-header${open?' is-open':''}`}>
      {editing
        ?<div className="tasting-edit">
          <label>Tasting name<input type="text" value={nameDraft} onChange={event=>setNameDraft(event.target.value)}/></label>
          <label>Venue<input type="text" value={venueDraft} onChange={event=>setVenueDraft(event.target.value)} placeholder="Optional"/></label>
          {/* Not the date: it is the tasting's identity, and changing it would
              orphan every wine already saved into it. */}
          <small>The date cannot be changed — every wine already saved is tied to it.</small>
          <div className="tasting-actions"><button type="button" className="quiet" onClick={()=>{setEditing(false);setNameDraft(tasting.name);setVenueDraft(tasting.venue??'')}} disabled={busy}>Cancel</button><button type="button" className="primary" onClick={()=>void saveDetails()} disabled={busy}>Save</button></div>
        </div>
        :<>
          <h1>{tasting.name}{open&&<em className="tasting-open-tag">In progress</em>}</h1>
          <p className="tasting-meta">{[dateLabel(tasting.tastingDate),tasting.venue].filter(Boolean).join(' · ')}</p>
          <p className="tasting-stats">{wines.length} wine{wines.length===1?'':'s'}{average!=null?` · ${average.toFixed(1)} average`:''}{rated.length>1?` · ${Math.min(...rated)}–${Math.max(...rated)}`:''}</p>
        </>}
    </header>

    {error&&<p className="tasting-error" role="alert">{error}</p>}

    {!editing&&<div className="tasting-actions">
      {open
        ?<button type="button" onClick={()=>void run(()=>endTasting(id))} disabled={busy}>End tasting</button>
        :<button type="button" onClick={()=>void run(()=>reopenTasting(id))} disabled={busy}>Reopen tasting</button>}
      {/* The thing you actually do all evening. Without it the only way to log a
          bottle from the page you are sitting on was the nav's Scan Wine, which
          is two taps away from the tasting you are already looking at. */}
      {open&&<Link className="button primary" to="/upload">Log a wine</Link>}
      <Link className="button" to={`/journal?attachTo=${id}`}>Add from journal</Link>
      <button type="button" onClick={()=>setEditing(true)} disabled={busy}>Rename / venue</button>
      <button type="button" className="quiet" onClick={()=>void removeTasting()} disabled={busy}>Delete</button>
    </div>}

    {wines.length
      ?<Lineup tastingId={id} name={tasting.name} wines={wines} onRemoved={wineId=>setWines(previous=>previous.filter(wine=>wine.wineId!==wineId))}/>
      :<p className="tasting-empty">{open?'No wines yet. Every wine you log while this is open joins it.':'No wines in this tasting. Add them from the journal.'}</p>}

    <TastingDocuments tastingId={id} documents={documents} onChange={setDocuments}/>
  </article>;
}
