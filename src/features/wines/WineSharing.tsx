import { useState } from 'react';
import { apiJson } from '../../lib/auth/api';
import { prepareSharingPhotos } from './sharingPhotos';
export function WineSharing({wineId,imageIds}:{wineId:string;imageIds:string[]}){
 const [open,setOpen]=useState(false),[friends,setFriends]=useState<Array<{id:string;display_name:string}>>([]),[selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function show(){setOpen(true);setMessage('');try{const [f,s]=await Promise.all([apiJson<{items:typeof friends}>('/api/friends'),apiJson<{recipientIds:string[]}>(`/api/wines/${wineId}/shares`)]);setFriends(f.items);setSelected(s.recipientIds)}catch(e){setMessage((e as Error).message)}}
 async function save(){setBusy(true);setMessage('');try{
  if(selected.length)await prepareSharingPhotos(imageIds);
  await apiJson(`/api/wines/${wineId}/shares`,'PUT',{recipientIds:selected});setMessage(selected.length?'Sharing updated.':'This wine is private.');
 }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}
 return <section className="wine-sharing"><button type="button" onClick={()=>open?setOpen(false):void show()}>Share with friends</button>{open&&<fieldset disabled={busy}><legend>Choose friends</legend><p>Share your notes, rating, tasting date, and wine photos. Price, venue, photo location, and cellar stay private.</p>{friends.length?friends.map(friend=><label key={friend.id}><input type="checkbox" checked={selected.includes(friend.id)} onChange={e=>setSelected(e.target.checked?[...selected,friend.id]:selected.filter(id=>id!==friend.id))}/>{friend.display_name}</label>):<p>Add friends from your Account page first.</p>}<button type="button" onClick={()=>void save()}>{busy?'Preparing photos…':'Save sharing'}</button></fieldset>}{message&&<p role="status">{message}</p>}</section>;
}
