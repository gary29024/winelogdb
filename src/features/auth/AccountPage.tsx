import { useCallback,useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import { getAccount,logout } from '../../lib/auth/client';
import { apiJson } from '../../lib/auth/api';

type Friend={id:string;display_name:string};
type Requests={incoming:Friend[];outgoing:Friend[]};
type UsageKind={kind:string;label:string;runs:number;requests:number;units:number;unit:'run'|'wine'};
type UsageSummary={days:number;kinds:UsageKind[];empty:boolean};
type ResearchAllowance={limit:number;used:number;remaining:number;weekStart:string;resetsAt:string};
type AccessSummary={balance:number;reserved:number;available:number;sponsoredAi:boolean;researchAllowance:ResearchAllowance|null};
export function AccountPage(){
 const [friends,setFriends]=useState<Friend[]>([]),[access,setAccess]=useState<AccessSummary>({balance:0,reserved:0,available:0,sponsoredAi:true,researchAllowance:null});
 const [requests,setRequests]=useState<Requests>({incoming:[],outgoing:[]});
 const [usage,setUsage]=useState<UsageSummary>({days:30,kinds:[],empty:true});
 const [ownCode,setOwnCode]=useState(''),[code,setCode]=useState('');
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
 const account=getAccount(),smart=usage.kinds.find(item=>item.kind==='search_embedding'),providerRequests=usage.kinds.reduce((sum,item)=>sum+item.requests,0),runs=usage.kinds.reduce((sum,item)=>sum+item.runs,0),allowance=access.researchAllowance;
 return <section className="account-page">
  <h1>Account & friends</h1><p>{account?.display_name}</p>
  {account?.role==='owner'?<p><strong>Owner AI access</strong> · usage and provider cost are tracked, but the member research allowance does not apply.</p>:<section aria-label="AI access"><p><strong>Scanning and Smart Search are included.</strong> Their provider cost is sponsored by WineLog.</p>{allowance&&<p><strong>{allowance.remaining} of {allowance.limit} research runs remaining this week.</strong> Resets {new Date(allowance.resetsAt).toLocaleString()}.</p>}<small>Wine Deep Search, individual producer research and Vintage Window share this allowance. Cached or friend-reused research does not use a run. Batch Deep Search is owner-only.</small></section>}
  <nav className="account-shortcuts" aria-label="Account shortcuts"><Link to="/shared">Shared with me</Link>{account?.role==='owner'&&<><Link to="/admin">Owner controls</Link><Link to="/admin#member-usage">Member usage</Link></>}</nav>
  <section className="personal-usage" aria-labelledby="your-usage-title"><h2 id="your-usage-title">Your usage</h2><p>Last {usage.days} days. Provider activity is tracked even for sponsored features.</p>
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
  <ul>{friends.map(friend=><li key={friend.id}>{friend.display_name} <button disabled={busy} onClick={()=>void run(()=>apiJson(`/api/friends/${friend.id}`,'DELETE'),'Friend removed.')}>Remove friend</button></li>)}</ul>
  <button onClick={()=>void logout()}>Sign out</button>
 </section>;
}
