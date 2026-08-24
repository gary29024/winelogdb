import { useEffect,useMemo,useState } from 'react';
import { Link } from 'react-router-dom';
import { AchievementIcon } from './AchievementIcon';
import { getAchievementProgress } from './api';
import type { AchievementProgress } from './types';
import '../../achievements.css';

const categoryLabel:Record<AchievementProgress['definition']['category'],string>={
  'iconic-estates':'Iconic estates','historic-tastings':'Historic tasting','regional-exploration':'Regional explorer','guide-selections':'Guide selection'
};

export function AchievementsPage(){
  const [collections,setCollections]=useState<AchievementProgress[]|null>(null),[error,setError]=useState('');
  useEffect(()=>{let active=true;getAchievementProgress().then(result=>{if(active)setCollections(result)}).catch(e=>{if(active)setError((e as Error).message)});return()=>{active=false}},[]);
  const summary=useMemo(()=>collections?{
    complete:collections.filter(item=>item.complete).length,
    active:collections.filter(item=>item.completed>0&&!item.complete).length,
    possible:collections.reduce((sum,item)=>sum+item.possible,0)
  }:null,[collections]);
  if(error)return <section className="achievements-page"><p role="alert">{error}</p></section>;
  if(!collections||!summary)return <section className="achievements-page"><p aria-live="polite">Checking your collection stamps…</p></section>;

  return <section className="achievements-page">
    <header className="achievements-hero">
      <div><p className="achievements-eyebrow">ACHIEVEMENTS</p><h1>Wine Collections</h1><p>Iconic estates, historic tastings and regions to explore. Every collection updates automatically from your journal.</p></div>
      <div className="achievements-summary" aria-label="Collection progress"><span><strong>{summary.complete}</strong><small>Complete</small></span><span><strong>{summary.active}</strong><small>In progress</small></span><span><strong>{collections.length}</strong><small>Collections</small></span></div>
    </header>

    {summary.possible>0&&<aside className="achievements-repair-note"><strong>{summary.possible} possible {summary.possible===1?'match':'matches'}</strong><span>Older tastings may need identity linking before they can count as completed checklist items.</span></aside>}

    <div className="collection-grid">{collections.map(collection=>{
      const {definition}=collection;
      return <Link className={`collection-card${collection.complete?' collection-card-complete':''}`} to={`/achievements/${definition.id}`} key={definition.id}>
        <div className="collection-card-top"><span className={`collection-icon collection-icon-${definition.icon}`}><AchievementIcon kind={definition.icon}/></span><span className="collection-category">{definition.series?.authority||categoryLabel[definition.category]}</span></div>
        <div className="collection-card-copy"><h2>{definition.title}</h2><p>{definition.subtitle}</p></div>
        <div className="collection-card-progress">
          <div><strong>{collection.completed}<span> / {collection.total}</span></strong><small>{collection.complete?'Completed':'tasted'}</small></div>
          <span className="collection-percent">{collection.percent}%</span>
        </div>
        <div className="collection-progress-bar" aria-label={`${collection.completed} of ${collection.total} completed`}><span style={{width:`${collection.percent}%`}}/></div>
        <div className="collection-card-foot"><span>{collection.complete?'Stamp earned':collection.possible?`${collection.possible} need linking`:'View checklist'}</span><b aria-hidden="true">›</b></div>
      </Link>;
    })}</div>
  </section>;
}
