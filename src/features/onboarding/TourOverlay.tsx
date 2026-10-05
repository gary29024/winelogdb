import { useEffect,useRef } from 'react';
import { useTour } from './useTour';
import '../../onboarding.css';

/** The bubble's intended width; the stylesheet narrows it on a small screen. */
const BUBBLE=340;

/**
 * The guided first-run tour.
 *
 * Deliberately not modal. The dim layer takes no pointer events, nothing locks
 * the page, and every anchor sits in the chrome that persists across routes - so
 * someone who taps a nav item mid-tour simply navigates, and the next step is
 * still on screen rather than stranded. role="dialog" is here for the grouping;
 * aria-modal is not, because that would claim an interaction trap the overlay
 * does not set.
 *
 * The spotlight does the pointing - a transparent window in a dimmed page,
 * drawn as one enormous box-shadow spread rather than four panels - so the
 * bubble only has to carry the words and stay on screen.
 */
export function TourOverlay(){
 const {open,step,rect,first,last,stepNumber,total,next,back,finish,skip}=useTour();
 const bubble=useRef<HTMLElement>(null);

 // Focus moves to the bubble on every step so a screen reader reads the new
 // step rather than leaving the user to go looking for it.
 useEffect(()=>{if(open)bubble.current?.focus()},[open,step?.id]);
 useEffect(()=>{
  if(!open)return;
  const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();skip()}};
  document.addEventListener('keydown',onKeyDown);
  return()=>document.removeEventListener('keydown',onKeyDown);
 },[open,skip]);

 if(!open||!step)return null;

 // Below the anchor when it sits in the upper half of the screen, above it
 // otherwise. The "above" case is pinned by its bottom edge, which is what lets
 // the bubble be placed without first measuring how tall its text made it.
 const width=Math.min(BUBBLE,window.innerWidth-32);
 const placement=rect?{
  ...rect.top+rect.height/2<window.innerHeight/2
   ?{top:rect.top+rect.height+14}
   :{bottom:Math.max(16,window.innerHeight-rect.top+14)},
  left:Math.max(16,Math.min(rect.left+rect.width/2-width/2,window.innerWidth-width-16))
 }:undefined;

 return <>
  {rect&&<div className="tour-spotlight" style={{top:rect.top-6,left:rect.left-6,width:rect.width+12,height:rect.height+12}} aria-hidden="true"/>}
  <section
   ref={bubble} tabIndex={-1}
   className={`tour-bubble${rect?'':' tour-bubble-centred'}`} style={placement}
   role="dialog" aria-labelledby="tour-step-title"
  >
   <p className="tour-progress">Step {stepNumber} of {total}</p>
   <h2 id="tour-step-title">{step.title}</h2>
   <p className="tour-body">{step.body}</p>
   <div className="tour-actions">
    <button type="button" className="quiet" onClick={skip}>{last?'Close':'Skip tour'}</button>
    <span className="tour-actions-end">
     {!first&&<button type="button" onClick={back}>Back</button>}
     <button type="button" className="primary" onClick={last?finish:next}>{last?'Done':'Next'}</button>
    </span>
   </div>
  </section>
 </>;
}
