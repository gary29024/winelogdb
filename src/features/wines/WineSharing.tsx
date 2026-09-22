import { useCallback,useEffect,useRef,useState } from 'react';
import { AppIcon } from '../../components/AppIcons';
import { FriendTagDialog } from './FriendTagDialog';
import { getWineFriendTags,listFriendTags,setWineFriendTags,type FriendTag } from './friendTags';
import '../../wineSharing.css';

type Props={wineId:string;ownerName?:never}|{wineId?:never;ownerName:string};
export function WineSharing({wineId,ownerName}:Props){
 const [open,setOpen]=useState(false),[friends,setFriends]=useState<FriendTag[]>([]),[selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [tagged,setTagged]=useState<string[]>([]),[ready,setReady]=useState(false),[loading,setLoading]=useState(false);
 const request=useRef(0),trigger=useRef<HTMLButtonElement>(null),readOnly=ownerName!==undefined;
 useEffect(()=>{
  if(!wineId)return;
  let active=true;
  const token=++request.current;
  void getWineFriendTags(wineId).then(result=>{if(active&&request.current===token)setTagged(result.recipientIds??[])}).catch(()=>undefined);
  return()=>{active=false};
 },[wineId]);
 const close=useCallback(()=>{setOpen(false);trigger.current?.focus()},[]);
 async function show(){
  setOpen(true);setMessage('');setError('');
  if(!wineId)return;
  const token=++request.current;setReady(false);setLoading(true);
  try{
   const [f,s]=await Promise.all([listFriendTags(),getWineFriendTags(wineId)]);
   if(request.current!==token)return;
   setFriends(f.items);setSelected(s.recipientIds??[]);setTagged(s.recipientIds??[]);setReady(true);
  }catch(e){if(request.current===token)setError((e as Error).message)}
  finally{if(request.current===token)setLoading(false)}
 }
 async function save(){
  if(!wineId||!ready||busy)return;
  setBusy(true);setMessage('');setError('');
  try{
   await setWineFriendTags(wineId,selected);
   setTagged(selected);close();setMessage('Tags updated.');
  }catch(e){setError((e as Error).message)}
  finally{setBusy(false)}
 }
 const names=tagged.map(id=>friends.find(friend=>friend.id===id)?.display_name??'Unavailable friend');
 const relationship=readOnly?`Shared by ${ownerName}`:loading?'Loading sharing details…':!ready?'Sharing details unavailable.':names.length?`Shared with ${names.join(', ')}`:'Not shared yet';
 return <>
  <button ref={trigger} type="button" className={`detail-share-button${!readOnly&&tagged.length?' active':''}`} aria-label={readOnly?'Sharing details':'Tag friends'} title={readOnly?'Sharing details':'Tag friends'} aria-pressed={readOnly?undefined:tagged.length>0} aria-haspopup="dialog" aria-expanded={open} onClick={()=>open?close():void show()}><AppIcon kind="person-tag"/></button>
  <FriendTagDialog open={open} title={readOnly?'Sharing':'Tag friends'} relationship={relationship} readOnly={readOnly} confirmDisabled={!ready||loading} description="Choose friends who can see this wine. Wine identity, details and attached wine photos are shared; each friend keeps their own notes, rating and tasting experience." friends={friends} selected={selected} busy={busy} error={error} onSelectedChange={setSelected} onConfirm={()=>void save()} onClose={close}/>
  {message&&<span className="wine-sharing-status" role="status">{message}</span>}
 </>;
}
