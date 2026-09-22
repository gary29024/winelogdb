export type Account={id:string;email:string;display_name:string;role:'owner'|'member';status:string};
let account:Account|null=null;
let generation=0;
// Browser-only in-flight JSON reads. No settled response survives navigation:
// permissions and remote edits are rechecked on every later request.
const pendingReads=new Map<string,Promise<Response>>();
const shareableRead=(path:string)=>path==='/api/journal'||path==='/api/producers'||/^\/api\/(?:producers|shared\/wines)\/[^/]+$/.test(path);
export const getAccount=()=>account;
/** An account/cache identity only; authentication credentials never enter JavaScript. */
export const getSession=()=>account?.id??null;
export const hasSession=()=>account!==null;
export const accountStorageKey=(key:string)=>`${key}:${getSession()??'signed-out'}`;
export const authHeaders=(json=false):Record<string,string>=>({...account?{'X-WineLog-Account':account.id}:{},...json?{'Content-Type':'application/json'}:{}});
export function clearSession(){account=null;generation++;pendingReads.clear();localStorage.removeItem('session');sessionStorage.removeItem('winelog-account')}
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
 // Read the method and headers off the inputs directly rather than by building a
 // Request. An abortable caller passes its page's AbortSignal, and the Request
 // constructor brand-checks it: under jsdom the signal comes from a different
 // realm than the fetch implementation, so constructing a Request from that init
 // throws "Expected signal to be an instance of AbortSignal" and every abortable
 // list read fails. The signal only ever needs to reach fetch, which accepts it.
 const method=(input instanceof Request?input.method:init?.method)??'GET';
 if(method!=='GET')pendingReads.clear();
 const headers=new Headers(input instanceof Request?input.headers:init?.headers);
 if(identity)headers.set('X-WineLog-Account',identity);
 headers.delete('Authorization');
 let response:Response;
 if(isAi(url.pathname,method)){
  const quoteUrl=new URL('/api/credits/quotes',url);quoteUrl.searchParams.set('path',url.pathname);
  // The quote and the run must send byte-identical bodies, and a FormData body
  // can only be read once, so it is serialized here - with the signal left out,
  // for the reason above - and the boundary header it generates is carried over.
  const bytes=await requestBytes(input,init,headers);
  const quoted=await fetch(quoteUrl.pathname+quoteUrl.search,{method,headers,body:bytes,credentials:'same-origin'});
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
  const execute=()=>fetch(url.pathname+url.search,{method,headers,body:bytes,credentials:'same-origin',signal:init?.signal});
  try{response=await execute()}catch(error){if(init?.signal?.aborted||atStart!==generation)throw error;response=await execute()}
 }else{
  // Abortable callers retain their independent cancellation semantics. Explicit
  // Request objects and non-JSON endpoints also keep their original fetch path.
  if(method==='GET'&&!(input instanceof Request)&&!init?.signal&&shareableRead(url.pathname)){
   const key=JSON.stringify([atStart,identity,url.href,{...init,headers:[...headers.entries()]}]);
   let pending=pendingReads.get(key);
   if(!pending){
    pending=fetch(input,{...init,headers,credentials:'same-origin'}).finally(()=>{if(pendingReads.get(key)===pending)pendingReads.delete(key)});
    pendingReads.set(key,pending);
   }
   response=(await pending).clone();
  }else response=await fetch(input,{...init,headers,credentials:'same-origin'});
 }
 if(atStart!==generation||identity!==getSession())throw new Error('Account changed; discard the previous response');
 if(response.status===401){clearSession();location.assign('/login')}
 return response;
}

/**
 * The request body as bytes, so the quote and the run send exactly the same one.
 *
 * A string body needs no serialization. Anything else - a FormData scan upload,
 * most of all - does, and only the Request constructor knows how to write the
 * multipart boundary, so its generated Content-Type is copied onto the headers
 * both calls will use. `signal` is stripped before constructing it: see apiFetch.
 */
async function requestBytes(input:RequestInfo|URL,init:RequestInit|undefined,headers:Headers){
 const body=input instanceof Request?undefined:init?.body;
 if(typeof body==='string')return body;
 if(body==null&&!(input instanceof Request))return undefined;
 const rest={...init};
 // The signal must not reach the Request constructor: it brand-checks it, and an
 // abortable caller's signal comes from a different realm under jsdom.
 delete rest.signal;
 const source=input instanceof Request?input.clone():new Request(location.origin,{...rest,method:'POST',body});
 const type=source.headers.get('Content-Type');
 if(type&&!headers.has('Content-Type'))headers.set('Content-Type',type);
 return source.arrayBuffer();
}

if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key==='winelog-account-event'||event.key==='winelog-account-id'&&(event.newValue||null)!==getSession()){clearSession();location.reload()}});
