import { useEffect,useMemo,useState } from 'react';
import { Link } from 'react-router-dom';
import { WineImage } from '../wines/WineImage';
import { AchievementIcon as CollectionAchievementIcon } from '../achievements/AchievementIcon';
import { getAchievementProgress } from '../achievements/api';
import { passportCollectionKicker,passportCollectionSummary,selectPassportCollections } from '../achievements/passportPreview';
import type { AchievementProgress } from '../achievements/types';
import { getJourneyData,type JourneyData,type RecentTasting } from './api';
import { journeyLadder,nextMilestones,unlockedAchievements,type MilestoneKey } from './model';
import { grapeColorFor } from './passportVisuals';
import { PassportMap } from './PassportMap';
import '../../journey.css';
import '../../achievementPassport.css';

const journalHref=(params:Record<string,string>)=>`/journal?${new URLSearchParams(params).toString()}`;
const flags:Record<string,string>={France:'🇫🇷',Italy:'🇮🇹',Spain:'🇪🇸',Portugal:'🇵🇹',Germany:'🇩🇪',Australia:'🇦🇺','United States':'🇺🇸','United Kingdom':'🇬🇧',Argentina:'🇦🇷',Chile:'🇨🇱','South Africa':'🇿🇦','New Zealand':'🇳🇿',Austria:'🇦🇹',Greece:'🇬🇷',Hungary:'🇭🇺'};

type PassportStatIconKind='wines'|'regions'|'producers';

function PassportStatIcon({kind}:{kind:PassportStatIconKind}){
  if(kind==='wines')return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 3.2 20.8 12 12 20.8 3.2 12 12 3.2Z"/>
    <path d="M8.8 12h6.4M12 8.8v6.4" className="passport-icon-detail"/>
  </svg>;
  if(kind==='regions')return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="8.2"/>
    <path d="M3.8 12h16.4M12 3.8c2.4 2.3 3.7 5 3.7 8.2S14.4 17.9 12 20.2M12 3.8C9.6 6.1 8.3 8.8 8.3 12s1.3 5.9 3.7 8.2" className="passport-icon-detail"/>
  </svg>;
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4.2 20V9.6L12 4l7.8 5.6V20"/>
    <path d="M7.2 9.8h9.6M8 20v-5.2h3.1V20m1.8 0v-5.2H16V20M5.8 20h12.4" className="passport-icon-detail"/>
  </svg>;
}

function AchievementIcon({kind}:{kind:MilestoneKey}){
  const common={width:18,height:18,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true};
  if(kind==='totalWines')return <svg {...common}><path d="M8 3h8l-1 6.5a3 3 0 0 1-6 0L8 3Z"/><path d="M12 12.5V20M8.5 20h7"/></svg>;
  if(kind==='producers')return <svg {...common}><path d="M4.5 20V9.5L12 4l7.5 5.5V20"/><path d="M7.5 10h9M8.2 20v-5h3v5m1.6 0v-5h3v5M5.5 20h13"/></svg>;
  if(kind==='appellations')return <svg {...common}><path d="M12 21s6-5.5 6-11a6 6 0 1 0-12 0c0 5.5 6 11 6 11Z"/><circle cx="12" cy="10" r="2.2"/></svg>;
  if(kind==='countries')return <svg {...common}><circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.3 2.2 3.5 4.9 3.5 8S14.3 17.8 12 20M12 4C9.7 6.2 8.5 8.9 8.5 12S9.7 17.8 12 20"/></svg>;
  return <svg {...common}><rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 8h6M9 12h3M9 16l1.5 1.5L15 13"/></svg>;
}

function tastingDate(item:RecentTasting){
  const raw=item.tastingDate||item.createdAt;
  const date=new Date(item.tastingDate?`${item.tastingDate}T00:00:00`:raw);
  if(Number.isNaN(date.getTime()))return '';
  return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(date);
}

export function PassportPage(){
  const [data,setData]=useState<JourneyData|null>(null),[error,setError]=useState('');
  const [collections,setCollections]=useState<AchievementProgress[]|null>(null),[collectionsError,setCollectionsError]=useState('');
  useEffect(()=>{let active=true;getJourneyData().then(result=>{if(active)setData(result)}).catch(e=>{if(active)setError((e as Error).message)});return()=>{active=false}},[]);
  useEffect(()=>{let active=true;getAchievementProgress().then(result=>{if(active)setCollections(result)}).catch(e=>{if(active)setCollectionsError((e as Error).message)});return()=>{active=false}},[]);
  const milestones=useMemo(()=>data?nextMilestones(data.summary):[],[data]);
  const achievements=useMemo(()=>data?unlockedAchievements(data.summary):[],[data]);
  const ladder=useMemo(()=>data?journeyLadder(data.summary):[],[data]);
  const featuredCollections=useMemo(()=>collections?selectPassportCollections(collections):[],[collections]);
  const collectionsSummary=useMemo(()=>collections?passportCollectionSummary(collections):null,[collections]);
  if(error)return <section className="journey-page"><p role="alert">{error}</p></section>;
  if(!data)return <section className="journey-page"><p aria-live="polite">Stamping your Wine Passport…</p></section>;

  const {summary}=data;
  const wineMilestone=milestones.find(item=>item.key==='totalWines')??milestones[0];
  const progressPercent=Math.round((wineMilestone?.progress??0)*100);
  const remaining=Math.max(0,(wineMilestone?.target??summary.totalWines)-summary.totalWines);
  const grapes=data.grapes??[];
  const recent=data.recentTastings??[];
  const summaryStats:{kind:PassportStatIconKind;value:number;label:string;detail:string}[]=[
    {kind:'wines',value:summary.totalWines,label:'Wines tasted',detail:`${summary.vintages} vintages`},
    {kind:'regions',value:summary.regions,label:'Regions explored',detail:`${summary.countries} countries`},
    {kind:'producers',value:summary.producers,label:'Producers logged',detail:`${summary.appellations} appellations`}
  ];

  return <section className="journey-page passport-page">
    <header className="passport-intro">
      <h1>Passport</h1>
      <p>Your tasting journey at a glance.</p>
    </header>

    <section className="passport-summary-card" aria-labelledby="passport-summary-heading">
      <div className="passport-summary-copy">
        <p className="section-label" id="passport-summary-heading">Passport summary</p>
        <div className="passport-stat-grid">{summaryStats.map(item=><article key={item.label}>
          <span className="passport-stat-icon" aria-hidden="true"><PassportStatIcon kind={item.kind}/></span>
          <strong>{item.value}</strong><span>{item.label}</span><small>{item.detail}</small>
        </article>)}</div>
      </div>
      <div className="passport-map-wrap"><PassportMap countries={data.countries}/></div>
    </section>

    <section className="passport-progress-card">
      <div className="passport-progress-ring" role="img" aria-label={`${progressPercent}% progress to the next wine milestone`} style={{background:`conic-gradient(#10182d ${progressPercent}%,#e8ecf2 0)`}}><span>{progressPercent}%</span></div>
      <div className="passport-progress-copy">
        <p className="section-label">Your wine journey</p>
        <h2>{remaining?`${remaining} wines to your next stamp`:'Next stamp unlocked'}</h2>
        <p>{wineMilestone?`${summary.totalWines} tasted · ${summary.totalWines-wineMilestone.previous} of ${wineMilestone.target-wineMilestone.previous} since your last stamp`:`${summary.totalWines} wines tasted`}</p>
        <div className="passport-progress-line" aria-hidden="true"><span style={{width:`${progressPercent}%`}}/></div>
      </div>
      <a className="passport-soft-link" href="#passport-achievements">View levels</a>
    </section>

    <section className="passport-collections-card" aria-labelledby="passport-collections-heading">
      <div className="passport-collections-heading">
        <div><p className="section-label">Wine collections</p><h2 id="passport-collections-heading">Explore your next stamps</h2><p>Iconic estates, historic tastings and regional challenges — updated automatically from your journal.</p></div>
        <div className="passport-collections-summary">{collectionsSummary&&<span><strong>{collectionsSummary.complete}</strong><small>complete</small></span>}<Link to="/achievements">View all{collectionsSummary?` ${collectionsSummary.total}`:''} <span>›</span></Link></div>
      </div>
      {collectionsError?<p className="passport-collections-error">Wine Collections could not be loaded right now.<Link to="/achievements">Open collections</Link></p>:!collections?<p className="passport-collections-loading" aria-live="polite">Checking your collection progress…</p>:<>
        <div className="passport-collection-preview-grid">{featuredCollections.map(collection=>{
          const {definition}=collection;
          return <Link className={`passport-collection-preview${collection.complete?' passport-collection-preview-complete':''}`} to={`/achievements/${definition.id}`} key={definition.id}>
            <span className={`passport-collection-preview-icon passport-collection-preview-icon-${definition.icon}`} aria-hidden="true"><CollectionAchievementIcon kind={definition.icon}/></span>
            <div className="passport-collection-preview-copy"><small>{passportCollectionKicker(collection)}</small><strong>{definition.title}</strong></div>
            <span className="passport-collection-preview-percent">{collection.percent}%</span>
            <div className="passport-collection-preview-progress"><span className="passport-collection-preview-bar" aria-hidden="true"><span style={{width:`${collection.percent}%`}}/></span><small>{collection.completed} / {collection.total} tasted</small></div>
          </Link>;
        })}</div>
        {collectionsSummary&&collectionsSummary.possible>0&&<p className="passport-collections-repair">{collectionsSummary.possible} possible {collectionsSummary.possible===1?'match needs':'matches need'} identity linking before they count.</p>}
      </>}
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
        {grapes.length?<div className="passport-compact-list passport-grape-list">{grapes.slice(0,5).map(item=><Link to={journalHref({query:item.grape})} key={item.grape}>
          <span className="passport-grape-dot" style={{backgroundColor:grapeColorFor(item.grape)}} aria-hidden="true"/>
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

      <section className="passport-mini-card passport-levels" id="passport-achievements">
        <div className="passport-card-heading"><div><h2>Journey stamps</h2></div><span>{achievements.length} earned</span></div>
        <p className="passport-levels-note">Every stamp on every track. Filled ones are yours; the outlined one is next.</p>
        <ul className="passport-ladder">{ladder.map(track=><li key={track.key} className="passport-track">
          <div className="passport-track-head">
            <span className={`passport-badge passport-badge-${track.key}`} aria-hidden="true"><AchievementIcon kind={track.key}/></span>
            <strong>{track.label}</strong>
            <span className="passport-track-count">{track.earned} / {track.total}</span>
          </div>
          <ol className="passport-stamps">{track.stamps.map(stamp=><li key={stamp.value}
            className={`passport-stamp${stamp.earned?' is-earned':''}${stamp.next?' is-next':''}`}
            aria-label={`${stamp.value} ${track.label.toLowerCase()}${stamp.earned?' - earned':stamp.next?' - next stamp':''}`}>
            {stamp.value}
          </li>)}</ol>
          <small>{track.next
            ?`${track.remaining} more to reach ${track.next.value}`
            :`Every ${track.label.toLowerCase()} stamp collected`}</small>
        </li>)}</ul>
      </section>
    </div>

    <section className="passport-story-card">
      <div className="passport-mini-cover" aria-hidden="true"><span>W</span><small>PASSPORT</small></div>
      <div><h2>Your passport. Your story.</h2><p>Every bottle leaves a mark. Keep exploring.</p></div>
      <Link className="passport-primary-link" to="/upload">Add a tasting</Link>
    </section>
  </section>;
}
