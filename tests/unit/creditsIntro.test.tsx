// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { apiFetch,bootstrapAccount,clearSession } from '../../src/lib/auth/client';
import { CreditConfirmation } from '../../src/features/auth/CreditConfirmation';

declare global{var IS_REACT_ACT_ENVIRONMENT:boolean}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;

let host:HTMLElement,root:Root,saved:Array<Record<string,unknown>>;

/**
 * Drives the real path: apiFetch quotes a priced AI route, finds a price, and
 * hands the decision to whatever CreditConfirmation registered. Faking the
 * prompt instead would not prove the panel appears where members will meet it.
 */
async function mount(role:'owner'|'member',tour_state:string){
 saved=[];
 vi.stubGlobal('fetch',vi.fn(async(path:string,init?:RequestInit)=>{
  if(path==='/api/me/tour'){saved.push(JSON.parse(String(init?.body)));return Response.json({user:{id:'alice',role,tour_state:String(init?.body)}})}
  if(path==='/api/me')return Response.json({user:{id:'alice',email:'a@example.com',display_name:'Alice',role,status:'active',tour_state}});
  if(path.startsWith('/api/credits/quotes'))return Response.json({id:'quote',total:3,available:12,units:[{action:'label_scan',credits:3}]});
  return Response.json({ok:true});
 }));
 await bootstrapAccount();
 host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
 await act(async()=>{root.render(<CreditConfirmation/>)});
}
const dialogText=()=>host.querySelector('dialog')?.textContent??'';
const press=async(label:string)=>{
 const button=[...host.querySelectorAll('button')].find(candidate=>candidate.textContent===label);
 if(!button)throw new Error(`No ${label} button. Dialog reads: ${dialogText()}`);
 await act(async()=>{button.dispatchEvent(new MouseEvent('click',{bubbles:true}))});
};
/** Starts a priced action and leaves it hanging on the confirmation. */
async function priced(){
 let settled=false;
 const pending=apiFetch('/api/recognition',{method:'POST',body:'{}'}).then(response=>{settled=true;return response});
 await act(async()=>{await Promise.resolve()});
 return {pending,isSettled:()=>settled};
}

beforeEach(()=>{document.body.innerHTML=''});
afterEach(async()=>{await act(async()=>root?.unmount());clearSession();vi.unstubAllGlobals();document.body.innerHTML=''});

describe('the one-time credits explanation',()=>{
 it('tells a member what credits are, the first time one is asked for',async()=>{
  await mount('member','{}');
  const {pending}=await priced();
  expect(dialogText()).toContain('3 credits');
  expect(dialogText()).toContain('Credits pay for the AI work');
  expect(dialogText()).toContain('This week’s AI allowance');
  await press('Use 3 credits');
  await pending;
 });

 it('records it, so the second priced action is just a price',async()=>{
  await mount('member','{}');
  const first=await priced();
  await press('Use 3 credits');
  await first.pending;
  expect(saved).toEqual([{completed:['credits-intro'],skipped:false}]);
 });

 it('does not explain it again to someone already told',async()=>{
  await mount('member','{"completed":["credits-intro"],"skipped":false}');
  const {pending}=await priced();
  expect(dialogText()).toContain('3 credits');
  expect(dialogText()).not.toContain('Credits pay for the AI work');
  await press('Use 3 credits');
  await pending;
  expect(saved,'nothing to record a second time').toEqual([]);
 });

 /** Owner AI is billed direct and costs no credits, so the panel would be a lie. */
 it('never shows it to the owner',async()=>{
  await mount('owner','{}');
  const {pending}=await priced();
  expect(dialogText()).not.toContain('Credits pay for the AI work');
  await press('Use 3 credits');
  await pending;
  expect(saved).toEqual([]);
 });

 it('counts a cancel as having been told, since they read it either way',async()=>{
  await mount('member','{}');
  const {pending}=await priced();
  expect(dialogText()).toContain('Credits pay for the AI work');
  await press('Cancel');
  await pending;
  expect(saved).toEqual([{completed:['credits-intro'],skipped:false}]);
 });

 it('leaves the action waiting until the member decides',async()=>{
  await mount('member','{}');
  const {pending,isSettled}=await priced();
  expect(isSettled(),'nothing should be spent before the dialog is answered').toBe(false);
  await press('Cancel');
  const response=await pending;
  expect(response.status,'a cancelled action resolves as cancelled, not as a charge').toBe(409);
 });
});
