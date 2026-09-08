import { useEffect,useState } from 'react';
import { Link,useParams } from 'react-router-dom';
import { apiJson } from '../../lib/auth/api';
import type { SharedWine } from '../../lib/wine/shared';
export function SharedWinesPage(){
 const {id}=useParams(),[items,setItems]=useState<SharedWine[]>([]),[error,setError]=useState(''),[offset,setOffset]=useState<number|null>(0);
 useEffect(()=>{let active=true;const refresh=async()=>{try{if(id){const item=await apiJson<SharedWine>(`/api/shared/wines/${id}`);if(active)setItems([item])}else{const result=await apiJson<{items:SharedWine[];nextOffset:number|null}>('/api/shared/wines');if(active){setItems(result.items);setOffset(result.nextOffset)}}}catch(e){if(active){setItems([]);setError((e as Error).message)}}};void refresh();const focus=()=>void refresh();window.addEventListener('focus',focus);return()=>{active=false;window.removeEventListener('focus',focus)}},[id]);
 async function more(){try{const result=await apiJson<{items:SharedWine[];nextOffset:number|null}>(`/api/shared/wines?offset=${offset}`);setItems([...items,...result.items]);setOffset(result.nextOffset)}catch(e){setError((e as Error).message)}}
 return <section className="account-page"><h1>Shared with me</h1>{id&&<Link to="/shared">← All shared wines</Link>}{error&&<p role="alert">{error}</p>}{!items.length&&!error&&<p>Wines your friends choose to share will appear here.</p>}{items.map(wine=><article key={wine.id}><p>Shared by {wine.ownerName}</p><h2><Link to={`/shared/${wine.id}`}>{wine.producer} · {wine.wineName} {wine.vintage??'NV'}</Link></h2><p>{wine.tastingDate}{wine.rating!==null?` · Rating ${wine.rating}`:''}</p><p className="shared-notes">{wine.tastingNotes}</p>{wine.photos?.map(photo=><img className="shared-photo" key={photo.id} src={photo.url} alt={`${wine.producer} ${wine.wineName}`}/>)}</article>)}{!id&&offset!==null&&<button onClick={()=>void more()}>Load more</button>}</section>;
}
