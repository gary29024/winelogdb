// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { bootstrapAccount,clearSession } from '../../src/lib/auth/client';
import { TourOverlay } from '../../src/features/onboarding/TourOverlay';
import { requestTour } from '../../src/features/onboarding/useTour';
import { chapters,firstRun } from '../../src/features/onboarding/steps';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

let host:HTMLElement,root:Root,saved:Array<Record<string,unknown>>;

/** The chrome the tour points at, with the boxes jsdom will not lay out itself. */
function renderChrome(){
 const bar=document.createElement('nav');
 for(const anchor of ['nav-passport','nav-journal','scan-trigger','nav-tastings','nav-producers','nav-account']){
  const item=document.createElement('a');item.setAttribute('data-tour',anchor);
  item.getBoundingClientRect=()=>({top:20,left:40,width:90,height:30,right:130,bottom:50,x:40,y:20,toJSON:()=>''});
  bar.appendChild(item);
 }
 document.body.appendChild(bar);
}

async function mount(tour_state:string|undefined){
 saved=[];
 vi.stubGlobal('fetch',vi.fn(async(path:string,init?:RequestInit)=>{
  if(path==='/api/me/tour'){saved.push(JSON.parse(String(init?.body)));return Response.json({user:{id:'alice',role:'member',tour_state:String(init?.body)}})}
  return Response.json({user:{id:'alice',email:'a@example.com',display_name:'Alice',role:'member',status:'active',...tour_state===undefined?{}:{tour_state}}});
 }));
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener(){},removeEventListener(){}})));
 vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{callback(0);return 1});
 vi.stubGlobal('cancelAnimationFrame',()=>{});
 await bootstrapAccount();
 renderChrome();
 host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
 // The tour navigates for chapter steps, so it needs a router around it.
 await act(async()=>{root.render(<MemoryRouter initialEntries={['/']}><TourOverlay/></MemoryRouter>)});
}
const bubble=()=>host.querySelector('[role=dialog]');
const text=()=>bubble()?.textContent??'';
const click=async(label:string)=>{
 const button=[...host.querySelectorAll('button')].find(candidate=>candidate.textContent===label);
 if(!button)throw new Error(`No ${label} button. Bubble reads: ${text()}`);
 await act(async()=>{button.dispatchEvent(new MouseEvent('click',{bubbles:true}))});
};

/** Waits for something the grace period decides, rather than guessing at a delay. */
async function settle(done:()=>boolean,within=2500){
 const deadline=Date.now()+within;
 while(!done()&&Date.now()<deadline)await act(async()=>{await new Promise(resolve=>setTimeout(resolve,50))});
 if(!done())throw new Error(`Still not settled after ${within}ms. Bubble reads: ${text()}`);
}

beforeEach(()=>{document.body.innerHTML=''});
afterEach(async()=>{await act(async()=>root?.unmount());clearSession();vi.unstubAllGlobals();document.body.innerHTML=''});

describe('the first-run tour',()=>{
 it('opens for a member who has never seen it',async()=>{
  await mount('{}');
  expect(bubble()).toBeTruthy();
  expect(text()).toContain('Your Passport');
  expect(text()).toContain('Step 1 of 7');
 });

 it('stays away from someone who already finished it',async()=>{
  await mount('{"completed":["first-run"],"skipped":false}');
  expect(bubble()).toBeNull();
 });

 it('stays away from someone who skipped it',async()=>{
  await mount('{"completed":[],"skipped":true}');
  expect(bubble()).toBeNull();
 });

 it('treats an unreadable stored state as never seen rather than failing',async()=>{
  await mount('not json at all');
  expect(bubble()).toBeTruthy();
 });

 it('walks forward and back through the steps',async()=>{
  await mount('{}');
  await click('Next');
  expect(text()).toContain('Every wine you log');
  // The line the whole tour exists for.
  expect(text()).toContain('In cellar tab');
  await click('Back');
  expect(text()).toContain('Your Passport');
  // Nothing to go back to on the first step, so no Back button is offered.
  expect([...host.querySelectorAll('button')].map(button=>button.textContent)).not.toContain('Back');
 });

 it('records the finished tour once, on the closing card',async()=>{
  await mount('{}');
  for(let step=0;step<6;step++)await click('Next');
  expect(text()).toContain('That is the tour');
  expect(saved,'nothing should be written while the tour is still running').toEqual([]);
  await click('Done');
  expect(bubble()).toBeNull();
  expect(saved).toEqual([{completed:['first-run'],skipped:false}]);
 });

 it('records a skip, which is what keeps every tour away afterwards',async()=>{
  await mount('{}');
  await click('Skip tour');
  expect(bubble()).toBeNull();
  expect(saved).toEqual([{completed:[],skipped:true}]);
 });

 it('closes on Escape, treating it as a skip',async()=>{
  await mount('{}');
  await act(async()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))});
  expect(bubble()).toBeNull();
  expect(saved).toEqual([{completed:[],skipped:true}]);
 });

 it('can be replayed from Account & friends after it has been finished',async()=>{
  await mount('{"completed":["first-run"],"skipped":false}');
  expect(bubble()).toBeNull();
  await act(async()=>{requestTour()});
  expect(bubble()).toBeTruthy();
  expect(text()).toContain('Step 1 of 7');
 });

 it('passes over a step whose anchor is not on the page, once it has waited for it',async()=>{
  await mount('{}');
  // Journal removed from the chrome: the step that points at it cannot be shown.
  document.querySelector('[data-tour=nav-journal]')?.remove();
  await click('Next');
  // Not immediately, though: a chapter navigates to a lazily loaded page, so an
  // anchor that is not there yet is waited for before it is called missing.
  expect(text()).toContain('Every wine you log');
  await settle(()=>!text().includes('Every wine you log'));
  expect(text()).toContain('One button, four ways in');
 });
});

describe('the optional chapters',()=>{
 it('is not offered on its own - only the first run opens by itself',async()=>{
  await mount('{"completed":["first-run"],"skipped":false}');
  expect(bubble()).toBeNull();
 });

 it('names the chapter beside the step count, so it is clear which one is running',async()=>{
  await mount('{"completed":["first-run"],"skipped":false}');
  await act(async()=>{requestTour('chapter-tastings')});
  expect(text()).toContain('Tastings · Step 1 of 3');
 });

 /**
  * The distinction that matters: closing the first run means "stop offering me
  * this", while closing a chapter someone deliberately opened means only that
  * they are done reading. Recording the second as a refusal would suppress
  * every future tour because they glanced at one chapter.
  */
 it('records nothing when a chapter is closed part-way',async()=>{
  await mount('{"completed":["first-run"],"skipped":false}');
  await act(async()=>{requestTour('chapter-sharing')});
  await click('Skip tour');
  expect(bubble()).toBeNull();
  expect(saved).toEqual([]);
 });

 it('records the chapter, and only the chapter, when it is finished',async()=>{
  await mount('{"completed":["first-run"],"skipped":false}');
  await act(async()=>{requestTour('chapter-progress')});
  await click('Next');await click('Next');
  await click('Done');
  expect(saved).toEqual([{completed:['first-run','chapter-progress'],skipped:false}]);
 });

 it('offers six tours from Account: the first run and five chapters',async()=>{
  await mount('{"completed":["first-run"],"skipped":false}');
  expect([firstRun,...chapters].map(tour=>tour.id)).toEqual(
   ['first-run','chapter-tastings','chapter-journal','chapter-vintages','chapter-sharing','chapter-progress']);
 });

 it('runs the Journal chapter, which stays on one page throughout',async()=>{
  await mount('{"completed":["first-run"],"skipped":false}');
  await act(async()=>{requestTour('chapter-journal')});
  expect(text()).toContain('The Journal · Step 1 of 4');
  expect(chapters.find(tour=>tour.id==='chapter-journal')!.steps.every(step=>step.route==='/journal')).toBe(true);
 });

 /** Vintages is reference data, so its chapter must not promise it will grow. */
 it('does not tell anyone the vintage record builds from their Journal',async()=>{
  const vintages=chapters.find(tour=>tour.id==='chapter-vintages')!;
  const words=vintages.steps.map(step=>step.body).join(' ').toLowerCase();
  expect(words).toContain('already here');
  expect(words).not.toContain('grows as you log');
 });

 it('ignores a tour id it does not know',async()=>{
  await mount('{"completed":["first-run"],"skipped":false}');
  await act(async()=>{requestTour('chapter-does-not-exist')});
  expect(bubble()).toBeNull();
 });
});
