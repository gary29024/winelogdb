import { useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import { bottleLabel,holdingsForWine,type CellarHolding } from './api';

/**
 * What you still hold of the wine on screen.
 *
 * Fetched on its own rather than folded into the wine read, so a page with
 * nothing in the cellar behind it pays for no cellar query, and renders nothing
 * at all when there is nothing to say.
 */
export function CellarStrip({wineId}:{wineId:string}){
  const [holdings,setHoldings]=useState<CellarHolding[]>([]);
  useEffect(()=>{
    let live=true;
    holdingsForWine(wineId).then(found=>{if(live)setHoldings(found)}).catch(()=>{});
    return()=>{live=false};
  },[wineId]);

  if(!holdings.length)return null;
  return <div className="detail-cellar-strip">
    <span className="detail-cellar-label">In your cellar</span>
    {holdings.map(holding=><span className="detail-cellar-line" key={holding.id}>
      <strong>{bottleLabel(holding)}</strong>
      {holding.location&&<span className="detail-cellar-where">{holding.location}</span>}
      <Link className="detail-cellar-open" to={`/wines/new?holding=${holding.id}`}>Open a bottle</Link>
    </span>)}
  </div>;
}
