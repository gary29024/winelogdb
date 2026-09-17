import { useEffect,useState } from 'react';
import { apiJson } from '../../lib/auth/api';
type Member={id:string;display_name:string;email:string;role:string;status:string;balance:number;reserved:number};
type MemberUsageKind={kind:string;requests:number;searchQueries:number;units:number;estimatedMarginalUsd:number};
type MemberUsage={userId:string;requests:number;searchQueries:number;promptTokens:number;outputTokens:number;smartSearchRequests:number;smartSearchUnits:number;estimatedMarginalUsd:number;kinds:MemberUsageKind[]};
type ActionPolicy={action:string;label:string;accessMode:'included'|'allowance';weeklyLimit:number};
type ActionAllowance={action:string;label:string;accessMode:'included'|'allowance';baseLimit:number;granted:number;limit:number;used:number;pending:number;remaining:number|null;weekStart:string;resetsAt:string};
type MemberActionAccess={userId:string;actions:ActionAllowance[]};
type Overview={members:Member[];actions:string[];settings:Record<string,unknown>|null;prices:Array<{id:string;action:string;credits:number}>;aiCost:{month:string;usd:number;searches:number};memberUsage:{month:string;items:MemberUsage[]};actionPolicies:ActionPolicy[];actionAccess:MemberActionAccess[];storage:Array<{owner_id:string;byte_size:number}>;reviewOperations:Array<{id:string;user_id:string;path:string}>};
type RolloutState='not_started'|'paused'|'running'|'complete';
type RolloutStatus={storage:{state:RolloutState;objects:number;error:string|null};research:{state:RolloutState;wines:{processed:number;total:number};producers:{processed:number;total:number};error:string|null}};
const defaults={memberLimit:25,memberStorageBytes:100*1024*1024,totalStorageBytes:8*1024*1024*1024,aiConcurrency:2,aiDailyOperations:100,aiDailyEmbeddingRequests:400,aiMonthlyBudgetUsd:0,aiUnitBudgetUsd:1,cloudflareWarningUsd:0,cloudflareStopUsd:0,cloudflareObservedUsd:0,cloudflareObservedMonth:new Date().toISOString().slice(0,7),allowOverages:true};
const budgetKeys=Object.keys(defaults);
const budgetLabels:Record<string,string>={memberLimit:'Member limit (owner excluded)',memberStorageBytes:'Storage per member (bytes)',totalStorageBytes:'Total storage (bytes)',aiConcurrency:'Simultaneous AI actions',aiDailyOperations:'Global AI units per day',aiDailyEmbeddingRequests:'Smart Search embeddings per account per day',aiMonthlyBudgetUsd:'Monthly AI budget (US$)',aiUnitBudgetUsd:'Estimated hold per unit, including retries (US$)',cloudflareWarningUsd:'Cloudflare warning amount (US$)',cloudflareStopUsd:'Cloudflare stop amount (US$)',cloudflareObservedUsd:'Measured Cloudflare cost this month (US$)',cloudflareObservedMonth:'Measurement month (YYYY-MM)',allowOverages:'Allow paid Cloudflare usage below the hard stop'};
const formatBytes=(bytes:number)=>{if(!Number.isFinite(bytes)||bytes<=0)return '0 B';const units=['B','KB','MB','GB','TB'];let value=bytes,index=0;while(value>=1024&&index<units.length-1){value/=1024;index++}return `${value<10&&index>0?value.toFixed(1):Math.round(value)} ${units[index]}`};
const labelKind=(kind:string)=>kind.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const stateLabel=(state:RolloutState)=>state==='not_started'?'Not started':state==='paused'?'Paused':state==='running'?'Running in background':'Complete';
const utcBudgetWindow=()=>{const now=new Date(),current=now.toISOString().slice(0,7),nextDate=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1)),days=Math.ceil((nextDate.getTime()-now.getTime())/86_400_000);return {current,next:nextDate.toISOString().slice(0,7),days}};
export function AdminPage(){
 const [data,setData]=useState<Overview|null>(null),[config,setConfig]=useState<Record<string,unknown>>(defaults),[policies,setPolicies]=useState<ActionPolicy[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[rolloutStatus,setRolloutStatus]=useState<RolloutStatus|null>(null);
 const [email,setEmail]=useState(''),[inviteUrl,setInviteUrl]=useState(''),[grantMemberId,setGrantMemberId]=useState(''),[grantAction,setGrantAction]=useState(''),[grantRuns,setGrantRuns]=useState(1),[grantReason,setGrantReason]=useState('');
 const rolloutRunning=rolloutStatus?.storage.state==='running'||rolloutStatus?.research.state==='running';
 async function load(){
  const [next,rollout]=await Promise.all([apiJson<Overview>('/api/admin/overview'),apiJson<RolloutStatus>('/api/admin/rollout/status')]);setData(next);setRolloutStatus(rollout);setPolicies(next.actionPolicies);
  if(next.settings){const clean:Record<string,unknown>={...defaults};for(const key of budgetKeys)if(next.settings[key]!==undefined)clean[key]=next.settings[key];setConfig(clean)}
 }
 useEffect(()=>{void load().catch(e=>setMessage(e.message))},[]);
 useEffect(()=>{if(!data||window.location.hash!=='#member-usage')return;const frame=window.requestAnimationFrame(()=>document.getElementById('member-usage')?.scrollIntoView({block:'start'}));return()=>window.cancelAnimationFrame(frame)},[data]);
 useEffect(()=>{if(!rolloutRunning)return;const timer=window.setInterval(()=>{void apiJson<RolloutStatus>('/api/admin/rollout/status').then(setRolloutStatus).catch(()=>undefined)},5000);return()=>window.clearInterval(timer)},[rolloutRunning]);
 useEffect(()=>{const members=data?.members.filter(item=>item.role==='member')??[];if(!grantMemberId&&members[0])setGrantMemberId(members[0].id);const allowed=policies.filter(item=>item.accessMode==='allowance');if(!allowed.some(item=>item.action===grantAction))setGrantAction(allowed[0]?.action??'')},[data,policies,grantMemberId,grantAction]);
 async function run(fn:()=>Promise<unknown>){setBusy(true);setMessage('');try{const result=await fn();setMessage(typeof result==='string'?result:'Saved');await load()}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}
 async function startRollout(kind:'storage'|'research',refresh=false){
  const result=await apiJson<{accepted:boolean;alreadyComplete?:boolean;alreadyRunning?:boolean;refreshing?:boolean;status:RolloutStatus}>(`/api/admin/rollout/${kind}`,'POST',kind==='research'?{refresh}:{});setRolloutStatus(result.status);
  if(result.alreadyRunning)return `${kind==='storage'?'R2 storage inventory':'Research indexing'} is already running.`;
  if(result.alreadyComplete)return `${kind==='storage'?'R2 storage inventory':'Research index'} is already complete.`;
  return `${refresh?'Research index refresh':kind==='storage'?'R2 storage inventory':'Research indexing'} is running in the background. You can leave this page.`;
 }
 const usageByUser=new Map(data?.memberUsage.items.map(item=>[item.userId,item])??[]),storageByUser=new Map(data?.storage.map(item=>[item.owner_id,Number(item.byte_size)||0])??[]),accessByUser=new Map(data?.actionAccess.map(item=>[item.userId,item.actions])??[]);
 const members=data?.members.filter(item=>item.role==='member')??[],allowancePolicies=policies.filter(item=>item.accessMode==='allowance');
 const budgetWindow=utcBudgetWindow(),observedMonth=String(config.cloudflareObservedMonth??'');
 const researchProcessed=(rolloutStatus?.research.wines.processed??0)+(rolloutStatus?.research.producers.processed??0),researchTotal=(rolloutStatus?.research.wines.total??0)+(rolloutStatus?.research.producers.total??0);
 function changePolicy(action:string,patch:Partial<ActionPolicy>){setPolicies(current=>current.map(item=>item.action===action?{...item,...patch}:item))}
 return <section className="account-page"><h1>Owner controls</h1>{message&&<p role="status">{message}</p>}{data&&<p>Estimated provider AI cost: US${data.aiCost.usd.toFixed(2)} · {data.aiCost.searches} searches. Estimates can lag provider billing.</p>}
 {observedMonth!==budgetWindow.current&&<p role="alert"><strong>AI is paused for the new month.</strong> In Pilot limits & budgets, set Measurement month to <strong>{budgetWindow.current}</strong>, enter this month’s measured Cloudflare cost (usually 0 at the start of a month), then press Save limits & budgets.</p>}
 {observedMonth===budgetWindow.current&&budgetWindow.days<=3&&<p role="status"><strong>Monthly AI budget check due soon.</strong> At 00:00 UTC on {budgetWindow.next}-01, WineLog will pause AI until Measurement month is changed to <strong>{budgetWindow.next}</strong> and the new month’s measured Cloudflare cost is saved.</p>}
 {Number(config.cloudflareObservedUsd)>=Number(config.cloudflareWarningUsd)&&Number(config.cloudflareWarningUsd)>0&&<p role='alert'>Cloudflare spending has reached your warning amount. Review current usage before more AI work.</p>}
 {data&&<section id="member-usage" className="member-usage" aria-labelledby="member-usage-title">
  <h2 id="member-usage-title">Member usage · {data.memberUsage.month}</h2>
  <p>Included actions are free to members within the deployment safeguards. Allowance actions count only successful user-facing runs; failed work releases the slot. Smart Search remains separately controlled by its per-account daily embedding limit.</p>
  <div className="member-usage-grid">{data.members.map(member=>{const usage=usageByUser.get(member.id),storage=storageByUser.get(member.id)??0,access=accessByUser.get(member.id);return <article className="member-usage-card" key={member.id}>
   <header><strong>{member.display_name}</strong><small>{member.email} · {member.role} · {member.status}</small></header>
   <dl><div><dt>AI requests</dt><dd>{usage?.requests??0}</dd></div><div><dt>Grounding searches</dt><dd>{usage?.searchQueries??0}</dd></div><div><dt>Smart Search</dt><dd>{usage?.smartSearchRequests??0} requests</dd></div><div><dt>Wines embedded</dt><dd>{usage?.smartSearchUnits??0}</dd></div><div><dt>Est. marginal AI</dt><dd>US${(usage?.estimatedMarginalUsd??0).toFixed(3)}</dd></div><div><dt>Storage</dt><dd>{formatBytes(storage)}</dd></div></dl>
   {access&&<details><summary>Pilot action access</summary><ul>{access.map(item=><li key={item.action}><span>{item.label}</span><span>{item.accessMode==='included'?'Included for all':`${item.used}/${item.limit} successful${item.granted?` · +${item.granted} extra`:''}${item.pending?` · ${item.pending} pending`:''} · ${item.remaining} available`}</span></li>)}</ul></details>}
   {!!usage?.kinds.length&&<details><summary>Feature breakdown</summary><ul>{usage.kinds.map(kind=><li key={kind.kind}><span>{labelKind(kind.kind)}</span><span>{kind.requests} req · {kind.searchQueries} searches · US${kind.estimatedMarginalUsd.toFixed(3)}</span></li>)}</ul></details>}
  </article>})}</div>
  <p className="usage-note">Cached or friend-reused results do not consume a run. Retries remain attached to the same operation. Allowance weeks reset Monday 00:00 UTC and do not roll over.</p>
 </section>}
 <fieldset disabled={busy}><legend>Pilot limits & budgets</legend><p>These are deployment-wide cost and capacity safeguards. Member entitlements are configured separately below.</p>{budgetKeys.map(key=>{const value=config[key];return <label key={key}>{budgetLabels[key]??key}{typeof value==='boolean'?<input type="checkbox" checked={value} onChange={e=>setConfig({...config,[key]:e.target.checked})}/>:<input type={typeof value==='number'?'number':'text'} value={String(value??'')} onChange={e=>setConfig({...config,[key]:typeof value==='number'?Number(e.target.value):e.target.value})}/>}</label>})}<button onClick={()=>void run(()=>apiJson('/api/admin/settings','PUT',config))}>Save limits & budgets</button></fieldset>
 <fieldset disabled={busy}><legend>Member AI access</legend>
  <p>Choose which user-facing AI actions are included for every member. For actions that would normally require credits, keep them on allowance mode during the pilot and set the free successful runs available to each account per week.</p>
  {policies.map(policy=><article key={policy.action} className="member-usage-card"><strong>{policy.label}</strong>
   <label><input type="checkbox" checked={policy.accessMode==='included'} onChange={e=>changePolicy(policy.action,{accessMode:e.target.checked?'included':'allowance'})}/> Included free for all members</label>
   <label>Free successful runs / member / week <input type="number" min="0" max="10000" step="1" disabled={policy.accessMode==='included'} value={policy.weeklyLimit} onChange={e=>changePolicy(policy.action,{weeklyLimit:Math.max(0,Math.floor(Number(e.target.value)||0))})}/></label>
   <small>{policy.accessMode==='included'?'No per-account run allowance is consumed; deployment limits still apply.':'Only successful new provider work consumes a run. Cached/reused results and failures do not.'}</small>
  </article>)}
  <button disabled={!policies.length} onClick={()=>void run(()=>apiJson('/api/admin/action-policies','PUT',{policies:policies.map(({action,accessMode,weeklyLimit})=>({action,accessMode,weeklyLimit}))}))}>Save member AI access</button>
  <p><small>Smart Search remains free to members and is governed by “Smart Search embeddings per account per day” above rather than this successful-run allowance.</small></p>
 </fieldset>
 <fieldset disabled={busy}><legend>Members</legend>
  <ul>{members.map(m=><li key={m.id}>{m.display_name} · {m.email} — {m.status} <button onClick={()=>void run(()=>apiJson(`/api/admin/members/${m.id}`,'PATCH',{status:m.status==='active'?'suspended':'active'}))}>{m.status==='active'?'Suspend':'Restore'}</button></li>)}</ul>{!members.length&&<p>No invited members yet.</p>}
  {!!members.length&&!!allowancePolicies.length&&<form onSubmit={e=>{e.preventDefault();void run(async()=>{await apiJson('/api/admin/action-grants','POST',{userId:grantMemberId,action:grantAction,runs:grantRuns,reason:grantReason,idempotencyKey:crypto.randomUUID()});setGrantRuns(1);setGrantReason('');return 'Additional free allocation granted for this week.'})}}>
   <fieldset><legend>Grant additional free allocation</legend>
    <label>Member<select value={grantMemberId} onChange={e=>setGrantMemberId(e.target.value)}>{members.map(item=><option key={item.id} value={item.id}>{item.display_name} · {item.email}</option>)}</select></label>
    <label>Action<select value={grantAction} onChange={e=>setGrantAction(e.target.value)}>{allowancePolicies.map(item=><option key={item.action} value={item.action}>{item.label}</option>)}</select></label>
    <label>Extra successful runs this week<input type="number" min="1" max="1000" step="1" value={grantRuns} onChange={e=>setGrantRuns(Math.max(1,Math.floor(Number(e.target.value)||1)))}/></label>
    <label>Reason (optional)<input value={grantReason} maxLength={300} onChange={e=>setGrantReason(e.target.value)}/></label>
    <button type="submit" disabled={!grantMemberId||!grantAction}>Grant extra runs</button>
   </fieldset>
  </form>}
 </fieldset>
 <fieldset disabled={busy}><legend>Launch preparation</legend>
  <p>R2 inventory and research indexing run in the background. It is safe to leave this page. Once the initial research index is complete, you can refresh it later to re-walk current wines and producers.</p>
  {rolloutStatus&&<div>
   <p><strong>R2 storage:</strong> {stateLabel(rolloutStatus.storage.state)} · {rolloutStatus.storage.objects} objects tracked.</p>
   {rolloutStatus.storage.error&&<p role="alert">Last storage inventory error: {rolloutStatus.storage.error}</p>}
   <button disabled={rolloutStatus.storage.state==='complete'||rolloutStatus.storage.state==='running'} onClick={()=>void run(()=>startRollout('storage'))}>{rolloutStatus.storage.state==='complete'?'R2 inventory complete':rolloutStatus.storage.state==='paused'?'Resume R2 inventory':'Inventory R2 storage'}</button>
   <p><strong>Existing research:</strong> {stateLabel(rolloutStatus.research.state)} · wines {rolloutStatus.research.wines.processed}/{rolloutStatus.research.wines.total} · producers {rolloutStatus.research.producers.processed}/{rolloutStatus.research.producers.total}.</p>
   {researchTotal>0&&<progress max={researchTotal} value={Math.min(researchProcessed,researchTotal)} aria-label="Research indexing progress"/>}
   {rolloutStatus.research.error&&<p role="alert">Last research indexing error: {rolloutStatus.research.error}</p>}
   <button disabled={rolloutStatus.research.state==='running'} onClick={()=>void run(()=>startRollout('research',rolloutStatus.research.state==='complete'))}>{rolloutStatus.research.state==='running'?'Research indexing…':rolloutStatus.research.state==='complete'?'Refresh research index':rolloutStatus.research.state==='paused'?'Resume research indexing':'Index existing research'}</button>
  </div>}
  <label>Invite email<input type="email" value={email} onChange={e=>{setEmail(e.target.value);setInviteUrl('')}}/></label><button onClick={()=>void run(async()=>{const result=await apiJson<{url:string}>('/api/admin/invitations','POST',{email});setInviteUrl(result.url);return 'Invitation created.'})}>Create member invitation</button>
  {inviteUrl&&<div className="invitation-result"><strong>Invitation link</strong><input aria-label="Invitation link" readOnly value={inviteUrl} onFocus={e=>e.currentTarget.select()}/><div className="friend-actions"><button type="button" onClick={()=>void navigator.clipboard.writeText(inviteUrl).then(()=>setMessage('Invitation link copied.')).catch(()=>setMessage('Could not copy automatically. Press and hold the link to copy it.'))}>Copy link</button><a className="button" href={inviteUrl} target="_blank" rel="noreferrer">Open link</a></div></div>}
 </fieldset>
 {!!data?.reviewOperations.length&&<><h2>Operations needing reconciliation</h2><p>These AI operations remain held because completion is uncertain. Reconcile provider status before allowing a duplicate run.</p><ul>{data.reviewOperations.map(op=><li key={op.id}>{op.id} — {op.path}</li>)}</ul></>}
 </section>;
}
