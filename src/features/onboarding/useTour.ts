import { useCallback,useEffect,useMemo,useState } from 'react';
import { useLocation,useNavigate } from 'react-router-dom';
import { getAccount } from '../../lib/auth/client';
import { currentTourState,hasSeen,saveTourState,toursAvailable } from './api';
import { FIRST_RUN,firstRun,stepsFor,tourById,type Tour } from './steps';

/**
 * The breakpoint styles.css uses, verbatim. The desktop top bar and the mobile
 * bottom bar hold different items, so the tour has to agree with the stylesheet
 * about which one is on screen - a second, rounder number here would point the
 * phone tour at a nav that is display:none.
 */
export const MOBILE_QUERY='(max-width:700px), (max-width:932px) and (orientation:landscape) and (pointer:coarse)';

export type Rect={top:number;left:number;width:number;height:number};

/**
 * How long an anchor is waited for before it is called missing.
 *
 * A chapter navigates to a lazily loaded route, so the element the next step
 * points at does not exist at the moment the step asks for it. Concluding
 * "absent" on the first look would skip every step that follows a route change.
 */
const ANCHOR_GRACE=1200;

/** Replay, asked for from Account & friends. The overlay answers while mounted. */
let replay:((tour:string)=>void)|null=null;
export const requestTour=(tour=FIRST_RUN)=>replay?.(tour);
export const tourIsReplayable=()=>replay!==null;

function useMobile(){
 const [mobile,setMobile]=useState(()=>window.matchMedia?.(MOBILE_QUERY).matches??false);
 useEffect(()=>{
  const query=window.matchMedia?.(MOBILE_QUERY);if(!query)return;
  const update=()=>setMobile(query.matches);update();
  query.addEventListener('change',update);return()=>query.removeEventListener('change',update);
 },[]);
 return mobile;
}

/**
 * Where the anchored element is now, and which anchor that answer is about.
 *
 * The anchor is reported back with the box because "no box" has two meanings
 * that must not be confused: nothing measured yet, and measured and genuinely
 * not on the page. Only the second is grounds for passing over a step, and
 * reading the first as the second skipped step one of every tour.
 *
 * Remeasured on resize and on scroll anywhere in the page - the capture phase,
 * because the element that scrolls is often an inner container rather than the
 * window - and coalesced into one frame, the same shape Layout already uses for
 * the mobile viewport variable.
 *
 * The destination, not the nav: Passport, Journal and Producers each appear
 * twice in the markup, once in the top bar and once in the tab bar, and exactly
 * one of the two is on screen at any width. Taking the first match with a real
 * box means both carry the same anchor name and the step wording is written
 * once - a display:none element measures 0x0, which is also how an anchor that
 * has genuinely gone missing reads.
 */
type Measurement={anchor:string|undefined;rect:Rect|null};

function useAnchorRect(anchor:string|undefined,step:number):Measurement{
 const [measurement,setMeasurement]=useState<Measurement>({anchor:undefined,rect:null});
 useEffect(()=>{
  if(!anchor){setMeasurement({anchor,rect:null});return}
  let frame=0,found=false;
  const publish=(box:DOMRect|undefined)=>setMeasurement({anchor,rect:box?{top:box.top,left:box.left,width:box.width,height:box.height}:null});
  const measure=()=>{
   window.cancelAnimationFrame(frame);
   frame=window.requestAnimationFrame(()=>{
    const box=[...document.querySelectorAll(`[data-tour="${anchor}"]`)].map(element=>element.getBoundingClientRect()).find(candidate=>candidate.width>0&&candidate.height>0);
    // Absence is only reported once the anchor has been here and gone, or once
    // the grace period below has run out. Until then an empty look means the
    // page it belongs to has probably not arrived yet.
    if(box){found=true;publish(box)}else if(found)publish(undefined);
   });
  };
  measure();
  // The arrival of a lazily loaded page is a DOM change, so that is what is
  // watched rather than a poll.
  const observer=new MutationObserver(measure);
  observer.observe(document.body,{childList:true,subtree:true});
  const grace=window.setTimeout(()=>{if(!found)publish(undefined)},ANCHOR_GRACE);
  window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);
  return()=>{
   window.cancelAnimationFrame(frame);window.clearTimeout(grace);observer.disconnect();
   window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);
  };
 },[anchor,step]);
 return measurement;
}

export function useTour(){
 const mobile=useMobile();
 const account=getAccount();
 const role=account?.role??'member';
 const navigate=useNavigate();
 const {pathname}=useLocation();
 // Which tour is running. The first run is the one that offers itself; every
 // other tour is asked for by name from Account & friends.
 const [tour,setTour]=useState<Tour>(firstRun);
 const steps=useMemo(()=>stepsFor(tour.steps,role,mobile),[tour,role,mobile]);
 const [index,setIndex]=useState(0);
 // Only the automatic offer is gated: asking for a tour by name from Account
 // is the reader's own choice, and an unsaveable one is a nuisance, not a bug.
 const [open,setOpen]=useState(()=>Boolean(account)&&toursAvailable()&&!hasSeen(currentTourState(),FIRST_RUN));

 useEffect(()=>{
  replay=requested=>{const next=tourById(requested);if(!next)return;setTour(next);setIndex(0);setOpen(true)};
  return()=>{replay=null};
 },[]);
 // Rotating a phone mid-tour can drop a step, so the position is clamped rather
 // than left pointing past the end of a shorter list.
 const position=Math.min(index,Math.max(steps.length-1,0));
 const step=steps[position];

 // A chapter's step names the page it is about, so the tour goes there. The
 // first-run tour names none: its anchors are in the chrome, which is on every
 // page already, so it never moves anyone off what they were looking at.
 useEffect(()=>{
  if(open&&step?.route&&pathname!==step.route)navigate(step.route);
 },[open,step?.route,pathname,navigate]);

 const measurement=useAnchorRect(step?.anchor,position);
 // The previous step's box is kept until the new one is measured, so the
 // spotlight glides between anchors rather than blinking out for a frame.
 const rect=measurement.rect;

 /**
  * Skipping is not the same thing in both directions.
  *
  * Closing the first run means "stop offering me this", and is remembered as
  * such. Closing a chapter someone deliberately opened means only that they are
  * done reading it - recording that as a refusal would suppress every future
  * tour because they glanced at one chapter.
  */
 const close=useCallback((finished:boolean)=>{
  setOpen(false);
  const state=currentTourState();
  if(!finished&&tour.id!==FIRST_RUN)return;
  void saveTourState({
   completed:finished?[...new Set([...state.completed,tour.id])]:state.completed,
   skipped:!finished||state.skipped
  });
 },[tour.id]);

 const next=useCallback(()=>setIndex(current=>current+1),[]);
 const back=useCallback(()=>setIndex(current=>Math.max(current-1,0)),[]);

 // An anchor that is not on the page would leave a bubble pointing at nothing,
 // so the step is passed over instead - but only once this anchor has actually
 // been looked for and found absent. Only a step that names an anchor can be
 // skipped this way; a step that names none is a card about the page itself.
 useEffect(()=>{
  if(open&&step?.anchor&&measurement.anchor===step.anchor&&!measurement.rect&&position<steps.length-1)setIndex(position+1);
 },[open,step?.anchor,measurement,position,steps.length]);

 return {
  open:open&&Boolean(step),tour,step,rect,
  first:position===0,last:position>=steps.length-1,
  stepNumber:position+1,total:steps.length,
  next,back,finish:()=>close(true),skip:()=>close(false)
 };
}
