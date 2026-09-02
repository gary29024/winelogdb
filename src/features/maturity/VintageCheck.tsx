import { useEffect,useState } from 'react';
import { maturityPair,vintageCacheKey,windowShift,type VintageSubject,type VintageWindow } from '../../lib/maturity/vintageWindow';
import { resolvePlace } from '../../lib/places/resolve';
import { getVintageWindow,lookUpVintageWindow } from './api';
import { DrinkingWindow } from './DrinkingWindow';
import '../../maturity.css';

type Wine=VintageSubject&{classification?:string|null};

const sameYears=(shift:{from:number;to:number}|null)=>shift!=null&&shift.from===0&&shift.to===0;
const years=(value:number)=>`${value>0?'+':''}${value}`;

/**
 * Both answers about when to open a bottle, kept apart on purpose.
 *
 * The calculated window comes from the place and the style and never changes.
 * The researched one is what a source said about this particular year. Where
 * they differ, the difference is the whole point - a cold vintage that pulled
 * the window in, a great one that pushed it out - so neither replaces the
 * other and both stay on screen with their basis named.
 *
 * A search is spent only on the button, and only once per region and vintage:
 * a growing season does not change, and every wine you own from that cell reads
 * the same answer afterwards for nothing.
 */
export function VintageCheck({wine}:{wine:Wine}){
  const [researched,setResearched]=useState<VintageWindow|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const subject:VintageSubject={country:wine.country,region:wine.region,appellation:wine.appellation,
    vintage:wine.vintage,wineStyle:wine.wineStyle,classification:wine.classification};
  const askable=Boolean(wine.vintage&&(wine.appellation||wine.region||wine.country));
  /**
   * The place the lookup is actually keyed on, rather than the region column.
   * A bottle edited from a Salon into a Charmes-Chambertin can still be carrying
   * Champagne in that column, and offering "one search for every wine from
   * Champagne 2013" while asking about Burgundy is a promise about the wrong
   * cell.
   */
  const where=resolvePlace({country:wine.country??null,region:wine.region??null,appellation:wine.appellation??null});
  const asked=where.region??where.country??wine.region??wine.country;

  /**
   * What is already known about this cell, keyed on the cell rather than on the
   * boxes.
   *
   * The subject can come from a form being typed into, where every keystroke in
   * the appellation is a new object but almost none of them are a new cell -
   * the key resolves through the place tree, so "Charmes-Chambertin" and
   * "Chambertin-Clos de Bèze" are the same Burgundy. The short wait is for the
   * ones that do change it: half a word typed is a cell of its own, and asking
   * about each is a request nobody wanted.
   */
  const cell=askable?vintageCacheKey(subject):'';

  useEffect(()=>{
    if(!cell){setResearched(null);return}
    let live=true;
    const timer=setTimeout(()=>{
      getVintageWindow(subject).then(found=>{if(live)setResearched(found)}).catch(()=>{});
    },300);
    return()=>{live=false;clearTimeout(timer)};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[cell]);

  /**
   * The search itself. `again` spends a fresh one on a cell that already has an
   * answer, which is the only way to replace a note written before the prompt
   * was - or one that reads as being about the bottle that happened to ask
   * rather than about the year.
   */
  async function look(again=false){
    setBusy(true);setError('');
    try{const {window}=await lookUpVintageWindow(subject,again);setResearched(window)}
    catch(e){setError((e as Error).message||'Could not look up that vintage')}
    finally{setBusy(false)}
  }

  const pair=maturityPair(wine,researched);
  const shift=windowShift(pair);
  if(!pair.calculated&&!pair.researched&&!askable)return null;

  return <div className="vintage-check">
    <DrinkingWindow wine={wine}/>

    {pair.researched
      ?<div className="vintage-researched">
        <div className="vintage-researched-head">
          <strong>{wine.vintage} in {researched?.region||researched?.country||asked}</strong>
          <span className="maturity-window">Drink {pair.researched.from}–{pair.researched.to}</span>
          {shift&&!sameYears(shift)&&<span className="vintage-shift">{years(shift.from)} / {years(shift.to)} on the usual</span>}
          {sameYears(shift)&&<span className="vintage-shift">Same as the usual window</span>}
        </div>
        {/* The note and the sources fold away together. The years and the
            shift are the answer; the prose behind them ran to six lines on a
            phone, which pushed the form it sits above off the screen. */}
        <details className="vintage-sources">
          <summary>Why this vintage · {pair.researched.sources.length} source{pair.researched.sources.length===1?'':'s'} · {pair.researched.researchedAt.slice(0,10)}</summary>
          {pair.researched.note&&<p className="vintage-note">{pair.researched.note}</p>}
          <ul>{pair.researched.sources.map(source=><li key={source.url}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>
          </li>)}</ul>
          {/* Inside the disclosure on purpose: a stored answer is meant to be
              reused, and a button that spends a search should not sit next to
              one that does not. */}
          <p className="vintage-again">
            <button type="button" className="quiet" onClick={()=>void look(true)} disabled={busy}>
              {busy?'Searching…':'Look it up again'}
            </button>
            <small>Spends one search and replaces this for every wine you own from {asked} {wine.vintage}.</small>
          </p>
        </details>
      </div>
      :askable&&<div className="vintage-ask">
        <button type="button" onClick={()=>void look()} disabled={busy}>
          {busy?'Searching…':`Look up ${wine.vintage}`}
        </button>
        <small>One search, kept for every wine you own from {asked} {wine.vintage} — the year is a regional fact. The window above stays either way.</small>
      </div>}

    {error&&<p className="cellar-error" role="alert">{error}</p>}
  </div>;
}
