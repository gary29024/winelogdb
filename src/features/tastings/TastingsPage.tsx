import { useEffect,useMemo,useState } from 'react';
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

/** The month an evening belongs to, from its own date rather than when the row was made. */
const monthKey=(tasting:TastingSummary)=>(tasting.tastingDate||tasting.createdAt).slice(0,7);
const monthLabel=(key:string)=>{
  const [year,month]=key.split('-').map(Number);
  return new Date(year,month-1,1).toLocaleDateString('en-US',{month:'short',year:'numeric'});
};

/**
 * Every evening, grouped by month like the journal.
 *
 * Sorted here rather than taken as the server sends it. listTastings pins the
 * open tasting to the very top, which is right for a flat list and wrong for a
 * grouped one: reopen an evening from last month and it would head the list
 * under this month's heading, or split its own month into two runs. So the
 * order is date-descending, and the open tasting leads only the month it
 * actually belongs to - it is still marked "In progress" and still carried by
 * the live strip on every screen, so nothing is lost by not pinning it.
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

  const months=useMemo(()=>{
    const sortKey=(tasting:TastingSummary)=>tasting.tastingDate||tasting.createdAt;
    const sorted=[...items].sort((a,b)=>
      sortKey(b).localeCompare(sortKey(a))||(isOpen(b)?1:0)-(isOpen(a)?1:0));
    return sorted.reduce<Array<{key:string;items:TastingSummary[]}>>((groups,tasting)=>{
      const key=monthKey(tasting),last=groups[groups.length-1];
      if(last?.key===key)last.items.push(tasting);else groups.push({key,items:[tasting]});
      return groups;
    },[]);
  },[items]);

  const row=(tasting:TastingSummary)=>
    <li key={tasting.id}><Link className={`tasting-row${isOpen(tasting)?' is-open':''}`} to={`/tastings/${tasting.id}`}>
      <span className="tasting-row-name">{tasting.name}{isOpen(tasting)&&<em className="tasting-open-tag">In progress</em>}</span>
      <small>{[dateLabel(tasting.tastingDate),tasting.venue].filter(Boolean).join(' · ')}</small>
      <span className="tasting-row-stats">{tasting.wineCount} wine{tasting.wineCount===1?'':'s'}{tasting.averageRating!=null?` · ${tasting.averageRating.toFixed(1)} avg`:''}</span>
    </Link></li>;

  return <section className="tastings-page">
    <div className="hero compact"><p className="eyebrow">TASTINGS</p><h1>Every evening, kept together.</h1><p>Start a tasting from Scan Wine and each wine you log joins it, with the name, date and venue already filled in.</p></div>
    {loading?<p aria-live="polite">Loading tastings…</p>
      :error?<p role="alert">{error}</p>
      :months.length?<div className="tasting-months">{months.map(group=>
        <section className="tasting-month" key={group.key}>
          <h2 className="tasting-month-heading">{monthLabel(group.key)}</h2>
          <ul className="tasting-list">{group.items.map(row)}</ul>
        </section>)}</div>
      :<div className="empty"><span><AppIcon kind="tasting"/></span><h2>No tastings yet</h2><p>Tap Scan Wine and choose Start Tasting when you sit down at the next one.</p></div>}
  </section>;
}
