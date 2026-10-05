import { SectionNavigation } from '../../components/SectionNavigation';
import { AiSpendCard } from '../journey/AiSpendCard';
import { usePageSection } from '../../components/usePageSection';
import { PageHeader } from '../../components/PageHeader';
import '../../settingsLayout.css';
import '../../settingsCards.css';
import { Link } from 'react-router-dom';
import { useEffect,useState,type ReactNode } from 'react';
import { apiJson } from '../../lib/auth/api';
type Member={id:string;display_name:string;handle?:string|null;email:string;role:string;status:string;balance:number;reserved:number};
type MemberUsageKind={kind:string;requests:number;searchQueries:number;units:number;estimatedMarginalUsd:number};
type MemberUsage={userId:string;requests:number;searchQueries:number;promptTokens:number;outputTokens:number;smartSearchRequests:number;smartSearchUnits:number;estimatedMarginalUsd:number;kinds:MemberUsageKind[]};
type ActionPolicy={action:string;label:string;accessMode:'included'|'allowance';weeklyLimit:number};
type ActionAllowance={action:string;label:string;accessMode:'included'|'allowance';baseLimit:number;granted:number;limit:number;used:number;pending:number;remaining:number|null;weekStart:string;resetsAt:string};
type MemberActionAccess={userId:string;actions:ActionAllowance[]};
type Overview={members:Member[];actions:string[];settings:Record<string,unknown>|null;prices:Array<{id:string;action:string;credits:number}>;aiCost:{month:string;usd:number;searches:number;freeRemaining?:number};memberUsage:{month:string;items:MemberUsage[]};actionPolicies:ActionPolicy[];actionAccess:MemberActionAccess[];storage:Array<{owner_id:string;byte_size:number;metered_byte_size:number}>;reviewOperations:Array<{id:string;user_id:string;path:string;created_at:string}>};
type RolloutState='not_started'|'paused'|'running'|'complete';
type RolloutStatus={lwinCurrent?:{total:number;automatic:number;manual:number;identityConflicts:number;fieldUpdates:number;needsReview:number;withoutLwin:number;optedOut:number};storage:{state:RolloutState;objects:number;error:string|null};research:{state:RolloutState;wines:{processed:number;total:number};producers:{processed:number;total:number};error:string|null};lwin:{state:RolloutState;processed:number;total:number;matched:number;ambiguous:number;unmatched:number;conflict:number;error:string|null};lwinValidation:{state:RolloutState;processed:number;total:number;verified:number;review:number;error:string|null;reviewListUnavailable?:boolean;reviewItems:Array<{id:string;producer:string;wineName:string;lwin7:string;candidates:string[]}>};lwinAi:{state:RolloutState;processed:number;total:number;matched:number;deterministic:number;ai:number;review:number;error:string|null}};
type RolloutAction='storage'|'research'|'lwin'|'lwin-validate'|'lwin-ai';
const defaults={memberLimit:25,memberStorageBytes:100*1024*1024,totalStorageBytes:8*1024*1024*1024,aiConcurrency:2,aiDailyOperations:100,aiDailyEmbeddingRequests:400,aiMonthlyBudgetUsd:0,aiUnitBudgetUsd:1,cloudflareWarningUsd:0,cloudflareStopUsd:0,cloudflareObservedUsd:0,cloudflareObservedMonth:new Date().toISOString().slice(0,7),allowOverages:true};
const budgetKeys=Object.keys(defaults);
const budgetLabels:Record<string,string>={memberLimit:'Member limit (owner excluded)',memberStorageBytes:'Storage per member (bytes; 0 = unlimited)',totalStorageBytes:'Total storage (bytes; 0 = unlimited)',aiConcurrency:'Simultaneous AI actions',aiDailyOperations:'Global AI units per day',aiDailyEmbeddingRequests:'Smart Search embeddings per account per day',aiMonthlyBudgetUsd:'Monthly AI budget (US$)',aiUnitBudgetUsd:'Estimated hold per unit, including retries (US$)',cloudflareWarningUsd:'Cloudflare warning amount (US$)',cloudflareStopUsd:'Cloudflare stop amount (US$)',cloudflareObservedUsd:'Measured Cloudflare cost this month (US$)',cloudflareObservedMonth:'Measurement month (YYYY-MM)',allowOverages:'Allow paid Cloudflare usage below the hard stop'};
const formatBytes=(bytes:number)=>{if(!Number.isFinite(bytes)||bytes<=0)return '0 B';const units=['B','KB','MB','GB','TB'];let value=bytes,index=0;while(value>=1024&&index<units.length-1){value/=1024;index++}return `${value<10&&index>0?value.toFixed(1):Math.round(value)} ${units[index]}`};
const labelKind=(kind:string)=>kind.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const stateLabel=(state:RolloutState)=>state==='not_started'?'Not started':state==='paused'?'Paused':state==='running'?'Running':'Complete';
const stateTone=(state:RolloutState)=>state==='complete'?' is-good':state==='running'?' is-accent':state==='paused'?' is-warn':'';
const utcBudgetWindow=()=>{const now=new Date(),current=now.toISOString().slice(0,7),nextDate=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1)),days=Math.ceil((nextDate.getTime()-now.getTime())/86_400_000);return {current,next:nextDate.toISOString().slice(0,7),days}};
const sections=[{id:'members',label:'Members & usage'},{id:'spend',label:'AI spend'},{id:'access',label:'Access & budgets'},{id:'maintenance',label:'Maintenance'}];
const MB=1024*1024,GB=1024*MB;
// Settings grouped as the owner thinks about them. Storage is entered in MB or
// GB and saved in bytes; the long original wording stays as each field's tooltip.
type BudgetField={key:string;label:string;scale?:number};
const budgetGroups:Array<{title:string;fields:BudgetField[]}>=[
 {title:'Members & storage',fields:[{key:'memberLimit',label:'Member limit'},{key:'memberStorageBytes',label:'Storage per member (MB)',scale:MB},{key:'totalStorageBytes',label:'Total storage (GB)',scale:GB}]},
 {title:'AI capacity',fields:[{key:'aiConcurrency',label:'AI actions at once'},{key:'aiDailyOperations',label:'AI units per day'},{key:'aiDailyEmbeddingRequests',label:'Smart Search per person per day'}]},
 {title:'Money',fields:[{key:'aiMonthlyBudgetUsd',label:'Monthly AI budget (US$)'},{key:'aiUnitBudgetUsd',label:'Hold per AI unit (US$)'},{key:'cloudflareWarningUsd',label:'Cloudflare warn at (US$)'},{key:'cloudflareStopUsd',label:'Cloudflare stop at (US$)'},{key:'cloudflareObservedUsd',label:'Cloudflare cost so far (US$)'},{key:'cloudflareObservedMonth',label:'Measured month'},{key:'allowOverages',label:'Allow paid usage below the stop'}]}
];
const initial=(name:string)=>name.trim().charAt(0)||'?';
function heldOperationLabel(path:string){
 if(path.endsWith('/deep-search'))return 'Wine Deep Search';
 if(path==='/api/producers/research-batch')return 'Producer batch';
 if(/^\/api\/producers\/[^/]+\/research$/.test(path))return 'Producer research';
 if(path==='/api/recognition')return 'Photo recognition';
 return path;
}
export function AdminPage(){
 const [section,selectSection]=usePageSection(sections,'members',{hash:'#member-usage',section:'members'});
 const [data,setData]=useState<Overview|null>(null),[config,setConfig]=useState<Record<string,unknown>>(defaults),[savedConfig,setSavedConfig]=useState<Record<string,unknown>>(defaults),[policies,setPolicies]=useState<ActionPolicy[]>([]),[savedPolicies,setSavedPolicies]=useState<ActionPolicy[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[rolloutStatus,setRolloutStatus]=useState<RolloutStatus|null>(null);
 const [loadError,setLoadError]=useState('');
 const [email,setEmail]=useState(''),[inviteUrl,setInviteUrl]=useState(''),[grantMemberId,setGrantMemberId]=useState(''),[grantAction,setGrantAction]=useState(''),[grantRuns,setGrantRuns]=useState(1),[grantReason,setGrantReason]=useState(''),[expanded,setExpanded]=useState('');
 const rolloutRunning=rolloutStatus?.storage.state==='running'||rolloutStatus?.research.state==='running'||rolloutStatus?.lwin.state==='running'||rolloutStatus?.lwinValidation.state==='running'||rolloutStatus?.lwinAi.state==='running';
 async function load(initial=false){
  setLoadError('');
  const [next,rollout]=await Promise.all([apiJson<Overview>('/api/admin/overview'),apiJson<RolloutStatus>('/api/admin/rollout/status').catch(()=>null)]);setData(next);setRolloutStatus(rollout);if(initial){setPolicies(next.actionPolicies);setSavedPolicies(next.actionPolicies)}
  if(initial&&next.settings){const clean:Record<string,unknown>={...defaults};for(const key of budgetKeys)if(next.settings[key]!==undefined)clean[key]=next.settings[key];setConfig(clean);setSavedConfig(clean)}
 }
 useEffect(()=>{void load(true).catch(e=>setLoadError(e.message))},[]);
 useEffect(()=>{if(!data||section!=='members'||window.location.hash!=='#member-usage')return;const frame=window.requestAnimationFrame(()=>document.getElementById('member-usage')?.scrollIntoView({block:'start'}));return()=>window.cancelAnimationFrame(frame)},[data,section]);
 useEffect(()=>{const refresh=()=>{void apiJson<RolloutStatus>('/api/admin/rollout/status').then(setRolloutStatus).catch(()=>undefined)};window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh)},[]);

 useEffect(()=>{if(!rolloutRunning)return;const timer=window.setInterval(()=>{void apiJson<RolloutStatus>('/api/admin/rollout/status').then(setRolloutStatus).catch(()=>undefined)},5000);return()=>window.clearInterval(timer)},[rolloutRunning]);
 useEffect(()=>{const members=data?.members.filter(item=>item.role==='member')??[];if(!grantMemberId&&members[0])setGrantMemberId(members[0].id);const allowed=policies.filter(item=>item.accessMode==='allowance');if(!allowed.some(item=>item.action===grantAction))setGrantAction(allowed[0]?.action??'')},[data,policies,grantMemberId,grantAction]);
 async function run(fn:()=>Promise<unknown>){setBusy(true);setMessage('');try{const result=await fn();setMessage(typeof result==='string'?result:'Saved');await load()}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}
 async function startRollout(kind:RolloutAction,refresh=false){
  const result=await apiJson<{accepted:boolean;alreadyComplete?:boolean;alreadyRunning?:boolean;refreshing?:boolean;status:RolloutStatus}>(`/api/admin/rollout/${kind}`,'POST',kind==='storage'?{}:{refresh});setRolloutStatus(result.status);
  const label=kind==='storage'?'R2 storage inventory':kind==='research'?'Research indexing':kind==='lwin'?'LWIN backfill':kind==='lwin-validate'?'Stored LWIN validation':'AI-assisted LWIN resolution';
  if(result.alreadyRunning)return `${label} is already running.`;
  if(result.alreadyComplete)return `${label} is already complete.`;
  return `${refresh?`${label} refresh`:label} is running in the background. You can leave this page.`;
 }
 async function pauseRollout(kind:RolloutAction){
  const result=await apiJson<{accepted:boolean;alreadyPaused?:boolean;status:RolloutStatus}>(`/api/admin/rollout/${kind}/pause`,'POST',{});setRolloutStatus(result.status);
  return result.accepted?'Background task paused. The current small batch may finish, but no further batch will be chained.':result.alreadyPaused?'Background task is already paused.':'That background task is not running.';
 }
 const usageByUser=new Map(data?.memberUsage.items.map(item=>[item.userId,item])??[]),storageByUser=new Map(data?.storage.map(item=>[item.owner_id,Number(item.metered_byte_size)||0])??[]),accessByUser=new Map(data?.actionAccess.map(item=>[item.userId,item.actions])??[]);
 const members=data?.members.filter(item=>item.role==='member')??[],allowancePolicies=policies.filter(item=>item.accessMode==='allowance');
 const budgetWindow=utcBudgetWindow(),observedMonth=String(config.cloudflareObservedMonth??'');
 const researchProcessed=(rolloutStatus?.research.wines.processed??0)+(rolloutStatus?.research.producers.processed??0),researchTotal=(rolloutStatus?.research.wines.total??0)+(rolloutStatus?.research.producers.total??0);
 // storage_totals keeps a '*' row with the deployment total beside each owner's row; summing every row counted it twice.
 const storageUsed=storageByUser.get('*')??[...storageByUser].filter(([owner])=>owner!=='*').reduce((sum,[,value])=>sum+value,0),totalStorage=Number(savedConfig.totalStorageBytes)||0,memberLimit=Number(savedConfig.memberLimit)||0,needsReview=rolloutStatus?.lwinCurrent?.needsReview??0;
 const configDirty=JSON.stringify(config)!==JSON.stringify(savedConfig),policiesDirty=JSON.stringify(policies)!==JSON.stringify(savedPolicies);
 function changePolicy(action:string,patch:Partial<ActionPolicy>){setPolicies(current=>current.map(item=>item.action===action?{...item,...patch}:item))}
 function goToField(target:string,field:string){selectSection(target);window.setTimeout(()=>document.getElementById(field)?.focus(),60)}
 function saveAccess(){void run(async()=>{
  if(configDirty){await apiJson('/api/admin/settings','PUT',config);setSavedConfig(config)}
  if(policiesDirty){await apiJson('/api/admin/action-policies','PUT',{policies:policies.map(({action,accessMode,weeklyLimit})=>({action,accessMode,weeklyLimit}))});setSavedPolicies(policies)}
  return 'Access & budgets saved.';
 })}
 // One background job: name and state, a line of figures, a bar while it has a total, its last error, and one action.
 const [aboutOpen,setAboutOpen]=useState('');
 function job({name,state,meta,processed,total,error,action,actionLabel,disabled,kind,about}:{name:string;state:RolloutState;meta:ReactNode;processed?:number;total?:number;error:string|null|undefined;action:()=>Promise<string>;actionLabel:string;disabled?:boolean;kind:RolloutAction;about:string}){
  const visible=state==='paused'?'Resume':state==='complete'?(kind==='storage'?'Done':'Refresh'):'Start';
  return <div className="settings-job" key={kind}>
   <div className="settings-job-name"><strong>{name}</strong><span className={`settings-chip${stateTone(state)}`}>{stateLabel(state)}</span><button type="button" className="settings-job-about" aria-expanded={aboutOpen===kind} aria-controls={`about-${kind}`} aria-label={`About ${name.toLowerCase()}`} title="About this job" onClick={()=>setAboutOpen(aboutOpen===kind?'':kind)}>ⓘ</button></div>
   <span className="settings-job-meta">{meta}</span>
   {aboutOpen===kind&&<p className="settings-hint settings-job-explain" id={`about-${kind}`}>{about}</p>}
   <div className="settings-job-actions">{state==='running'?<button type="button" disabled={busy} onClick={()=>void run(()=>pauseRollout(kind))} aria-label={`Pause ${name.toLowerCase()}`}>Pause</button>:<button type="button" disabled={busy||disabled} aria-label={actionLabel} onClick={()=>void run(action)}>{visible}</button>}</div>
   {!!total&&(state==='running'||state==='paused')&&<progress max={total} value={Math.min(processed??0,total)} aria-label={`${name} progress`}/>}
   {error&&<p role="alert" className="settings-job-error">Last error: {error}</p>}
  </div>;
 }
 return <section className="account-page settings-page">
 <PageHeader title="Owner controls" subtitle="Members, AI access and operations."/>
 <div className="settings-layout">
  <aside><SectionNavigation label="Owner sections" items={sections.map(item=>({...item,count:item.id==='maintenance'?rolloutStatus?.lwinCurrent?.needsReview:undefined}))} selected={section} onSelect={selectSection}/><Link className="settings-owner-link" to="/account">← Account & friends</Link></aside>
  <div className="settings-content settings-cards is-wide">
 {message&&<p role="status">{message}</p>}
 {loadError&&<p role="alert">{loadError} <button type="button" onClick={()=>void load(true).catch(e=>setLoadError(e.message))}>Retry owner controls</button></p>}
 {!data&&!loadError&&<p role="status">Loading owner controls…</p>}
 {!!data?.reviewOperations.length&&<div className="settings-banner" role="alert"><p><strong>{data.reviewOperations.length} {data.reviewOperations.length===1?'operation needs':'operations need'} reconciliation.</strong></p><button type="button" onClick={()=>selectSection('maintenance')}>Review operations</button></div>}
 {data&&observedMonth!==budgetWindow.current&&<div className="settings-banner" role="alert"><p><strong>Member AI is paused for {budgetWindow.current}.</strong> Set the measured month to {budgetWindow.current} and enter this month’s Cloudflare cost (usually 0 at the start of a month). Your own AI still works.</p><button type="button" onClick={()=>goToField('access','budget-cloudflareObservedMonth')}>Go to budgets</button></div>}
 {data&&observedMonth===budgetWindow.current&&budgetWindow.days<=3&&<div className="settings-banner is-quiet" role="status"><p><strong>Monthly budget check on {budgetWindow.next}-01.</strong> Member AI pauses then until you set the measured month to {budgetWindow.next} and save that month’s Cloudflare cost.</p></div>}
 {Number(config.cloudflareObservedUsd)>=Number(config.cloudflareWarningUsd)&&Number(config.cloudflareWarningUsd)>0&&<div className="settings-banner" role="alert"><p><strong>Cloudflare spending has reached your warning amount.</strong> Review current usage before more AI work.</p></div>}
 {data&&<dl className="settings-kpis">
  <div><dt>Members</dt><dd>{members.length}{memberLimit>0&&<small> of {memberLimit}</small>}</dd></div>
  <div title="What the provider bill comes to this month. Searches inside Google's monthly free allowance cost nothing here."><dt>AI bill · {data.aiCost.month??data.memberUsage.month}</dt><dd>US${data.aiCost.usd.toFixed(2)} <small>{data.aiCost.freeRemaining?`${data.aiCost.searches} searches, all free`:`${data.aiCost.searches} searches`}</small></dd></div>
  <div className={totalStorage>0&&storageUsed>totalStorage?'is-attention':''}><dt>Storage{totalStorage>0&&storageUsed>totalStorage?' · over limit':''}</dt><dd>{formatBytes(storageUsed)}{totalStorage>0&&<small> of {formatBytes(totalStorage)}</small>}</dd></div>
  <div className={needsReview?'is-attention':''}><dt>Needs review</dt><dd>{needsReview} <small>LWIN</small></dd></div>
 </dl>}
 <div hidden={!data} className="settings-sections">
 <section hidden={section!=='members'} aria-label="Members and usage">
 {data&&<section id="member-usage" className="settings-card" aria-labelledby="member-usage-title">
  <div className="settings-card-head"><h2 id="member-usage-title">Members · {data.memberUsage.month}</h2><small>Cost prices every search at list price</small></div>
  <div className="settings-table-scroll"><table className="settings-table is-members">
   <thead><tr><th scope="col">Member</th><th scope="col">Status</th><th scope="col" className="is-number">AI requests</th><th scope="col" className="is-number" title="Every search priced at list price, ignoring the monthly free allowance, so members compare fairly. It can be higher than the AI bill above.">List-price cost</th><th scope="col" className="is-number">Storage</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
   <tbody>{data.members.map(member=>{const usage=usageByUser.get(member.id),storage=storageByUser.get(member.id)??0,access=accessByUser.get(member.id),isMember=member.role==='member',open=expanded===member.id;return [
    <tr key={member.id}>
     <td><div className="settings-table-person"><span className="settings-avatar" aria-hidden="true">{initial(member.display_name)}</span><div><strong>{member.display_name}</strong><span>{[member.handle?`@${member.handle}`:'',member.email].filter(Boolean).join(' · ')}</span></div></div></td>
     <td><span className={`settings-chip${member.role==='owner'?' is-accent':member.status==='active'?' is-good':' is-warn'}`}>{member.role==='owner'?'Owner':member.status==='active'?'Active':'Suspended'}</span></td>
     <td className="is-number" data-label="AI requests">{usage?.requests??0}</td>
     <td className="is-number" data-label="List-price cost">US${(usage?.estimatedMarginalUsd??0).toFixed(3)}</td>
     <td className="is-number" data-label="Storage">{formatBytes(storage)}</td>
     <td><details className="settings-menu"><summary aria-label={`More options for ${member.display_name}`}>⋯</summary><div>
      <button type="button" onClick={e=>{setExpanded(open?'':member.id);e.currentTarget.closest('details')?.removeAttribute('open')}}>{open?'Hide details':'Show details'}</button>
      {isMember&&!!allowancePolicies.length&&<button type="button" onClick={e=>{setGrantMemberId(member.id);e.currentTarget.closest('details')?.removeAttribute('open');window.setTimeout(()=>document.getElementById('grant-runs')?.focus(),30)}}>Grant extra runs…</button>}
      {isMember&&<button type="button" className={member.status==='active'?'settings-danger':''} disabled={busy} onClick={()=>void run(()=>apiJson(`/api/admin/members/${member.id}`,'PATCH',{status:member.status==='active'?'suspended':'active'}))}>{member.status==='active'?'Suspend':'Restore'}</button>}
     </div></details></td>
    </tr>,
    open&&<tr key={`${member.id}-details`} className="settings-table-details"><td colSpan={6}>
     <dl className="settings-stats"><div><dt>Grounding searches</dt><dd>{usage?.searchQueries??0}</dd></div><div><dt>Smart Search</dt><dd>{usage?.smartSearchRequests??0}</dd></div><div><dt>Wines embedded</dt><dd>{usage?.smartSearchUnits??0}</dd></div></dl>
     {access&&<><span className="settings-label">This week’s allowance</span><ul className="settings-breakdown" aria-label={`AI access for ${member.display_name}`}>{access.map(item=><li key={item.action}><span>{item.label}</span><span>{item.accessMode==='included'?'Included for all':`${item.used}/${item.limit} used${item.granted?` · +${item.granted} extra`:''}${item.pending?` · ${item.pending} pending`:''} · ${item.remaining} left`}</span></li>)}</ul></>}
     {!!usage?.kinds.length&&<><span className="settings-label">This month by feature</span><ul className="settings-breakdown" aria-label={`Feature breakdown for ${member.display_name}`}>{usage.kinds.map(kind=><li key={kind.kind}><span>{labelKind(kind.kind)}</span><span>{kind.requests} req · {kind.searchQueries} searches · US${kind.estimatedMarginalUsd.toFixed(3)}</span></li>)}</ul></>}
    </td></tr>
   ]})}</tbody>
  </table></div>
  {!members.length&&<p className="settings-hint">No invited members yet.</p>}
  <form className="settings-row settings-card-foot" onSubmit={e=>{e.preventDefault();void run(async()=>{const result=await apiJson<{url:string}>('/api/admin/invitations','POST',{email});setInviteUrl(result.url);return 'Invitation created.'})}}>
   <label htmlFor="invite-email" className="visually-hidden">Invite email</label>
   <input id="invite-email" className="settings-grow" type="email" placeholder="name@example.com" value={email} required onChange={e=>{setEmail(e.target.value);setInviteUrl('')}}/>
   <button type="submit" className="settings-primary" disabled={busy||!email.trim()}>Create member invitation</button>
  </form>
  {inviteUrl&&<div className="settings-invite"><span className="settings-label">Invitation link</span><input aria-label="Invitation link" readOnly value={inviteUrl} onFocus={e=>e.currentTarget.select()}/><div className="settings-row"><button type="button" onClick={()=>void navigator.clipboard.writeText(inviteUrl).then(()=>setMessage('Invitation link copied.')).catch(()=>setMessage('Could not copy automatically. Press and hold the link to copy it.'))}>Copy link</button><a className="button" href={inviteUrl} target="_blank" rel="noreferrer">Open link</a></div></div>}
  <p className="settings-hint">Cached or friend-reused results do not use a run, and failed work gives the run back. Allowance weeks reset Monday 00:00 UTC and do not roll over.</p>
 </section>}
 {!!members.length&&!!allowancePolicies.length&&<form className="settings-card" onSubmit={e=>{e.preventDefault();void run(async()=>{await apiJson('/api/admin/action-grants','POST',{userId:grantMemberId,action:grantAction,runs:grantRuns,reason:grantReason,idempotencyKey:crypto.randomUUID()});setGrantRuns(1);setGrantReason('');return 'Additional free allocation granted for this week.'})}}>
  <div className="settings-card-head"><h2>Grant extra runs</h2><small>This week only</small></div>
  <fieldset className="settings-grant" disabled={busy}><legend className="visually-hidden">Grant additional free allocation</legend>
   <label>Member<select value={grantMemberId} onChange={e=>setGrantMemberId(e.target.value)}>{members.map(item=><option key={item.id} value={item.id}>{item.display_name}{item.handle?` (@${item.handle})`:` · ${item.email}`}</option>)}</select></label>
   <label>Feature<select value={grantAction} onChange={e=>setGrantAction(e.target.value)}>{allowancePolicies.map(item=><option key={item.action} value={item.action}>{item.label}</option>)}</select></label>
   <label>Extra successful runs this week<input id="grant-runs" className="settings-grant-runs" type="number" min="1" max="1000" step="1" value={grantRuns} onChange={e=>setGrantRuns(Math.max(1,Math.floor(Number(e.target.value)||1)))}/></label>
   <label>Reason (optional)<input value={grantReason} maxLength={300} onChange={e=>setGrantReason(e.target.value)}/></label>
  </fieldset>
  <div><button type="submit" className="settings-primary" disabled={busy||!grantMemberId||!grantAction}>Grant extra runs</button></div>
 </form>}
 </section><section hidden={section!=='spend'} aria-label="AI spend">
  {/* Mounted only when opened: the card reads the spend ledger, which no other section needs. */}
  {section==='spend'&&<AiSpendCard/>}
 </section><section hidden={section!=='access'} aria-label="Access and budgets">
 <div className="settings-card">
  <div className="settings-card-head"><h2>Limits & budgets</h2><small>Members only. Your own AI is never limited; its usage is still recorded.</small></div>
  <div className="settings-groups">{budgetGroups.map(group=><fieldset key={group.title} disabled={busy} className={group.fields.length>4?'is-wide':undefined}><legend>{group.title}</legend>{group.fields.map(({key,label,scale})=>{const value=config[key],id=`budget-${key}`;
   if(typeof value==='boolean')return <label key={key} className="settings-switch settings-group-switch" title={budgetLabels[key]}><input id={id} type="checkbox" role="switch" checked={value} onChange={e=>setConfig({...config,[key]:e.target.checked})}/>{label}</label>;
   if(typeof value==='number')return <label key={key} className="settings-num" title={budgetLabels[key]}>{label}<input id={id} type="number" min="0" step="any" value={scale?Number((value/scale).toFixed(scale===GB?2:1)):value} onChange={e=>setConfig({...config,[key]:scale?Math.round(Number(e.target.value)*scale):Number(e.target.value)})}/></label>;
   return <label key={key} className="settings-num" title={budgetLabels[key]}>{label}<input id={id} value={String(value??'')} placeholder="YYYY-MM" onChange={e=>setConfig({...config,[key]:e.target.value})}/></label>;
  })}</fieldset>)}</div>
  <p className="settings-hint">0 means unlimited for storage. Hover a field for its full description.</p>
 </div>
 <div className="settings-card">
  <div className="settings-card-head"><h2>Member AI access</h2><small>Free successful runs per member per week</small></div>
  {policies.length?<div className="settings-table-scroll"><table className="settings-table">
   <thead><tr><th scope="col">Feature</th><th scope="col">Free for all</th><th scope="col" className="is-number">Runs per week</th></tr></thead>
   <tbody>{policies.map(policy=><tr key={policy.action}>
    <td><strong>{policy.label}</strong></td>
    <td><label className="settings-switch"><input type="checkbox" role="switch" aria-label={`${policy.label} included free for all members`} disabled={busy} checked={policy.accessMode==='included'} onChange={e=>changePolicy(policy.action,{accessMode:e.target.checked?'included':'allowance'})}/></label></td>
    <td className="is-number">{policy.accessMode==='included'?<span className="settings-hint">No limit</span>:<label className="settings-num is-compact"><span className="visually-hidden">{policy.label} free successful runs per member per week</span><input type="number" min="0" max="10000" step="1" disabled={busy} value={policy.weeklyLimit} onChange={e=>changePolicy(policy.action,{weeklyLimit:Math.max(0,Math.floor(Number(e.target.value)||0))})}/></label>}</td>
   </tr>)}</tbody>
  </table></div>:<p className="settings-hint">No member AI features are configured.</p>}
  <p className="settings-hint">Only successful new provider work uses a run. Smart Search stays free and is limited by “Smart Search per person per day” above.</p>
 </div>
 <div className={`settings-savebar${configDirty||policiesDirty?' is-dirty':''}`} role="group" aria-label="Save access and budgets">
  <span>{configDirty||policiesDirty?'You have unsaved changes':'All changes saved'}</span>
  <div className="settings-row"><button type="button" className="settings-quiet" disabled={busy||!(configDirty||policiesDirty)} onClick={()=>{setConfig(savedConfig);setPolicies(savedPolicies)}}>Discard</button><button type="button" className="settings-primary" disabled={busy||!(configDirty||policiesDirty)} onClick={saveAccess}>Save changes</button></div>
 </div>
 </section><section hidden={section!=='maintenance'} aria-label="Maintenance">
 {!!data?.reviewOperations.length&&<div className="settings-card"><div className="settings-card-head"><h2>Operations needing reconciliation</h2></div><p className="settings-hint">These AI operations remain held because completion is uncertain. Releasing one keeps any saved research, charges only for that, and lets the work run again.</p><ul className="admin-held-operations">{data.reviewOperations.map(op=><li key={op.id}><div><strong>{heldOperationLabel(op.path)}</strong><small>Started {new Date(op.created_at).toLocaleString()} · {op.id}</small></div><button type="button" disabled={busy} onClick={()=>{if(confirm(`Release this held ${heldOperationLabel(op.path).toLowerCase()}?\n\nOnly release it if it is no longer running. Any saved research is kept and only that is charged. If the provider did finish, running it again may pay for the same search twice.`))void run(async()=>{await apiJson(`/api/admin/operations/${op.id}/release`,'POST',{confirmation:'RELEASE_HELD_OPERATION'});return 'Operation released.'})}}>Release</button></li>)}</ul></div>}
 {!rolloutStatus&&<p role="alert">Maintenance status is unavailable. <button type="button" onClick={()=>void run(()=>load())}>Retry</button></p>}
 {rolloutStatus?.lwinCurrent&&<section className="settings-card" aria-label="Current LWIN status">
  <div className="settings-card-head"><h2>Your wines’ LWIN links</h2><Link className="settings-card-link" to="/admin/lwin-review">Needs review now: {rolloutStatus.lwinCurrent.needsReview} →</Link></div>
  <dl className="settings-stats">
   <div><dt>Wines</dt><dd>{rolloutStatus.lwinCurrent.total}</dd></div>
   <div><dt>Linked automatically</dt><dd>{rolloutStatus.lwinCurrent.automatic}</dd></div>
   <div><dt>Confirmed by you</dt><dd>{rolloutStatus.lwinCurrent.manual}</dd></div>
   <div><dt>Without LWIN</dt><dd>{rolloutStatus.lwinCurrent.withoutLwin}{rolloutStatus.lwinCurrent.optedOut>0&&<small> {rolloutStatus.lwinCurrent.optedOut} on purpose</small>}</dd></div>
  </dl>
  <p className="settings-hint">Identity conflicts: {rolloutStatus.lwinCurrent.identityConflicts} · Field suggestions only: {rolloutStatus.lwinCurrent.fieldUpdates}. A field suggestion does not mean the link is wrong, and confirming a link protects it.</p>
 </section>}
 {rolloutStatus&&<section className="settings-card" aria-label="Background jobs">
  <div className="settings-card-head"><h2>Background jobs</h2><small>Safe to leave this page. Results cover all accounts.</small></div>
  {job({name:'Storage inventory',kind:'storage',state:rolloutStatus.storage.state,meta:`${rolloutStatus.storage.objects} files tracked`,error:rolloutStatus.storage.error,disabled:rolloutStatus.storage.state==='complete',actionLabel:rolloutStatus.storage.state==='complete'?'R2 inventory complete':rolloutStatus.storage.state==='paused'?'Resume R2 inventory':'Inventory R2 storage',action:()=>startRollout('storage'),about:'Counts the photos and files already in R2 storage so each account’s storage allowance is accurate.'})}
  {job({name:'Research index',kind:'research',state:rolloutStatus.research.state,meta:`Wines ${rolloutStatus.research.wines.processed}/${rolloutStatus.research.wines.total} · producers ${rolloutStatus.research.producers.processed}/${rolloutStatus.research.producers.total}`,processed:researchProcessed,total:researchTotal,error:rolloutStatus.research.error,actionLabel:rolloutStatus.research.state==='complete'?'Refresh research index':rolloutStatus.research.state==='paused'?'Resume research indexing':'Index existing research',action:()=>startRollout('research',rolloutStatus.research.state==='complete'),about:'Indexes research that already exists so friends can reuse it instead of paying for it again.'})}
  {job({name:'LWIN matching',kind:'lwin',state:rolloutStatus.lwin.state,meta:<>{rolloutStatus.lwin.processed}/{rolloutStatus.lwin.total} checked · {rolloutStatus.lwin.matched} matched · {rolloutStatus.lwin.ambiguous} unclear · {rolloutStatus.lwin.unmatched} no match{rolloutStatus.lwin.conflict?` · ${rolloutStatus.lwin.conflict} conflicts`:''}</>,processed:rolloutStatus.lwin.processed,total:rolloutStatus.lwin.total,error:rolloutStatus.lwin.error,actionLabel:rolloutStatus.lwin.state==='complete'?'Refresh LWIN matches and enrichment':rolloutStatus.lwin.state==='paused'?'Resume LWIN backfill':'Match existing wines to LWIN',action:()=>startRollout('lwin',rolloutStatus.lwin.state==='complete'),about:'Matches existing wines to LWIN using only local D1 and R2 data. It does not call Liv-ex or change tasting notes, photos or research.'})}
  {job({name:'Check automatic links',kind:'lwin-validate',state:rolloutStatus.lwinValidation.state,meta:rolloutStatus.lwin.state!=='complete'?'Runs after LWIN matching':`${rolloutStatus.lwinValidation.processed}/${rolloutStatus.lwinValidation.total} checked · ${rolloutStatus.lwinValidation.verified} verified · ${rolloutStatus.lwinValidation.review} flagged during this run`,processed:rolloutStatus.lwinValidation.processed,total:rolloutStatus.lwinValidation.total,error:rolloutStatus.lwinValidation.error,disabled:rolloutStatus.lwin.state!=='complete',actionLabel:rolloutStatus.lwinValidation.state==='complete'?'Revalidate stored LWINs':rolloutStatus.lwinValidation.state==='paused'?'Resume stored LWIN validation':'Validate stored LWINs',action:()=>startRollout('lwin-validate',rolloutStatus.lwinValidation.state==='complete'),about:'Rechecks automatic LWIN matches with the current resolver. It never deletes or replaces a stored LWIN; a disagreement is kept and flagged for review.'})}
  {job({name:'AI match for the rest',kind:'lwin-ai',state:rolloutStatus.lwinAi.state,meta:rolloutStatus.lwin.state!=='complete'?'Runs after LWIN matching':`${rolloutStatus.lwinAi.processed}/${rolloutStatus.lwinAi.total} checked · ${rolloutStatus.lwinAi.matched} matched (${rolloutStatus.lwinAi.deterministic} local · ${rolloutStatus.lwinAi.ai} AI) · ${rolloutStatus.lwinAi.review} still unresolved`,processed:rolloutStatus.lwinAi.processed,total:rolloutStatus.lwinAi.total,error:rolloutStatus.lwinAi.error,disabled:rolloutStatus.lwin.state!=='complete',actionLabel:rolloutStatus.lwinAi.state==='complete'?'Recheck unresolved with AI':rolloutStatus.lwinAi.state==='paused'?'Resume AI-assisted LWIN resolution':'Resolve unmatched LWIN wines',action:()=>startRollout('lwin-ai',rolloutStatus.lwinAi.state==='complete'),about:'For wines still unmatched, narrows the candidates locally, then asks the low-cost recognition model through the normal AI Gateway Vertex path on Flex.'})}
 </section>}
 </section></div></div></div></section>;
}
