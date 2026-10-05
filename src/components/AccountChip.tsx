import { useEffect,useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ACCOUNT_UPDATED,FRIEND_REQUESTS_UPDATED,getAccount,getFriendRequestCount } from '../lib/auth/client';
import '../accountChip.css';

/**
 * The top-right way into Account & friends: the reader's initial and name in a
 * pill, with a dot while friend requests wait. On a phone only the circle shows.
 * The dot's count comes with /api/me; profile saves and the Account page's own
 * request reads update both through window events, so no reload is needed.
 */
export function AccountChip(){
 const [account,setAccount]=useState(getAccount);
 const [requests,setRequests]=useState(getFriendRequestCount);
 useEffect(()=>{
  const onAccount=()=>{setAccount(getAccount());setRequests(getFriendRequestCount())};
  const onRequests=()=>setRequests(getFriendRequestCount());
  window.addEventListener(ACCOUNT_UPDATED,onAccount);window.addEventListener(FRIEND_REQUESTS_UPDATED,onRequests);
  return()=>{window.removeEventListener(ACCOUNT_UPDATED,onAccount);window.removeEventListener(FRIEND_REQUESTS_UPDATED,onRequests)};
 },[]);
 const name=account?.display_name?.trim()||'Account';
 const label=`Account & friends${requests?`, ${requests} friend request${requests===1?'':'s'} waiting`:''}`;
 return <NavLink className="account-link" to="/account" aria-label={label} title={account?.handle?`${name} · @${account.handle}`:name}>
  <span className="account-link-avatar" aria-hidden="true">{name.charAt(0)}{requests>0&&<span className="account-link-dot"/>}</span>
  <span className="account-link-name" aria-hidden="true">{name}</span>
 </NavLink>;
}
