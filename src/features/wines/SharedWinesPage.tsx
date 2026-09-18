import { useEffect,useMemo,useState,type FormEvent } from 'react';
import { Link,useLocation,useParams } from 'react-router-dom';
import { apiJson } from '../../lib/auth/api';
import type { SharedWine,SharedWineExperience } from '../../lib/wine/shared';
import { setWineFavorite } from './api';
import { AppIcon } from '../../components/AppIcons';
import { backTargetFromState,JOURNAL_BACK } from './backTarget';
import { formatDate,formatPrice,formatRating } from '../../lib/wine/detailFormat';
import '../../favorites.css';
// The gallery and lightbox markup below is the wine-detail one, and its rules
// live in wineImages.css. This page never renders <WineImage>, and it is in the
// entry bundle while every other importer of that stylesheet is a lazy route,
// so without this import a cold /shared/:id load has no rules for either.
import '../../wineImages.css';
import '../../sharedWine.css';

const classificationLabel:Record<string,string>={grand_cru:'Grand Cru',premier_cru:'Premier Cru',village:'Village'};
const wineSearcherUrl=(producer:string,wineName:string,vintage:number|null)=>`https://www.wine-searcher.com/find/${encodeURIComponent([producer,wineName,vintage??''].filter(Boolean).join(' ')).replace(/%20/g,'+')}`;
type Draft={tastingDate:string;rating:string;tastingName:string;venue:string;locationName:string;currency:string;price:string;tastingNotes:string};
const draftFromWine=(wine:SharedWine):Draft=>({
 tastingDate:wine.tastingDate??'',rating:wine.rating==null?'':String(wine.rating),tastingName:wine.tastingName??'',
 venue:wine.venue??'',locationName:wine.locationName??'',currency:wine.currency??'',price:wine.price==null?'':String(wine.price),tastingNotes:wine.tastingNotes
});

export function SharedWinesPage(){
 const {id=''}=useParams(),{state}=useLocation(),[wine,setWine]=useState<SharedWine>(),[error,setError]=useState(''),[favoriteError,setFavoriteError]=useState(''),[editing,setEditing]=useState(false),[saving,setSaving]=useState(false),[notice,setNotice]=useState(''),[favoriteBusy,setFavoriteBusy]=useState(false),[selectedPhoto,setSelectedPhoto]=useState<string>(),[draft,setDraft]=useState<Draft>({tastingDate:'',rating:'',tastingName:'',venue:'',locationName:'',currency:'',price:'',tastingNotes:''});
 const back=useMemo(()=>backTargetFromState(state)??JOURNAL_BACK,[state]);

 useEffect(()=>{let active=true;setError('');setFavoriteError('');setNotice('');apiJson<SharedWine>(`/api/shared/wines/${id}`).then(item=>{if(active){setWine(item);setDraft(draftFromWine(item))}}).catch(e=>{if(active)setError((e as Error).message)});return()=>{active=false}},[id]);

 // A save confirmation that never leaves stops meaning anything, and on a long
 // detail page it is also the only thing still moving. Retire it on its own.
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4000);return()=>clearTimeout(timer)},[notice]);

 async function toggleFavorite(){
  if(!wine||favoriteBusy)return;const next=!wine.favorite;setFavoriteBusy(true);setWine({...wine,favorite:next});setFavoriteError('');
  try{await setWineFavorite(wine.id,next)}
  catch(e){setWine(current=>current?{...current,favorite:!next}:current);setFavoriteError((e as Error).message)}
  finally{setFavoriteBusy(false)}
 }
 function edit(){if(!wine)return;setDraft(draftFromWine(wine));setError('');setNotice('');setEditing(true)}
 async function saveExperience(event:FormEvent){
  event.preventDefault();if(!wine||saving)return;setSaving(true);setError('');setNotice('');
  const experience:SharedWineExperience={
   tastingDate:draft.tastingDate||null,
   rating:draft.rating.trim()?Number(draft.rating):null,
   tastingName:draft.tastingName.trim()||null,
   venue:draft.venue.trim()||null,
   locationName:draft.locationName.trim()||null,
   currency:draft.currency.trim()?draft.currency.trim().toUpperCase():null,
   price:draft.price.trim()?Number(draft.price):null,
   tastingNotes:draft.tastingNotes.trim()
  };
  try{
   await apiJson(`/api/shared/wines/${wine.id}/experience`,'PUT',experience);
   setWine(current=>current?{...current,...experience}:current);setDraft(current=>({...current,currency:experience.currency??''}));setEditing(false);setNotice('Your experience was saved.');
  }catch(e){setError((e as Error).message)}
  finally{setSaving(false)}
 }

 if(error&&!wine)return <section className="detail wine-detail"><Link className="back-pill" to={back.to}>← {back.label}</Link><p role="alert">{error}</p></section>;
 if(!wine)return <p aria-live="polite">Loading wine…</p>;

 const place=[wine.region,wine.country].filter(Boolean).join(', '),price=formatPrice(wine.price,wine.currency);
 // The score is the viewer's own, so it belongs with the rest of their experience
 // rather than in the pills, where it would read as a property of the wine.
 const experienceRows:[string,string][]=([
  ['Your rating',formatRating(wine.rating)],['Drinking date',formatDate(wine.tastingDate)],['Tasting / event',wine.tastingName],['Venue',wine.venue],['Location',wine.locationName],['Price',price]
 ] as [string,string|null][]).filter((row):row is [string,string]=>Boolean(row[1]));
 const hasExperience=Boolean(wine.tastingDate||wine.tastingName||wine.venue||wine.locationName||wine.price!=null||wine.rating!=null||wine.tastingNotes);
 return <article className="detail wine-detail shared-wine-detail">
  <Link className="back-pill" to={back.to}>← {back.label}</Link>
  <section className="wine-identity">
   {wine.photos?.length?<div className="detail-gallery" aria-label={`${wine.wineName} photos`}>{wine.photos.map((photo,index)=><span className="detail-photo-slot" key={photo.id}><button type="button" className="detail-photo-button" onClick={()=>setSelectedPhoto(photo.url)} aria-label={`Open photo ${index+1} of ${wine.photos!.length}`}><img src={photo.url} alt={`${wine.producer} ${wine.wineName} photo ${index+1}`} className="detail-photo" loading="lazy" decoding="async"/></button></span>)}</div>:<div className="detail-bottle">{wine.wineStyle?.slice(0,1).toUpperCase()||'W'}</div>}
   <p className="eyebrow">{wine.vintage??'NON-VINTAGE'} · {wine.wineStyle??'WINE'}</p><h1>{wine.wineName}</h1><h2>{wine.producer}</h2>
   <div className="detail-favorite-row"><button type="button" className={`detail-favorite-button${wine.favorite?' active':''}`} aria-pressed={wine.favorite} onClick={()=>void toggleFavorite()} disabled={favoriteBusy}><span className="heart" aria-hidden="true"><AppIcon kind={wine.favorite?'heart-filled':'heart'}/></span>{wine.favorite?'Favorite':'Add to favorites'}</button><a className="detail-wine-searcher-link" href={wineSearcherUrl(wine.producer,wine.wineName,wine.vintage)} target="_blank" rel="noopener noreferrer">Find on Wine-Searcher <span aria-hidden="true">↗</span></a>{favoriteError&&<span className="shared-favorite-error" role="alert">{favoriteError}</span>}</div>
   <div className="detail-pills">{wine.appellation&&<span>{wine.appellation}</span>}{wine.classification&&<span className={`detail-classification detail-classification-${wine.classification}`}>{classificationLabel[wine.classification]}</span>}{wine.grapes.map(grape=><span key={grape}>{grape}</span>)}</div>
  </section>
  <div className="shared-source-indicator" role="note"><span>Shared by</span><strong>{wine.ownerName}</strong></div>
  <section className="detail-section"><p className="section-label">Wine details</p><dl className="detail-facts">{[['Region',place],['Appellation',wine.appellation],['Grapes / blend',wine.grapes.join(', ')],['Alcohol',wine.alcoholPercentage!=null?`${wine.alcoholPercentage}%`:'']].filter(([,value])=>Boolean(value)).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
  <section className="detail-section experience-panel">
   <p className="section-label">Your experience</p>
   {!editing?<>{experienceRows.length>0&&<dl className="detail-facts shared-experience-summary">{experienceRows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}{wine.tastingNotes?<blockquote className="detail-experience-notes">{wine.tastingNotes}</blockquote>:null}<button type="button" className="shared-experience-edit" onClick={edit}>{hasExperience?'Edit your experience':'Add your experience'}</button></>:<form className="shared-experience-form" onSubmit={saveExperience}>
    <label>Drinking date<input type="date" value={draft.tastingDate} onChange={e=>setDraft({...draft,tastingDate:e.target.value})}/></label>
    <label>Rating / 100<input type="number" min="0" max="100" step="0.5" value={draft.rating} onChange={e=>setDraft({...draft,rating:e.target.value})}/></label>
    <label>Tasting / event<input type="text" maxLength={500} value={draft.tastingName} onChange={e=>setDraft({...draft,tastingName:e.target.value})}/></label>
    <label>Venue<input type="text" maxLength={500} value={draft.venue} onChange={e=>setDraft({...draft,venue:e.target.value})}/></label>
    <label>Location<input type="text" maxLength={500} value={draft.locationName} onChange={e=>setDraft({...draft,locationName:e.target.value})}/></label>
    <label>Price<div className="shared-price-input"><input type="text" inputMode="text" maxLength={3} placeholder="HKD" aria-label="Currency" value={draft.currency} onChange={e=>setDraft({...draft,currency:e.target.value})}/><input type="number" min="0" step="0.01" placeholder="0" aria-label="Price" value={draft.price} onChange={e=>setDraft({...draft,price:e.target.value})}/></div></label>
    <label className="shared-experience-full">Sensory notes<textarea rows={4} maxLength={10000} value={draft.tastingNotes} onChange={e=>setDraft({...draft,tastingNotes:e.target.value})}/></label>
    <div className="shared-experience-actions shared-experience-full"><button type="button" className="quiet" disabled={saving} onClick={()=>{setEditing(false);setDraft(draftFromWine(wine))}}>Cancel</button><button type="submit" className="primary" disabled={saving}>{saving?'Saving…':'Save experience'}</button></div>
   </form>}
   {notice&&<p className="shared-experience-notice" role="status">{notice}</p>}{error&&<p className="shared-experience-error" role="alert">{error}</p>}
  </section>
  {selectedPhoto&&<div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Wine photo viewer" onClick={()=>setSelectedPhoto(undefined)}><button type="button" className="lightbox-close" aria-label="Close photo" onClick={()=>setSelectedPhoto(undefined)}>×</button><div className="lightbox-image-wrap" onClick={e=>e.stopPropagation()}><img src={selectedPhoto} alt={`${wine.producer} ${wine.wineName} full-resolution shared photo`} className="lightbox-image"/></div></div>}
 </article>;
}
