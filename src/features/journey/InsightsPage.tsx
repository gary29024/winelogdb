import { useEffect,useMemo,useState } from 'react';
import { Link } from 'react-router-dom';
import { getJourneyData,type JourneyData } from './api';
import { buildStructureProfile,structureDisplay } from './model';
import '../../journey.css';

const journalHref=(params:Record<string,string>)=>`/?${new URLSearchParams(params).toString()}`;
const rating=(value:number|null)=>value==null?'—':value.toFixed(1);
const money=(currency:string,value:number|null)=>{
  if(value==null)return '—';
  try{return new Intl.NumberFormat(undefined,{style:'currency',currency,maximumFractionDigits:0}).format(value)}catch{return `${currency} ${Math.round(value)}`}
};

export function InsightsPage(){
  const [data,setData]=useState<JourneyData|null>(null),[error,setError]=useState('');
  useEffect(()=>{let active=true;getJourneyData().then(result=>{if(active)setData(result)}).catch(e=>{if(active)setError((e as Error).message)});return()=>{active=false}},[]);
  const profile=useMemo(()=>buildStructureProfile(data?.structures??[]),[data]);
  if(error)return <section className="journey-page"><p role="alert">{error}</p></section>;
  if(!data)return <section className="journey-page"><p aria-live="polite">Reading your tasting history…</p></section>;
  const {summary}=data,structureCoverage=summary.totalWines?Math.round(summary.structuredTastings/summary.totalWines*100):0,ratingCoverage=summary.totalWines?Math.round(summary.ratedWines/summary.totalWines*100):0;
  return <section className="journey-page insights-page">
    <div className="hero compact journey-hero"><p className="eyebrow">INSIGHTS</p><h1>Learn your palate.</h1><p>Turn your tasting history into patterns you can use when choosing what to drink or buy next.</p></div>

    <div className="journey-stat-grid">
      <article><strong>{rating(summary.averageRating)}</strong><span>Average rating</span></article>
      <article><strong>{ratingCoverage}%</strong><span>Rated</span></article>
      <article><strong>{structureCoverage}%</strong><span>Structured</span></article>
      <article><strong>{summary.favorites}</strong><span>Favorites</span></article>
    </div>

    <section className="journey-card palate-card"><div className="journey-section-heading"><div><p className="section-label">YOUR PALATE</p><h2>Typical tasting structure</h2></div><span>{summary.structuredTastings}</span></div>
      {data.structures.length?<><div className="palate-table"><div className="palate-head"><span>Structure</span><span>All</span><span>{profile.topRatedCutoff==null?'Top rated':`${profile.topRatedCutoff}+`}</span></div>{profile.rows.map(row=><div className="palate-row" key={row.key}><strong>{row.label}</strong><span>{row.all?structureDisplay[row.all]??row.all:'—'}</span><span>{row.top?structureDisplay[row.top]??row.top:'—'}</span></div>)}</div><p className="journey-muted">“Top rated” uses the highest-rated quarter of your structured tastings{profile.topRatedCutoff!=null?` (currently ${profile.topRatedCutoff}+; ${profile.topRatedCount} tastings)`:''}. It updates automatically as your journal grows.</p></>:<p className="journey-muted">Add Structure when logging wines and WineLog will start comparing the profile of your highest-rated tastings with your overall history.</p>}
    </section>

    <div className="journey-two-column">
      <section className="journey-card"><div className="journey-section-heading"><div><p className="section-label">PRODUCERS</p><h2>You consistently rate highly</h2></div></div>
        {data.producers.length?<div className="insight-rank-list">{data.producers.map((item,index)=><Link to={journalHref({query:item.producer})} key={item.producer}><span className="rank-number">{index+1}</span><div><strong>{item.producer}</strong><small>{item.wines} wines · {item.ratedWines} rated{item.favorites?` · ${item.favorites} favorite${item.favorites===1?'':'s'}`:''}</small></div><b>{rating(item.averageRating)}</b></Link>)}</div>:<p className="journey-muted">Rate at least two wines from the same producer to build this ranking.</p>}
      </section>
      <section className="journey-card"><div className="journey-section-heading"><div><p className="section-label">STYLES</p><h2>What you rate highest</h2></div></div>
        {data.styles.length?<div className="insight-rank-list">{[...data.styles].sort((a,b)=>(b.averageRating??-1)-(a.averageRating??-1)||b.wines-a.wines).map((item,index)=><Link to={journalHref({style:item.style})} key={item.style}><span className="rank-number">{index+1}</span><div><strong className="capitalize">{item.style}</strong><small>{item.wines} wines · {item.ratedWines} rated</small></div><b>{rating(item.averageRating)}</b></Link>)}</div>:<p className="journey-muted">Style insights appear once wines have been identified.</p>}
      </section>
    </div>

    <section className="journey-card"><div className="journey-section-heading"><div><p className="section-label">OVER TIME</p><h2>Your tasting history by year</h2></div></div>
      <div className="year-insight-grid">{data.years.map(item=><article key={item.year}><strong>{item.year}</strong><span>{item.wines} wines</span><small>{item.ratedWines?`${rating(item.averageRating)} average rating`:'No ratings yet'}</small></article>)}</div>
    </section>

    <section className="journey-card"><div className="journey-section-heading"><div><p className="section-label">PRICE</p><h2>What you have recorded</h2></div><span>{summary.pricedWines}</span></div>
      {data.currencies.length?<div className="currency-grid">{data.currencies.map(item=><article key={item.currency}><div><strong>{item.currency}</strong><span>{item.wines} priced wines</span></div><div><b>{money(item.currency,item.averagePrice)}</b><small>{item.averageRating==null?'No rating average':`${rating(item.averageRating)} avg rating`}</small></div></article>)}</div>:<p className="journey-muted">Record purchase or tasting prices to see separate summaries for each currency. WineLog does not mix currencies into a misleading value score.</p>}
    </section>
  </section>;
}
