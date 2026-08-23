import { useEffect,useMemo,useState } from 'react';
import { Link } from 'react-router-dom';
import { WineImage } from '../wines/WineImage';
import { getJourneyData,type JourneyData,type RecentTasting } from './api';
import { nextMilestones,unlockedAchievements,type MilestoneKey } from './model';
import '../../journey.css';

const journalHref=(params:Record<string,string>)=>`/journal?${new URLSearchParams(params).toString()}`;
const achievementIcon:Record<MilestoneKey,string>={totalWines:'◇',producers:'⌂',appellations:'✦',countries:'◎',structuredTastings:'✓'};
const grapeColors=['#a8172d','#e1bd45','#5b1621','#563080','#724060','#d98939'];
const flags:Record<string,string>={France:'🇫🇷',Italy:'🇮🇹',Spain:'🇪🇸',Portugal:'🇵🇹',Germany:'🇩🇪',Australia:'🇦🇺','United States':'🇺🇸','United Kingdom':'🇬🇧',Argentina:'🇦🇷',Chile:'🇨🇱','South Africa':'🇿🇦','New Zealand':'🇳🇿',Austria:'🇦🇹',Greece:'🇬🇷',Hungary:'🇭🇺'};

function tastingDate(item:RecentTasting){
  const raw=item.tastingDate||item.createdAt;
  const date=new Date(item.tastingDate?`${item.tastingDate}T00:00:00`:raw);
  if(Number.isNaN(date.getTime()))return '';
  return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(date);
}

function PassportMap(){return <svg className="passport-world-map" viewBox="0 0 300 138" aria-hidden="true">
  <g className="passport-map-land">
    <path d="M18 45 35 29l28-8 24 8 8 17-10 14-17 3-8 13-17-1-7-12-18-4Z"/>
    <path d="m74 79 11 5 8 17-6 25-11 9-8-20 2-16-8-12Z"/>
    <path d="m126 38 17-9 22 4 8 10-7 8-14-2-7 8-12-4Z"/>
    <path d="m146 58 20 2 14 15-2 20-12 20-11-7-7-23-11-13Z"/>
    <path d="m174 37 26-10 42 8 35 22-5 16-25 1-14 10-19-4-14-13-18 2-10-11Z"/>
    <path d="m239 97 21-6 18 9-2 15-14 10-18-7Z"/>
  </g>
  <g className="passport-map-pins">
    <circle cx="151" cy="45" r="5"/><circle cx="162" cy="48" r="4"/><circle cx="172" cy="51" r="3.5"/><circle cx="52" cy="59" r="4"/><circle cx="232" cy="105" r="4"/>
  </g>
</svg>}

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
  const grapes=data.grapes??[];
  const recent=data.recentTastings??[];
  const summaryStats=[
    {icon:'♧',value:summary.totalWines,label:'Wines tasted',detail:`${summary.vintages} vintages`},
    {icon:'◎',value:summary.regions,label:'Regions explored',detail:`${summary.countries} countries`},
    {icon:'⌂',value:summary.producers,label:'Producers logged',detail:`${summary.appellations} appellations`}
  ];

  return <section className="journey-page passport-page">
    <header className="passport-intro">
      <h1>Passport</h1>
      <p>Your tasting journey at a glance.</p>
    </header>

    <section className="passport-summary-card" aria-labelledby="passport-summary-heading">
      <div className="passport-summary-copy">
        <p className="section-label" id="passport-summary-heading">PASSPORT SUMMARY</p>
        <div className="passport-stat-grid">{summaryStats.map(item=><article key={item.label}>
          <span className="passport-stat-icon" aria-hidden="true">{item.icon}</span>
          <strong>{item.value}</strong><span>{item.label}</span><small>{item.detail}</small>
        </article>)}</div>
      </div>
      <div className="passport-map-wrap"><PassportMap/></div>
    </section>

    <section className="passport-progress-card">
      <div className="passport-progress-ring" role="img" aria-label={`${progressPercent}% progress to the next wine milestone`} style={{background:`conic-gradient(#10182d ${progressPercent}%,#e8ecf2 0)`}}><span>{progressPercent}%</span></div>
      <div className="passport-progress-copy">
        <p className="section-label">YOUR WINE JOURNEY</p>
        <h2>{remaining?`${remaining} wines to your next stamp`:'Next stamp unlocked'}</h2>
        <p>{wineMilestone?`${summary.totalWines} / ${wineMilestone.target} wines tasted`:`${summary.totalWines} wines tasted`}</p>
        <div className="passport-progress-line" aria-hidden="true"><span style={{width:`${progressPercent}%`}}/></div>
      </div>
      <a className="passport-soft-link" href="#passport-achievements">View levels</a>
    </section>

    <div className="passport-pair-grid">
      <section className="passport-mini-card">
        <div className="passport-card-heading"><div><h2>Top regions</h2><span>By wines tasted</span></div></div>
        {data.regions.length?<div className="passport-compact-list">{data.regions.slice(0,5).map(item=><Link to={journalHref({query:item.region})} key={`${item.country}-${item.region}`}>
          <span className="passport-region-flag" aria-hidden="true">{flags[item.country??'']??'•'}</span>
          <div><strong>{item.region}</strong><small>{item.country||'Region'}</small></div><b>{item.wines}</b>
        </Link>)}</div>:<p className="passport-empty-mini">Regions appear as your journal grows.</p>}
        <Link className="passport-card-link" to="/insights">View all regions <span>›</span></Link>
      </section>

      <section className="passport-mini-card">
        <div className="passport-card-heading"><div><h2>Top grapes</h2><span>By wines tasted</span></div></div>
        {grapes.length?<div className="passport-compact-list passport-grape-list">{grapes.slice(0,5).map((item,index)=><Link to={journalHref({query:item.grape})} key={item.grape}>
          <span className="passport-grape-dot" style={{backgroundColor:grapeColors[index%grapeColors.length]}} aria-hidden="true"/>
          <div><strong>{item.grape}</strong></div><b>{item.wines}</b>
        </Link>)}</div>:<p className="passport-empty-mini">Grapes appear as your journal grows.</p>}
        <Link className="passport-card-link" to="/journal">View all grapes <span>›</span></Link>
      </section>
    </div>

    <div className="passport-pair-grid passport-secondary-grid">
      <section className="passport-mini-card">
        <div className="passport-card-heading"><div><h2>Recent tastings</h2></div><Link to="/journal">View all</Link></div>
        {recent.length?<div className="passport-recent-list">{recent.slice(0,2).map(item=><Link to={`/wines/${item.id}`} key={item.id}>
          <span className="passport-recent-image">{item.imageId?<WineImage imageId={item.imageId} alt={`${item.producer} ${item.wineName}`}/>:<span className="passport-recent-fallback">W</span>}</span>
          <div className="passport-recent-copy"><strong>{item.wineName}{item.vintage?` ${item.vintage}`:''}</strong><small>{[item.producer,item.region||item.country].filter(Boolean).join(' · ')}</small></div>
          <span className="passport-recent-date">{tastingDate(item)}</span>
        </Link>)}</div>:<p className="passport-empty-mini">Your latest tastings will appear here.</p>}
      </section>

      <section className="passport-mini-card" id="passport-achievements">
        <div className="passport-card-heading"><div><h2>Achievements</h2></div><span>{achievements.length} stamps</span></div>
        {achievements.length?<div className="passport-stamp-list">{achievements.slice(0,2).map(item=><article key={item.key}>
          <span className={`passport-badge passport-badge-${item.key}`} aria-hidden="true">{achievementIcon[item.key]}</span>
          <div><strong>{item.label}</strong><small>{item.value} milestone reached</small></div>
        </article>)}{achievements.length>2&&<p className="passport-more-stamps">+{achievements.length-2} more stamps collected</p>}</div>:<p className="passport-empty-mini">Your first stamp unlocks at ten logged wines.</p>}
      </section>
    </div>

    <section className="passport-story-card">
      <div className="passport-mini-cover" aria-hidden="true"><span>W</span><small>PASSPORT</small></div>
      <div><h2>Your passport. Your story.</h2><p>Every bottle leaves a mark. Keep exploring.</p></div>
      <Link className="passport-primary-link" to="/upload">Add a tasting</Link>
    </section>
  </section>;
}
