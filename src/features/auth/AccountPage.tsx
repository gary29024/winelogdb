import { useCallback,useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import { SectionNavigation } from '../../components/SectionNavigation';
import { usePageSection } from '../../components/usePageSection';
import { PageHeader } from '../../components/PageHeader';
import '../../settingsLayout.css';
import '../../settingsCards.css';
import { bootstrapAccount,getAccount,logout } from '../../lib/auth/client';
import { apiJson } from '../../lib/auth/api';
import { setDefaultFriendShare,shareAllExistingWines } from '../wines/friendTags';

type Friend={id:string;display_name:string;handle?:string|null;defaultShare?:boolean;since?:string};
type HandleCheck={state:'idle'|'checking'|'available'|'unavailable';message?:string};
type Requests={incoming:Friend[];outgoing:Friend[]};
type UsageKind={kind:string;label:string;runs:number;requests:number;units:number;unit:'run'|'wine'};
type UsageSummary={days:number;kinds:UsageKind[];empty:boolean};
type ActionAccess={action:string;label:string;accessMode:'included'|'allowance';baseLimit:number;granted:number;limit:number;used:number;pending:number;remaining:number|null;weekStart:string;resetsAt:string};
type AccessSummary={balance:number;reserved:number;available:number;sponsoredAi:boolean;actionAccess:ActionAccess[]|null};
const formatReset=(value:string)=>{const date=new Date(value);return Number.isNaN(date.getTime())?value:date.toLocaleString(undefined,{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})};
const sections=[{id:'profile',label:'Profile'},{id:'friends',label:'Friends'},{id:'usage',label:'AI usage'}];
export function AccountPage(){
 const [section,selectSection]=usePageSection(sections,'profile');
 const [friends,setFriends]=useState<Friend[]>([]),[access,setAccess]=useState<AccessSummary>({balance:0,reserved:0,available:0,sponsoredAi:true,actionAccess:null});
 const [requests,setRequests]=useState<Requests>({incoming:[],outgoing:[]});
 const [usage,setUsage]=useState<UsageSummary>({days:30,kinds:[],empty:true});
 const [ownCode,setOwnCode]=useState(''),[code,setCode]=useState('');
 const [name,setName]=useState(()=>getAccount()?.display_name??'');
 const [handle,setHandle]=useState(()=>getAccount()?.handle??''),[handleCheck,setHandleCheck]=useState<HandleCheck>({state:'idle'});
 const [busySections,setBusySections]=useState<Record<string,boolean>>({});
 const busy=Boolean(busySections[section]);
 const [feedback,setFeedback]=useState<Record<string,{error?:string;notice?:string}>>({});
 const [loadErrors,setLoadErrors]=useState<Record<string,string>>({});
 const [loaded,setLoaded]=useState<Record<string,boolean>>({});
 const [shareNotice,setShareNotice]=useState<{friendId:string;message:string}|null>(null);
 const setError=(error:string)=>setFeedback(previous=>({...previous,[section]:{error}}));
 const setNotice=(notice:string)=>setFeedback(previous=>({...previous,[section]:{notice}}));
 const load=useCallback(async(target?:string)=>{
  const jobs=[
   {key:'friends',group:'friends',fetch:()=>apiJson<{items:Friend[]}>('/api/friends').then(value=>setFriends(value.items))},
   {key:'code',group:'friends',fetch:()=>apiJson<{code:string}>('/api/friends/code').then(value=>setOwnCode(value.code))},
   {key:'requests',group:'friends',fetch:()=>apiJson<Requests>('/api/friends/requests').then(setRequests)},
   {key:'access',group:'usage',fetch:()=>apiJson<AccessSummary>('/api/credits').then(setAccess)},
   {key:'usage',group:'usage',fetch:()=>apiJson<UsageSummary>('/api/usage/spend').then(setUsage)}
  ].filter(job=>!target||job.group===target);
  await Promise.all(jobs.map(async job=>{
   try{await job.fetch();setLoadErrors(previous=>({...previous,[job.key]:''}));setLoaded(previous=>({...previous,[job.key]:true}))}
   catch(error){setLoadErrors(previous=>({...previous,[job.key]:(error as Error).message}))}
  }));
 },[]);
 // Ask whether a new handle is free once typing pauses; a stale answer is ignored.
 useEffect(()=>{
  const wanted=handle.trim().replace(/^@/,'').toLowerCase(),current=getAccount()?.handle??'';
  if(!wanted||wanted===current){setHandleCheck({state:'idle'});return}
  setHandleCheck({state:'checking'});let live=true;
  const timer=window.setTimeout(()=>{void apiJson<{available:boolean;problem:string|null}>(`/api/me/handle-check?handle=${encodeURIComponent(wanted)}`).then(result=>{if(live)setHandleCheck(result.available?{state:'available'}:{state:'unavailable',message:result.problem??'That user ID is taken'})}).catch(()=>{if(live)setHandleCheck({state:'idle'})})},350);
  return()=>{live=false;window.clearTimeout(timer)};
 },[handle]);
 useEffect(()=>{
  const refresh=()=>void load();refresh();
  window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh);
 },[load]);
 async function run(fn:()=>Promise<unknown>,message:string|((result:unknown)=>string)=''){
  const target=section;
  setBusySections(previous=>({...previous,[target]:true}));setFeedback(previous=>({...previous,[target]:{}}));setShareNotice(null);
  try{const result=await fn();await load(target);setFeedback(previous=>({...previous,[target]:{notice:typeof message==='function'?message(result):message}}))}
  catch(error){setFeedback(previous=>({...previous,[target]:{error:(error as Error).message}}))}
  finally{setBusySections(previous=>({...previous,[target]:false}))}
 }
 async function shareExisting(friend:Friend){
  await run(async()=>{
   const result=await shareAllExistingWines(friend.id),count=result.count;
   setShareNotice({friendId:friend.id,message:count?'Shared '+count+' wine'+(count===1?'':'s')+' with '+friend.display_name+'.':'No new wine shares were added for '+friend.display_name+'.'});
  });
 }
 const resourceStatus=(keys:string[])=>keys.map(key=>loadErrors[key]
  ?<p role="alert" key={key}>{loadErrors[key]} <button type="button" onClick={()=>void load(keys.includes('access')?'usage':'friends')}>Retry</button></p>
  :!loaded[key]?<p role="status" key={key}>Loading {key==='code'?'friend code':key}…</p>:null);
 const account=getAccount(),isOwner=account?.role==='owner',smart=usage.kinds.find(item=>item.kind==='search_embedding'),providerRequests=usage.kinds.reduce((sum,item)=>sum+item.requests,0),runs=usage.kinds.reduce((sum,item)=>sum+item.runs,0),actions=access.actionAccess??[],allowanceActions=actions.filter(item=>item.accessMode==='allowance');
 const resetsAt=allowanceActions[0]?.resetsAt;
 const sinceLabel=(since?:string)=>{const date=since?new Date(since.replace(' ','T')+(since.includes('Z')?'':'Z')):null;return date&&!Number.isNaN(date.getTime())?`Friends since ${date.toLocaleDateString(undefined,{month:'short',year:'numeric'})}`:'Friend'};
 return <section className="account-page settings-page">
  <PageHeader title="Account & friends" subtitle="Your profile, connections and AI access."/>
  <div className="settings-layout">
   <aside><SectionNavigation label="Account sections" items={sections.map(item=>({...item,count:item.id==='friends'?requests.incoming.length:undefined}))} selected={section} onSelect={selectSection}/>
   {isOwner&&<Link className="settings-owner-link" to="/admin">Owner tools →</Link>}</aside>
   <div className="settings-content settings-cards">
    {sections.map(item=><div hidden={section!==item.id} key={item.id}>
     {feedback[item.id]?.error&&<p role="alert">{feedback[item.id].error}</p>}
     {feedback[item.id]?.notice&&<p role="status">{feedback[item.id].notice}</p>}
    </div>)}
    <section hidden={section!=='profile'} aria-label="Profile settings">
     <form className="settings-card" onSubmit={e=>{e.preventDefault();void run(async()=>{const saved=await apiJson<{user:{display_name:string;handle?:string|null}}>('/api/me','PATCH',{displayName:name,handle});setName(saved.user.display_name);setHandle(saved.user.handle??'');await bootstrapAccount()},'Profile saved.')}}>
      <div className="settings-identity"><span className="settings-avatar is-large" aria-hidden="true">{(account?.display_name??name).trim().charAt(0)||'?'}</span><div><strong>{account?.display_name??name}{account?.handle&&<span className="settings-handle"> @{account.handle}</span>}</strong><span className="settings-chips"><span className={`settings-chip${isOwner?' is-accent':''}`}>{isOwner?'Owner':'Member'}</span>{loaded.friends&&<span className="settings-chip">{friends.length} friend{friends.length===1?'':'s'}</span>}</span></div></div>
      <div className="settings-field"><label htmlFor="display-name" className="settings-label">Name</label>
       <input id="display-name" value={name} onChange={e=>setName(e.target.value)} maxLength={60} autoComplete="name" required/></div>
      <div className="settings-field"><label htmlFor="handle" className="settings-label">User ID</label>
       <div className="settings-row"><span className="settings-at settings-grow"><span aria-hidden="true">@</span><input id="handle" value={handle} onChange={e=>setHandle(e.target.value.replace(/^@/,'').toLowerCase())} maxLength={20} autoCapitalize="none" autoComplete="username" spellCheck={false} aria-describedby="handle-status handle-hint" required/></span>
        <span id="handle-status" role="status" className={`settings-chip${handleCheck.state==='available'?' is-good':handleCheck.state==='unavailable'?' is-warn':''}`} hidden={handleCheck.state==='idle'}>{handleCheck.state==='checking'?'Checking…':handleCheck.state==='available'?'✓ Available':handleCheck.message}</span></div></div>
      <p className="settings-hint" id="handle-hint">Your name can be anything. Your user ID is unique, so friends can tell two people with the same name apart and find you by typing @{handle||'userid'}. 3–20 characters: lowercase letters, numbers, dots and underscores.</p>
      <div><button type="submit" className="settings-primary" disabled={busy||!name.trim()||!handle.trim()||handleCheck.state==='unavailable'||handleCheck.state==='checking'}>Save profile</button></div>
     </form>
     <div className="settings-card settings-split"><div><strong>Signed in</strong><span className="settings-hint">{account?.email}</span></div><button type="button" onClick={()=>void logout()}>Sign out</button></div>
    </section>
    <section hidden={section!=='friends'} aria-label="Friends settings">
     {resourceStatus(['friends','requests','code'])}
     {requests.incoming.map(item=><article className="settings-request" key={item.id} aria-label={`Friend request from ${item.display_name}`}>
      <span className="settings-avatar" aria-hidden="true">{item.display_name.charAt(0)}</span><p><strong>{item.display_name}</strong>{item.handle&&<span className="settings-handle"> @{item.handle}</span>} wants to be your friend.</p><div className="friend-actions">
       <button className="settings-primary" disabled={busy} aria-label={`Accept ${item.display_name}`} onClick={()=>void run(()=>apiJson(`/api/friends/requests/${item.id}/accept`,'POST',{}),`You and ${item.display_name} are now friends.`)}>Accept</button>
       <button className="settings-quiet" disabled={busy} aria-label={`Decline ${item.display_name}`} onClick={()=>void run(()=>apiJson(`/api/friends/requests/${item.id}`,'DELETE'),'Friend request declined.')}>Decline</button>
      </div>
     </article>)}
     <div className="settings-card settings-connect">
      <div><span className="settings-label" id="own-code-label">Your friend code</span>
       <div className="settings-row"><span className="settings-code settings-grow" aria-labelledby="own-code-label">{ownCode||'…'}</span><button type="button" disabled={!ownCode} onClick={()=>{void navigator.clipboard.writeText(ownCode).then(()=>setNotice('Friend code copied.')).catch(()=>setError('Select your friend code and copy it.'))}} aria-label="Copy friend code">Copy</button></div>
       <p className="settings-hint">{account?.handle?<>Friends can also find you as <strong>@{account.handle}</strong>.</>:'Your code stays the same. Share it so friends can add you.'}</p></div>
      <form onSubmit={e=>{e.preventDefault();void run(async()=>{await apiJson('/api/friends/requests','POST',{code});setCode('')},'Friend request sent. You’ll become friends when they accept.')}}>
       <div className="settings-field"><label htmlFor="friend-code" className="settings-label">Add a friend</label>
       <div className="settings-row"><input className="settings-grow" id="friend-code" aria-label="Friend code or user ID" value={code} onChange={e=>setCode(e.target.value)} placeholder="@userid or friend code" autoCapitalize="none" autoComplete="off" spellCheck={false} maxLength={20} required/><button type="submit" className="settings-primary" disabled={busy||!code.trim()}>Send request</button></div></div>
       <p className="settings-hint">Type a user ID or a friend code. You become friends once they accept.</p></form>
     </div>
     <div className="settings-card">
      <div className="settings-card-head"><h2>Your friends</h2><small>Friends can reuse each other’s research. Wines are shared separately.</small></div>
      {loaded.friends&&!friends.length&&<p className="settings-hint">No friends yet. Add someone above with their user ID or friend code.</p>}
      {!!friends.length&&<ul className="settings-people">{friends.map(friend=><li key={friend.id}>
       <span className="settings-avatar" aria-hidden="true">{friend.display_name.charAt(0)}</span>
       <span className="settings-person"><strong>{friend.display_name}{friend.handle&&<span className="settings-handle"> @{friend.handle}</span>}</strong><span>{sinceLabel(friend.since)}</span></span>
       <label className="settings-switch"><input type="checkbox" role="switch" aria-label={`Share new wines with ${friend.display_name} by default`} checked={Boolean(friend.defaultShare)} disabled={busy} onChange={event=>void run(()=>setDefaultFriendShare(friend.id,event.target.checked),event.target.checked?`New wines will be tagged with ${friend.display_name} by default.`:`Default tagging for ${friend.display_name} is off.`)}/><span className="settings-switch-long">Share new wines</span><span className="settings-switch-short" aria-hidden="true">Share</span></label>
       <details className="settings-menu"><summary aria-label={`More options for ${friend.display_name}`}>⋯</summary><div>
        {isOwner&&<button disabled={busy} aria-label={`Share all existing wines with ${friend.display_name}`} onClick={()=>{if(confirm(`Share every wine already in your Journal with ${friend.display_name}?\n\nThis does not change default tagging for future wines. There is currently no bulk undo; reversing this requires untagging this friend from wines individually.`))void shareExisting(friend)}}>Share all existing wines…</button>}
        {shareNotice?.friendId===friend.id&&<small role="status">{shareNotice.message}</small>}
        <button className="settings-danger" disabled={busy} onClick={()=>{if(confirm(`Remove ${friend.display_name} as a friend?\n\nWines and tastings you shared with each other stop being shared.`))void run(()=>apiJson(`/api/friends/${friend.id}`,'DELETE'),'Friend removed.')}}>Remove friend</button>
       </div></details>
      </li>)}</ul>}
      <details className="settings-fold"><summary>Sent requests {!!requests.outgoing.length&&<span className="settings-chip">{requests.outgoing.length} pending</span>}</summary>
       {loaded.requests&&!requests.outgoing.length&&<p className="settings-hint">No pending sent requests.</p>}
       {!!requests.outgoing.length&&<ul className="settings-people">{requests.outgoing.map(item=><li key={item.id}><span className="settings-avatar" aria-hidden="true">{item.display_name.charAt(0)}</span><span className="settings-person"><strong>{item.display_name}{item.handle&&<span className="settings-handle"> @{item.handle}</span>}</strong><span>Awaiting acceptance</span></span><button className="settings-quiet" disabled={busy} aria-label={`Cancel request to ${item.display_name}`} onClick={()=>void run(()=>apiJson(`/api/friends/requests/${item.id}`,'DELETE'),'Friend request cancelled.')}>Cancel</button></li>)}</ul>}
      </details>
     </div>
    </section>
    <section hidden={section!=='usage'} aria-label="AI usage settings">
     {resourceStatus(['access','usage'])}
     {loaded.access&&<section className="settings-card" aria-label="AI access">
      <div className="settings-card-head"><h2>{isOwner?'Your AI access':'This week’s AI allowance'}</h2>{isOwner?<span className="settings-chip is-accent">Owner · no allowance limits</span>:resetsAt&&<span className="settings-chip">Resets {formatReset(resetsAt)}</span>}</div>
      {isOwner?<p className="settings-hint">Your usage and provider cost are tracked, but member allowances do not apply to you.</p>:<>
       <div className="settings-tiles">{actions.map(item=>{const remaining=item.remaining??0,share=item.limit?remaining/item.limit:0;return <article key={item.action}><strong>{item.label}</strong>
        {item.accessMode==='included'?<><b><span className="settings-chip is-good">Included</span></b><span className="settings-tile-note">No weekly limit</span></>:<><b aria-label={`${remaining} of ${item.limit} runs left`}>{remaining} <small>of {item.limit} left</small></b><div className={`settings-meter${share<=.34?' is-low':''}`} aria-hidden="true"><span style={{width:`${Math.round(Math.min(1,share)*100)}%`}}/></div>{(item.granted>0||item.pending>0)&&<span className="settings-tile-note">{[item.granted?`${item.granted} extra granted`:'',item.pending?`${item.pending} in progress`:''].filter(Boolean).join(' · ')}</span>}</>}
       </article>})}
        <article><strong>Smart Search</strong><b><span className="settings-chip is-good">Included</span></b><span className="settings-tile-note">Daily limit applies</span></article></div>
       <p className="settings-hint">Only successful new work uses a run. Failed runs, cached results and research reused from friends are free.</p></>}
     </section>}
     {loaded.usage&&<section className="settings-card" aria-labelledby="your-usage-title">
      <div className="settings-card-head"><h2 id="your-usage-title">Your usage</h2><small>Last {usage.days} days</small></div>
      {usage.empty?<p className="settings-hint">No AI usage recorded yet.</p>:<><dl className="settings-stats"><div><dt>AI runs</dt><dd>{runs}</dd></div><div><dt>Smart Search</dt><dd>{smart?.requests??0} <small>searches</small></dd></div><div><dt>Wines indexed</dt><dd>{smart?.units??0}</dd></div>{isOwner&&<div><dt>Provider requests</dt><dd>{providerRequests}</dd></div>}</dl>
      <p className="settings-hint">Included features are counted here too, so you can see everything AI did for you.</p></>}
     </section>}
    </section>
   </div>
  </div>
 </section>;
}
