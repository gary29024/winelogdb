import { useEffect,useState } from 'react';
import { Link,useParams } from 'react-router-dom';
import { apiJson } from '../../lib/auth/api';
import type { SharedWine } from '../../lib/wine/shared';
import { AppIcon } from '../../components/AppIcons';
import { setWineFavorite } from './api';

type Experience=NonNullable<SharedWine['experience']>;
const emptyExperience:Experience={tastingNotes:'',rating:null,tastingDate:null,tastingName:null,venue:null,locationName:null,price:null,currency:null};
const wineSearcherUrl=(wine:SharedWine)=>{
 const query=[wine.producer,wine.wineName,wine.vintage??''].map(String).map(value=>value.trim()).filter(Boolean).join(' ');
 return `https://www.wine-searcher.com/find/${encodeURIComponent(query).replace(/%20/g,'+')}`;
};

function SharedWineDetail({wine,onSaved}:{wine:SharedWine;onSaved:(experience:Experience)=>void}){
 const [experience,setExperience]=useState<Experience>(wine.experience??emptyExperience);
 const [favorite,setFavorite]=useState(false),[favoriteBusy,setFavoriteBusy]=useState(false);
 const [saving,setSaving]=useState(false),[notice,setNotice]=useState('');
 const photo=wine.photos?.[0];

 async function toggleFavorite(){
  if(favoriteBusy)return;const next=!favorite;setFavorite(next);setFavoriteBusy(true);
  try{await setWineFavorite(wine.id,next)}catch(e){setFavorite(!next);setNotice((e as Error).message)}finally{setFavoriteBusy(false)}
 }
 async function saveExperience(){
  setSaving(true);setNotice('');
  try{
   const saved=await apiJson<{experience:Experience}>(`/api/shared/wines/${wine.id}/experience`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(experience)});
   setExperience(saved.experience);onSaved(saved.experience);setNotice('Your experience is saved.');
  }catch(e){setNotice((e as Error).message)}finally{setSaving(false)}
 }
 const set=<K extends keyof Experience>(key:K,value:Experience[K])=>setExperience(current=>({...current,[key]:value}));
 return <article className="detail wine-detail shared-wine-detail">
  <Link className="back-pill" to="/journal">← Journal</Link>
  <section className="wine-identity">
   {photo?<div className="detail-gallery" aria-label={`${wine.wineName} photos`}>{wine.photos!.map((item,index)=><span className="detail-photo-slot" key={item.id}><img src={item.url} alt={`${wine.producer} ${wine.wineName} photo ${index+1}`} className="detail-photo"/></span>)}</div>:<div className="detail-bottle">{wine.wineStyle?.slice(0,1).toUpperCase()||'W'}</div>}
   <p className="eyebrow">{wine.vintage??'NON-VINTAGE'} · {wine.wineStyle??'WINE'}</p>
   <h1>{wine.wineName}</h1><h2>{wine.producer}</h2>
   <div className="detail-favorite-row">
    <button type="button" className={`detail-favorite-button${favorite?' active':''}`} aria-pressed={favorite} onClick={()=>void toggleFavorite()} disabled={favoriteBusy}><span className="heart" aria-hidden="true"><AppIcon kind={favorite?'heart-filled':'heart'}/></span>{favorite?'Favorite':'Add to favorites'}</button>
    <a className="detail-wine-searcher-link" href={wineSearcherUrl(wine)} target="_blank" rel="noopener noreferrer">Find on Wine-Searcher <span aria-hidden="true">↗</span></a>
   </div>
   <div className="detail-pills">{wine.appellation&&<span>{wine.appellation}</span>}{wine.grapes.map(grape=><span key={grape}>{grape}</span>)}</div>
  </section>
  <div className="shared-origin" role="note"><span aria-hidden="true">↗</span><span>Shared by <strong>{wine.ownerName}</strong></span></div>
  <section className="detail-section"><p className="section-label">Wine details</p><dl>{[['Region',[wine.region,wine.country].filter(Boolean).join(', ')],['Appellation',wine.appellation],['Grapes / blend',wine.grapes.join(', ')]].filter(([,value])=>Boolean(value)).map(([key,value])=><div key={String(key)}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></section>
  <section className="detail-section experience-panel shared-experience"><p className="section-label">Your experience</p>
   <p className="shared-experience-hint">This is your own private experience of the wine. Your friend's tasting details are not copied here.</p>
   <label>Tasting notes<textarea value={experience.tastingNotes} onChange={event=>set('tastingNotes',event.target.value)} placeholder="What did you notice?"/></label>
   <div className="shared-experience-grid">
    <label>Score<input type="number" min="0" max="100" value={experience.rating??''} onChange={event=>set('rating',event.target.value===''?null:Number(event.target.value))}/></label>
    <label>Drinking date<input type="date" value={experience.tastingDate??''} onChange={event=>set('tastingDate',event.target.value||null)}/></label>
    <label>Tasting / event<input value={experience.tastingName??''} onChange={event=>set('tastingName',event.target.value||null)}/></label>
    <label>Venue<input value={experience.venue??''} onChange={event=>set('venue',event.target.value||null)}/></label>
    <label>Location<input value={experience.locationName??''} onChange={event=>set('locationName',event.target.value||null)}/></label>
    <label>Price<input type="number" min="0" step="0.01" value={experience.price??''} onChange={event=>set('price',event.target.value===''?null:Number(event.target.value))}/></label>
    <label>Currency<input value={experience.currency??''} maxLength={8} onChange={event=>set('currency',event.target.value.toUpperCase()||null)} placeholder="HKD"/></label>
   </div>
   <button type="button" className="primary" disabled={saving} onClick={()=>void saveExperience()}>{saving?'Saving…':'Save your experience'}</button>
   {notice&&<p role="status">{notice}</p>}
  </section>
 </article>;
}

export function SharedWinesPage(){
 const {id}=useParams(),[items,setItems]=useState<SharedWine[]>([]),[error,setError]=useState(''),[offset,setOffset]=useState<number|null>(0);
 useEffect(()=>{let active=true;const refresh=async()=>{try{if(id){const item=await apiJson<SharedWine>(`/api/shared/wines/${id}`);if(active)setItems([item])}else{const result=await apiJson<{items:SharedWine[];nextOffset:number|null}>('/api/shared/wines');if(active){setItems(result.items);setOffset(result.nextOffset)}}}catch(e){if(active){setItems([]);setError((e as Error).message)}}};void refresh();const focus=()=>void refresh();window.addEventListener('focus',focus);return()=>{active=false;window.removeEventListener('focus',focus)}},[id]);
 async function more(){try{const result=await apiJson<{items:SharedWine[];nextOffset:number|null}>(`/api/shared/wines?offset=${offset}`);setItems([...items,...result.items]);setOffset(result.nextOffset)}catch(e){setError((e as Error).message)}}
 if(id){if(error)return <p role="alert">{error}</p>;if(!items[0])return <p aria-live="polite">Loading wine…</p>;return <SharedWineDetail wine={items[0]} onSaved={experience=>setItems(current=>current.map(item=>item.id===id?{...item,experience}:item))}/>}
 return <section className="account-page"><h1>Shared wine</h1>{error&&<p role="alert">{error}</p>}{!items.length&&!error&&<p>Wines your friends choose to share will appear in your Journal.</p>}{items.map(wine=><article key={wine.id}><h2><Link to={`/shared/${wine.id}`}>{wine.producer} · {wine.wineName} {wine.vintage??'NV'}</Link></h2></article>)}{offset!==null&&<button onClick={()=>void more()}>Load more</button>}</section>;
}
