import { useCallback,useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import { getAccount,logout } from '../../lib/auth/client';
import { apiJson } from '../../lib/auth/api';

type Friend={id:string;display_name:string};
type Requests={incoming:Friend[];outgoing:Friend[]};
export function AccountPage(){
 const [friends,setFriends]=useState<Friend[]>([]),[wallet,setWallet]=useState({balance:0,reserved:0,available:0});
 const [requests,setRequests]=useState<Requests>({incoming:[],outgoing:[]});
 const [ownCode,setOwnCode]=useState(''),[code,setCode]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [history,setHistory]=useState<Array<{id:string;kind:string;amount:number;reason:string}>>([]);
 const load=useCallback(async()=>{
  const [f,w,h,c,r]=await Promise.all([
   apiJson<{items:Friend[]}>('/api/friends'),apiJson<typeof wallet>('/api/credits'),
   apiJson<{items:typeof history}>('/api/credits/history'),apiJson<{code:string}>('/api/friends/code'),
   apiJson<Requests>('/api/friends/requests')
  ]);
  setFriends(f.items);setWallet(w);setHistory(h.items);setOwnCode(c.code);setRequests(r);
 },[]);
 useEffect(()=>{
  const refresh=()=>void load().catch(e=>setError(e.message));refresh();
  window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh);
 },[load]);
 async function run(fn:()=>Promise<unknown>,message=''){
  setBusy(true);setError('');setNotice('');
  try{await fn();await load();setNotice(message)}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <section className="account-page">
  <h1>Account & friends</h1><p>{getAccount()?.display_name}</p>
  <p><strong>{wallet.available} credits available</strong> · {wallet.reserved} reserved</p>
  <Link to="/shared">Shared with me</Link>
  {getAccount()?.role==='owner'&&<p><Link to="/admin">Owner controls</Link></p>}
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
  <h2>Credit history</h2><ul>{history.map(item=><li key={item.id}>{item.kind}: {item.amount} — {item.reason}</li>)}</ul>
  <button onClick={()=>void logout()}>Sign out</button>
 </section>;
}
