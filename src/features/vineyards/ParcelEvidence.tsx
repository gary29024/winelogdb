import {useEffect,useReducer,useState} from 'react';
import {loadParcelEvidence,type EvidenceItem,type EvidenceKind as Kind,type EvidenceSource as Source,type ParcelEvidenceData} from '../../lib/places/grandCruParcels/evidence';

export type {EvidenceItem,ParcelEvidenceData};

const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function when(item:EvidenceItem){
 const date=item.date;
 if(!date)return null;
 // Legal-entity rights use the 1 January snapshot of that year.
 if(item.kind==='ownership'&&date.length===4)return {text:`1 Jan ${date}`,iso:`${date}-01-01`};
 if(date.length===4)return {text:date,iso:date};
 const [y,m,d]=date.split('-').map(Number);
 return {text:`${d} ${months[m-1]} ${y}`,iso:date};
}
const badges:Record<Kind,string>={authorisation:'Authorisation decision',suspended:'Application suspended',application:'Application received',notice:'Reviewed notice reference',
 filing:'Company filing',research:'Published research',ownership:'Rights record',sale:'Sale record',filiation:'Official parcel filiation',lineage:'Spatial inference',lead:'Weak lead'};
const groups:{id:string;heading:string;kinds:Kind[]}[]=[
 {id:'notices',heading:'Official notices',kinds:['authorisation','suspended','application','notice']},
 {id:'filings',heading:'Company filings',kinds:['filing']},
 {id:'research',heading:'Published research',kinds:['research']},
 {id:'ownership',heading:'Rights and sales',kinds:['ownership','sale']},
 {id:'history',heading:'Parcel history',kinds:['filiation','lineage']},
 {id:'leads',heading:'Weak leads',kinds:['lead']},
];

const sourceLabels:Record<Source['kind'],string>={official:'Official notice',research:'Winehog',data:'Open data',company:'Company record',estate:'Estate page',other:'Other source'};
function sourceLabel(source:Source,repeated:boolean){
 let label=sourceLabels[source.kind];
 if(source.kind==='research'&&source.date)label+=` · ${source.date.slice(0,4)}`;
 if(repeated)label+=` · ${new URL(source.url).hostname.replace(/^www\./,'')}`;  // two links of one kind need telling apart
 return label;
}

// What the reader opened or closed is remembered while browsing parcels; untouched groups follow the default.
const choices=new Map<string,boolean>();
const dateRoles:Record<string,string>={'dfi-validation':'DFI validation date','cadastral-observation':'Cadastral observation',
 'first-observed-cadastral-release':'First observed cadastral release','1-january-rights-snapshot':'1 January rights snapshot',
 'deed-date':'Deed date','notice-act-date':'Notice act date'};
// The original record's scope stays visible, so a former parcel's record is never read as this parcel's.
const scopes:Record<string,string>={'entire-printed-parcel-reference':'Scope: the whole former parcel as recorded',
 'complete-deed-parcel-group':'Scope: every parcel in the deed together',
 'original-research-reference-and-stated-area':'Scope: the reference and area stated by the research',
 'printed-notice-reference-and-area':'Scope: the reference and area printed in the notice'};
const methods:Record<NonNullable<EvidenceItem['method']>,string>={'documented-dfi':'Official DGFiP filiation record',
 'spatial-inference':'Inferred from map overlap, not an official record'};
const shortRef=(id:string)=>`${id.slice(8,10).replace(/^0/,'')}${id.slice(10)}`;

function Item({item,sources}:{item:EvidenceItem;sources:ParcelEvidenceData['sources']}){
 const time=when(item);
 return <li className={`parcel-evidence-item is-${item.kind}`}>
  <div className="parcel-evidence-meta">
   {time&&<time dateTime={time.iso}>{time.text}</time>}
   {item.dateRole&&<span>{dateRoles[item.dateRole]??item.dateRole}</span>}
   <span className="parcel-evidence-badge">{item.kind==='research'||item.kind==='lead'?item.label??badges[item.kind]:badges[item.kind]}</span>
  </div>
  <strong>{item.title}</strong>
  {item.detail&&<span className="parcel-evidence-detail">{item.detail}</span>}
  {item.via&&<span className="parcel-evidence-detail">Record names former parcel {item.via}</span>}
  {item.originalScope&&<span className="parcel-evidence-detail">{scopes[item.originalScope]??`Scope: ${item.originalScope.replaceAll('-',' ')}`}</span>}
  {item.method&&<span className="parcel-evidence-detail">{methods[item.method]}</span>}
  {item.note&&<p>{item.note}</p>}
  {Boolean(item.contextPaths?.length)&&<details><summary>Historical reference paths</summary><ul>{item.contextPaths!.map((path,index)=><li key={index}>
   {path.method&&`${methods[path.method]}: `}{path.referencePath.map(shortRef).join(' ← ')}
   {path.assignment==='unassigned-context'&&' · Unassigned context'}
   {path.qualifications.length>0&&` · ${path.qualifications.map(q=>q.replaceAll('-',' ')).join('; ')}`}
  </li>)}</ul></details>}
  <span className="parcel-evidence-sources">{item.sources.map(id=>{
   const source=sources[id];
   if(!source)return null;
   const repeated=item.sources.filter(other=>sources[other]&&sourceLabels[sources[other].kind]===sourceLabels[source.kind]).length>1;
   const label=sourceLabel(source,repeated);
   return <a key={id} href={source.url} target="_blank" rel="noopener noreferrer" title={source.title} aria-label={`${label}: ${source.title}`}>{label}</a>;
  })}</span>
 </li>;
}

export function ParcelEvidence({parcelId,parentId}:{parcelId:string;parentId:string}){
 const [data,setData]=useState<ParcelEvidenceData|null>(null),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0),[,bump]=useReducer((n:number)=>n+1,0);
 useEffect(()=>{
  let active=true;
  loadParcelEvidence(parentId).then(result=>{if(active){setData(result);setFailed(false)}}).catch(()=>{if(active)setFailed(true)});
  return()=>{active=false};
 },[parentId,attempt]);
 if(failed)return <div className="parcel-evidence" role="alert"><p className="village-map-note">Evidence records could not load. Parcel rights are still available.</p>
  <button type="button" className="village-map-link-button" onClick={()=>setAttempt(n=>n+1)}>Retry evidence</button></div>;
 if(!data)return <p className="village-map-note parcel-evidence" role="status">Loading evidence records…</p>;
 const items=data.parcels[parcelId]??[];
 const tracing=data.tracing?.[parcelId];
 if(!items.length&&!tracing)return <p className="village-map-note parcel-evidence">No matched records in the reviewed sources for this parcel.</p>;
 const shown=groups.map(group=>({...group,list:items.filter(i=>group.kinds.includes(i.kind))})).filter(group=>group.list.length>0);
 const firstId=shown[0]?.id;
 return <section className="parcel-evidence" aria-label="History and evidence">
  <h5>History and evidence</h5>
  {!items.length&&<p className="village-map-note">No matched dated rights, sale or notice records in the reviewed sources.</p>}
  {shown.map(group=><details key={group.id} className={`parcel-evidence-group parcel-evidence-${group.id}`} open={choices.get(group.id)??group.id===firstId}>
   <summary onClick={event=>{event.preventDefault();choices.set(group.id,!(choices.get(group.id)??group.id===firstId));bump()}}>{group.heading} <span>{group.list.length}</span></summary>
   <ul>{group.list.map((item,index)=><Item key={`${item.kind}:${item.title}:${index}`} item={item} sources={data.sources}/>)}</ul>
  </details>)}
 </section>;
}
