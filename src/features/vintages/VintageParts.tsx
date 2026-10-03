import { addDays,dayReaching,daysBetween,formatDay,PICKING_DAYS,seasonDay,sugarOn,type Baseline,type HarvestReading,type SeasonScore } from './model';
import type { OutlookCheck,OutlookDriver,QualityModel,QualityOutlook,SugarCurve,VintageIndex } from './types';
import { VintageIcon } from './VintageIcons';

export function BaselineToggle({value,onChange,standardLabel}:{value:Baseline;onChange:(next:Baseline)=>void;standardLabel:string}){
  return <div className="vintage-baseline" role="group" aria-label="Compare with">
    <span>Compare with</span>
    <button type="button" className={value==='standard'?'active':undefined} aria-pressed={value==='standard'} onClick={()=>onChange('standard')}>{standardLabel}</button>
    <button type="button" className={value==='era'?'active':undefined} aria-pressed={value==='era'} onClick={()=>onChange('era')}>Its own era</button>
  </div>;
}

export function SampleBadge(){
  return <span className="vintage-sample-badge" title="These figures are invented to show the layout. Real weather replaces them once the data pipeline has run.">Sample data</span>;
}

export function ScoreMeter({score,label,small}:{score:SeasonScore|number;label?:string;small?:boolean}){
  return <span className={`vintage-score${small?' is-small':''}`} role={label?'img':undefined} aria-label={label} aria-hidden={label?undefined:true} title={label}>
    {[1,2,3,4,5].map(step=><span key={step} className={step<=score?'is-on':undefined}/>)}
  </span>;
}

export function HowWeEstimate({index}:{index:VintageIndex|null}){
  return <details className="vintage-how">
    <summary><VintageIcon kind="info" size={16}/>How we estimate</summary>
    <div>
      <p><strong>Harvest dates</strong> are the start of picking a source records for each area — an official ban des vendanges or opening, or a reported start — and a modelled date marked “estimated” where none is found. Picking is read as that date plus two weeks.</p>
      <p><strong>Sugar</strong> is estimated from daily temperature with a published grape-ripening model (Parker et al., 2020) calibrated on French vineyards. It shows what grapes picked in that window would typically carry — not a measurement of any bottle.</p>
      <p><strong>Ripening conditions</strong> compare the weather after véraison with the same village’s normal. They show whether the season helped or hindered colour, tannin or freshness; rain, crop size, disease and each grower’s choices change the real result.</p>
      <p><strong>Weather</strong> is read for each village’s vineyards: rain on a 1 km grid, temperature on an 8 km grid corrected to the vines’ elevation. Neighbouring villages share very similar temperatures; rain differs more. Frost days count air frosts in that grid, so a frost that settles only in the lowest vines on a clear night — like April 2016 — may not show.</p>
      {index&&<p><strong>Typical</strong> means the {index.baseline.from}–{index.baseline.to} average{index.baseline.rainFrom?` (rain from ${index.baseline.rainFrom}, when the 1 km radar record begins)`:''}.</p>}
      {index&&<ul>{index.sources.map(source=><li key={source.label}><strong>{source.label}</strong> — {source.detail}</li>)}</ul>}
    </div>
  </details>;
}

/* ---------- The sugar chart ---------- */

const W=342,LEFT=30,RIGHT=338,TOP=22,BOTTOM=194;
const SUGAR_MAX=230;
/** The axis starts low enough for the whole season: real early-August sugar sits well under 150 g/L. */
function sugarScale(...series:number[][]){
  const lowest=Math.min(...series.flat());
  // Cold years start low (1965: 70 g/L on 1 August), so the axis can open at 60 rather than clip them.
  const min=Math.max(60,Math.min(150,Math.floor(lowest/20)*20));
  const y=(sugar:number)=>BOTTOM-2-(Math.min(SUGAR_MAX,Math.max(min,sugar))-min)*((BOTTOM-2-TOP-10)/(SUGAR_MAX-min));
  const ticks:number[]=[];
  for(let level=Math.ceil((min+1)/20)*20;level<=220;level+=20)ticks.push(level);
  return {y,ticks};
}

/** Days of axis kept before véraison so its line never sits on the y-axis. */
const VERAISON_LEAD=8;

/**
 * The date axis normally runs 1 August to 10 October. It opens into July when véraison
 * comes earlier, and runs on into October when picking does; the curves cover both.
 */
function chartScale(curve:SugarCurve,year:number,veraison:number,harvest:HarvestReading|null){
  const curveStart=seasonDay(year,curve.start),curveEnd=addDays(curveStart,(curve.values.length-1)*curve.step);
  // The axis normally ends on 10 October; the data runs to the end of October so a late
  // harvest (1965: to 25 October) can extend it and still sit on the curve.
  const usualEnd=Math.min(curveEnd,seasonDay(year,'10-10'));
  const end=Math.min(curveEnd,Math.max(usualEnd,harvest?addDays(harvest.end,3):usualEnd));
  const usualStart=Math.max(curveStart,seasonDay(year,'08-01'));
  const start=Math.max(curveStart,Math.min(usualStart,addDays(veraison,-VERAISON_LEAD))),span=daysBetween(start,end);
  const x=(time:number)=>LEFT+Math.min(span,Math.max(0,daysBetween(start,time)))*(RIGHT-LEFT)/span;
  return {start,curveStart,end,span,x};
}

const path=(points:[number,number][])=>points.map(([px,py],i)=>`${i?'L':'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');

/**
 * Sugar against date: this year's curve, the usual one and its spread, the
 * picking window, véraison, and the line where grapes count as ripe - with a
 * dot where each curve crosses it, so "8 days later" is something you can see.
 */
export function SugarChart({year,curve,normal,low,high,harvest,veraison,ripeSugar}:{
  year:number;curve:SugarCurve;normal:SugarCurve;low:number[];high:number[];
  harvest:HarvestReading|null;veraison:number;ripeSugar:number;
}){
  const {start,curveStart,end,span,x}=chartScale(curve,year,veraison,harvest);
  // Only what is on screen sets the sugar axis: July values below it would stretch it for nothing.
  const visible=(values:number[])=>values.filter((_,i)=>{const time=addDays(curveStart,i*curve.step);return time>=start&&time<=end});
  const {y,ticks:levels}=sugarScale(visible(curve.values),visible(normal.values),visible(low));
  // Each line runs to the axis end: modelled points up to it, then one point read off at the end itself.
  const line=(values:number[]):[number,number][]=>{
    const series={...curve,values};
    const points=values.map((_,i)=>addDays(curveStart,i*curve.step)).filter(time=>time>start&&time<end).map(time=>[x(time),y(sugarOn(series,year,time))] as [number,number]);
    return [[x(start),y(sugarOn(series,year,start))],...points,[x(end),y(sugarOn(series,year,end))]];
  };
  const yearLine=path(line(curve.values));
  const normalLine=path(line(normal.values));
  const bandPath=`${path(line(high))} ${path(line(low).reverse()).replace(/^M/,'L')} Z`;
  const ripe=dayReaching(curve,year,ripeSugar),normalRipe=dayReaching(normal,year,ripeSugar);
  const picked:[number,number][]=[];
  if(harvest)for(let day=0;day<=PICKING_DAYS;day++){const time=addDays(harvest.start,day);picked.push([x(time),y(sugarOn(curve,year,time))])}
  const ticks=[0,1,2,3].map(offset=>Date.UTC(new Date(start).getUTCFullYear(),new Date(start).getUTCMonth()+offset,1)).filter(time=>daysBetween(start,time)>=0&&daysBetween(start,time)<=span);
  const ripeY=y(ripeSugar);
  const verX=x(veraison);
  // Two date labels a few days apart would print over each other; push them
  // to either side of their dots instead.
  const crowded=ripe!=null&&normalRipe!=null&&Math.abs(daysBetween(normalRipe,ripe))<9;
  const anchor=(own:number,other:number|null)=>!crowded||other==null?'middle':own<=other?'end':'start';
  const text={fontFamily:'DM Sans, sans-serif'};
  // "Picked" sits at the top of its band unless a curve runs through there; then at the foot.
  const pickMid=harvest?addDays(harvest.start,PICKING_DAYS/2):0;
  const pickedLabelY=harvest&&Math.min(y(sugarOn(curve,year,pickMid)),y(sugarOn(normal,year,pickMid)))<TOP+30?BOTTOM-26:TOP+14;
  return <svg className="vintage-sugar-chart" viewBox={`0 0 ${W} 222`} role="img" aria-label={`Estimated sugar in the grapes from ${formatDay(curveStart)}, véraison ${formatDay(veraison)}: ${year} against a typical year${harvest?`, picked from ${formatDay(harvest.start)}`:''}${ripe?`, ripe around ${formatDay(ripe)}`:''}.`}>
    {harvest&&<rect x={x(harvest.start)} y={TOP} width={Math.max(2,x(harvest.end)-x(harvest.start))} height={BOTTOM-TOP} className="chart-picking"/>}
    <line x1={verX} y1={TOP} x2={verX} y2={BOTTOM} className="chart-veraison"/>
    {levels.map(level=><g key={level}>
      <line x1={LEFT} y1={y(level)} x2={RIGHT} y2={y(level)} className="chart-grid"/>
      {level!==ripeSugar&&<text x={LEFT-6} y={y(level)+3} textAnchor="end" className="chart-axis" style={text}>{level}</text>}
    </g>)}
    <path d={bandPath} className="chart-band"/>
    <path d={normalLine} className="chart-normal"/>
    <path d={yearLine} className="chart-year"/>
    {picked.length>1&&<path d={path(picked)} className="chart-picked"/>}
    <line x1={LEFT} y1={ripeY} x2={RIGHT} y2={ripeY} className="chart-ripe"/>
    <text x={LEFT-6} y={ripeY+3} textAnchor="end" className="chart-ripe-label" style={text}>{ripeSugar}</text>
    {normalRipe!=null&&<>
      <line x1={x(normalRipe)} y1={ripeY} x2={x(normalRipe)} y2={BOTTOM-18} className="chart-drop is-normal"/>
      <circle cx={x(normalRipe)} cy={ripeY} r={4.5} className="chart-dot is-normal"/>
      <text x={x(normalRipe)} y={BOTTOM-6} textAnchor={anchor(normalRipe,ripe)} className="chart-dot-label is-normal" style={text}>{formatDay(normalRipe)}</text>
    </>}
    {ripe!=null&&<>
      <line x1={x(ripe)} y1={ripeY} x2={x(ripe)} y2={BOTTOM-18} className="chart-drop"/>
      <circle cx={x(ripe)} cy={ripeY} r={5} className="chart-dot"/>
      <text x={x(ripe)} y={BOTTOM-6} textAnchor={anchor(ripe,normalRipe)} className="chart-dot-label" style={text}>{formatDay(ripe)}</text>
    </>}
    <line x1={LEFT} y1={BOTTOM} x2={RIGHT} y2={BOTTOM} className="chart-axis-line"/>
    {/* The start date only when no month label sits close enough to collide with it. */}
    {!ticks.some(time=>time>start&&daysBetween(start,time)<14)&&<text x={LEFT} y={212} className="chart-axis is-month" style={text}>{formatDay(start)}</text>}
    {ticks.filter(time=>time>start).map(time=><text key={time} x={x(time)} y={212} textAnchor="middle" className="chart-axis is-month" style={text}>{formatDay(time)}</text>)}
    {/* Labels last, outlined in the card colour, so a curve running high never hides them. */}
    {harvest&&<text x={(x(harvest.start)+x(harvest.end))/2} y={pickedLabelY} textAnchor="middle" className="chart-picking-label" style={text}>Picked</text>}
    <text x={verX+5} y={TOP+14} className="chart-veraison-label" style={text}>Véraison</text>
  </svg>;
}

// Short enough for three to share one row on a phone; the full phrase is the chip's title.
const OUTLOOK_REASONS:Record<OutlookDriver['id'],[string,string,string,string]>={
  ripeness:['Riper','Less ripe','Riper grapes','Less ripe grapes'],
  warmth:['Warmer','Cooler','Warmer season','Cooler season'],
  heat:['Less heat','Heat stress','Less heat stress','More heat stress'],
  wet:['Less rot','More rot','Fewer rot days','More rot days'],
  harvestRain:['Dry harvest','Wet harvest','Drier harvest','Wetter harvest'],
  acidity:['Fresher','Softer acid','Fresher acidity','Softer acidity'],
  hail:['Less hail','Hail','Less hail','Hail']
};
const BEYOND_WORDS:Record<OutlookDriver['id'],string>={
  ripeness:'ripeness',warmth:'season heat',heat:'heat stress',wet:'wet ripening days',harvestRain:'harvest rain',acidity:'ripening warmth',hail:'hail'
};
const outlookLabel=(labels:string[],score:number)=>labels[Math.min(labels.length,Math.max(1,Math.round(score)))-1];
const scalePosition=(score:number)=>`${(Math.min(5,Math.max(1,score))-1)/4*100}%`;

/**
 * What the season's weather points to on the critics' scale, with the range
 * its past errors allow, the reasons, and how well it has done before. The
 * critics' own consensus sits beside it when there is one.
 */
export function QualityOutlookCard({year,grapeName,outlook,model,check,consensus}:{
  year:number;grapeName:string;outlook:QualityOutlook;model:QualityModel;
  check:OutlookCheck;consensus:[number,number]|null;
}){
  const {labels}=model,modern=year>=model.modernFrom;
  const label=outlookLabel(labels,outlook.score),low=outlookLabel(labels,outlook.low),high=outlookLabel(labels,outlook.high);
  return <section className="vintage-card vintage-outlook" aria-labelledby="vintage-outlook-title">
    <div className="vintage-card-head"><h2 id="vintage-outlook-title">Quality outlook</h2><span>{grapeName} · from the weather</span></div>
    <p className="vintage-outlook-main"><strong>{label}</strong><small>{low===high?`likely ${low.toLowerCase()}`:`likely ${low.toLowerCase()} to ${high.toLowerCase()}`}</small></p>
    <div className="vintage-outlook-scale" role="img" aria-label={`Weather points to ${label.toLowerCase()}, range ${low.toLowerCase()} to ${high.toLowerCase()}${consensus?`; critics' consensus ${outlookLabel(labels,consensus[0]).toLowerCase()}`:''}.`}>
      <span className="vintage-outlook-range" style={{left:scalePosition(outlook.low),right:`calc(100% - ${scalePosition(outlook.high)})`}}/>
      <span className="vintage-outlook-mark" style={{left:scalePosition(outlook.score)}}/>
      {consensus&&<span className="vintage-outlook-critics-mark" style={{left:scalePosition(consensus[0])}}/>}
    </div>
    <ol className="vintage-outlook-steps" aria-hidden="true">{labels.map(item=><li key={item}>{item}</li>)}</ol>
    {outlook.drivers.length>0&&<ul className="vintage-outlook-reasons" style={{gridTemplateColumns:`repeat(${outlook.drivers.length},minmax(0,1fr))`}}>{outlook.drivers.map(driver=>{
      const [short,full]=driver.effect==='helps'?[OUTLOOK_REASONS[driver.id][0],OUTLOOK_REASONS[driver.id][2]]:[OUTLOOK_REASONS[driver.id][1],OUTLOOK_REASONS[driver.id][3]];
      return <li key={driver.id} className={`vintage-outlook-reason-${driver.effect}`} title={full}>
        <b aria-hidden="true">{driver.effect==='helps'?'↑':'↓'}</b><span aria-hidden="true">{short}</span><span className="visually-hidden">{full}</span>
      </li>;
    })}</ul>}
    {consensus&&<p className="vintage-outlook-critics"><span className="vintage-outlook-key" aria-hidden="true"/>Critics’ consensus: <strong>{outlookLabel(labels,consensus[0])}</strong> ({consensus[1]} critics)</p>}
    {outlook.beyondTested&&outlook.beyondTested.length>0&&<p className="vintage-callout">This season’s <strong>{outlook.beyondTested.map(id=>BEYOND_WORDS[id]).join(' and ')}</strong> went well past every vintage the outlook was tested on, so it is read as the most extreme of those. Treat it with extra caution.</p>}
    <p className="vintage-outlook-note">{modern
      ?`Tested on past vintages, the weather alone landed within one step of the critics in ${Math.round(check.withinOneStep*100)}% of seasons since ${model.modernFrom}. Growers now soften what the weather does, so it ranks modern vintages only loosely.`
      :`Tested on past vintages, the weather alone landed within one step of the critics in ${Math.round(check.withinOneStep*100)}% of seasons before ${model.modernFrom}, when it decided more of the outcome.`}</p>
  </section>;
}
