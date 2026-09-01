import { useEffect,useMemo,useState } from 'react';
import { addToCellar,type CellarHolding } from './api';
import { getProducer,resolveProducer } from '../producers/api';
import { resolvePlace } from '../../lib/places/resolve';

/** A wine this producer is known to make, however the app came to know it. */
type KnownWine={name:string;appellation:string|null;style:string|null};

const SIZES:Array<[number,string]>=[[375,'Half · 375ml'],[750,'Bottle · 750ml'],[1500,'Magnum · 1.5L'],[3000,'Double magnum · 3L'],[6000,'Imperial · 6L']];
const STYLES=['red','white','rose','sparkling','dessert','fortified','orange'];

/**
 * Adding bottles you hold.
 *
 * Typed rather than photographed, because you add a case from an invoice and
 * not with the bottles in front of you - and because a holding carries no photo
 * until it is drunk. Most of the typing is avoided rather than asked for: pick
 * a producer you already have and the cuvees you have drunk plus the producer's
 * researched range are offered, each of which brings its own appellation and
 * style. Whatever is left, the place tree fills on save, exactly as it does for
 * a wine - type "Etna" and the region and country arrive with it.
 *
 * Nothing here calls the AI. A cellar bottle already has an identity; that is
 * what recognition exists to find.
 */
export function AddToCellarSheet({onClose,onAdded}:{onClose:()=>void;onAdded:(holding:CellarHolding)=>void}){
  const [producer,setProducer]=useState(''),[wineName,setWineName]=useState('');
  const [vintage,setVintage]=useState(''),[appellation,setAppellation]=useState(''),[style,setStyle]=useState('');
  const [country,setCountry]=useState(''),[region,setRegion]=useState('');
  const [bottles,setBottles]=useState('1'),[size,setSize]=useState('750');
  const [price,setPrice]=useState(''),[currency,setCurrency]=useState(''),[purchasedAt,setPurchasedAt]=useState('');
  const [merchant,setMerchant]=useState(''),[location,setLocation]=useState(''),[notes,setNotes]=useState('');
  const [known,setKnown]=useState<{id:string;canonicalName:string}|null>(null);
  const [choices,setChoices]=useState<KnownWine[]>([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');

  // Which producer this is, and what it makes. Both are lookups the app has
  // already paid for: the producer identity, and the catalogue that producer
  // research wrote. Debounced so typing a name is not a request per keystroke.
  useEffect(()=>{
    const name=producer.trim();
    if(!name){setKnown(null);setChoices([]);return}
    let live=true;const timer=window.setTimeout(async()=>{
      try{
        const resolution=await resolveProducer(name);
        if(!live)return;
        const match=resolution.producer;
        if(!match){setKnown(null);setChoices([]);return}
        setKnown({id:match.id,canonicalName:match.canonicalName});
        const detail=await getProducer(match.id).catch(()=>null);
        if(!live||!detail)return;
        // Three sources, all already paid for: the cuvees you have drunk, the
        // producer's researched range, and the catalogue entries research wrote
        // as plain text. Cuvees first, because a wine you have opened is the
        // more likely one to be buying again.
        const known:KnownWine[]=[
          ...detail.catalogCuvees.map(cuvee=>({name:cuvee.canonicalName,appellation:cuvee.appellation,style:cuvee.wineStyle})),
          ...detail.tastedWines.map(wine=>({name:wine.wineName,appellation:wine.appellation,style:wine.wineStyle})),
          ...detail.catalog.map(entry=>({name:entry.name,appellation:entry.appellation??null,style:entry.style??entry.category??null}))
        ];
        const seen=new Set<string>();
        setChoices(known.filter(entry=>{
          const key=entry.name?.trim().toLowerCase();
          if(!key||seen.has(key))return false;
          seen.add(key);return true;
        }));
      }catch{if(live){setKnown(null);setChoices([])}}
    },400);
    return()=>{live=false;window.clearTimeout(timer)};
  },[producer]);

  /**
   * Where the place tree files this appellation, worked out as you type.
   *
   * Pure and local - the same resolvePlace a wine save runs, so what is shown
   * here is what will be stored, and it costs no request and no token. The tree
   * carries most of the wine world at region level, but not all of it, and an
   * appellation it has never heard of would otherwise be filed under no country
   * at all: invisible to the country filter, and a bottle that would take no
   * stamp on the Passport when it is eventually opened.
   */
  const derived=useMemo(()=>{
    const named=appellation.trim();
    if(!named)return null;
    const place=resolvePlace({country:country.trim()||null,region:region.trim()||null,appellation:named});
    return {country:place.country,region:place.region,appellation:place.appellation,
      denomination:place.denomination,known:Boolean(place.placeId)};
  },[appellation,country,region]);

  function pick(name:string){
    const entry=choices.find(choice=>choice.name===name);
    if(!entry)return;
    setWineName(entry.name);
    if(entry.appellation)setAppellation(entry.appellation);
    if(entry.style&&STYLES.includes(entry.style))setStyle(entry.style);
  }

  async function submit(){
    setError('');setBusy(true);
    try{
      const holding=await addToCellar({
        producer:known?.canonicalName&&known.canonicalName.toLowerCase()===producer.trim().toLowerCase()?known.canonicalName:producer.trim(),
        wineName:wineName.trim(),
        vintage:vintage.trim()?Number(vintage.trim()):null,
        country:country.trim()||null,region:region.trim()||null,appellation:appellation.trim()||null,
        wineStyle:style||null,
        bottles:Number(bottles)||1,bottleSizeMl:Number(size)||750,
        purchasePrice:price.trim()?Number(price.trim()):null,
        currency:currency.trim()||null,purchasedAt:purchasedAt||null,
        merchant:merchant.trim()||null,location:location.trim()||null,notes:notes.trim()
      });
      onAdded(holding);
    }catch(e){setError((e as Error).message||'Could not add those bottles')}
    finally{setBusy(false)}
  }

  const ready=Boolean(producer.trim()&&wineName.trim()&&Number(bottles)>0);
  return <div className="cellar-sheet-backdrop" role="presentation" onClick={()=>{if(!busy)onClose()}}>
    <div className="cellar-sheet" role="dialog" aria-modal="true" aria-labelledby="cellar-add-title" onClick={event=>event.stopPropagation()}>
      <div className="cellar-sheet-head">
        <div><p className="eyebrow">PUT BOTTLES AWAY</p><h2 id="cellar-add-title">Add to cellar</h2></div>
        <button type="button" className="cellar-sheet-close" onClick={onClose} disabled={busy} aria-label="Close">×</button>
      </div>
      <p className="cellar-sheet-note">These bottles stay out of your journal and out of every statistic until you open one.</p>

      <label className="cellar-field">Producer *
        <input value={producer} onChange={event=>setProducer(event.target.value)} placeholder="Domaine, château or estate" autoFocus/>
      </label>
      {known&&<p className="cellar-resolution">✓ Existing producer · {known.canonicalName}</p>}

      <label className="cellar-field">Wine name *
        <input list="cellar-known-wines" value={wineName} onChange={event=>{setWineName(event.target.value);pick(event.target.value)}} placeholder="Cuvée or bottling"/>
      </label>
      {choices.length>0&&<datalist id="cellar-known-wines">{choices.map(entry=><option key={entry.name} value={entry.name}>{entry.appellation??''}</option>)}</datalist>}
      {choices.length>0&&<p className="cellar-hint">{choices.length} known wine{choices.length===1?'':'s'} from this producer — picking one fills its appellation and style.</p>}

      <div className="cellar-row">
        <label className="cellar-field">Vintage<input inputMode="numeric" value={vintage} onChange={event=>setVintage(event.target.value)} placeholder="NV"/></label>
        <label className="cellar-field">Style<select value={style} onChange={event=>setStyle(event.target.value)}><option value="">Style</option>{STYLES.map(value=><option key={value}>{value}</option>)}</select></label>
      </div>
      <label className="cellar-field">Appellation
        <input value={appellation} onChange={event=>setAppellation(event.target.value)} placeholder="Etna, Barolo, Pauillac…"/>
        <small>Or the region — the tree decides which column a name belongs in, so Napa Valley files the same either way.</small>
      </label>
      {derived&&(derived.known
        ?<p className="cellar-resolution">✓ Filed under {[derived.appellation,derived.region,derived.country].filter(Boolean).join(' · ')}{derived.denomination&&<small> · recognised as {derived.denomination}, no need to type it</small>}</p>
        :<p className="cellar-unresolved">The place tree does not carry “{appellation.trim()}”. Name the country yourself, or these bottles are filed under nowhere — no country filter finds them, and the wine takes no stamp when you open it.</p>)}
      <div className="cellar-row">
        <label className="cellar-field">Country<input value={country} onChange={event=>setCountry(event.target.value)} placeholder={derived?.country??'Country'}/></label>
        <label className="cellar-field">Region<input value={region} onChange={event=>setRegion(event.target.value)} placeholder={derived?.region??'Region'}/></label>
      </div>

      <div className="cellar-row">
        <label className="cellar-field">Bottles *<input inputMode="numeric" value={bottles} onChange={event=>setBottles(event.target.value)}/></label>
        <label className="cellar-field">Format<select value={size} onChange={event=>setSize(event.target.value)}>{SIZES.map(([ml,label])=><option key={ml} value={ml}>{label}</option>)}</select></label>
      </div>
      <div className="cellar-row">
        <label className="cellar-field">Paid<input inputMode="decimal" value={price} onChange={event=>setPrice(event.target.value)} placeholder="Per bottle"/></label>
        <label className="cellar-field">Currency<input value={currency} onChange={event=>setCurrency(event.target.value)} placeholder="HKD" maxLength={3}/></label>
      </div>
      <div className="cellar-row">
        <label className="cellar-field">Bought<input type="date" value={purchasedAt} onChange={event=>setPurchasedAt(event.target.value)}/></label>
        <label className="cellar-field">From<input value={merchant} onChange={event=>setMerchant(event.target.value)} placeholder="Merchant"/></label>
      </div>
      <label className="cellar-field">Where it is<input value={location} onChange={event=>setLocation(event.target.value)} placeholder="Rack, case, offsite…"/></label>
      <label className="cellar-field">Notes<textarea rows={2} value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Anything worth remembering about these bottles"/></label>

      {error&&<p className="cellar-error" role="alert">{error}</p>}
      <div className="cellar-sheet-actions">
        <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="primary" onClick={()=>void submit()} disabled={!ready||busy}>{busy?'Adding…':`Add ${Number(bottles)||1} bottle${Number(bottles)===1?'':'s'}`}</button>
      </div>
    </div>
  </div>;
}
