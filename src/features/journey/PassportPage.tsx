import { useEffect,useMemo,useState } from 'react';
import { Link } from 'react-router-dom';
import { getJourneyData,type JourneyData } from './api';
import { nextMilestones,unlockedAchievements,type MilestoneKey } from './model';
import '../../journey.css';

const journalHref=(params:Record<string,string>)=>`/journal?${new URLSearchParams(params).toString()}`;
const rating=(value:number|null)=>value==null?'—':value.toFixed(1);
const achievementIcon:Record<MilestoneKey,string>={totalWines:'◇',producers:'⌂',appellations:'✦',countries:'◎',structuredTastings:'✓'};

export function PassportPage(){
  const [data,setData]=useState<JourneyData|null>(null),[error,setError]=useState('');
  useEffect(()=>{let active=true;getJourneyData().then(result=>{if(active)setData(result)}).catch(e=>{if(active)setError((e as Error).message)});return()=>{active=false}},[]);
  const milestones=useMemo(()=>data?nextMilestones(data.summary):[],[data]);
  const achievements=useMemo(()=>data?unlockedAchievements(data.summary):[],[data]);
  if(error)return <section className="journey-page"><p role="alert">{error}</p></section>;
  if(!data)return <section className="journey-page"><p aria-live="polite">Stamping your Wine Passport…</p></section>;

  const {summary}=data;
  const wineMilestone=milestones.find(item=>item.key==='totalWines')??milestones[0];
  const progressPercent=Math.round((wineMilestone?.progress??0)*100);
  const remaining=Math.max(0,(wineMilestone?.target??summary.totalWines)-summary.totalWines);
  const topRegion=data.regions[0];
  const summaryStats=[
    {icon:'◇',value:summary.totalWines,label:'Wines tasted',detail:`${summary.vintages} vintages`},
    {icon:'◎',value:summary.regions,label:'Regions explored',detail:`${summary.countries} countries`},
    {icon:'⌂',value:summary.producers,label:'Producers logged',detail:`${summary.favorites} favourites`},
    {icon:'✦',value:summary.appellations,label:'Appellations',detail:`${summary.structuredTastings} structured`}
  ];

  return <section className="journey-page passport-page">
    <header className="passport-intro">
      <p className="eyebrow">WINE PASSPORT</p>
      <h1>Passport</h1>
      <p>Your tasting journey at a glance.</p>
    </header>

    <section className="passport-summary-card" aria-labelledby="passport-summary-heading">
      <div className="passport-summary-copy">
        <p className="section-label" id="passport-summary-heading">PASSPORT SUMMARY</p>
        <div className="passport-stat-grid">
          {summaryStats.map(item=><article key={item.label}>
            <span className="passport-stat-icon" aria-hidden="true">{item.icon}</span>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
            <small>{item.detail}</small>
          </article>)}
        </div>
      </div>
      <aside className="passport-stamp-panel" aria-label="WineLog passport highlight">
        <div className="passport-emblem" aria-hidden="true"><span>W</span><small>WINELOG</small></div>
        <div className="passport-highlight">
          <span>{topRegion?'Most explored':'Keep exploring'}</span>
          <strong>{topRegion?.region??'Your wine world'}</strong>
          <small>{topRegion?[topRegion.country,`${topRegion.wines} wines`].filter(Boolean).join(' · '):'Every bottle adds another stamp.'}</small>
        </div>
      </aside>
    </section>

    <section className="passport-progress-card">
      <div className="passport-progress-ring" role="img" aria-label={`${progressPercent}% progress to the next wine milestone`} style={{background:`conic-gradient(#10182d ${progressPercent}%,#e8ecf2 0)`}}><span>{progressPercent}%</span></div>
      <div className="passport-progress-copy">
        <p className="section-label">YOUR WINE JOURNEY</p>
        <h2>{remaining?`${remaining} wines to your next stamp`:'Next stamp unlocked'}</h2>
        <p>{wineMilestone?`${summary.totalWines} / ${wineMilestone.target} wines logged`:`${summary.totalWines} wines logged`}</p>
        <div className="passport-progress-line" aria-hidden="true"><span style={{width:`${progressPercent}%`}}/></div>
      </div>
      <Link className="passport-soft-link" to="/journal">View journal</Link>
    </section>

    <div className="passport-dashboard-grid">
      <section className="journey-card passport-rank-card">
        <div className="journey-section-heading"><div><p className="section-label">TOP REGIONS</p><h2>Most explored</h2></div><span>{summary.regions}</span></div>
        {data.regions.length?<div className="passport-rank-list">{data.regions.slice(0,5).map((item,index)=><Link to={journalHref({query:item.region})} key={`${item.country}-${item.region}`}>
          <span className="passport-rank-number">{String(index+1).padStart(2,'0')}</span>
          <div><strong>{item.region}</strong><small>{item.country||'Region'} · {item.producers} producers</small></div>
          <b>{item.wines}</b>
        </Link>)}</div>:<p className="journey-muted">Regions appear here as your passport grows.</p>}
      </section>

      <section className="journey-card passport-rank-card">
        <div className="journey-section-heading"><div><p className="section-label">COUNTRIES</p><h2>Places tasted</h2></div><span>{summary.countries}</span></div>
        {data.countries.length?<div className="passport-rank-list">{data.countries.slice(0,5).map((item,index)=><Link to={journalHref({country:item.country})} key={item.country}>
          <span className="passport-rank-number">{String(index+1).padStart(2,'0')}</span>
          <div><strong>{item.country}</strong><small>{item.producers} producers · {item.appellations} appellations</small></div>
          <b>{item.averageRating==null?item.wines:rating(item.averageRating)}</b>
        </Link>)}</div>:<p className="journey-muted">Country information appears as you log identified wines.</p>}
      </section>
    </div>

    <div className="passport-dashboard-grid passport-achievement-row">
      <section className="journey-card">
        <div className="journey-section-heading"><div><p className="section-label">ACHIEVEMENTS</p><h2>Stamps collected</h2></div><span>{achievements.length}</span></div>
        {achievements.length?<div className="passport-achievement-grid">{achievements.map(item=><article key={item.key}>
          <span className="passport-achievement-badge" aria-hidden="true">{achievementIcon[item.key]}</span>
          <div><strong>{item.value}</strong><span>{item.label}</span><small>Milestone unlocked</small></div>
        </article>)}</div>:<p className="journey-muted">Your first achievement unlocks at ten logged wines.</p>}
      </section>

      <section className="journey-card">
        <div className="journey-section-heading"><div><p className="section-label">NEXT STAMPS</p><h2>Within reach</h2></div></div>
        <div className="passport-milestone-list">{milestones.map(item=><div className="passport-milestone" key={item.key}>
          <div><strong>{item.label}</strong><span>{item.current} / {item.target}</span></div>
          <div className="passport-milestone-track"><span style={{width:`${Math.round(item.progress*100)}%`}}/></div>
        </div>)}</div>
      </section>
    </div>

    <section className="journey-card passport-spectrum-card">
      <div className="journey-section-heading"><div><p className="section-label">TASTING SPECTRUM</p><h2>Your styles</h2></div></div>
      {data.styles.length?<div className="passport-style-grid">{data.styles.map(item=><Link to={journalHref({style:item.style})} key={item.style}><strong>{item.wines}</strong><span>{item.style}</span><small>{item.averageRating==null?'Logged wines':`${rating(item.averageRating)} avg rating`}</small></Link>)}</div>:<p className="journey-muted">Wine styles appear here as your journal grows.</p>}
    </section>

    <section className="passport-story-card">
      <div className="passport-mini-cover" aria-hidden="true"><span>W</span><small>PASSPORT</small></div>
      <div><p className="section-label">YOUR PASSPORT. YOUR STORY.</p><h2>Every bottle leaves a mark.</h2><p>Keep exploring producers, regions and appellations one tasting at a time.</p></div>
      <Link className="passport-primary-link" to="/journal">Open journal</Link>
    </section>
  </section>;
}
