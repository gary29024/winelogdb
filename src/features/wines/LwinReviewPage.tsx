import { useCallback,useEffect,useState } from 'react';
import { Link,useSearchParams } from 'react-router-dom';
import { getAccount } from '../../lib/auth/client';
import { apiJson } from '../../lib/auth/api';
import { summariesChanged } from '../../lib/cache/summaryCaches';
import { applyWineReferenceSuggestion,getWine,type WineDetail } from './api';
import { linkFrom,rememberBackTarget } from './backTarget';
import { WineImage } from './WineImage';
import { LwinLinkEditor } from './LwinLinkEditor';
import { ProducerNameReview } from './ProducerNameReview';
import '../../referenceSuggestions.css';

type ReviewItem={id:string;producer:string;wineName:string;vintage:number|null;lwin7:string|null;conflict:boolean};
type ReviewPage={items:ReviewItem[];total:number;nextCursor:string|null};
const pending=(wine:WineDetail)=>wine.identityMatchStatus==='conflict'||Boolean(wine.referenceSuggestions?.length);

export function LwinReviewPage(){
 const [params,setParams]=useSearchParams(),cursor=params.get('after')??'',selected=params.get('wine')??'';
 const [page,setPage]=useState<ReviewPage>(),[wine,setWine]=useState<WineDetail>(),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const owner=getAccount()?.role==='owner';
 const load=useCallback(async()=>{const next=await apiJson<ReviewPage>(`/api/admin/rollout/lwin-review?after=${encodeURIComponent(cursor)}`);setPage(next);return next},[cursor]);
 useEffect(()=>{if(!owner)return;let active=true;setLoading(true);setPage(undefined);apiJson<ReviewPage>(`/api/admin/rollout/lwin-review?after=${encodeURIComponent(cursor)}`).then(next=>{if(active)setPage(next)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[cursor,owner]);
 useEffect(()=>{setWine(undefined);setError('');if(!selected)return;let active=true;getWine(selected).then(next=>{if(active)setWine(next)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[selected]);
 useEffect(()=>{if(!owner)return;const refresh=()=>{if(!busy)void load().catch(e=>setError(e.message))};window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh)},[load,owner,busy]);
 function choose(id:string){const next=new URLSearchParams(params);if(id)next.set('wine',id);else next.delete('wine');setParams(next,{replace:true});setNotice('')}
 async function act(operation:()=>Promise<unknown>){
  if(!wine||busy)return;const id=wine.id;setBusy(true);setError('');
  try{
   await operation();summariesChanged();const updated=await getWine(id);setWine(updated);
   const next=await load();
   if(!pending(updated)){const following=next.items.find(item=>item.id>id)??next.items[0];choose(following?.id??'');setNotice('Resolved. Removed from needs review.');}
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 const back={to:`/admin/lwin-review${params.size?`?${params}`:''}`,label:'Needs review'};
 if(!owner)return <p>Owner access required.</p>;
 return <section className="lwin-review-page">
  <header className="lwin-review-header"><p className="eyebrow">Owner controls</p><h1>Needs review</h1><p>Review LWIN differences one wine at a time. Resolved wines leave this queue.</p>{page&&<p>{page.total} wines remaining</p>}<Link to="/admin">Owner controls</Link></header>
  <div className="lwin-review-toolbar"><button disabled={loading||busy} onClick={()=>void load().catch(e=>setError(e.message))}>Refresh list</button>{cursor&&<Link to="/admin/lwin-review">Back to first wines</Link>}</div>
  {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
  {loading&&<p role="status">Loading wines…</p>}
  {page&&!page.items.length&&<p>{page.total?'No more wines on this page. Return to the first wines to continue.':'All caught up. No wines need review.'}</p>}
  <div className="lwin-review-list">{page?.items.map(item=><article className={`lwin-review-card${selected===item.id?' is-open':''}`} key={item.id}>
   <button className="lwin-review-heading quiet" disabled={busy} aria-expanded={selected===item.id} onClick={()=>choose(selected===item.id?'':item.id)}><span><strong>{item.producer}</strong><span>{item.wineName}{item.vintage?` · ${item.vintage}`:''}</span></span><small>{item.conflict?'Check identity':'Suggested updates'} {selected===item.id?'−':'+'}</small></button>
   {selected===item.id&&(!wine?<p>Loading review…</p>:<div className="lwin-review-body">
    {wine.imageIds?.[0]&&<WineImage imageId={wine.imageIds[0]} alt={`${wine.producer} ${wine.wineName}`} className="lwin-review-photo"/>}
    <div className="lwin-review-toolbar"><Link to={`/wines/${item.id}`} state={linkFrom(back)}>Open wine</Link><Link to={`/wines/${item.id}/edit`} onClick={()=>rememberBackTarget(item.id,back)} state={linkFrom(back)}>Edit wine</Link><button disabled={busy} onClick={()=>void act(()=>apiJson(`/api/wines/${item.id}/reference-review`,'POST',{action:'recheck'}))}>Recheck LWIN</button></div>
    <p className="lwin-suggestion-intro">Recheck LWIN refreshes older suggestions against the current catalogue. Your populated fields stay unchanged.</p>
    {wine.identityMatchStatus==='conflict'&&<div className="lwin-review-conflict"><strong>Stored LWIN: {wine.lwin7||'None'}</strong><p>The current match could not verify this identity. Check the wine before confirming.</p>{!!wine.identityMatchCandidates?.length&&<p>Candidate LWINs: {wine.identityMatchCandidates.join(', ')}</p>}{wine.lwin7&&<button disabled={busy} onClick={()=>void act(()=>apiJson(`/api/wines/${item.id}/reference-review`,'POST',{action:'confirm',lwin7:wine.lwin7,updatedAt:wine.updatedAt}))}>Confirm stored LWIN {wine.lwin7}</button>}</div>}
    <LwinLinkEditor key={wine.id} wine={wine} disabled={busy} onLink={preview=>act(()=>apiJson(`/api/wines/${wine.id}/reference-review`,'POST',{action:'link',lwin7:preview.requestedLwin7,previewToken:preview.previewToken}))}/>
    <div className="lwin-suggestion-list">{wine.referenceSuggestions?.map(suggestion=><div className="lwin-suggestion-row" key={suggestion.field}>
     <div><strong>{suggestion.label}</strong><span><small>Current</small>{suggestion.current||'—'}</span><span><small>LWIN</small>{suggestion.suggested}</span></div>
     <div className="lwin-review-choices"><button disabled={busy} onClick={()=>void act(()=>applyWineReferenceSuggestion(item.id,suggestion.field))}>Use LWIN value</button><button className="quiet" disabled={busy} onClick={()=>void act(()=>applyWineReferenceSuggestion(item.id,suggestion.field,'keep'))}>Keep current</button></div>
    </div>)}</div>
    {wine.referenceSuggestions?.some(suggestion=>suggestion.field==='producer')&&<ProducerNameReview key={`${wine.id}:${wine.updatedAt}`} wineId={wine.id} disabled={busy} onApply={act}/>}
    {!pending(wine)&&<p>This wine has been resolved. Refresh the list to continue.</p>}
    {busy&&<p role="status">Saving review…</p>}
   </div>)}
  </article>)}</div>
  {page?.nextCursor&&<Link className="button" to={`/admin/lwin-review?after=${encodeURIComponent(page.nextCursor)}`}>Next wines</Link>}
 </section>;
}
