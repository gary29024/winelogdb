import { useMemo } from 'react';
import { Link,Navigate,useParams,useSearchParams } from 'react-router-dom';
import { linkFrom } from '../wines/backTarget';
import { calibrate,eraNormal,grapeExpect,readNobleRot,ripeningSpread,eventDay,formatDay,formatRange,readGrape,readSeason,SCORE_LABELS,seasonDay,seasonHeadline,seasonStory,shiftLabel,shiftTone,signed,type Effect,type Level } from './model';
import { BURGUNDY,harvestArea,pickGrape,regionOfVillage,villageGrapes } from './regions';
import type { GrapeId } from './types';
import { useBaseline,useRegionWines,useVintageData } from './useVintages';
import { VintageIcon } from './VintageIcons';
import { BaselineToggle,HowWeEstimate,QualityOutlookCard,SampleBadge,ScoreMeter,SugarChart } from './VintageParts';
import '../../vintages.css';

const EFFECT_MARK:Record<Effect,string>={helps:'↑',hurts:'↓',neutral:'–'};
const EFFECT_WORD:Record<Effect,string>={helps:'helps',hurts:'hurts',neutral:'neutral'};

const WARMTH_WORD:Record<Level,string>={2:'Much warmer',1:'Warmer',0:'Typical','-1':'Cooler','-2':'Much cooler'};
const RAIN_WORD:Record<Level,string>={2:'Very wet',1:'Wetter',0:'Typical','-1':'Drier','-2':'Very dry'};
const NIGHT_WORD:Record<Level,string>={2:'Much warmer',1:'Warmer',0:'Normal','-1':'Cooler','-2':'Much cooler'};

/** A bar that grows left or right of a centre line; `share` is −1…1 of the half width. */
function Diverging({share,kind}:{share:number;kind:'warmth'|'rain'|'nights'}){
  const width=`${Math.round(Math.min(1,Math.abs(share))*100)}%`;
  return <span className="vintage-diverging" aria-hidden="true">
    <span>{share<0&&<span className={`is-${kind}`} style={{width}}/>}</span>
    <span>{share>0&&<span className={`is-${kind}`} style={{width}}/>}</span>
  </span>;
}

/** "191" rather than "191–191" when sugar stalls over the picking fortnight. */
const span=(low:number|string,high:number|string)=>String(low)===String(high)?String(low):`${low}–${high}`;

export function VintageDetailPage(){
  const {village:villageParam='',year:yearParam=''}=useParams();
  const region=regionOfVillage(villageParam)??BURGUNDY;
  const [params,setParams]=useSearchParams();
  const village=region.villages.find(item=>item.id===villageParam);
  const year=Number(yearParam);
  const {index,village:data,error}=useVintageData(region,village?.id??'meursault');
  // Only the grapes this place grows (Pauillac: no Sémillon); a grape it does not grow falls back to its blend.
  const grapes=villageGrapes(region,data?Object.keys(data.normal.grapes):null);
  const grapeId:GrapeId=pickGrape(grapes,params.get('grape'),region.defaultGrape);
  const grape=region.grapes.find(item=>item.id===grapeId)!;
  // A white grape in a red commune keeps its own, earlier harvest dates.
  const areaId=village?harvestArea(index,village,grape):'';
  const wines=useRegionWines(region);

  const season=data?.years[String(year)];
  const [baseline,setBaseline]=useBaseline();
  // The normal this page compares with: the standard 30 years, or the 30 seasons around this one.
  const reference=useMemo(()=>{
    if(!index||!data||!village)return null;
    const harvest=index.harvest[areaId];
    if(baseline==='era'&&data.years[String(year)]){
      const era=eraNormal(data.years,harvest,year);
      return {normal:era.normal,harvest:era.harvest,from:era.from,to:era.to,label:`${era.from}–${era.to}`,short:`’${String(era.from).slice(2)}–’${String(era.to).slice(2)}`};
    }
    return {normal:data.normal,harvest,from:index.baseline.from,to:index.baseline.to,label:`${index.baseline.from}–${index.baseline.to}`,short:`’${String(index.baseline.from).slice(2)}–’${String(index.baseline.to).slice(2)}`};
  },[index,data,village,areaId,baseline,year]);
  // How far seasons normally stray here, from the standard 30 years whichever normal is shown.
  const calibration=useMemo(()=>index&&data&&village?calibrate(data.years,data.normal,index.harvest[areaId],index.baseline.from,index.baseline.to):undefined,[index,data,village,areaId]);
  const reading=useMemo(()=>reference&&season?readSeason(year,season,reference.normal,reference.harvest,calibration):null,[reference,season,year,calibration]);
  // The appellation's legal minimum for this grape here; a blend takes its planted mix of them.
  const minSugar=useMemo(()=>{
    const at=(id:GrapeId)=>{const item=region.grapes.find(g=>g.id===id);return item?(item.minSugarAt?.[village?.id??'']??item.minSugar):0};
    const mix=grape.blend&&village?index?.blends?.[village.id]?.[grapeId]:undefined;
    if(!mix)return at(grapeId);
    return Math.round(Object.entries(mix).reduce((sum,[id,share])=>sum+(share??0)*at(id as GrapeId),0));
  },[region,grape,grapeId,village,index]);
  // The line grapes are picked at here: the sugar this area's recorded harvests began at, or the
  // legal minimum where noble rot decides (Sauternes); the model's 200 g/L where neither is known.
  const areaHarvest=index?.harvest[areaId];
  const pickSugar=areaHarvest?.pickSugar??grape.ripeSugar;
  const grapeReading=useMemo(()=>{
    const grapeSeason=season?.grapes[grapeId];
    if(!reading||!grapeSeason||!data)return null;
    // The four ripening drivers are graded against the same reference seasons as everything else.
    const spread=ripeningSpread(data.years,reference!.harvest,grapeId,reference!.from,reference!.to);
    return readGrape(grapeId,year,grapeSeason,reference!.normal.grapes[grapeId],reading.harvest,pickSugar,minSugar,spread);
  },[reading,season,data,reference,grapeId,year,pickSugar,minSugar]);

  if(!village||!Number.isInteger(year))return <Navigate to="/vintages" replace/>;
  const area=region.areas.find(item=>item.id===village.area);
  const back=<Link className="vintage-back" to={`/vintages?village=${village.id}${baseline==='era'?'&baseline=era':''}`}><span aria-hidden="true">‹</span> Vintages</Link>;
  if(error)return <section className="vintages-page">{back}<p role="alert" className="vintage-error">{error}</p></section>;
  if(!index||!data)return <section className="vintages-page">{back}<p className="vintage-loading" aria-live="polite">Reading the season…</p></section>;
  if(!season||!reading)return <section className="vintages-page">{back}<p className="vintage-error">No weather for {village.name} in {year} yet.</p></section>;

  const {levels,harvest}=reading;
  const normal=reference!.normal;
  const shift=harvest?.shiftDays??0;
  const events=index.events?.[village.area]?.[String(year)]??[];
  const story=seasonStory(season,normal,levels,shift,events);
  // The weather is shared; what it means in the glass depends on the grape shown.
  // In Sauternes and Barsac the vintage turns on noble rot, whichever grape is shown.
  const nobleRot=grapes.some(item=>item.sweet)?readNobleRot(season,normal):null;
  const expect=nobleRot?.expect??grapeExpect(grapeId,grapeReading?.conditions??null,levels,shift,story.expect);
  const normalGrape=normal.grapes[grapeId];
  const grapeSeason=season.grapes[grapeId];
  // The quality outlook answers "how good": the conditions card below only explains why.
  // A single grape in a blended region reads the blend's outlook: critics rate the wine, not the grape.
  const outlookGrape:GrapeId=grapeSeason?.outlook?grapeId:grapes.find(item=>item.blend&&item.colour===grape.colour&&season.grapes[item.id]?.outlook)?.id??grapeId;
  const outlook=season.grapes[outlookGrape]?.outlook;
  const qualityModel=index.quality?.grapes[outlookGrape];
  const outlookArea=harvestArea(index,village,region.grapes.find(item=>item.id===outlookGrape)??grape);
  const consensusGroup=Object.entries(qualityModel?.groups??{}).find(([,areas])=>areas.includes(outlookArea))?.[0]??qualityModel?.colour??grape.colour;
  const qualityCheck=qualityModel?(year>=index.quality!.modernFrom?qualityModel.validation.since:qualityModel.validation.before):null;
  // Rain over this grape's own picking (Pessac-Léognan's whites come in weeks before its reds).
  const ownHarvestRain=grapeSeason?.ripening.harvestRain!=null&&normalGrape?.ripening.harvestRain!=null;
  const harvestRain=ownHarvestRain?grapeSeason!.ripening.harvestRain:season.harvestRain;
  const normalHarvestRain=ownHarvestRain?Math.round(normalGrape!.ripening.harvestRain!):normal.harvestRain;
  const alcohol=`≈ ${(pickSugar/16.83).toFixed(0)}% alc.`;
  const ripeLineLabel=areaHarvest?.pickSugarBasis==='legal minimum'?`Noble rot can start: ${pickSugar} g/L, the legal minimum (${alcohol})`
    :areaHarvest?.pickSugar!=null?`Usually picked at ${pickSugar} g/L (${alcohol})`:`Ripe at ${pickSugar} g/L (${alcohol})`;
  const myWines=(wines??[]).filter(wine=>wine.village===village.id&&wine.vintage===year);
  const gddPct=(season.gdd-normal.gdd)/normal.gdd,rainPct=(season.rainAprSep-normal.rainAprSep)/normal.rainAprSep,nightDiff=season.augNights-normal.augNights;
  const pickGapText=(gap:number)=>gap>0?`${gap} day${gap===1?'':'s'} before`:gap<0?`${-gap} day${gap===-1?'':'s'} after`:'right at';
  const blendMix=Object.entries(index.blends?.[village.id]?.[grapeId]??{}).sort((a,b)=>(b[1]??0)-(a[1]??0))
    .map(([id,share])=>`${Math.round((share??0)*100)}% ${region.grapes.find(item=>item.id===id)?.name??id}`).join(', ');
  // Where a place makes both colours, its red blend says so.
  const grapeName=(item:typeof grape)=>item.id==='blend'&&grapes.some(other=>other.blend&&other.colour==='white')?'Red blend':item.name;
  const setGrape=(id:GrapeId)=>setParams(current=>{const next=new URLSearchParams(current);next.set('grape',id);return next},{replace:true});

  return <section className="vintages-page vintage-detail">
    <div className="vintage-detail-top">{back}{index.sample&&<SampleBadge/>}</div>
    <BaselineToggle value={baseline} onChange={setBaseline} standardLabel={`${index.baseline.from}–${index.baseline.to}`}/>

    <header className="vintage-card vintage-hero">
      <div className="vintage-hero-head">
        <span className={`vintage-year-tile is-large tone-${shiftTone(shift)}`}><strong>{year}</strong><small>{harvest?<>harvest<br/>{shiftLabel(shift,'short')}</>:'harvest date unknown'}</small></span>
        <div>
          <p className="vintage-kicker">{village.name} · {area?.name}</p>
          <h1>{seasonHeadline(levels,shift)}</h1>
          <span className="vintage-hero-score"><ScoreMeter score={reading.score}/>{SCORE_LABELS[reading.score]}</span>
        </div>
      </div>
      {harvest&&<p className="vintage-hero-harvest"><VintageIcon kind="calendar"/><span>Harvest {harvest.source==='estimated'?'estimated to begin':'began'} <strong>{formatDay(harvest.start)}</strong>{harvest.source==='official'?' (official)':harvest.source==='reported'?' (reported)':''} — <strong className={shift<0?'is-early':shift>0?'is-late':undefined}>{shiftLabel(shift)}</strong>{shift?` than usual (${formatDay(harvest.typicalStart)})`:''}</span></p>}
      <p className="vintage-hero-story">{story.happened} <strong>{expect}</strong></p>
      {events.length>0&&<p className="vintage-hero-events">Recorded: {events.map((event,i)=><span key={`${event.type}-${event.date}`}>{i>0&&' · '}<a href={event.source} target="_blank" rel="noopener noreferrer">{event.type==='hail'?'hail':'spring frost'}, {eventDay(event.date)}</a></span>)}</p>}
      <div className="vintage-hero-measures">
        <span className={`is-warmth${levels.warmth===0?' is-typical':''}`}><VintageIcon kind="sun" size={20}/><strong>{WARMTH_WORD[levels.warmth]}</strong><small>warmth {signed(Math.round(gddPct*100))}%</small></span>
        <span className={`is-rain${levels.rain===0?' is-typical':''}`}><VintageIcon kind="drop" size={20}/><strong>{RAIN_WORD[levels.rain]}</strong><small>rain {signed(Math.round(rainPct*100))}%</small></span>
        <span className={`is-nights${levels.nights===0?' is-typical':''}`}><VintageIcon kind="moon" size={20}/><strong>{NIGHT_WORD[levels.nights]}</strong><small>nights {signed(nightDiff,1)} °C</small></span>
      </div>
    </header>

    <div className="vintage-grape-toggle" role="group" aria-label="Grape" style={{gridTemplateColumns:`repeat(${grapes.length>3?2:grapes.length},minmax(0,1fr))`}}>
      {grapes.map(item=><button type="button" key={item.id} className={item.id===grapeId?'active':undefined} aria-pressed={item.id===grapeId} onClick={()=>setGrape(item.id)}>
        <span className={`vintage-grape-dot is-${item.colour}`} aria-hidden="true"/>{grapeName(item)}
      </button>)}
    </div>
    {grape.blend&&blendMix&&<p className="vintage-blend-note">Read as {village.name}’s planted mix: {blendMix}.</p>}

    {outlook&&index.quality&&qualityCheck&&<QualityOutlookCard year={year} grapeName={grapeName(region.grapes.find(item=>item.id===outlookGrape)??grape)} outlook={outlook} model={index.quality} check={qualityCheck}
      consensus={index.quality.consensus[consensusGroup]?.[String(year)]??null}/>}

    {nobleRot&&<section className="vintage-card" aria-labelledby="vintage-noble-title">
      <h2 id="vintage-noble-title">Noble rot season</h2>
      <p className="vintage-card-note">From the harvest start to 31 October. Botrytis needs humid spells to set in, then dry days for the berries to shrivel.</p>
      <div className="vintage-noble-rot">
        <span className={nobleRot.noble>0?'is-helps':nobleRot.noble<0?'is-hurts':undefined}><strong>{season.nobleRotDays}</strong>noble-rot days<small>usual {Math.round(normal.nobleRotDays??0)}</small></span>
        <span className={nobleRot.grey>0?'is-hurts':nobleRot.grey<0?'is-helps':undefined}><strong>{season.greyRotDays}</strong>grey-rot days<small>usual {Math.round(normal.greyRotDays??0)}</small></span>
        <span><strong>{season.botrytisDays}</strong>days Botrytis could spread<small>usual {Math.round(normal.botrytisDays??0)}</small></span>
      </div>
    </section>}

    {grapeReading&&grapeSeason&&normalGrape&&<section className="vintage-card" aria-labelledby="vintage-harvest-title">
      <h2 id="vintage-harvest-title">At harvest</h2>
      {grapeReading.picking&&grapeReading.normalPicking&&harvest&&<div className="vintage-harvest-boxes">
        <div className="is-year">
          <span>{year}</span><small>{harvest.source==='estimated'?'Est.':'Picked'} {formatRange(harvest.start,harvest.end)}</small>
          <p><strong>{span(grapeReading.picking.low,grapeReading.picking.high)}</strong> g/L</p>
          <small>≈ {span(grapeReading.picking.alcoholLow.toFixed(1),grapeReading.picking.alcoholHigh.toFixed(1))}% alc.</small>
        </div>
        <div>
          <span>Typical {reference!.short}</span><small>{harvest.source==='estimated'?'Est.':'Picked'} {formatRange(harvest.typicalStart,harvest.typicalStart+14*86_400_000)}</small>
          <p><strong>{span(grapeReading.normalPicking.low,grapeReading.normalPicking.high)}</strong> g/L</p>
          <small>≈ {span(grapeReading.normalPicking.alcoholLow.toFixed(1),grapeReading.normalPicking.alcoholHigh.toFixed(1))}% alc.</small>
        </div>
      </div>}
      <SugarChart year={year} curve={grapeSeason.sugar} normal={normalGrape.sugar} low={normalGrape.sugarLow} high={normalGrape.sugarHigh}
        harvest={harvest} veraison={grapeReading.veraison} ripeSugar={pickSugar}/>
      <ul className="vintage-chart-legend">
        <li><span className="is-year" aria-hidden="true"/>{year} sugar{grapeSeason.sugarSource==='measured'?` (matched to ${region.id==='burgundy'?'BIVB':'measured'} samples)`:grapeSeason.sugarSource==='weather'?' (estimated)':''}</li>
        <li><span className="is-normal" aria-hidden="true"/>Typical</li>
        <li><span className="is-picked" aria-hidden="true"/>At picking</li>
        <li><span className="is-ripe" aria-hidden="true"/>{ripeLineLabel} · ○ typical · ● {year}</li>
      </ul>
      {harvest?.source==='estimated'&&<p className="vintage-callout">The harvest date here is <strong>estimated from the weather</strong>, so picking is assumed at the usual ripeness. Once the official start date is added, this shows how much earlier or later growers really picked.</p>}
      {harvest&&harvest.source!=='estimated'&&grapeReading.pickGap!=null&&grapeReading.normalPickGap!=null&&<p className="vintage-callout">Picking began <strong>{pickGapText(grapeReading.pickGap)}</strong> the grapes reached {pickSugar} g/L — usually {pickGapText(grapeReading.normalPickGap)}.{' '}
        {grapeReading.pickGap-grapeReading.normalPickGap>=2?'Grapes came in a little less ripe than normal.':grapeReading.normalPickGap-grapeReading.pickGap>=2?'Grapes came in riper than normal.':'About as ripe as a normal year.'}</p>}
      {grapeReading.ripe==null&&<p className="vintage-callout">In {year} the grapes <strong>never reached {pickSugar} g/L</strong> before the end of October: the season was too cool to ripen them fully.</p>}
    </section>}

    {grapeReading?.conditions&&<section className="vintage-card" aria-labelledby="vintage-conditions-title">
      <div className="vintage-card-head"><h2 id="vintage-conditions-title">{grapeReading.conditions.title}</h2><span className={`vintage-verdict is-${grapeReading.conditions.verdict.toLowerCase()}`}>{grapeReading.conditions.verdict}</span></div>
      <div className="vintage-conditions">{grapeReading.conditions.conditions.map(item=><div className={`vintage-condition vintage-condition-${item.effect}`} key={item.id} aria-label={`${item.label}: ${item.value}, ${item.usual} — ${EFFECT_WORD[item.effect]}`}>
        <span className="vintage-condition-head"><VintageIcon kind={item.icon} size={16}/><span>{item.label}</span><b aria-hidden="true">{EFFECT_MARK[item.effect]}</b></span>
        <span className="vintage-condition-value"><strong>{item.value}</strong><small>{item.usual}</small></span>
      </div>)}</div>
      <ul className="vintage-effect-key" aria-hidden="true"><li className="vintage-effect-helps">↑ Helps</li><li className="vintage-effect-hurts">↓ Hurts</li><li className="vintage-effect-neutral">– Neutral</li></ul>
    </section>}

    <section className="vintage-card" aria-labelledby="vintage-season-title">
      <div className="vintage-card-head"><h2 id="vintage-season-title">The season</h2><span>vs {reference!.label}</span></div>
      {season.rainSource==='8km'&&<p className="vintage-muted vintage-rain-note">Rain before 1997 comes from Météo-France’s 8 km record, scaled to the village’s 1 km radar rain.</p>}
      <div className="vintage-season-rows">
        <div><span className="vintage-season-icon is-warmth"><VintageIcon kind="sun" size={17}/></span><div>
          <p><strong>Warmth</strong><span>{season.gdd.toLocaleString('en-GB')} °D <b className="is-warmth">{signed(Math.round(gddPct*100))}%</b></span></p>
          <Diverging share={gddPct/.12} kind="warmth"/></div></div>
        <div><span className="vintage-season-icon is-rain"><VintageIcon kind="drop" size={17}/></span><div>
          <p><strong>Rain</strong><span>{season.rainAprSep} mm <b className="is-rain">{signed(Math.round(rainPct*100))}%</b></span></p>
          <Diverging share={rainPct/.5} kind="rain"/></div></div>
        <div><span className="vintage-season-icon is-nights"><VintageIcon kind="moon" size={17}/></span><div>
          <p><strong>August nights</strong><span>{season.augNights.toFixed(1)} °C <b className="is-nights">{signed(nightDiff,1)}°</b></span></p>
          <Diverging share={nightDiff/2.5} kind="nights"/></div></div>
        <p className="vintage-season-scale" aria-hidden="true"><span>◀ less</span><span>typical</span><span>more ▶</span></p>
      </div>
      <div className="vintage-season-tiles">
        <div><span>Frost days</span><strong>{season.frostDays}</strong><small>usual {normal.frostDays}</small></div>
        <div><span>Days ≥ 30 °C</span><strong>{season.heatDays}</strong><small>usual {normal.heatDays}</small></div>
        {harvestRain!=null&&normalHarvestRain!=null
          ?<div><span>Harvest rain</span><strong>{harvestRain} mm</strong><small>usual {normalHarvestRain}</small></div>
          :<div><span>Sept rain</span><strong>{season.sepRain} mm</strong><small>usual {normal.sepRain}</small></div>}
      </div>
    </section>

    <section className="vintage-card" aria-labelledby="vintage-wines-title">
      <div className="vintage-card-head"><h2 id="vintage-wines-title">Your {village.name} {year}s</h2>{myWines.length>0&&<span className="vintage-wine-count">{myWines.length}</span>}</div>
      {wines==null?<p className="vintage-muted">Checking your journal…</p>
        :myWines.length?<ul className="vintage-wines">{myWines.map(wine=><li key={wine.id}>
          <Link to={`/wines/${wine.id}`} state={linkFrom({to:`/vintages/${village.id}/${year}`,label:'Vintages'})}>
            <span className={`vintage-wine-dot is-${(wine.wineStyle??'').toLowerCase()==='red'?'red':'white'}`} aria-hidden="true"/>
            <span><strong>{wine.wineName}</strong><small>{wine.producer}</small></span>
          </Link>
        </li>)}</ul>
        :<p className="vintage-muted">No {year} from {village.name} in your journal yet.</p>}
    </section>

    <HowWeEstimate index={index}/>
    <p className="vintage-area-note">Compared with {reference!.label}{baseline==='era'?' (its own era)':''} · typical harvest {formatDay(seasonDay(year,reference!.harvest.typical))}</p>
  </section>;
}
