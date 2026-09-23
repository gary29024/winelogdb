import { useCallback,useRef,useState } from 'react';
import { AppIcon } from '../../components/AppIcons';
import { FriendTagDialog } from './FriendTagDialog';
import { getWineFriendTags,listFriendTags,setWineFriendTags,type FriendTag } from './friendTags';
import '../../wineSharing.css';

/** How many friends this wine is tagged with, or a sharer to name on a wine
 *  someone else owns. The count arrives with the wine, so the button is right
 *  on first paint: it used to read the sharing endpoint on mount, which cost a
 *  request per wine opened and left the icon briefly lying about a read that
 *  had failed. Naming the friends still needs the endpoint, and still asks -
 *  once the sheet is actually opened. */
type Props={wineId:string;sharedCount:number;ownerName?:never}|{wineId?:never;sharedCount?:never;ownerName:string};
export function WineSharing({wineId,sharedCount,ownerName}:Props){
 const [open,setOpen]=useState(false),[friends,setFriends]=useState<FriendTag[]>([]),[selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [ready,setReady]=useState(false),[loading,setLoading]=useState(false);
 // Our own saves move ahead of the wine we were handed; a freshly loaded wine
 // overrules them, because by then the server has counted our save too.
 const [tagged,setTagged]=useState(sharedCount??0),[counted,setCounted]=useState(sharedCount);
 if(sharedCount!==counted){setCounted(sharedCount);setTagged(sharedCount??0)}
 const request=useRef(0),trigger=useRef<HTMLButtonElement>(null),readOnly=ownerName!==undefined;
 const close=useCallback(()=>{setOpen(false);trigger.current?.focus()},[]);
 async function show(){
  setOpen(true);setMessage('');setError('');
  if(!wineId)return;
  const token=++request.current;setReady(false);setLoading(true);
  try{
   const [f,s]=await Promise.all([listFriendTags(),getWineFriendTags(wineId)]);
   if(request.current!==token)return;
   setFriends(f.items);setSelected(s.recipientIds??[]);setTagged((s.recipientIds??[]).length);setReady(true);
  }catch(e){if(request.current===token)setError((e as Error).message)}
  finally{if(request.current===token)setLoading(false)}
 }
 async function save(){
  if(!wineId||!ready||busy)return;
  setBusy(true);setMessage('');setError('');
  try{
   await setWineFriendTags(wineId,selected);
   setTagged(selected.length);close();
   setMessage(selected.length?`Tagged with ${selected.length} friend${selected.length===1?'':'s'}.`:'Friend tags removed.');
  }catch(e){setError((e as Error).message)}
  finally{setBusy(false)}
 }
 /* The colour says "tagged" to everyone who can see it, so the name has to carry
    the same fact for everyone who cannot. It goes in the name rather than in
    aria-pressed: this button opens a sheet, and a wine being tagged is not a
    pressed button. It counts direct tags only - the ones this sheet can change.
    Sharing a tasting also lets friends see its wines, so "not shared" would be
    a claim the button cannot back. */
 const label=readOnly?'Sharing details'
  :tagged?`Tag friends, ${tagged} friend${tagged===1?'':'s'} tagged`
  :'Tag friends, no friends tagged';
 return <>
  <button ref={trigger} type="button" className={`detail-share-button${!readOnly&&tagged?' active':''}`} aria-label={label} title={readOnly?'Sharing details':'Tag friends'} aria-haspopup="dialog" aria-expanded={open} onClick={()=>open?close():void show()}><AppIcon kind="person-tag"/></button>
  <FriendTagDialog open={open} title={readOnly?'Tagged friends':'Tag friends'} relationship={readOnly?`Shared by ${ownerName||'a friend'}`:undefined} readOnly={readOnly} confirmDisabled={!ready||loading} loading={loading} description="Choose friends who can see this wine. Wine identity, details and attached wine photos are shared; each friend keeps their own notes, rating and tasting experience." friends={friends} selected={selected} busy={busy} error={error} onSelectedChange={setSelected} onConfirm={()=>void save()} onClose={close}/>
  {message&&<span className="wine-sharing-status" role="status">{message}</span>}
 </>;
}
