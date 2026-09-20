import { useCallback,useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import { SectionNavigation } from '../../components/SectionNavigation';
import { usePageSection } from '../../components/usePageSection';
import { PageHeader } from '../../components/PageHeader';
import '../../settingsLayout.css';
import { bootstrapAccount,getAccount,logout } from '../../lib/auth/client';
import { apiJson } from '../../lib/auth/api';
import { setDefaultFriendShare,shareAllExistingWines } from '../wines/friendTags';

type Friend={id:string;display_name:string;defaultShare?:boolean};
type Requests={incoming:Friend[];outgoing:Friend[]};
type UsageKind={kind:string;label:string;runs:number;requests:number;units:number;unit:'run'|'wine'};
type UsageSummary={days:number;kinds:UsageKind[];empty:boolean};
type ActionAccess={action:string;label:string;accessMode:'included'|'allowance';baseLimit:number;granted:number;limit:number;used:number;pending:number;remaining:number|null;weekStart:string;resetsAt:string};
type AccessSummary={balance:number;reserved:number;available:number;sponsoredAi:boolean;actionAccess:ActionAccess[]|null};
const sections=[{id:'profile',label:'Profile'},{id:'friends',label:'Friends'},{id:'usage',label:'AI usage'}];
export function AccountPage(){
 const [section,selectSection]=usePageSection(sections,'profile');
 const [friends,setFriends]=useState<Friend[]>([]),[access,setAccess]=useState<AccessSummary>({balance:0,reserved:0,available:0,sponsoredAi:true,actionAccess:null});
 const [requests,setRequests]=useState<Requests>({incoming:[],outgoing:[]});
 const [usage,setUsage]=useState<UsageSummary>({days:30,kinds:[],empty:true});
 const [ownCode,setOwnCode]=useState(''),[code,setCode]=useState('');
 const [name,setName]=useState(()=>getAccount()?.display_name??'');
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
 const account=getAccount(),smart=usage.kinds.find(item=>item.kind==='search_embedding'),providerRequests=usage.kinds.reduce((sum,item)=>sum+item.requests,0),runs=usage.kinds.reduce((sum,item)=>sum+item.runs,0),actions=access.actionAccess??[],allowanceActions=actions.filter(item=>item.accessMode==='allowance');
 const resetsAt=allowanceActions[0]?.resetsAt;
 return <section className="account-page settings-page">
  <PageHeader title="Account & friends" subtitle="Your profile, connections and AI access."/>
  <div className="settings-layout">
   <aside><SectionNavigation label="Account sections" items={sections.map(item=>({...item,count:item.id==='friends'?requests.incoming.length:undefined}))} selected={section} onSelect={selectSection}/>
   {account?.role==='owner'&&<Link className="settings-owner-link" to="/admin">Owner tools →</Link>}</aside>
   <div className="settings-content">
    {sections.map(item=><div hidden={section!==item.id} key={item.id}>
     {feedback[item.id]?.error&&<p role="alert">{feedback[item.id].error}</p>}
     {feedback[item.id]?.notice&&<p role="status">{feedback[item.id].notice}</p>}
    </div>)}
    <section hidden={section!=='profile'} aria-label="Profile settings">
  <form onSubmit={e=>{e.preventDefault();void run(async()=>{const saved=await apiJson<{user:{display_name:string}}>('/api/me','PATCH',{displayName:name});setName(saved.user.display_name);await bootstrapAccount()},'Name updated.')}}>
   <fieldset><legend>Profile</legend>
    <label htmlFor="display-name">Name <input id="display-name" value={name} onChange={e=>setName(e.target.value)} maxLength={60} autoComplete="name" required /></label>
    <button type="submit" disabled={busy||!name.trim()}>Save name</button>
    <small>This is the name your friends and other WineLog members will see.</small>
   </fieldset>
  </form>
  <section className="settings-session"><h2>Session</h2><button type="button" onClick={()=>void logout()}>Sign out</button></section>
    </section>
    <section hidden={section!=='friends'} aria-label="Friends settings">
  <h2>Friends</h2>
  <p>Accepted friends can reuse each other’s factual research. Personal wines are shared separately.</p>
{resourceStatus(['friends','requests','code'])}
  <h3>Friend requests{requests.incoming.length?` (${requests.incoming.length})`:''}</h3>
  <button disabled={busy} onClick={()=>void run(async()=>{},'Friend requests refreshed.')}>Refresh requests</button>
  {loaded.requests&&!requests.incoming.length&&<p>No incoming requests.</p>}
  {requests.incoming.map(item=><article key={item.id} aria-label={`Friend request from ${item.display_name}`}>
   <p>{item.display_name} wants to be your friend.</p><div className="friend-actions">
    <button disabled={busy} onClick={()=>void run(()=>apiJson(`/api/friends/requests/${item.id}/accept`,'POST',{}),`You and ${item.display_name} are now friends.`)}>Accept {item.display_name}</button>
    <button disabled={busy} onClick={()=>void run(()=>apiJson(`/api/friends/requests/${item.id}`,'DELETE'),'Friend request declined.')}>Decline {item.display_name}</button>
   </div>
  </article>)}
  <h3>Your friends</h3>{loaded.friends&&!friends.length&&<p>No friends yet. Send a request using a friend code above.</p>}
  <ul className="settings-friends">{friends.map(friend=><li key={friend.id}><strong>{friend.display_name}</strong> <label><input type="checkbox" checked={Boolean(friend.defaultShare)} disabled={busy} onChange={event=>void run(()=>setDefaultFriendShare(friend.id,event.target.checked),event.target.checked?`New wines will be tagged with ${friend.display_name} by default.`:`Default tagging for ${friend.display_name} is off.`)}/> Share new wines by default</label><details><summary>Sharing options</summary> {account?.role==='owner'&&<><button disabled={busy} aria-label={`Share all existing wines with ${friend.display_name}`} onClick={()=>{if(confirm(`Share every wine already in your Journal with ${friend.display_name}?\n\nThis does not change default tagging for future wines. There is currently no bulk undo; reversing this requires untagging this friend from wines individually.`))void shareExisting(friend)}}>Share all existing wines</button>{shareNotice?.friendId===friend.id&&<small role="status"> {shareNotice.message}</small>}</>} <button disabled={busy} onClick={()=>void run(()=>apiJson(`/api/friends/${friend.id}`,'DELETE'),'Friend removed.')}>Remove friend</button></details></li>)}</ul>
  <form onSubmit={e=>{e.preventDefault();void run(async()=>{await apiJson('/api/friends/requests','POST',{code});setCode('')},'Friend request sent. You’ll become friends when they accept.')}}>
   <fieldset><legend>Add a friend</legend>
    <label htmlFor="friend-code">Friend code <input id="friend-code" value={code} onChange={e=>setCode(e.target.value)} placeholder="A1B2-C3D4-E5F6" autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={20} required /></label>
    <button type="submit" disabled={busy||!code.trim()}>Send friend request</button>
   </fieldset>
  </form>
  <fieldset className="friend-code-panel"><legend>Your friend code</legend>
   <input aria-label="Your friend code" readOnly value={ownCode} onFocus={e=>e.target.select()} />
   <button disabled={!ownCode} onClick={()=>{void navigator.clipboard.writeText(ownCode).then(()=>setNotice('Friend code copied.')).catch(()=>setError('Select your friend code and copy it.'))}}>Copy code</button>
   <small>Your code stays the same. Other members can use it to send you a friend request.</small>
  </fieldset>

  <details><summary>Sent requests</summary>{loaded.requests&&!requests.outgoing.length&&<p>No pending sent requests.</p>}
  <ul>{requests.outgoing.map(item=><li key={item.id}>{item.display_name} · Awaiting acceptance <button disabled={busy} onClick={()=>void run(()=>apiJson(`/api/friends/requests/${item.id}`,'DELETE'),'Friend request cancelled.')}>Cancel request to {item.display_name}</button></li>)}</ul>
</details>
    </section>
    <section hidden={section!=='usage'} aria-label="AI usage settings">
     <h2>AI access</h2>{resourceStatus(['access','usage'])}
{loaded.access&&<>  {account?.role==='owner'?<p><strong>Owner AI access</strong> · usage and provider cost are tracked, but member action allowances do not apply.</p>:<section aria-label="AI access">
   <p><strong>Pilot AI access</strong></p>
   <ul>{actions.map(item=><li key={item.action}><strong>{item.label}:</strong> {item.accessMode==='included'?'Included':`${item.remaining??0} of ${item.limit} free successful runs available this week${item.granted?` (${item.granted} extra granted)`:''}${item.pending?` · ${item.pending} in progress`:''}`}</li>)}</ul>
   <small>Only successful new provider work consumes an allowance run. Failed work and cached or friend-reused results do not. Smart Search is included separately and has its own daily usage limit.{resetsAt?` Weekly allowances reset ${new Date(resetsAt).toLocaleString()}.`:''}</small>
  </section>}
</>}{loaded.usage&&<>  <section className="personal-usage" aria-labelledby="your-usage-title"><h2 id="your-usage-title">Your usage</h2><p>Last {usage.days} days. Provider activity is tracked even for included features.</p>
   {usage.empty?<p>No AI usage recorded yet.</p>:<><dl><div><dt>AI runs</dt><dd>{runs}</dd></div></dl><details><summary>Provider activity</summary><dl><div><dt>Provider requests</dt><dd>{providerRequests}</dd></div><div><dt>Smart Search</dt><dd>{smart?.requests??0} requests</dd></div><div><dt>Wines embedded</dt><dd>{smart?.units??0}</dd></div></dl></details></>}
  </section>
</>}    </section>
   </div>
  </div>
 </section>;
}
