import { useState } from 'react';
import { AppIcon } from '../../components/AppIcons';
import { FriendTagDialog } from './FriendTagDialog';
import { getWineFriendTags,listFriendTags,setWineFriendTags,type FriendTag } from './friendTags';

export function WineSharing({wineId}:{wineId:string}){
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
   await setWineFriendTags(wineId,selected);
   setOpen(false);
   if(!selected.length){setMessage('Friend tags removed.');return}
   setMessage(`Tagged with ${selected.length} friend${selected.length===1?'':'s'}.`);
  }catch(e){setError((e as Error).message)}
  finally{setBusy(false)}
 }
 return <>
  <button type="button" className="detail-share-button" aria-label="Tag friends" title="Tag friends" aria-haspopup="dialog" onClick={()=>open?setOpen(false):void show()}><AppIcon kind="person-tag"/></button>
  <FriendTagDialog open={open} title="Tag friends" description="Choose friends who can see this wine. Wine identity, details and attached wine photos are shared; each friend keeps their own notes, rating and tasting experience." friends={friends} selected={selected} busy={busy} error={error} onSelectedChange={setSelected} onConfirm={()=>void save()} onClose={()=>setOpen(false)}/>
  {message&&<span className="wine-sharing-status" role="status">{message}</span>}
 </>;
}
