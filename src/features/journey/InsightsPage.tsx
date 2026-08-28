import { useEffect,useMemo,useState } from 'react';
import { Link } from 'react-router-dom';
import { getJourneyData,type GrapeStat,type JourneyData,type RegionStat,type StyleStat } from './api';
import { buildStructureProfile,structureDisplay } from './model';
import { buildCadence,buildCruMix,buildDrinkingAge,buildMix,favoriteRates,readDiscovery,showsRatingInsights,showsStructureInsights } from './insights';
import { grapeColorFor,styleColorKeyFor } from './passportVisuals';
import { AiSpendCard } from './AiSpendCard';
import '../../journey.css';
import '../../insights.css';

const journalHref=(params:Record<string,string>)=>`/journal?${new URLSearchParams(params).toString()}`;
const rating=(value:number|null)=>value==null?'—':value.toFixed(1);
const percent=(value:number)=>`${Math.round(value*100)}%`;
const money=(currency:string,value:number|null)=>{
  if(value==null)return '—';
  try{return new Intl.NumberFormat(undefined,{style:'currency',currency,maximumFractionDigits:0}).format(value)}catch{return `${currency} ${Math.round(value)}`}
};
const monthName=(month:string)=>{
  const date=new Date(`${month}-01T00:00:00`);
  return Number.isNaN(date.getTime())?month:new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric'}).format(date);
};
const sinceLabel=(value:string|null)=>{
  if(!value)return null;
  const date=new Date(value.length<=10?`${value}T00:00:00`:value);
  return Number.isNaN(date.getTime())?null:new Intl.DateTimeFormat(undefined,{month:'short',year:'numeric'}).format(date);
};

function FavoriteColumn<T>({title,rows,label,href}:{
  title:string;
  rows:{item:T;wines:number;favorites:number;rate:number}[];
  label:(item:T)=>string;
  href:(item:T)=>string;
}){
  return <div className="favorite-column">
    <p className="favorite-column-title">{title}</p>
    {rows.length?<ol>{rows.slice(0,3).map(row=><li key={label(row.item)}>
      <Link to={href(row.item)}>
        <span className="favorite-rate-bar" aria-hidden="true"><span style={{width:percent(row.rate)}}/></span>
        <strong className="capitalize">{label(row.item)}</strong>
        <small>{row.favorites} of {row.wines}</small>
        <b>{percent(row.rate)}</b>
      </Link>
    </li>)}</ol>:<p className="journey-muted small">Not enough logged yet.</p>}
  </div>;
}

export function InsightsPage(){
  const [data,setData]=useState<JourneyData|null>(null),[error,setError]=useState('');
  useEffect(()=>{let active=true;getJourneyData().then(result=>{if(active)setData(result)}).catch(e=>{if(active)setError((e as Error).message)});return()=>{active=false}},[]);
  const profile=useMemo(()=>buildStructureProfile(data?.structures??[]),[data]);
  const discovery=useMemo(()=>readDiscovery(data?.discovery??{tastings:0,newProducers:0,newRegions:0,newCountries:0}),[data]);
  const cadence=useMemo(()=>buildCadence(data?.months??[]),[data]);
  const drinkingAge=useMemo(()=>buildDrinkingAge(data?.drinkingAges??[]),[data]);
  const cruMix=useMemo(()=>buildCruMix(data?.classifications??[]),[data]);
  const grapeMix=useMemo(()=>buildMix(data?.grapes??[],grape=>({label:grape.grape,wines:grape.wines})),[data]);
  const styleMix=useMemo(()=>buildMix(data?.styles??[],style=>({label:style.style,wines:style.wines})),[data]);
  const favoriteGrapes=useMemo(()=>favoriteRates<GrapeStat>(data?.grapes??[],grape=>grape),[data]);
  const favoriteRegions=useMemo(()=>favoriteRates<RegionStat>(data?.regions??[],region=>region),[data]);
  const favoriteStyles=useMemo(()=>favoriteRates<StyleStat>(data?.styles??[],style=>style),[data]);

  if(error)return <section className="journey-page"><p role="alert">{error}</p></section>;
  if(!data)return <section className="journey-page"><p aria-live="polite">Reading your tasting history…</p></section>;

  const {summary}=data;
  const withRatings=showsRatingInsights(summary),withStructure=showsStructureInsights(summary);
  const busiestMonthBar=Math.max(1,...cadence.months.map(month=>month.wines));
  const widestBand=Math.max(1,...(drinkingAge?.bands.map(band=>band.wines)??[1]));

  return <section className="journey-page insights-page">
    <div className="hero compact journey-hero"><p className="eyebrow">INSIGHTS</p><h1>Learn your palate.</h1><p>Turn your tasting history into patterns you can use when choosing what to drink or buy next.</p></div>

    <div className="journey-stat-grid">
      <article><strong>{summary.totalWines}</strong><span>Wines logged</span></article>
      <article><strong>{summary.favorites}</strong><span>Favorites</span></article>
      <article><strong>{discovery?`${discovery.percent}%`:'—'}</strong><span>Recent bottles new</span></article>
      {withRatings
        ?<article><strong>{rating(summary.averageRating)}</strong><span>Average rating</span></article>
        :<article><strong>{drinkingAge?`${drinkingAge.median}y`:'—'}</strong><span>Typical age opened</span></article>}
    </div>

    <div className="journey-two-column">
      <section className="journey-card"><div className="journey-section-heading"><div><p className="section-label">Producers</p><h2>You keep coming back to</h2></div></div>
        {data.producers.length?<div className="insight-rank-list">{data.producers.map((item,index)=>{
          const since=sinceLabel(item.lastTasted);
          return <Link to={journalHref({query:item.producer})} key={item.producer}>
            <span className="rank-number">{index+1}</span>
            <div><strong>{item.producer}</strong><small>{[
              `${item.wines} wines`,
              item.favorites?`${item.favorites} favorite${item.favorites===1?'':'s'}`:'',
              since?`last ${since}`:''
            ].filter(Boolean).join(' · ')}</small></div>
            <b>{item.wines}</b>
          </Link>;
        })}</div>:<p className="journey-muted">Log a second bottle from any producer and this fills in.</p>}
      </section>

      <section className="journey-card"><div className="journey-section-heading"><div><p className="section-label">Exploration</p><h2>{discovery?discovery.phrase:'Your next frontier'}</h2></div></div>
        {discovery?<>
          <div className="discovery-dial" role="img" aria-label={`${discovery.percent}% of your last ${data.discovery.tastings} tastings came from a producer new to you`}>
            <strong>{discovery.percent}%</strong>
            <small>of your last {data.discovery.tastings} tastings were a first</small>
          </div>
          <div className="discovery-facets">{discovery.facets.map(facet=><article key={facet.label}>
            <strong>{facet.count}</strong><span>{facet.label}</span>
          </article>)}</div>
        </>:<p className="journey-muted">Log a few tastings and WineLog will track how much of your drinking is new ground.</p>}
      </section>
    </div>

    <section className="journey-card"><div className="journey-section-heading"><div><p className="section-label">What earns a heart</p><h2>Your favorites, by the numbers</h2></div><span>{summary.favorites}</span></div>
      {summary.favorites?<>
        <div className="favorite-columns">
          <FavoriteColumn title="Grapes" rows={favoriteGrapes} label={grape=>grape.grape} href={grape=>journalHref({query:grape.grape})}/>
          <FavoriteColumn title="Regions" rows={favoriteRegions} label={region=>region.region} href={region=>journalHref({query:region.region})}/>
          <FavoriteColumn title="Styles" rows={favoriteStyles} label={style=>style.style} href={style=>journalHref({style:style.style})}/>
        </div>
        <p className="journey-muted">Ranked by how often you favorite one, not how often you drink one. Anything with fewer than three logged wines is left out.</p>
      </>:<p className="journey-muted">Tap the heart on a wine you would buy again. It takes one tap and it is the signal WineLog leans on hardest.</p>}
    </section>

    <div className="journey-two-column">
      <section className="journey-card"><div className="journey-section-heading"><div><p className="section-label">Rhythm</p><h2>Your tasting year</h2></div>{cadence.streak>1&&<span>{cadence.streak}-month run</span>}</div>
        {cadence.months.length?<>
          <div className="cadence-chart" role="img" aria-label={cadence.months.map(month=>`${monthName(month.month)}: ${month.wines}`).join(', ')}>
            {cadence.months.map(month=><span className="cadence-bar" key={month.month} title={`${monthName(month.month)}: ${month.wines} wine${month.wines===1?'':'s'}`}>
              <b>{month.wines}</b>
              <span className="cadence-track"><span style={{height:`${Math.round(month.wines/busiestMonthBar*100)}%`}}/></span>
              <small>{month.label}</small>
            </span>)}
          </div>
          <p className="journey-muted">{cadence.busiest
            ?`${cadence.perMonth.toFixed(1)} wines a month on average · busiest was ${monthName(cadence.busiest.month)} with ${cadence.busiest.wines}.`
            :'No tastings dated in the last year.'}</p>
        </>:<p className="journey-muted">Tasting dates build this chart.</p>}
      </section>

      <section className="journey-card"><div className="journey-section-heading"><div><p className="section-label">Cellar age</p><h2>When you open them</h2></div>{drinkingAge&&<span>{drinkingAge.wines}</span>}</div>
        {drinkingAge?<>
          <p className="age-headline"><strong>{drinkingAge.median} years</strong><span>median age at opening · middle half {drinkingAge.typicalFrom}–{drinkingAge.typicalTo} years</span></p>
          <div className="age-bands">{drinkingAge.bands.map(band=><article key={band.label}>
            <span className="age-band-bar" aria-hidden="true"><span style={{height:`${Math.round(band.wines/widestBand*100)}%`}}/></span>
            <small>{band.label}</small><b>{band.wines}</b>
          </article>)}</div>
        </>:<p className="journey-muted">Vintages and tasting dates together show how long your bottles wait.</p>}
      </section>
    </div>

    {cruMix.length>0&&<section className="journey-card"><div className="journey-section-heading"><div><p className="section-label">Cru level</p><h2>How high you drink</h2></div><span>{cruMix.reduce((total,tier)=>total+tier.wines,0)}</span></div>
      <div className="cru-mix">{cruMix.map(tier=><article className={`cru-tier cru-tier-${tier.key}`} key={tier.key}>
        <span className="cru-tier-bar" aria-hidden="true"><span style={{width:percent(tier.share)}}/></span>
        <strong>{tier.label}</strong>
        <small>{tier.wines} {tier.wines===1?'wine':'wines'}{tier.favorites?` · ${tier.favorites} favorite${tier.favorites===1?'':'s'}`:''}</small>
        <b>{percent(tier.share)}</b>
      </article>)}</div>
      <p className="journey-muted">Counted where WineLog can read a cru tier - Burgundy today - so a bottle without one is not missing, just outside the scheme.</p>
    </section>}

    <section className="journey-card"><div className="journey-section-heading"><div><p className="section-label">The mix</p><h2>What fills your journal</h2></div></div>
      {grapeMix.length||styleMix.length?<div className="mix-groups">
        {[{title:'Grapes',slices:grapeMix,tint:(label:string)=>grapeColorFor(label),colorClass:()=>undefined},
          {title:'Styles',slices:styleMix,tint:()=>undefined,colorClass:(label:string)=>`mix-style-${styleColorKeyFor(label)}`}].filter(group=>group.slices.length).map(group=><div className="mix-group" key={group.title}>
          <p className="favorite-column-title">{group.title}</p>
          <div className="mix-bar" role="img" aria-label={group.slices.map(slice=>`${slice.label} ${percent(slice.share)}`).join(', ')}>
            {group.slices.map(slice=><span className={group.colorClass(slice.label)} key={slice.label} style={{width:percent(slice.share),backgroundColor:group.tint(slice.label)}} title={`${slice.label}: ${slice.wines}`}/>)}
          </div>
          <ul className="mix-legend">{group.slices.map(slice=><li key={slice.label}>
            <span className={`mix-swatch ${group.colorClass(slice.label)??''}`} style={{backgroundColor:group.tint(slice.label)}} aria-hidden="true"/>
            <span className="capitalize">{slice.label}</span><b>{percent(slice.share)}</b>
          </li>)}</ul>
        </div>)}
      </div>:<p className="journey-muted">Grape and style breakdowns appear once wines have been identified.</p>}
    </section>

    {withStructure&&<section className="journey-card palate-card"><div className="journey-section-heading"><div><p className="section-label">Your palate</p><h2>Typical tasting structure</h2></div><span>{summary.structuredTastings}</span></div>
      <div className="palate-table"><div className="palate-head"><span>Structure</span><span>All</span><span>{profile.topRatedCutoff==null?'Top rated':`${profile.topRatedCutoff}+`}</span></div>{profile.rows.map(row=><div className="palate-row" key={row.key}><strong>{row.label}</strong><span>{row.all?structureDisplay[row.all]??row.all:'—'}</span><span>{row.top?structureDisplay[row.top]??row.top:'—'}</span></div>)}</div>
      <p className="journey-muted">“Top rated” uses the highest-rated quarter of your structured tastings{profile.topRatedCutoff!=null?` (currently ${profile.topRatedCutoff}+; ${profile.topRatedCount} tastings)`:''}. It updates automatically as your journal grows.</p>
    </section>}

    {withRatings&&<section className="journey-card"><div className="journey-section-heading"><div><p className="section-label">Styles</p><h2>What you rate highest</h2></div></div>
      {data.styles.length?<div className="insight-rank-list">{[...data.styles].sort((a,b)=>(b.averageRating??-1)-(a.averageRating??-1)||b.wines-a.wines).map((item,index)=><Link to={journalHref({style:item.style})} key={item.style}><span className="rank-number">{index+1}</span><div><strong className="capitalize">{item.style}</strong><small>{item.wines} wines · {item.ratedWines} rated</small></div><b>{rating(item.averageRating)}</b></Link>)}</div>:<p className="journey-muted">Style insights appear once wines have been identified.</p>}
    </section>}

    <section className="journey-card"><div className="journey-section-heading"><div><p className="section-label">Over time</p><h2>Your tasting history by year</h2></div></div>
      <div className="year-insight-grid">{data.years.map(item=><article key={item.year}><strong>{item.year}</strong><span>{item.wines} wines</span>{withRatings&&item.ratedWines>0&&<small>{rating(item.averageRating)} average rating</small>}</article>)}</div>
    </section>

    <section className="journey-card"><div className="journey-section-heading"><div><p className="section-label">Price</p><h2>What you have recorded</h2></div><span>{summary.pricedWines}</span></div>
      {data.currencies.length?<div className="currency-grid">{data.currencies.map(item=><article key={item.currency}><div><strong>{item.currency}</strong><span>{item.wines} priced wines</span></div><div><b>{money(item.currency,item.averagePrice)}</b><small>{withRatings&&item.averageRating!=null?`${rating(item.averageRating)} avg rating`:`${item.wines} logged`}</small></div></article>)}</div>:<p className="journey-muted">Record purchase or tasting prices to see separate summaries for each currency. WineLog does not mix currencies into a misleading value score.</p>}
    </section>

    <AiSpendCard/>

    {(!withRatings||!withStructure)&&<p className="insights-gate-note">
      {[!withRatings?'rating':'',!withStructure?'structure':''].filter(Boolean).join(' and ')} insights stay hidden until they cover more of your journal — everything above works without them.
    </p>}
  </section>;
}
