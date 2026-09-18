import { useState } from 'react';
import { FriendTagDialog } from './FriendTagDialog';
import { getWineFriendTags,listFriendTags,setWineFriendTags,type FriendTag } from './friendTags';
import { prepareSharingPhotos } from './sharingPhotos';

export function WineSharing({wineId,imageIds}:{wineId:string;imageIds:string[]}){
 const [open,setOpen]=useState(false),[friends,setFriends]=useState<FriendTag[]>([]),[selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function show(){
  setOpen(true);setMessage('');setError('');
  try{
   const [f,s]=await Promise.all([listFriendTags(),getWineFriendTags(wineId)]);
   setFriends(f.items);setSelected(s.recipientIds);
  }catch(e){setError((e as Error).message)}
 }
 async function save(){
  setBusy(true);setMessage('');setError('');
  try{
   // Access is granted first. A derivative photo is an optional privacy-safe
   // enhancement; storage trouble must never make a successful friend tag look
   // as though it failed.
   await setWineFriendTags(wineId,selected);
   setOpen(false);
   if(!selected.length){setMessage('Friend tags removed.');return}
   setMessage(`Tagged with ${selected.length} friend${selected.length===1?'':'s'}.`);
   try{await prepareSharingPhotos(imageIds)}
   catch{setMessage(`Tagged with ${selected.length} friend${selected.length===1?'':'s'}. Photos could not be prepared for sharing, but the wine and notes are shared.`)}
  }catch(e){setError((e as Error).message)}
  finally{setBusy(false)}
 }
 return <section className="wine-sharing">
  <button type="button" onClick={()=>open?setOpen(false):void show()}>Tag friends</button>
  <FriendTagDialog open={open} title="Tag friends" description="Choose friends who can see this wine. Notes, rating, tasting date and sharing-safe wine photos are included; price, venue, photo location and cellar stay private." friends={friends} selected={selected} busy={busy} error={error} onSelectedChange={setSelected} onConfirm={()=>void save()} onClose={()=>setOpen(false)}/>
  {message&&<p role="status">{message}</p>}
 </section>;
}
