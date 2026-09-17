import { useEffect,useRef,useState } from 'react';
import { apiJson } from '../../lib/auth/api';
/** Read-only polling: following a friend never creates an AI action. */
export function FriendResearchStatus({operationId,onComplete}:{operationId:string;onComplete:()=>void}){
 const [message,setMessage]=useState('A friend is researching this wine. Their successful results will become available for zero credits.');
 const callback=useRef(onComplete);useEffect(()=>{callback.current=onComplete},[onComplete]);
 useEffect(()=>{let active=true,timer:ReturnType<typeof setTimeout>,delay=5000;
  async function check(){try{const op=await apiJson<{status:string}>(`/api/credits/operations/${operationId}`);if(!active)return;if(op.status==='complete'){setMessage('Your friend’s research is available.');callback.current();return}if(op.status==='failed'){setMessage('Shared research was not completed or access changed. You can request a new quote.');return}}catch{if(!active)return}delay=Math.min(60000,Math.round(delay*1.5));timer=setTimeout(()=>void check(),delay)}
  timer=setTimeout(()=>void check(),delay);return()=>{active=false;clearTimeout(timer)};
 },[operationId]);
 return <p role="status">{message} You can leave this page safely.</p>;
}
