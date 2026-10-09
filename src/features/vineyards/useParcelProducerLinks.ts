import {useCallback,useEffect,useMemo,useState} from 'react';
import {matchesLinkedProducer,type HolderGroup} from '../../lib/places/parcelPresentation';
import type {ParcelProducerLink} from '../../lib/places/parcelProducerLinks';
import {listParcelProducerLinks,removeParcelProducerLink,saveParcelProducerLink} from './parcelProducerApi';

/** The account's links for one cru. The map opens from a wine, so a link always names that wine's own producer:
 * one tap links every recorded holder in a row, one link per holder. */
export function useParcelProducerLinks(parentId:string,producer?:string|null,producerId?:string|null){
 const [links,setLinks]=useState<ParcelProducerLink[]>([]),[loadedParent,setLoadedParent]=useState(''),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const [busy,setBusy]=useState('');
 useEffect(()=>{
  let active=true;
  void listParcelProducerLinks(parentId).then(result=>{if(active){setLinks(result.items);setLoadedParent(parentId);setError('')}})
   .catch(()=>{if(active)setError('Your producer links could not load. Parcel rights are still available.')});
  return()=>{active=false};
 },[parentId,attempt]);
 const loaded=loadedParent===parentId;
 // A link saved from another producer's wine stays on the account but is not shown here.
 const mine=useMemo(()=>loaded?links.filter(link=>matchesLinkedProducer(link,producer,producerId)):[],[loaded,links,producer,producerId]);
 const linked=useMemo(()=>new Set(mine.map(link=>link.holderId)),[mine]);
 const change=async(row:HolderGroup,save:boolean)=>{
  if(!producerId)return;
  setBusy(row.id);setError('');
  try{
   // One at a time, so a failure leaves the list matching what was saved.
   for(const id of row.holderIds.filter(id=>linked.has(id)!==save)){
    if(save){const link=await saveParcelProducerLink(parentId,id,producerId);setLinks(items=>[...items.filter(l=>l.holderId!==id),link])}
    else{await removeParcelProducerLink(parentId,id);setLinks(items=>items.filter(l=>l.holderId!==id))}
   }
  }catch(e){setError((e as Error).message||(save?'Could not save the link':'Could not remove the link'))}
  finally{setBusy('')}
 };
 return {loaded,error,busy,mine,linked,hasProducer:Boolean(producerId),canLink:loaded&&Boolean(producerId),
  retry:useCallback(()=>setAttempt(n=>n+1),[]),
  link:(row:HolderGroup)=>change(row,true),unlink:(row:HolderGroup)=>change(row,false)};
}
export type ParcelProducerLinks=ReturnType<typeof useParcelProducerLinks>;
