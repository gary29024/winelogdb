import { useEffect,useRef,type RefObject } from 'react';
/** Keep modal focus local and return it to the invoking control after dismissal. */
export function useModalFocus(open:boolean,element:RefObject<HTMLElement|null>,onClose:()=>void,busy=false,returnFocus?:RefObject<HTMLElement|null>){
 const actions=useRef({onClose,busy});
 useEffect(()=>{actions.current={onClose,busy}},[onClose,busy]);
 useEffect(()=>{
  if(!open||!element.current)return;
  const dialog=element.current,opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();if(!actions.current.busy)actions.current.onClose();return}
   if(event.key!=='Tab')return;
   const controls=[...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(control=>control.getClientRects().length>0);
   const first=controls[0],last=controls[controls.length-1],active=document.activeElement;
   if(!first){event.preventDefault();dialog.focus();return}
   if(event.shiftKey&&(active===first||active===dialog||!dialog.contains(active))){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&(active===last||active===dialog||!dialog.contains(active))){event.preventDefault();first.focus()}
  };
  document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('keydown',key);document.body.style.overflow=overflow;const target=returnFocus?.current??opener;if(target?.isConnected)target.focus()};
 },[open,element,returnFocus]);
}
