import { ApiError,body,json,type IdentityEnv,type Member } from './common';

type FriendRequest={id:string;sender_id:string;recipient_id:string;status:string};
const formatCode=(code:string)=>code.match(/.{4}/g)!.join('-');

export async function friendRequestRoute(request:Request,env:IdentityEnv,member:Member):Promise<Response|null>{
 const path=new URL(request.url).pathname,db=env.DB;
 if(path==='/api/friends/links'||path==='/api/friends/accept')return json({error:'Friend links have been retired. Use a friend code in Account & friends.'},410);
 if(path==='/api/friends/code'&&request.method==='GET'){
  const row=await db.prepare('SELECT code FROM friend_codes WHERE user_id=?').bind(member.id).first<{code:string}>();
  if(!row)throw new ApiError(503,'Friend code is not available');
  return json({code:formatCode(row.code)});
 }
 if(path==='/api/friends/requests'&&request.method==='GET'){
  const rows=await db.prepare(`SELECT r.id,r.sender_id,r.recipient_id,u.display_name FROM friend_requests r
   JOIN app_users u ON u.id=CASE WHEN r.sender_id=? THEN r.recipient_id ELSE r.sender_id END AND u.status='active'
   WHERE r.status='pending' AND (r.sender_id=? OR r.recipient_id=?) ORDER BY r.created_at,r.id LIMIT 48`)
   .bind(member.id,member.id,member.id).all<FriendRequest&{display_name:string}>();
  const item=(row:FriendRequest&{display_name:string})=>({id:row.id,display_name:row.display_name});
  return json({incoming:rows.results.filter(row=>row.recipient_id===member.id).map(item),outgoing:rows.results.filter(row=>row.sender_id===member.id).map(item)});
 }
 if(path==='/api/friends/requests'&&request.method==='POST'){
  const data=await body(request),code=typeof data.code==='string'?data.code.replace(/[\s-]/g,'').toUpperCase():'';
  if(!/^[0-9A-F]{12}$/.test(code))throw new ApiError(400,'Enter a valid friend code, such as A1B2-C3D4-E5F6');
  const target=await db.prepare("SELECT u.id FROM friend_codes c JOIN app_users u ON u.id=c.user_id AND u.status='active' WHERE c.code=?").bind(code).first<{id:string}>();
  if(!target)throw new ApiError(404,'No member found with that friend code');
  if(target.id===member.id)throw new ApiError(400,'That is your own friend code');
  if(await db.prepare('SELECT 1 FROM friendships WHERE user_id=? AND friend_id=?').bind(member.id,target.id).first())throw new ApiError(409,'You are already friends');
  const existing=await db.prepare("SELECT * FROM friend_requests WHERE status='pending' AND ((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?))").bind(member.id,target.id,target.id,member.id).first<FriendRequest>();
  if(existing){if(existing.sender_id!==member.id)throw new ApiError(409,'This member has already sent you a request. Accept it in Friend requests.');return json({id:existing.id,status:'pending'})}
  const id=crypto.randomUUID();
  const inserted=await db.prepare(`INSERT OR IGNORE INTO friend_requests(id,sender_id,recipient_id)
   SELECT ?,?,? WHERE (SELECT count(*) FROM friend_requests WHERE sender_id=? AND created_at>=datetime('now','-1 day'))<50
   AND EXISTS(SELECT 1 FROM app_users WHERE id=? AND status='active')
   AND NOT EXISTS(SELECT 1 FROM friendships WHERE user_id=? AND friend_id=?)`)
   .bind(id,member.id,target.id,member.id,target.id,member.id,target.id).run();
  if(!inserted.meta.changes)throw new ApiError(409,'Request could not be sent. Refresh your requests or try again later.');
  return json({id,status:'pending'},201);
 }
 const match=path.match(/^\/api\/friends\/requests\/([^/]+)(\/accept)?$/);
 if(match&&(request.method==='DELETE'||request.method==='POST'&&match[2])){
  const row=await db.prepare('SELECT * FROM friend_requests WHERE id=? AND (sender_id=? OR recipient_id=?)').bind(match[1],member.id,member.id).first<FriendRequest>();
  if(!row)throw new ApiError(404,'Friend request not found');
  if(request.method==='DELETE'){
   await db.prepare("UPDATE friend_requests SET status=? WHERE id=? AND status='pending'").bind(row.sender_id===member.id?'cancelled':'declined',row.id).run();return json({ok:true});
  }
  if(row.recipient_id!==member.id)throw new ApiError(403,'Only the recipient can accept this request');
  if(row.status==='accepted')return json({ok:true});
  const eligible=`FROM friend_requests r JOIN app_users s ON s.id=r.sender_id AND s.status='active'
   JOIN app_users u ON u.id=r.recipient_id AND u.status='active' WHERE r.id=? AND r.recipient_id=? AND r.status='pending'`;
  const results=await db.batch([
   db.prepare(`INSERT OR IGNORE INTO friendships(user_id,friend_id) SELECT r.sender_id,r.recipient_id ${eligible}`).bind(row.id,member.id),
   db.prepare(`INSERT OR IGNORE INTO friendships(user_id,friend_id) SELECT r.recipient_id,r.sender_id ${eligible}`).bind(row.id,member.id),
   db.prepare(`UPDATE friend_requests SET status='accepted' WHERE id IN (SELECT r.id ${eligible})`).bind(row.id,member.id)
  ]);
  if(!results[2].meta.changes)throw new ApiError(409,'This request is no longer available');
  return json({ok:true});
 }
 return null;
}
