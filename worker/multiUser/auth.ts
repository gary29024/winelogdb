import { createRemoteJWKSet,jwtVerify } from 'jose';
import { ApiError,body,cookie,hash,json,randomToken,seconds,setCookie,settings,type IdentityEnv,type Member } from './common';

const keys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const SESSION='__Host-winelog';
const FLOW='__Host-winelog-flow';
const sessionAge=7*86400;
export async function authenticate(request:Request,env:IdentityEnv):Promise<Member>{
 const token=cookie(request,SESSION);if(!token)throw new ApiError(401,'Sign in required');
 const user=await env.DB.prepare("SELECT u.* FROM auth_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.status='active'").bind(await hash(token),seconds()).first<Member>();
 if(!user)throw new ApiError(401,'Session expired');return user;
}
export function verifyOrigin(request:Request,env:IdentityEnv){
 if(!['GET','HEAD','OPTIONS'].includes(request.method)&&request.headers.get('Origin')!==new URL(env.APP_URL).origin)throw new ApiError(403,'Invalid request origin');
}
export async function bindGoogleAccount(env:IdentityEnv,claims:{sub:string;email:string;name:string},invitationHash:string|null){
 const existing=await env.DB.prepare('SELECT u.* FROM auth_identities i JOIN app_users u ON u.id=i.user_id WHERE i.provider=? AND i.subject=?').bind('google',claims.sub).first<Member>();
 if(existing){if(existing.status!=='active')throw new ApiError(403,'Account suspended');return existing}
 const isOwner=Boolean(env.OWNER_GOOGLE_SUB)&&claims.sub===env.OWNER_GOOGLE_SUB;
 const id=isOwner?'owner':crypto.randomUUID();
 if(!isOwner){
  const config=await settings(env.DB);
  const count=await env.DB.prepare('SELECT count(*) AS n FROM app_users').first<{n:number}>();
  if((count?.n??0)>=config.memberLimit)throw new ApiError(403,'Pilot membership is full');
  if(!invitationHash)throw new ApiError(403,'An owner invitation is required');
 }
 // A conditional INSERT plus the identity FK makes consumption and membership atomic.
 const invitation=isOwner?null:await env.DB.prepare('SELECT token_hash FROM member_invitations WHERE token_hash=? AND email=? AND used_by IS NULL AND expires_at>?').bind(invitationHash,claims.email.toLowerCase(),seconds()).first();
 if(!isOwner&&!invitation)throw new ApiError(403,'Invitation is invalid, expired, or for a different email');
 await env.DB.batch([
  isOwner?env.DB.prepare("INSERT INTO app_users(id,email,display_name,role) VALUES(?,?,?,'owner')").bind(id,claims.email,claims.name):
   env.DB.prepare("INSERT INTO app_users(id,email,display_name,role) SELECT ?,?,?,'member' FROM member_invitations WHERE token_hash=? AND email=? AND used_by IS NULL AND expires_at>? AND (SELECT count(*) FROM app_users)<json_extract((SELECT value_json FROM pilot_settings WHERE id=1),'$.memberLimit')").bind(id,claims.email,claims.name,invitationHash,claims.email.toLowerCase(),seconds()),
  env.DB.prepare('INSERT INTO auth_identities(provider,subject,user_id) VALUES(?,?,?)').bind('google',claims.sub,id),
  env.DB.prepare('INSERT INTO credit_wallets(user_id) VALUES(?)').bind(id),
  ...(isOwner?[]:[env.DB.prepare('UPDATE member_invitations SET used_by=? WHERE token_hash=? AND used_by IS NULL').bind(id,invitationHash)])
 ]);
 return {id,email:claims.email,display_name:claims.name,role:isOwner?'owner':'member',status:'active'} as Member;
}
export async function authRoute(request:Request,env:IdentityEnv):Promise<Response|null>{
 const url=new URL(request.url);
 if(url.pathname==='/api/auth/login')return json({error:'Password login has been retired. Use Google.'},410);
 if(url.pathname==='/api/auth/google/start'&&request.method==='GET'){
  if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.OWNER_GOOGLE_SUB)throw new ApiError(503,'Google sign-in has not been configured');
  const state=randomToken(),nonce=randomToken(),verifier=randomToken(),invite=url.searchParams.get('invitation');
  await env.DB.prepare('INSERT INTO auth_flows(state_hash,nonce,verifier,invitation_hash,expires_at) VALUES(?,?,?,?,?)').bind(await hash(state),nonce,verifier,invite?await hash(invite):null,seconds()+600).run();
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
  const challenge=btoa(String.fromCharCode(...digest)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const target=new URL('https://accounts.google.com/o/oauth2/v2/auth');target.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:`${env.APP_URL}/api/auth/google/callback`,response_type:'code',scope:'openid email profile',state,nonce,code_challenge:challenge,code_challenge_method:'S256'}).toString();
  return new Response(null,{status:302,headers:{Location:target.toString(),'Set-Cookie':setCookie(FLOW,state,600),'Cache-Control':'no-store'}});
 }
 if(url.pathname==='/api/auth/google/callback'&&request.method==='GET'){
  const state=url.searchParams.get('state')||'';if(!state||state!==cookie(request,FLOW))throw new ApiError(400,'Invalid sign-in state');
  const flow=await env.DB.prepare('DELETE FROM auth_flows WHERE state_hash=? AND expires_at>? RETURNING nonce,verifier,invitation_hash').bind(await hash(state),seconds()).first<{nonce:string;verifier:string;invitation_hash:string|null}>();
  if(!flow||!url.searchParams.get('code'))throw new ApiError(400,'Sign-in expired or cancelled');
  const reply=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:url.searchParams.get('code')!,client_id:env.GOOGLE_CLIENT_ID!,client_secret:env.GOOGLE_CLIENT_SECRET!,redirect_uri:`${env.APP_URL}/api/auth/google/callback`,grant_type:'authorization_code',code_verifier:flow.verifier}),signal:AbortSignal.timeout(15000)});
  const tokens=await reply.json() as {id_token?:string};if(!reply.ok||!tokens.id_token)throw new ApiError(401,'Google sign-in failed');
  const {payload}=await jwtVerify(tokens.id_token,keys,{issuer:['https://accounts.google.com','accounts.google.com'],audience:env.GOOGLE_CLIENT_ID,algorithms:['RS256'],requiredClaims:['sub','exp','iat','nonce','email']});
  if(payload.nonce!==flow.nonce||!payload.sub||payload.email_verified!==true||typeof payload.email!=='string')throw new ApiError(401,'Google identity could not be verified');
  const member=await bindGoogleAccount(env,{sub:payload.sub,email:payload.email,name:typeof payload.name==='string'?payload.name:payload.email},flow.invitation_hash);
  const token=randomToken();await env.DB.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await hash(token),member.id,seconds()+sessionAge).run();
  const headers=new Headers({Location:`${env.APP_URL}/`,'Cache-Control':'no-store'});headers.append('Set-Cookie',setCookie(SESSION,token,sessionAge));headers.append('Set-Cookie',setCookie(FLOW,'',0));return new Response(null,{status:302,headers});
 }
 if(url.pathname==='/api/auth/logout'&&request.method==='POST'){
  verifyOrigin(request,env);await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await hash(cookie(request,SESSION))).run();return json({ok:true},200,{'Set-Cookie':setCookie(SESSION,'',0)});
 }
 if(url.pathname==='/api/me'&&request.method==='GET'){const member=await authenticate(request,env);return json({user:member})}
 if(url.pathname==='/api/auth/logout-all'&&request.method==='POST'){verifyOrigin(request,env);const member=await authenticate(request,env);await body(request);await env.DB.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(member.id).run();return json({ok:true},200,{'Set-Cookie':setCookie(SESSION,'',0)})}
 if(url.pathname.startsWith('/api/auth/'))return json({error:'Unknown authentication endpoint'},404);
 return null;
}
