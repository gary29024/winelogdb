import { useEffect,useState } from 'react';
import { Link,useParams } from 'react-router-dom';
import { AchievementIcon } from './AchievementIcon';
import { getAchievementProgress } from './api';
import type { AchievementProgress } from './types';
import '../../achievements.css';

function statusCopy(status:AchievementProgress['items'][number]['status']){
  if(status==='tasted')return 'Tasted';
  if(status==='possible')return 'Needs linking';
  return 'Not tasted';
}

export function AchievementDetailPage(){
  const {id}=useParams(),[collection,setCollection]=useState<AchievementProgress|null|undefined>(undefined),[error,setError]=useState('');
  useEffect(()=>{let active=true;getAchievementProgress().then(result=>{if(active)setCollection(result.find(item=>item.definition.id===id)??null)}).catch(e=>{if(active)setError((e as Error).message)});return()=>{active=false}},[id]);
  if(error)return <section className="achievements-page"><p role="alert">{error}</p></section>;
  if(collection===undefined)return <section className="achievements-page"><p aria-live="polite">Opening collection…</p></section>;
  if(!collection)return <section className="achievements-page"><Link className="achievement-back" to="/achievements">‹ Wine Collections</Link><h1>Collection not found</h1></section>;
  const {definition}=collection;
  return <section className="achievements-page achievement-detail-page">
    <Link className="achievement-back" to="/achievements">‹ Wine Collections</Link>
    <header className="achievement-detail-hero">
      <span className={`collection-icon achievement-detail-icon collection-icon-${definition.icon}`}><AchievementIcon kind={definition.icon}/></span>
      <div className="achievement-detail-title"><p className="achievements-eyebrow">{definition.series?`${definition.series.authority} · ${definition.series.region} · ${definition.series.edition}`:'COLLECTION'}</p><h1>{definition.title}</h1><p>{definition.subtitle}</p></div>
      <div className="achievement-detail-score"><strong>{collection.completed}<span>/{collection.total}</span></strong><small>{collection.complete?'Stamp earned':'tasted'}</small></div>
    </header>

    <section className="achievement-detail-progress">
      <div className="collection-progress-bar"><span style={{width:`${collection.percent}%`}}/></div>
      <div><span>{collection.percent}% complete</span>{collection.possible>0&&<span>{collection.possible} possible {collection.possible===1?'match':'matches'} need linking</span>}</div>
    </section>

    <section className="achievement-checklist-card">
      <div className="achievement-checklist-heading"><div><p className="achievements-eyebrow">CHECKLIST</p><h2>{collection.total} targets</h2></div><span>{collection.pending} remaining</span></div>
      <div className="achievement-checklist">{collection.items.map(item=>{
        const firstWine=item.tastedWineIds[0];
        return <article className={`achievement-check-row achievement-check-${item.status}`} key={item.id}>
          <span className="achievement-check-mark" aria-hidden="true">{item.status==='tasted'?'✓':item.status==='possible'?'?':'○'}</span>
          <div className="achievement-check-copy"><strong>{item.label}</strong>{item.note&&<small>{item.note}</small>}{item.tastedVintages.length>0&&<small>Tasted vintages: {item.tastedVintages.join(', ')}</small>}</div>
          <div className="achievement-check-status"><span>{statusCopy(item.status)}</span>{firstWine&&<Link to={`/wines/${firstWine}`}>{item.status==='possible'?'Review':'View tasting'}</Link>}</div>
        </article>;
      })}</div>
    </section>

    {definition.references.length>0&&<section className="achievement-reference-card"><p className="achievements-eyebrow">COLLECTION SOURCES</p><h2>Definition references</h2><p>These sources define the membership of this collection; they do not determine whether your tasting matches.</p><div>{definition.references.map(reference=><a key={reference.url} href={reference.url} target="_blank" rel="noreferrer">{reference.title}<span aria-hidden="true">↗</span></a>)}</div></section>}
  </section>;
}
