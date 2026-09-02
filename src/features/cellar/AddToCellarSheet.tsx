import { useEffect,useMemo,useRef,useState } from 'react';
import { addToCellar,updateHolding,type CellarHolding } from './api';
import { VintageCheck } from '../maturity/VintageCheck';
import { getProducer,resolveProducer,type ProducerResolution } from '../producers/api';
import { resolvePlace } from '../../lib/places/resolve';
// The suggestion banner is the scan form's, down to the class names, so it is
// the same control in both places rather than a second one that looks like it.
import '../../producerResolution.css';
import '../../wineFormCompact.css';

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
export function AddToCellarSheet({onClose,onAdded,holding,onRemove}:{onClose:()=>void;onAdded:(holding:CellarHolding)=>void;
  /** An existing line, to correct rather than add to. */
  holding?:CellarHolding;
  /**
   * Dropping the line entirely. Only offered while editing, and here rather
   * than on the row: it is the rarest thing done to a holding and the only one
   * that cannot be undone, so it belongs behind the screen you open on purpose.
   */
  onRemove?:(holding:CellarHolding)=>Promise<void>|void}){
  const editing=Boolean(holding);
  const [producer,setProducer]=useState(holding?.producer??''),[wineName,setWineName]=useState(holding?.wineName??'');
  const [vintage,setVintage]=useState(holding?.vintage!=null?String(holding.vintage):''),[appellation,setAppellation]=useState(holding?.appellation??''),[style,setStyle]=useState(holding?.wineStyle??'');
  const [country,setCountry]=useState(holding?.country??''),[region,setRegion]=useState(holding?.region??'');
  const [bottles,setBottles]=useState(holding?String(holding.bottles):'1'),[size,setSize]=useState(String(holding?.bottleSizeMl??750));
  const [price,setPrice]=useState(holding?.purchasePrice!=null?String(holding.purchasePrice):''),[currency,setCurrency]=useState(holding?.currency??''),[purchasedAt,setPurchasedAt]=useState(holding?.purchasedAt??'');
  const [merchant,setMerchant]=useState(holding?.merchant??''),[location,setLocation]=useState(holding?.location??''),[notes,setNotes]=useState(holding?.notes??'');
  const [resolution,setResolution]=useState<ProducerResolution|null>(null),[resolving,setResolving]=useState(false);
  /** The spelling the library uses, once it has been taken - so the screen can say it did. */
  const [adopted,setAdopted]=useState('');
  const [choices,setChoices]=useState<KnownWine[]>([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  /** The place the boxes were last filled from, so typing in them is not stomped. */
  const filledFrom=useRef<string|null>(null);

  const matched=resolution?.matched?resolution.producer:undefined;
  const suggestion=resolution?.matched?undefined:resolution?.suggestion;

  /**
   * Which producer this is, on the same mechanism the scan form uses and
   * against the same endpoint: an exact match, or a suggestion where one name
   * contains the other. Debounced so typing is not a request per keystroke.
   */
  useEffect(()=>{
    const name=producer.trim();
    if(!name){setResolution(null);setResolving(false);return}
    let cancelled=false;
    setResolving(true);
    const timer=window.setTimeout(()=>{
      resolveProducer(name)
        .then(result=>{if(!cancelled)setResolution(result)})
        .catch(()=>{if(!cancelled)setResolution(null)})
        .finally(()=>{if(!cancelled)setResolving(false)});
    },250);
    return()=>{cancelled=true;window.clearTimeout(timer)};
  },[producer]);

  /**
   * The library already knew this house, so the bottles are filed under the name
   * the library uses.
   *
   * It matters more here than on a wine form. A holding stores the producer as
   * text, and that text is what creates the producer when the bottle is finally
   * opened - so a spelling that drifted at the cellar door becomes a duplicate
   * producer months later, long after anyone could connect the two.
   *
   * Only when the field still holds the name that was resolved: the probe is
   * debounced, and landing on top of newer typing would be worse than the drift
   * it is fixing.
   */
  useEffect(()=>{
    const canonical=matched?.canonicalName;
    if(!canonical||producer.trim()!==resolution?.inputName||producer===canonical)return;
    setProducer(canonical);
    setAdopted(canonical);
  },[matched,resolution,producer]);

  // What this producer makes, for the wine-name list. A second lookup only once
  // there is a producer to ask about, and one the app has already paid for.
  useEffect(()=>{
    if(!matched?.id){setChoices([]);return}
    let live=true;
    getProducer(matched.id).then(detail=>{
      if(!live||!detail)return;
      // Three sources, all already paid for: the cuvees you have drunk, the
      // producer's researched range, and the catalogue entries research wrote
      // as plain text. Cuvees first, because a wine you have opened is the more
      // likely one to be buying again.
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
    }).catch(()=>{if(live)setChoices([])});
    return()=>{live=false};
  },[matched?.id]);

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

  /**
   * Follow the appellation with the country and the region.
   *
   * Editing a Salon into a Charmes-Chambertin left Champagne sitting in the
   * region box, and the box is what gets sent - so the bottle was saved as a
   * Burgundy grand cru in Champagne. The save re-derives the place either way,
   * but the form should not have shown one answer and stored another.
   *
   * Only when the tree actually recognised somewhere, and only once per place:
   * a country typed by hand for a place the tree has never heard of is the
   * whole reason these boxes exist, and must not be overwritten.
   */
  useEffect(()=>{
    const placeId=derived?.known?`${derived.country}|${derived.region}`:null;
    if(!placeId||filledFrom.current===placeId)return;
    filledFrom.current=placeId;
    setCountry(derived?.country??'');
    setRegion(derived?.region??'');
  },[derived]);

  function pick(name:string){
    const entry=choices.find(choice=>choice.name===name);
    if(!entry)return;
    setWineName(entry.name);
    if(entry.appellation)setAppellation(entry.appellation);
    if(entry.style&&STYLES.includes(entry.style))setStyle(entry.style);
  }

  async function submit(){
    setError('');setBusy(true);
    // One shape for both, because a correction and a first entry describe the
    // same bottle. The only difference is which row it lands in.
    const entry={
      producer:producer.trim(),
      wineName:wineName.trim(),
      vintage:vintage.trim()?Number(vintage.trim()):null,
      country:country.trim()||null,region:region.trim()||null,appellation:appellation.trim()||null,
      wineStyle:style||null,
      bottles:Number(bottles)||1,bottleSizeMl:Number(size)||750,
      purchasePrice:price.trim()?Number(price.trim()):null,
      currency:currency.trim().toUpperCase()||null,purchasedAt:purchasedAt||null,
      merchant:merchant.trim()||null,location:location.trim()||null,notes:notes.trim()
    };
    try{
      const saved=editing?await updateHolding(holding!.id,entry):await addToCellar(entry);
      if(saved)onAdded(saved);else onClose();
    }catch(e){setError((e as Error).message||(editing?'Could not save those changes':'Could not add those bottles'))}
    finally{setBusy(false)}
  }

  const ready=Boolean(producer.trim()&&wineName.trim()&&Number(bottles)>0);
  return <div className="cellar-sheet-backdrop" role="presentation" onClick={()=>{if(!busy)onClose()}}>
    <div className="cellar-sheet" role="dialog" aria-modal="true" aria-labelledby="cellar-add-title" onClick={event=>event.stopPropagation()}>
      <div className="cellar-sheet-head">
        <div><p className="eyebrow">{editing?'BOTTLES YOU HOLD':'PUT BOTTLES AWAY'}</p><h2 id="cellar-add-title">{editing?holding!.wineName:'Add to cellar'}</h2></div>
        <button type="button" className="cellar-sheet-close" onClick={onClose} disabled={busy} aria-label="Close">×</button>
      </div>
      <p className="cellar-sheet-note">These bottles stay out of your journal and out of every statistic until you open one.</p>

      {/* Where a cellar bottle's drinking window belongs: this is the screen you
          are on when you are deciding whether to open it, and the only one that
          exists for a wine you have not drunk. */}
      {editing&&<VintageCheck wine={holding!}/>}

      <label className="cellar-field">Producer *
        <input value={producer} onChange={event=>setProducer(event.target.value)} placeholder="Domaine, château or estate" autoFocus/>
      </label>
      {suggestion&&<div className="producer-resolution producer-suggestion">
        <span>Did you mean <strong>{suggestion.canonicalName}</strong>? {suggestion.tastedCount} wine{suggestion.tastedCount===1?'':'s'} logged.</span>
        <button type="button" onClick={()=>{setProducer(suggestion.canonicalName);setAdopted('')}}>Use it</button>
      </div>}
      {producer.trim()&&(resolving
        ?<p className="cellar-resolution checking">Checking producer library…</p>
        :matched
          ?<p className="cellar-resolution">✓ Existing producer · {matched.canonicalName}<small> · {matched.tastedCount} tasted{matched.catalogCount?` · ${matched.catalogCount} in researched range`:''}</small></p>
          :<p className="cellar-new-producer">○ New to the library. These bottles are filed under the name as typed — nothing is created in Producers until you open one.</p>)}
      {adopted&&adopted===producer&&<p className="cellar-hint">Filed under the library's spelling, {adopted}. Type over it if that is wrong.</p>}

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
        {!derived&&<small>Or the region — the tree decides which column a name belongs in.</small>}
      </label>
      {derived&&(derived.known
        ?<p className="cellar-resolution">✓ Filed under {[derived.appellation,derived.region,derived.country].filter(Boolean).join(' · ')}{derived.denomination&&<small> · recognised as {derived.denomination}, no need to type it</small>}</p>
        :<p className="cellar-unresolved">“{appellation.trim()}” is not in the place tree — name the country below, or these bottles are filed under nowhere.</p>)}
      <div className="cellar-row">
        <label className="cellar-field">Country<input value={country} onChange={event=>setCountry(event.target.value)} placeholder={derived?.country??'Country'}/></label>
        <label className="cellar-field">Region<input value={region} onChange={event=>setRegion(event.target.value)} placeholder={derived?.region??'Region'}/></label>
      </div>

      <div className="cellar-row">
        <label className="cellar-field">Bottles *<input inputMode="numeric" value={bottles} onChange={event=>setBottles(event.target.value)}/></label>
        <label className="cellar-field">Format<select value={size} onChange={event=>setSize(event.target.value)}>{SIZES.map(([ml,label])=><option key={ml} value={ml}>{label}</option>)}</select></label>
      </div>
      <div className="cellar-row stack-narrow">
        <label className="cellar-field">Paid
          <div className="price-currency-inputs">
            <input value={currency} onChange={event=>setCurrency(event.target.value.toUpperCase())} placeholder="HKD" maxLength={3} autoCapitalize="characters" spellCheck={false} aria-label="Currency"/>
            <input inputMode="decimal" value={price} onChange={event=>setPrice(event.target.value)} placeholder="Per bottle" aria-label="Price"/>
          </div>
        </label>
        <label className="cellar-field">Bought<input type="date" value={purchasedAt} onChange={event=>setPurchasedAt(event.target.value)}/></label>
      </div>
      <div className="cellar-row">
        <label className="cellar-field">From<input value={merchant} onChange={event=>setMerchant(event.target.value)} placeholder="Merchant"/></label>
        <label className="cellar-field">Where it is<input value={location} onChange={event=>setLocation(event.target.value)} placeholder="Rack or case"/></label>
      </div>
      <label className="cellar-field">Notes<textarea rows={2} value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Anything worth remembering"/></label>

      {error&&<p className="cellar-error" role="alert">{error}</p>}
      <div className="cellar-sheet-actions">
        {editing&&onRemove&&<button type="button" className="quiet cellar-drop cellar-sheet-drop" disabled={busy}
          onClick={()=>void onRemove(holding!)}>Remove these bottles</button>}
        <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="primary" onClick={()=>void submit()} disabled={!ready||busy}>{busy?(editing?'Saving…':'Adding…'):editing?'Save changes':`Add ${Number(bottles)||1} bottle${Number(bottles)===1?'':'s'}`}</button>
      </div>
    </div>
  </div>;
}
