import { useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import { AppIcon } from '../../components/AppIcons';
import { listTastings,type TastingSummary } from './api';
import '../../tastings.css';

const isOpen=(tasting:TastingSummary)=>Boolean(tasting.startedAt&&!tasting.endedAt);
const dateLabel=(value:string|null)=>{
  if(!value)return 'No date';
  const parsed=new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())?value:parsed.toLocaleDateString('en-US',{day:'numeric',month:'short',year:'numeric'});
};

/**
 * Every evening, the open one first.
 *
 * Counts and mean scores are aggregated in SQL, so this page never loads a
 * lineup - only the tasting you open does.
 */
export function TastingsPage(){
  const [items,setItems]=useState<TastingSummary[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');

  useEffect(()=>{
    let active=true;
    listTastings().then(({items:next})=>{if(active)setItems(next)}).catch(e=>{if(active)setError((e as Error).message)}).finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[]);

  return <section className="tastings-page">
    <div className="hero compact"><p className="eyebrow">TASTINGS</p><h1>Every evening, kept together.</h1><p>Start a tasting from Scan Wine and each wine you log joins it, with the name, date and venue already filled in.</p></div>
    {loading?<p aria-live="polite">Loading tastings…</p>
      :error?<p role="alert">{error}</p>
      :items.length?<ul className="tasting-list">{items.map(tasting=>
        <li key={tasting.id}><Link className={`tasting-row${isOpen(tasting)?' is-open':''}`} to={`/tastings/${tasting.id}`}>
          <span className="tasting-row-name">{tasting.name}{isOpen(tasting)&&<em className="tasting-open-tag">In progress</em>}</span>
          <small>{[dateLabel(tasting.tastingDate),tasting.venue].filter(Boolean).join(' · ')}</small>
          <span className="tasting-row-stats">{tasting.wineCount} wine{tasting.wineCount===1?'':'s'}{tasting.averageRating!=null?` · ${tasting.averageRating.toFixed(1)} avg`:''}</span>
        </Link></li>)}</ul>
      :<div className="empty"><span><AppIcon kind="tasting"/></span><h2>No tastings yet</h2><p>Tap Scan Wine and choose Start Tasting when you sit down at the next one.</p></div>}
  </section>;
}
