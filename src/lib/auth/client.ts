export type Account={id:string;email:string;display_name:string;role:'owner'|'member';status:string};
let account:Account|null=null;
let generation=0;
export const getAccount=()=>account;
/** An account/cache identity only; authentication credentials never enter JavaScript. */
export const getSession=()=>account?.id??null;
export const hasSession=()=>account!==null;
export const accountStorageKey=(key:string)=>`${key}:${getSession()??'signed-out'}`;
export const authHeaders=(json=false):Record<string,string>=>({...account?{'X-WineLog-Account':account.id}:{},...json?{'Content-Type':'application/json'}:{}});
export function clearSession(){account=null;generation++;localStorage.removeItem('session');sessionStorage.removeItem('winelog-account')}
export async function bootstrapAccount(){
 const response=await fetch('/api/me',{credentials:'same-origin',cache:'no-store'});
 const next=response.ok?(await response.json() as {user:Account}).user:null;
 const previous=sessionStorage.getItem('winelog-account');
 if(previous!==next?.id){generation++;for(const key of Object.keys(sessionStorage))if(key.startsWith('winelog'))sessionStorage.removeItem(key)}
 account=next;localStorage.removeItem('session');if(next)sessionStorage.setItem('winelog-account',next.id);localStorage.setItem('winelog-account-id',next?.id??'');return next;
}
export async function logout(){await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});clearSession();localStorage.setItem('winelog-account-event',crypto.randomUUID());location.assign('/login')}
export function login(){location.assign('/api/auth/google/start')}
type Quote={id:string;total:number;available:number;units:Array<{action:string;credits:number}>};
export type QuotePrompt={quote:Quote;resolve:(confirmed:boolean)=>void};
let askQuote:((prompt:QuotePrompt)=>void)|null=null;
export function registerQuotePrompt(prompt:((prompt:QuotePrompt)=>void)|null){askQuote=prompt}
const isAi=(path:string,method:string)=>method==='POST'&&(path==='/api/recognition'||/^\/api\/tastings\/[^/]+\/sheet\/parse$/.test(path)||/^\/api\/wines\/[^/]+\/deep-search$/.test(path)||/^\/api\/producers\/[^/]+\/research$/.test(path)||path==='/api/producers/research-batch'||/^\/api\/batch-recognition\/sessions\/[^/]+\/submit$/.test(path)||path==='/api/maturity/vintage');
export async function apiFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{
 const atStart=generation,identity=getSession();
 const url=typeof input==='string'?new URL(input,location.origin):input instanceof URL?input:new URL(input.url);
 const original=new Request(url,input instanceof Request?input:init);
 const headers=new Headers(original.headers);if(identity)headers.set('X-WineLog-Account',identity);headers.delete('Authorization');
 const request=new Request(original,{headers,credentials:'same-origin'});
 let response:Response;
 if(isAi(url.pathname,request.method)){
  const quoteUrl=new URL('/api/credits/quotes',url);quoteUrl.searchParams.set('path',url.pathname);
  const bytes=await request.clone().arrayBuffer();
  const quoted=await fetch(quoteUrl.pathname+quoteUrl.search,{method:request.method,headers:request.headers,body:bytes,credentials:'same-origin'});
  if(atStart!==generation||identity!==getSession())throw new Error('Account changed; discard the previous quote');
  if(!quoted.ok){if(quoted.status===401){clearSession();location.assign('/login')}return quoted}
  const quote=await quoted.json() as Quote;
  if(quote.total>quote.available)return Response.json({error:`This needs ${quote.total} credits; ${quote.available} are available.`},{status:402});
  if(quote.total>0){
   if(!askQuote)throw new Error('Credit confirmation is not available');
   const confirmed=await new Promise<boolean>(resolve=>askQuote!({quote,resolve}));if(!confirmed)return Response.json({error:'AI action cancelled; no credits used.'},{status:409});
  }
  if(atStart!==generation||identity!==getSession())throw new Error('Account changed');
  headers.set('X-WineLog-Quote',quote.id);headers.set('Idempotency-Key',crypto.randomUUID());
  const execute=()=>fetch(url.pathname+url.search,{method:request.method,headers,body:typeof init?.body==='string'?init.body:bytes,credentials:'same-origin',signal:init?.signal});
  try{response=await execute()}catch(error){if(init?.signal?.aborted||atStart!==generation)throw error;response=await execute()}
 }else{
  response=await fetch(input,{...init,headers,credentials:'same-origin'});
 }
 if(atStart!==generation||identity!==getSession())throw new Error('Account changed; discard the previous response');
 if(response.status===401){clearSession();location.assign('/login')}
 return response;
}
if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key==='winelog-account-event'||event.key==='winelog-account-id'&&(event.newValue||null)!==getSession()){clearSession();location.reload()}});
