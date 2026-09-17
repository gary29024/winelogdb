import { useEffect,useRef,useState } from 'react';
import { registerQuotePrompt,type QuotePrompt } from '../../lib/auth/client';
export function CreditConfirmation(){
 const [prompt,setPrompt]=useState<QuotePrompt|null>(null),pending=useRef<QuotePrompt[]>([]),active=useRef<QuotePrompt|null>(null),dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const queue=pending.current;registerQuotePrompt(next=>{if(active.current)queue.push(next);else{active.current=next;setPrompt(next)}});return()=>{registerQuotePrompt(null);active.current?.resolve(false);active.current=null;for(const p of queue.splice(0))p.resolve(false)}},[]);
 useEffect(()=>{if(prompt)dialog.current?.showModal?.();else dialog.current?.close?.()},[prompt]);
 function finish(yes:boolean){active.current?.resolve(yes);active.current=pending.current.shift()??null;setPrompt(active.current)}
 return <dialog ref={dialog} aria-labelledby="credit-confirm-title" onCancel={event=>{event.preventDefault();finish(false)}}><h2 id="credit-confirm-title">Use AI credits?</h2>{prompt&&<><p>This action costs <strong>{prompt.quote.total} credits</strong>. You have {prompt.quote.available} available.</p><ul>{prompt.quote.units.map((unit,i)=><li key={i}>{unit.action.replaceAll('_',' ')} — {unit.credits}</li>)}</ul><p>Only successfully saved results are charged. Failed units are released.</p><div className="action-row"><button type="button" onClick={()=>finish(false)}>Cancel</button><button type="button" className="primary" onClick={()=>finish(true)}>Use {prompt.quote.total} credits</button></div></>}</dialog>;
}
