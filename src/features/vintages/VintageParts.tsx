import { addDays,dayReaching,daysBetween,formatDay,PICKING_DAYS,seasonDay,sugarOn,type Baseline,type HarvestReading,type SeasonScore } from './model';
import type { SugarCurve,VintageIndex } from './types';
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
  const min=Math.max(80,Math.min(150,Math.floor(lowest/20)*20));
  const y=(sugar:number)=>BOTTOM-2-(Math.min(SUGAR_MAX,Math.max(min,sugar))-min)*((BOTTOM-2-TOP-10)/(SUGAR_MAX-min));
  const ticks:number[]=[];
  for(let level=Math.ceil((min+1)/20)*20;level<=220;level+=20)ticks.push(level);
  return {y,ticks};
}

function chartScale(curve:SugarCurve,year:number){
  const start=seasonDay(year,curve.start),span=(curve.values.length-1)*curve.step;
  const x=(time:number)=>LEFT+Math.min(span,Math.max(0,daysBetween(start,time)))*(RIGHT-LEFT)/span;
  return {start,span,x};
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
  const {start,span,x}=chartScale(curve,year);
  const {y,ticks:levels}=sugarScale(curve.values,normal.values,low);
  const at=(values:number[],i:number):[number,number]=>[LEFT+i*curve.step*(RIGHT-LEFT)/span,y(values[i])];
  const yearLine=path(curve.values.map((_,i)=>at(curve.values,i)));
  const normalLine=path(normal.values.map((_,i)=>at(normal.values,i)));
  const bandPath=`${path(high.map((_,i)=>at(high,i)))} ${path(low.map((_,i)=>at(low,i)).reverse()).replace(/^M/,'L')} Z`;
  const ripe=dayReaching(curve,year,ripeSugar),normalRipe=dayReaching(normal,year,ripeSugar);
  const picked:[number,number][]=[];
  if(harvest)for(let day=0;day<=PICKING_DAYS;day++){const time=addDays(harvest.start,day);picked.push([x(time),y(sugarOn(curve,year,time))])}
  const ticks=[1,2,3].map(offset=>Date.UTC(new Date(start).getUTCFullYear(),new Date(start).getUTCMonth()+offset-1,1)).filter(time=>daysBetween(start,time)<=span);
  const ripeY=y(ripeSugar);
  // In hot years véraison comes before the chart's first day: pin it to the edge and say when.
  const early=veraison<start,verX=early?LEFT:x(veraison);
  // Two date labels a few days apart would print over each other; push them
  // to either side of their dots instead.
  const crowded=ripe!=null&&normalRipe!=null&&Math.abs(daysBetween(normalRipe,ripe))<9;
  const anchor=(own:number,other:number|null)=>!crowded||other==null?'middle':own<=other?'end':'start';
  const text={fontFamily:'DM Sans, sans-serif'};
  return <svg className="vintage-sugar-chart" viewBox={`0 0 ${W} 222`} role="img" aria-label={`Estimated sugar in the grapes from ${formatDay(start)}: ${year} against a typical year${harvest?`, picked from ${formatDay(harvest.start)}`:''}${ripe?`, ripe around ${formatDay(ripe)}`:''}.`}>
    {harvest&&<>
      <rect x={x(harvest.start)} y={TOP} width={Math.max(2,x(harvest.end)-x(harvest.start))} height={BOTTOM-TOP} className="chart-picking"/>
      <text x={(x(harvest.start)+x(harvest.end))/2} y={TOP+14} textAnchor="middle" className="chart-picking-label" style={text}>Picked</text>
    </>}
    <line x1={verX} y1={TOP} x2={verX} y2={BOTTOM} className="chart-veraison"/>
    <text x={verX+5} y={TOP+14} className="chart-veraison-label" style={text}>{early?`‹ Véraison ${formatDay(veraison)}`:'Véraison'}</text>
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
    <text x={LEFT} y={212} className="chart-axis is-month" style={text}>{formatDay(start)}</text>
    {ticks.filter(time=>time>start).map(time=><text key={time} x={x(time)} y={212} textAnchor="middle" className="chart-axis is-month" style={text}>{formatDay(time)}</text>)}
  </svg>;
}
