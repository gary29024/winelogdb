import { useCallback,useEffect,useMemo,useState } from 'react';
import { getAccount } from '../../lib/auth/client';
import { currentTourState,hasSeen,saveTourState } from './api';
import { FIRST_RUN,firstRunSteps,stepsFor } from './steps';

/**
 * The breakpoint styles.css uses, verbatim. The desktop top bar and the mobile
 * bottom bar hold different items, so the tour has to agree with the stylesheet
 * about which one is on screen - a second, rounder number here would point the
 * phone tour at a nav that is display:none.
 */
export const MOBILE_QUERY='(max-width:700px), (max-width:932px) and (orientation:landscape) and (pointer:coarse)';

export type Rect={top:number;left:number;width:number;height:number};

/** Replay, asked for from Account & friends. The overlay answers while mounted. */
let replay:(()=>void)|null=null;
export const requestTour=()=>replay?.();
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
  let frame=0;
  const measure=()=>{
   window.cancelAnimationFrame(frame);
   frame=window.requestAnimationFrame(()=>{
    const box=[...document.querySelectorAll(`[data-tour="${anchor}"]`)].map(element=>element.getBoundingClientRect()).find(candidate=>candidate.width>0&&candidate.height>0);
    setMeasurement({anchor,rect:box?{top:box.top,left:box.left,width:box.width,height:box.height}:null});
   });
  };
  measure();
  window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);
  return()=>{window.cancelAnimationFrame(frame);window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true)};
 },[anchor,step]);
 return measurement;
}

export function useTour(){
 const mobile=useMobile();
 const account=getAccount();
 const role=account?.role??'member';
 const steps=useMemo(()=>stepsFor(firstRunSteps,role,mobile),[role,mobile]);
 const [index,setIndex]=useState(0);
 const [open,setOpen]=useState(()=>Boolean(account)&&!hasSeen(currentTourState(),FIRST_RUN));

 useEffect(()=>{replay=()=>{setIndex(0);setOpen(true)};return()=>{replay=null}},[]);
 // Rotating a phone mid-tour can drop a step, so the position is clamped rather
 // than left pointing past the end of a shorter list.
 const position=Math.min(index,Math.max(steps.length-1,0));
 const step=steps[position];
 const measurement=useAnchorRect(step?.anchor,position);
 // The previous step's box is kept until the new one is measured, so the
 // spotlight glides between anchors rather than blinking out for a frame.
 const rect=measurement.rect;

 const close=useCallback((skipped:boolean)=>{
  setOpen(false);
  const state=currentTourState();
  void saveTourState({
   completed:skipped?state.completed:[...new Set([...state.completed,FIRST_RUN])],
   skipped:skipped||state.skipped
  });
 },[]);

 const next=useCallback(()=>setIndex(current=>current+1),[]);
 const back=useCallback(()=>setIndex(current=>Math.max(current-1,0)),[]);

 // An anchor that is not on the page would leave a bubble pointing at nothing,
 // so the step is passed over instead - but only once this anchor has actually
 // been looked for and found absent. Only a step that names an anchor can be
 // skipped this way; the closing card names none and is always shown.
 useEffect(()=>{
  if(open&&step?.anchor&&measurement.anchor===step.anchor&&!measurement.rect&&position<steps.length-1)setIndex(position+1);
 },[open,step?.anchor,measurement,position,steps.length]);

 return {
  open:open&&Boolean(step),step,rect,
  first:position===0,last:position>=steps.length-1,
  stepNumber:position+1,total:steps.length,
  next,back,finish:()=>close(false),skip:()=>close(true)
 };
}
