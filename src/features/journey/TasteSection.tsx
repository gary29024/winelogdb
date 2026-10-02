import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { GrapeStat,JourneyData,RegionStat,StyleStat } from './api';
import { buildStructureProfile,structureDisplay } from './model';
import { buildCadence,buildCruMix,buildDrinkingAge,buildMix,favoriteRates,readDiscovery,showsRatingInsights,showsStructureInsights } from './insights';
import { styleColorKeyFor } from './passportVisuals';
import '../../taste.css';

/**
 * What used to be the Insights page, folded into the Passport.
 *
 * The page read as a report: a dozen full-width cards, most of them one list.
 * Here the same signals sit in small tiles - the top three of each, not the top
 * ten - and the cards that need room to be read (palate, price, cellar age) are
 * collapsed behind one tap each, so the Passport stays a page you can scan.
 */

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

export function TasteSection({data}:{data:JourneyData}){
  const profile=useMemo(()=>buildStructureProfile(data.structures??[]),[data]);
  const discovery=useMemo(()=>readDiscovery(data.discovery??{tastings:0,newProducers:0,newRegions:0,newCountries:0}),[data]);
  const cadence=useMemo(()=>buildCadence(data.months??[]),[data]);
  const drinkingAge=useMemo(()=>buildDrinkingAge(data.drinkingAges??[]),[data]);
  const cruMix=useMemo(()=>buildCruMix(data.classifications??[]),[data]);
  const styleMix=useMemo(()=>buildMix(data.styles??[],style=>({label:style.style,wines:style.wines})),[data]);
  const hearted=useMemo(()=>[
    favoriteRates<GrapeStat>(data.grapes??[],grape=>grape).map(row=>({label:row.item.grape,href:journalHref({grape:row.item.grape}),row}))[0],
    favoriteRates<RegionStat>(data.regions??[],region=>region).map(row=>({label:row.item.region,href:journalHref({query:row.item.region}),row}))[0],
    favoriteRates<StyleStat>(data.styles??[],style=>style).map(row=>({label:row.item.style,href:journalHref({style:row.item.style}),row}))[0]
  ].filter(Boolean),[data]);

  const {summary}=data;
  const withRatings=showsRatingInsights(summary),withStructure=showsStructureInsights(summary);
  const topStyle=withRatings?[...data.styles].filter(style=>style.averageRating!=null).sort((a,b)=>(b.averageRating??-1)-(a.averageRating??-1)||b.wines-a.wines)[0]:undefined;
  const busiestMonth=Math.max(1,...cadence.months.map(month=>month.wines));
  const years=[...data.years].sort((a,b)=>a.year.localeCompare(b.year)).slice(-6);
  const busiestYear=Math.max(1,...years.map(year=>year.wines));
  const widestBand=Math.max(1,...(drinkingAge?.bands.map(band=>band.wines)??[1]));

  return <section className="taste-section" id="passport-taste" aria-labelledby="taste-heading">
    <div className="taste-heading"><h2 id="taste-heading">Your taste</h2><span>From your journal</span></div>

    <div className="taste-tiles">
      <article className="taste-tile">
        <p className="taste-tile-label">Go-to producers</p>
        {data.producers.length?<ol className="taste-rank">{data.producers.slice(0,3).map(item=><li key={item.producer}>
          <Link to={journalHref({query:item.producer})}><strong>{item.producer}</strong><b>{item.wines}</b></Link>
        </li>)}</ol>:<p className="taste-empty">A second bottle from any producer fills this in.</p>}
      </article>

      <article className="taste-tile">
        <p className="taste-tile-label">Exploration</p>
        {discovery?<>
          <strong className="taste-big">{discovery.percent}%</strong>
          <p className="taste-note">of your last {data.discovery.tastings} tastings were a first · {discovery.phrase.toLowerCase()}</p>
        </>:<p className="taste-empty">Log a few tastings to see how much is new ground.</p>}
      </article>

      <article className="taste-tile">
        <p className="taste-tile-label">Most hearted</p>
        {summary.favorites&&hearted.length?<ol className="taste-rank">{hearted.map(item=><li key={item!.label}>
          <Link to={item!.href}><strong className="capitalize">{item!.label}</strong><b className="taste-heart" title={`${item!.row.favorites} of ${item!.row.wines} hearted`}>♥ {percent(item!.row.rate)}</b></Link>
        </li>)}</ol>:<p className="taste-empty">Heart a wine you would buy again.</p>}
      </article>

      {topStyle
        ?<article className="taste-tile">
          <p className="taste-tile-label">Rated highest</p>
          <strong className="taste-big capitalize">{topStyle.style}</strong>
          <p className="taste-note">average {rating(topStyle.averageRating)} · {topStyle.ratedWines} rated</p>
        </article>
        :<article className="taste-tile">
          <p className="taste-tile-label">Typical age opened</p>
          <strong className="taste-big">{drinkingAge?`${drinkingAge.median} yrs`:'—'}</strong>
          <p className="taste-note">{drinkingAge?`middle half ${drinkingAge.typicalFrom}–${drinkingAge.typicalTo} years`:'Vintages and dates fill this in.'}</p>
        </article>}
    </div>

    {(cruMix.length>0||styleMix.length>0)&&<article className="taste-card">
      {cruMix.length>0&&<div className="taste-bar-group">
        <div className="taste-bar-head"><strong>Cru level</strong><span>{cruMix.reduce((total,tier)=>total+tier.wines,0)} classified wines</span></div>
        <div className="taste-bar" role="img" aria-label={cruMix.map(tier=>`${tier.label} ${percent(tier.share)}`).join(', ')}>
          {cruMix.map(tier=><span className={`taste-cru-${tier.key}`} key={tier.key} style={{width:percent(tier.share)}}/>)}
        </div>
        <ul className="taste-legend">{cruMix.map(tier=><li key={tier.key}><span className={`taste-swatch taste-cru-${tier.key}`} aria-hidden="true"/>{tier.label} <b>{percent(tier.share)}</b></li>)}</ul>
      </div>}
      {styleMix.length>0&&<div className="taste-bar-group">
        <div className="taste-bar-head"><strong>The mix</strong><span>by style</span></div>
        <div className="taste-bar" role="img" aria-label={styleMix.map(slice=>`${slice.label} ${percent(slice.share)}`).join(', ')}>
          {styleMix.map(slice=><span className={`mix-style-${styleColorKeyFor(slice.label)}`} key={slice.label} style={{width:percent(slice.share)}}/>)}
        </div>
        <ul className="taste-legend">{styleMix.map(slice=><li key={slice.label}><span className={`taste-swatch mix-style-${styleColorKeyFor(slice.label)}`} aria-hidden="true"/><span className="capitalize">{slice.label}</span> <b>{percent(slice.share)}</b></li>)}</ul>
      </div>}
    </article>}

    <article className="taste-card taste-charts">
      <div>
        <strong>Wines by year</strong>
        {years.length?<div className="taste-mini-chart" role="img" aria-label={years.map(year=>`${year.year}: ${year.wines}`).join(', ')}>
          {years.map((year,index)=><span key={year.year} className={index===years.length-1?'is-latest':undefined} style={{height:`${Math.max(4,Math.round(year.wines/busiestYear*100))}%`}} title={`${year.year}: ${year.wines}`}/>)}
        </div>:<div className="taste-mini-chart"/>}
        <small>{years.length?`${years[0].year}–${years[years.length-1].year}`:'Tasting dates fill this in'}</small>
      </div>
      <div>
        <strong>Rhythm</strong>
        <div className="taste-mini-chart" role="img" aria-label={cadence.months.map(month=>`${monthName(month.month)}: ${month.wines}`).join(', ')}>
          {cadence.months.map(month=><span key={month.month} className={cadence.busiest?.month===month.month?'is-latest':undefined} style={{height:`${Math.max(4,Math.round(month.wines/busiestMonth*100))}%`}} title={`${monthName(month.month)}: ${month.wines}`}/>)}
        </div>
        <small>{cadence.busiest?`Busiest: ${monthName(cadence.busiest.month)}`:'No tastings dated in the last year'}</small>
      </div>
    </article>

    <div className="taste-more">
      <p className="taste-more-title">More about your tasting</p>
      {withStructure&&<details>
        <summary>Your palate structure</summary>
        <div className="palate-table"><div className="palate-head"><span>Structure</span><span>All</span><span>{profile.topRatedCutoff==null?'Top rated':`${profile.topRatedCutoff}+`}</span></div>{profile.rows.map(row=><div className="palate-row" key={row.key}><strong>{row.label}</strong><span>{row.all?structureDisplay[row.all]??row.all:'—'}</span><span>{row.top?structureDisplay[row.top]??row.top:'—'}</span></div>)}</div>
      </details>}
      <details>
        <summary>What you have paid</summary>
        {data.currencies.length?<ul className="taste-list">{data.currencies.map(item=><li key={item.currency}>
          <span>{item.currency} · {item.wines} priced wines</span><b>{money(item.currency,item.averagePrice)}</b>
        </li>)}</ul>:<p className="taste-empty">Record a price to see an average per currency. Currencies are never mixed.</p>}
      </details>
      <details>
        <summary>How old wines are when you open them</summary>
        {drinkingAge?<>
          <p className="taste-note"><strong>{drinkingAge.median} years</strong> median · middle half {drinkingAge.typicalFrom}–{drinkingAge.typicalTo} years</p>
          <div className="taste-age-bands">{drinkingAge.bands.map(band=><div key={band.label}>
            <span aria-hidden="true"><span style={{height:`${Math.round(band.wines/widestBand*100)}%`}}/></span>
            <small>{band.label}</small><b>{band.wines}</b>
          </div>)}</div>
        </>:<p className="taste-empty">Vintages and tasting dates together show how long your bottles wait.</p>}
      </details>
    </div>

    {(!withRatings||!withStructure)&&<p className="taste-gate-note">
      {[!withRatings?'Rating':'',!withStructure?(withRatings?'Structure':'structure'):''].filter(Boolean).join(' and ')} insights appear once they cover more of your journal.
    </p>}
  </section>;
}
