import { useMemo,useState } from 'react';
import { Link,useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { favouriteVillage } from './data';
import { SCORE_LABELS,closestToTypical,formatDay,readSeason,seasonDay,shiftLabel,shiftTone,type Level,type SeasonReading } from './model';
import { BURGUNDY,DEFAULT_VILLAGE } from './regions';
import { rememberVillage,rememberedVillage,useRegionWines,useVintageData } from './useVintages';
import { VintageIcon } from './VintageIcons';
import { HowWeEstimate,SampleBadge,ScoreMeter } from './VintageParts';
import '../../vintages.css';

const ARROWS:Record<Level,string>={2:'↑↑',1:'↑',0:'=','-1':'↓','-2':'↓↓'};
const LEVEL_WORDS:Record<'warmth'|'rain'|'nights',Record<Level,string>>={
  warmth:{2:'much warmer',1:'warmer',0:'typical warmth','-1':'cooler','-2':'much cooler'},
  rain:{2:'much wetter',1:'wetter',0:'typical rain','-1':'drier','-2':'much drier'},
  nights:{2:'much warmer nights',1:'warmer nights',0:'typical nights','-1':'cooler nights','-2':'much cooler nights'}
};

function Indicator({kind,level}:{kind:'warmth'|'rain'|'nights';level:Level}){
  const icon=kind==='warmth'?'sun':kind==='rain'?'drop':'moon';
  return <span className={`vintage-indicator vintage-indicator-${level===0?'typical':kind}`} title={LEVEL_WORDS[kind][level]}>
    <VintageIcon kind={icon} size={15}/><b aria-hidden="true">{ARROWS[level]}</b><span className="visually-hidden">{LEVEL_WORDS[kind][level]}</span>
  </span>;
}

const INITIAL_YEARS=12;

export function VintagesPage(){
  const region=BURGUNDY;
  const [params,setParams]=useSearchParams();
  const wines=useRegionWines(region);
  const known=(id:string|null)=>id&&region.villages.some(village=>village.id===id)?id:null;
  const villageId=known(params.get('village'))??known(rememberedVillage())??(wines?known(favouriteVillage(wines)):null)??DEFAULT_VILLAGE;
  const village=region.villages.find(item=>item.id===villageId)!;
  const area=region.areas.find(item=>item.id===village.area);
  const {index,village:data,error}=useVintageData(region,villageId);
  const [showAll,setShowAll]=useState(false);

  const readings=useMemo<SeasonReading[]>(()=>{
    if(!index||!data)return [];
    return Object.keys(data.years).map(Number).sort((a,b)=>b-a)
      .map(year=>readSeason(year,data.years[String(year)],data.normal,index.harvest[village.area]));
  },[index,data,village.area]);
  const closest=useMemo(()=>closestToTypical(readings),[readings]);
  const winesByYear=useMemo(()=>{
    const counts=new Map<number,number>();
    for(const wine of wines??[])if(wine.village===villageId&&wine.vintage)counts.set(wine.vintage,(counts.get(wine.vintage)??0)+1);
    return counts;
  },[wines,villageId]);

  const chooseVillage=(id:string)=>{rememberVillage(id);setParams(current=>{const next=new URLSearchParams(current);next.set('village',id);return next},{replace:true})};
  const typicalHarvest=index?.harvest[village.area]?.typical;
  const strip=[...readings].reverse().slice(-30);
  const shown=showAll?readings:readings.slice(0,INITIAL_YEARS);

  return <section className="vintages-page">
    <PageHeader title="Vintages" subtitle={`How each season shaped the wine, village by village. Harvest compared with ${index?`${index.baseline.from}–${index.baseline.to}`:'a typical year'}.`}/>

    <div className="vintage-controls">
      <label>
        <span>Village</span>
        <select value={villageId} onChange={event=>chooseVillage(event.target.value)}>
          {region.areas.map(group=><optgroup label={group.name} key={group.id}>
            {region.villages.filter(item=>item.area===group.id).map(item=><option value={item.id} key={item.id}>{item.name}</option>)}
          </optgroup>)}
        </select>
      </label>
      {index?.sample&&<SampleBadge/>}
    </div>

    {error&&<p role="alert" className="vintage-error">{error}</p>}
    {!error&&!readings.length&&<p className="vintage-loading" aria-live="polite">Reading the seasons…</p>}

    {readings.length>0&&<>
      <section className="vintage-card vintage-strip-card" aria-labelledby="vintage-strip-title">
        <div className="vintage-card-head"><h2 id="vintage-strip-title">{strip.length} years at a glance</h2><span>harvest start vs typical</span></div>
        <div className="vintage-strip">{strip.map(item=><Link key={item.year} to={`/vintages/${villageId}/${item.year}`}
          className={`vintage-strip-tile tone-${shiftTone(item.harvest?.shiftDays??0)}`}
          aria-label={`${item.year}: harvest ${item.harvest?shiftLabel(item.harvest.shiftDays):'date unknown'}`}>
          ’{String(item.year).slice(2)}
        </Link>)}</div>
        <div className="vintage-strip-legend" aria-hidden="true"><span>Early · warm</span><span className="vintage-strip-scale">{['early-3','early-2','early-1','typical','late-1','late-2','late-3'].map(tone=><span key={tone} className={`tone-${tone}`}/>)}</span><span>Late · cool</span></div>
      </section>

      <div className="vintage-key" aria-hidden="true">
        <span className="is-warmth"><VintageIcon kind="sun" size={14}/>Warmth</span>
        <span className="is-rain"><VintageIcon kind="drop" size={14}/>Rain</span>
        <span className="is-nights"><VintageIcon kind="moon" size={14}/>Nights</span>
        <span className="vintage-key-score"><ScoreMeter score={2} small/>How unusual</span>
      </div>

      <ol className="vintage-year-list">
        <li className="vintage-year-card is-reference">
          <span className="vintage-year-tile is-reference"><strong>{index?`${String(index.baseline.from).slice(2)}–${String(index.baseline.to).slice(2)}`:'—'}</strong><small>average</small></span>
          <div className="vintage-year-body">
            <div className="vintage-year-row"><strong className="vintage-year-character">Typical year</strong></div>
            <div className="vintage-year-row"><Indicator kind="warmth" level={0}/><Indicator kind="rain" level={0}/><Indicator kind="nights" level={0}/></div>
            <div className="vintage-year-row vintage-year-meta"><strong>Harvest ~{typicalHarvest?formatDay(seasonDay(2000,typicalHarvest)):'—'}</strong></div>
          </div>
        </li>
        {shown.map(item=>{
          const count=winesByYear.get(item.year)??0;
          const shift=item.harvest?.shiftDays??0;
          return <li key={item.year}>
            <Link className="vintage-year-card" to={`/vintages/${villageId}/${item.year}`}>
              <span className={`vintage-year-tile tone-${shiftTone(shift)}`}><strong>{item.year}</strong><small>{item.harvest?shiftLabel(shift,'short'):'—'}</small></span>
              <div className="vintage-year-body">
                <div className="vintage-year-row">
                  <strong className="vintage-year-character">{item.character}</strong>
                  {count>0&&<span className="vintage-wine-count" title={`${count} of your wines`}><VintageIcon kind="glass" size={12}/>{count}<span className="visually-hidden"> of your wines</span></span>}
                </div>
                <div className="vintage-year-row">
                  <Indicator kind="warmth" level={item.levels.warmth}/><Indicator kind="rain" level={item.levels.rain}/><Indicator kind="nights" level={item.levels.nights}/>
                  <ScoreMeter score={item.score} label={SCORE_LABELS[item.score]}/>
                </div>
                <div className="vintage-year-row vintage-year-meta">
                  <strong>{item.harvest?`Harvest ${formatDay(item.harvest.start)}`:'Harvest date unknown'}</strong>
                  {item.harvest?.source==='estimated'&&<span className="vintage-estimated">estimated</span>}
                  {closest===item.year&&<span className="vintage-closest">Closest to typical</span>}
                </div>
              </div>
            </Link>
          </li>;
        })}
      </ol>
      {!showAll&&readings.length>INITIAL_YEARS&&<button type="button" className="vintage-show-all" onClick={()=>setShowAll(true)}>Show all {readings.length} years</button>}
      <p className="vintage-area-note">{village.name} · {area?.name}</p>
      <HowWeEstimate index={index}/>
    </>}
  </section>;
}
