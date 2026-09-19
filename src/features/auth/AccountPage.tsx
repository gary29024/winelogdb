import { useCallback,useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import { bootstrapAccount,getAccount,logout } from '../../lib/auth/client';
import { apiJson } from '../../lib/auth/api';
import { setDefaultFriendShare,shareAllExistingWines } from '../wines/friendTags';

type Friend={id:string;display_name:string;defaultShare?:boolean};
type Requests={incoming:Friend[];outgoing:Friend[]};
type UsageKind={kind:string;label:string;runs:number;requests:number;units:number;unit:'run'|'wine'};
type UsageSummary={days:number;kinds:UsageKind[];empty:boolean};
type ActionAccess={action:string;label:string;accessMode:'included'|'allowance';baseLimit:number;granted:number;limit:number;used:number;pending:number;remaining:number|null;weekStart:string;resetsAt:string};
type AccessSummary={balance:number;reserved:number;available:number;sponsoredAi:boolean;actionAccess:ActionAccess[]|null};
export function AccountPage(){
 const [friends,setFriends]=useState<Friend[]>([]),[access,setAccess]=useState<AccessSummary>({balance:0,reserved:0,available:0,sponsoredAi:true,actionAccess:null});
 const [requests,setRequests]=useState<Requests>({incoming:[],outgoing:[]});
 const [usage,setUsage]=useState<UsageSummary>({days:30,kinds:[],empty:true});
 const [ownCode,setOwnCode]=useState(''),[code,setCode]=useState('');
 const [name,setName]=useState(()=>getAccount()?.display_name??'');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  const [f,a,c,r,u]=await Promise.all([
   apiJson<{items:Friend[]}>('/api/friends'),apiJson<AccessSummary>('/api/credits'),apiJson<{code:string}>('/api/friends/code'),
   apiJson<Requests>('/api/friends/requests'),apiJson<UsageSummary>('/api/usage/spend')
  ]);
  setFriends(f.items);setAccess(a);setOwnCode(c.code);setRequests(r);setUsage(u);
 },[]);
 useEffect(()=>{
  const refresh=()=>void load().catch(e=>setError(e.message));refresh();
  window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh);
 },[load]);
 async function run(fn:()=>Promise<unknown>,message=''){
  setBusy(true);setError('');setNotice('');
  try{await fn();await load();setNotice(message)}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 const account=getAccount(),smart=usage.kinds.find(item=>item.kind==='search_embedding'),providerRequests=usage.kinds.reduce((sum,item)=>sum+item.requests,0),runs=usage.kinds.reduce((sum,item)=>sum+item.runs,0),actions=access.actionAccess??[],allowanceActions=actions.filter(item=>item.accessMode==='allowance');
 const resetsAt=allowanceActions[0]?.resetsAt;
 return <section className="account-page">
  <h1>Account & friends</h1>
  <form onSubmit={e=>{e.preventDefault();void run(async()=>{const saved=await apiJson<{user:{display_name:string}}>('/api/me','PATCH',{displayName:name});setName(saved.user.display_name);await bootstrapAccount()},'Name updated.')}}>
   <fieldset><legend>Profile</legend>
    <label htmlFor="display-name">Name <input id="display-name" value={name} onChange={e=>setName(e.target.value)} maxLength={60} autoComplete="name" required /></label>
    <button type="submit" disabled={busy||!name.trim()}>Save name</button>
    <small>This is the name your friends and other WineLog members will see.</small>
   </fieldset>
  </form>
  {account?.role==='owner'?<p><strong>Owner AI access</strong> · usage and provider cost are tracked, but member action allowances do not apply.</p>:<section aria-label="AI access">
   <p><strong>Pilot AI access</strong></p>
   <ul>{actions.map(item=><li key={item.action}><strong>{item.label}:</strong> {item.accessMode==='included'?'Included':`${item.remaining??0} of ${item.limit} free successful runs available this week${item.granted?` (${item.granted} extra granted)`:''}${item.pending?` · ${item.pending} in progress`:''}`}</li>)}</ul>
   <small>Only successful new provider work consumes an allowance run. Failed work and cached or friend-reused results do not. Smart Search is included separately and has its own daily usage limit.{resetsAt?` Weekly allowances reset ${new Date(resetsAt).toLocaleString()}.`:''}</small>
  </section>}
  {account?.role==='owner'&&<nav className="account-shortcuts" aria-label="Account shortcuts"><Link to="/admin">Owner controls</Link><Link to="/admin#member-usage">Member usage</Link></nav>}
  <section className="personal-usage" aria-labelledby="your-usage-title"><h2 id="your-usage-title">Your usage</h2><p>Last {usage.days} days. Provider activity is tracked even for included features.</p>
   {usage.empty?<p>No AI usage recorded yet.</p>:<dl><div><dt>AI runs</dt><dd>{runs}</dd></div><div><dt>Provider requests</dt><dd>{providerRequests}</dd></div><div><dt>Smart Search</dt><dd>{smart?.requests??0} requests</dd></div><div><dt>Wines embedded</dt><dd>{smart?.units??0}</dd></div></dl>}
  </section>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <h2>Friends</h2>
  <p>Accepted friends can reuse each other’s factual research. Personal wines are shared separately.</p>
  <fieldset className="friend-code-panel"><legend>Your friend code</legend>
   <input aria-label="Your friend code" readOnly value={ownCode} onFocus={e=>e.target.select()} />
   <button disabled={!ownCode} onClick={()=>{void navigator.clipboard.writeText(ownCode).then(()=>setNotice('Friend code copied.')).catch(()=>setError('Select your friend code and copy it.'))}}>Copy code</button>
   <small>Your code stays the same. Other members can use it to send you a friend request.</small>
  </fieldset>
  <form onSubmit={e=>{e.preventDefault();void run(async()=>{await apiJson('/api/friends/requests','POST',{code});setCode('')},'Friend request sent. You’ll become friends when they accept.')}}>
   <fieldset><legend>Add a friend</legend>
    <label htmlFor="friend-code">Friend code <input id="friend-code" value={code} onChange={e=>setCode(e.target.value)} placeholder="A1B2-C3D4-E5F6" autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={20} required /></label>
    <button type="submit" disabled={busy||!code.trim()}>Send friend request</button>
   </fieldset>
  </form>
  <h3>Friend requests{requests.incoming.length?` (${requests.incoming.length})`:''}</h3>
  <button disabled={busy} onClick={()=>void run(async()=>{},'Friend requests refreshed.')}>Refresh requests</button>
  {!requests.incoming.length&&<p>No incoming requests.</p>}
  {requests.incoming.map(item=><article key={item.id} aria-label={`Friend request from ${item.display_name}`}>
   <p>{item.display_name} wants to be your friend.</p><div className="friend-actions">
    <button disabled={busy} onClick={()=>void run(()=>apiJson(`/api/friends/requests/${item.id}/accept`,'POST',{}),`You and ${item.display_name} are now friends.`)}>Accept {item.display_name}</button>
    <button disabled={busy} onClick={()=>void run(()=>apiJson(`/api/friends/requests/${item.id}`,'DELETE'),'Friend request declined.')}>Decline {item.display_name}</button>
   </div>
  </article>)}
  <h3>Sent requests</h3>{!requests.outgoing.length&&<p>No pending sent requests.</p>}
  <ul>{requests.outgoing.map(item=><li key={item.id}>{item.display_name} · Awaiting acceptance <button disabled={busy} onClick={()=>void run(()=>apiJson(`/api/friends/requests/${item.id}`,'DELETE'),'Friend request cancelled.')}>Cancel request to {item.display_name}</button></li>)}</ul>
  <h3>Your friends</h3>{!friends.length&&<p>No friends yet. Send a request using a friend code above.</p>}
  <ul>{friends.map(friend=><li key={friend.id}><strong>{friend.display_name}</strong> <label><input type="checkbox" checked={Boolean(friend.defaultShare)} disabled={busy} onChange={event=>void run(()=>setDefaultFriendShare(friend.id,event.target.checked),event.target.checked?`New wines will be tagged with ${friend.display_name} by default.`:`Default tagging for ${friend.display_name} is off.`)}/> Tag new wines by default</label> {account?.role==='owner'&&<button disabled={busy} onClick={()=>{if(confirm(`Share every wine already in your Journal with ${friend.display_name}?\n\nThis does not change default tagging for future wines.`))void run(()=>shareAllExistingWines(friend.id),`All existing wines are now shared with ${friend.display_name}.`)}}>Share all existing wines</button>} <button disabled={busy} onClick={()=>void run(()=>apiJson(`/api/friends/${friend.id}`,'DELETE'),'Friend removed.')}>Remove friend</button></li>)}</ul>
  <button onClick={()=>void logout()}>Sign out</button>
 </section>;
}
