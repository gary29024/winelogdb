// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { bootstrapAccount,clearSession } from '../../src/lib/auth/client';
import { TourOverlay } from '../../src/features/onboarding/TourOverlay';
import { requestTour } from '../../src/features/onboarding/useTour';

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
 await act(async()=>{root.render(<TourOverlay/>)});
}
const bubble=()=>host.querySelector('[role=dialog]');
const text=()=>bubble()?.textContent??'';
const click=async(label:string)=>{
 const button=[...host.querySelectorAll('button')].find(candidate=>candidate.textContent===label);
 if(!button)throw new Error(`No ${label} button. Bubble reads: ${text()}`);
 await act(async()=>{button.dispatchEvent(new MouseEvent('click',{bubbles:true}))});
};

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
  expect(text()).toContain('Cellar tab');
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

 it('passes over a step whose anchor is not on the page',async()=>{
  await mount('{}');
  // Journal removed from the chrome: the step that points at it cannot be shown.
  document.querySelector('[data-tour=nav-journal]')?.remove();
  await click('Next');
  expect(text()).not.toContain('Every wine you log');
  expect(text()).toContain('One button, four ways in');
 });
});
