import { useEffect,useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WineForm } from '../wines/WineForm';
import { bottleLabel,getHolding,type CellarHolding } from './api';
import '../../cellar.css';

/**
 * Opening a bottle: the ordinary wine form, prefilled with what the cellar
 * already knows, and carrying the holding so that saving takes the bottle off
 * the count. Nothing is decremented on the way in - back out and the cellar is
 * untouched.
 *
 * No recognition runs here. The identity came out of the cellar; photographing
 * the bottle now just adds the photo it never had.
 */
export function OpenBottlePage(){
  const [params]=useSearchParams();
  const holdingId=params.get('holding')||'';
  const [holding,setHolding]=useState<CellarHolding|null>(null);
  const [state,setState]=useState<'loading'|'ready'|'missing'>('loading');

  useEffect(()=>{
    if(!holdingId){setState('missing');return}
    let live=true;
    getHolding(holdingId)
      .then(found=>{if(!live)return;setHolding(found);setState(found?'ready':'missing')})
      .catch(()=>{if(live)setState('missing')});
    return()=>{live=false};
  },[holdingId]);

  if(state==='loading')return <section><h1>Open a bottle</h1><p aria-live="polite">Fetching it from the cellar…</p></section>;
  if(state==='missing'||!holding)return <section><h1>Add wine</h1><p className="cellar-hint">Those bottles are no longer in your cellar, so this is an ordinary new wine.</p><WineForm/></section>;

  return <section>
    <h1>Open a bottle</h1>
    <p className="cellar-open-note">
      <strong>{holding.producer} · {holding.wineName} {holding.vintage??'NV'}</strong>
      <span>{bottleLabel(holding)} in your cellar. Saving logs the tasting and takes one off the count.</span>
    </p>
    <WineForm holdingId={holding.id} initial={{
      producer:holding.producer,wineName:holding.wineName,vintage:holding.vintage,
      country:holding.country,region:holding.region,appellation:holding.appellation,
      wineStyle:holding.wineStyle as never,classification:holding.classification as never,
      price:holding.purchasePrice,currency:holding.currency,
      recognitionStatus:'complete'
    }}/>
  </section>;
}
