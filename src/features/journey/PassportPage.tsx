import { useEffect,useMemo,useState } from 'react';
import { Link } from 'react-router-dom';
import { getJourneyData,type JourneyData } from './api';
import { nextMilestones,unlockedAchievements } from './model';
import '../../journey.css';

const journalHref=(params:Record<string,string>)=>`/?${new URLSearchParams(params).toString()}`;
const rating=(value:number|null)=>value==null?'—':value.toFixed(1);

export function PassportPage(){
  const [data,setData]=useState<JourneyData|null>(null),[error,setError]=useState('');
  useEffect(()=>{let active=true;getJourneyData().then(result=>{if(active)setData(result)}).catch(e=>{if(active)setError((e as Error).message)});return()=>{active=false}},[]);
  const milestones=useMemo(()=>data?nextMilestones(data.summary):[],[data]);
  const achievements=useMemo(()=>data?unlockedAchievements(data.summary):[],[data]);
  if(error)return <section className="journey-page"><p role="alert">{error}</p></section>;
  if(!data)return <section className="journey-page"><p aria-live="polite">Stamping your Wine Passport…</p></section>;
  const {summary}=data;
  return <section className="journey-page passport-page">
    <div className="hero compact journey-hero"><p className="eyebrow">WINE PASSPORT</p><h1>Your world of wine.</h1><p>See how far your tastings have taken you and what is left to explore.</p></div>

    <div className="journey-stat-grid">
      <article><strong>{summary.totalWines}</strong><span>Wines</span></article>
      <article><strong>{summary.producers}</strong><span>Producers</span></article>
      <article><strong>{summary.appellations}</strong><span>Appellations</span></article>
      <article><strong>{summary.countries}</strong><span>Countries</span></article>
    </div>

    <section className="journey-card"><div className="journey-section-heading"><div><p className="section-label">ACHIEVEMENTS</p><h2>Milestones reached</h2></div><span>{achievements.length}</span></div>
      {achievements.length?<div className="achievement-grid">{achievements.map(item=><article key={item.key}><span className="achievement-mark">◆</span><div><strong>{item.value}</strong><small>{item.label}</small></div></article>)}</div>:<p className="journey-muted">Your first achievements unlock as your journal grows. Ten logged wines is the first milestone.</p>}
    </section>

    <section className="journey-card"><div className="journey-section-heading"><div><p className="section-label">NEXT STAMPS</p><h2>What’s within reach</h2></div></div>
      <div className="milestone-list">{milestones.map(item=><div className="milestone-row" key={item.key}><div><strong>{item.label}</strong><span>{item.current} / {item.target}</span></div><div className="journey-progress"><span style={{width:`${Math.round(item.progress*100)}%`}}/></div></div>)}</div>
    </section>

    <section className="journey-card"><div className="journey-section-heading"><div><p className="section-label">COUNTRIES</p><h2>Countries explored</h2></div><span>{summary.countries}</span></div>
      {data.countries.length?<div className="exploration-list">{data.countries.map(item=><Link to={journalHref({country:item.country})} key={item.country}><div><strong>{item.country}</strong><small>{item.producers} producers · {item.appellations} appellations</small></div><div className="exploration-number"><strong>{item.wines}</strong><small>{item.averageRating==null?'wines':`${rating(item.averageRating)} avg`}</small></div></Link>)}</div>:<p className="journey-muted">Country information will appear as you log identified wines.</p>}
    </section>

    <div className="journey-two-column">
      <section className="journey-card"><div className="journey-section-heading"><div><p className="section-label">REGIONS</p><h2>Most explored</h2></div><span>{summary.regions}</span></div>
        <div className="compact-rank-list">{data.regions.slice(0,10).map(item=><Link to={journalHref({query:item.region})} key={`${item.country}-${item.region}`}><div><strong>{item.region}</strong><small>{item.country||'Region'} · {item.producers} producers</small></div><span>{item.wines}</span></Link>)}</div>
      </section>
      <section className="journey-card"><div className="journey-section-heading"><div><p className="section-label">APPELLATIONS</p><h2>Most tasted</h2></div><span>{summary.appellations}</span></div>
        <div className="compact-rank-list">{data.appellations.slice(0,10).map(item=><Link to={journalHref({query:item.appellation})} key={`${item.country}-${item.region}-${item.appellation}`}><div><strong>{item.appellation}</strong><small>{[item.region,item.country].filter(Boolean).join(' · ')||'Appellation'}</small></div><span>{item.wines}</span></Link>)}</div>
      </section>
    </div>

    <section className="journey-card"><div className="journey-section-heading"><div><p className="section-label">STYLES</p><h2>Your tasting spectrum</h2></div></div>
      <div className="style-coverage">{data.styles.map(item=><Link to={journalHref({style:item.style})} key={item.style}><strong>{item.wines}</strong><span>{item.style}</span></Link>)}</div>
    </section>
  </section>;
}
