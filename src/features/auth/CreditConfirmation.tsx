import { useEffect,useRef,useState } from 'react';
import { getAccount,registerQuotePrompt,type QuotePrompt } from '../../lib/auth/client';
import { currentTourState,saveTourState } from '../onboarding/api';
import { CREDITS_INTRO } from '../onboarding/steps';
export function CreditConfirmation(){
 const [prompt,setPrompt]=useState<QuotePrompt|null>(null),pending=useRef<QuotePrompt[]>([]),active=useRef<QuotePrompt|null>(null),dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const queue=pending.current;registerQuotePrompt(next=>{if(active.current)queue.push(next);else{active.current=next;setPrompt(next)}});return()=>{registerQuotePrompt(null);active.current?.resolve(false);active.current=null;for(const p of queue.splice(0))p.resolve(false)}},[]);
 useEffect(()=>{if(prompt)dialog.current?.showModal?.();else dialog.current?.close?.()},[prompt]);
 /**
  * The first time a member is asked for credits, say what they are.
  *
  * This is the moment to explain them rather than day one: they are looking at
  * a real price for a thing they just asked for, which is the only context in
  * which the explanation means anything. The owner never sees it - owner AI is
  * billed direct and costs no credits - and it is shown once, then recorded
  * alongside the tours, since it is the same kind of "already told you".
  */
 const [explain]=useState(()=>getAccount()?.role==='member'&&!currentTourState().completed.includes(CREDITS_INTRO));
 function finish(yes:boolean){
  if(explain){const state=currentTourState();void saveTourState({...state,completed:[...new Set([...state.completed,CREDITS_INTRO])]})}
  active.current?.resolve(yes);active.current=pending.current.shift()??null;setPrompt(active.current);
 }
 return <dialog ref={dialog} aria-labelledby="credit-confirm-title" onCancel={event=>{event.preventDefault();finish(false)}}><h2 id="credit-confirm-title">Use AI credits?</h2>{prompt&&<><p>This action costs <strong>{prompt.quote.total} credits</strong>. You have {prompt.quote.available} available.</p><ul>{prompt.quote.units.map((unit,i)=><li key={i}>{unit.action.replaceAll('_',' ')} — {unit.credits}</li>)}</ul><p>Only successfully saved results are charged. Failed units are released.</p>{explain&&<p className="credit-intro">Credits pay for the AI work behind scanning labels and researching producers and vintages. You are shown the price before anything is spent, nothing is charged if you cancel, and your balance is on <strong>Account &amp; friends</strong>.</p>}<div className="action-row"><button type="button" onClick={()=>finish(false)}>Cancel</button><button type="button" className="primary" onClick={()=>finish(true)}>Use {prompt.quote.total} credits</button></div></>}</dialog>;
}
