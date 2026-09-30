import {useEffect,useReducer,useState} from 'react';
import {loadParcelEvidence,type EvidenceItem,type EvidenceKind as Kind,type EvidenceSource as Source,type ParcelEvidenceData} from '../../lib/places/grandCruParcels/evidence';

export type {EvidenceItem,ParcelEvidenceData};

const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function when(item:EvidenceItem){
 const date=item.date;
 if(!date)return null;
 // Ownership records are the 1 January snapshot of that year.
 if(item.kind==='ownership')return {text:`1 Jan ${date}`,iso:`${date}-01-01`};
 if(date.length===4)return {text:date,iso:date};
 const [y,m,d]=date.split('-').map(Number);
 return {text:`${d} ${months[m-1]} ${y}`,iso:date};
}
const badges:Record<Kind,string>={authorisation:'Authorisation decision',suspended:'Application suspended',application:'Application received',
 filing:'Company filing',research:'Published research',ownership:'Ownership record',sale:'Sale record',lineage:'Parcel history',lead:'Weak lead'};
const groups:{id:string;heading:string;kinds:Kind[]}[]=[
 {id:'notices',heading:'Official notices',kinds:['authorisation','suspended','application']},
 {id:'filings',heading:'Company filings',kinds:['filing']},
 {id:'research',heading:'Published research',kinds:['research']},
 {id:'ownership',heading:'Ownership and sales',kinds:['ownership','sale','lineage']},
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

function Item({item,sources}:{item:EvidenceItem;sources:ParcelEvidenceData['sources']}){
 const time=when(item);
 return <li className={`parcel-evidence-item is-${item.kind}`}>
  <div className="parcel-evidence-meta">
   {time&&<time dateTime={time.iso}>{time.text}</time>}
   <span className="parcel-evidence-badge">{item.kind==='research'||item.kind==='lead'?item.label??badges[item.kind]:badges[item.kind]}</span>
  </div>
  <strong>{item.title}</strong>
  {item.detail&&<span className="parcel-evidence-detail">{item.detail}</span>}
  {item.via&&<span className="parcel-evidence-detail">Inherited from former parcel {item.via}</span>}
  {item.note&&<p>{item.note}</p>}
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
 if(!items.length)return <p className="village-map-note parcel-evidence">No dated records were found for this parcel.</p>;
 const shown=groups.map(group=>({...group,list:items.filter(i=>group.kinds.includes(i.kind))})).filter(group=>group.list.length>0);
 const firstId=shown[0]?.id;
 return <section className="parcel-evidence" aria-label="History and evidence">
  <h5>History and evidence</h5>
  <p className="village-map-note">Dated notices, ownership, sales, company filings and published research.</p>
  {shown.map(group=><details key={group.id} className={`parcel-evidence-group parcel-evidence-${group.id}`} open={choices.get(group.id)??group.id===firstId}>
   <summary onClick={event=>{event.preventDefault();choices.set(group.id,!(choices.get(group.id)??group.id===firstId));bump()}}>{group.heading} <span>{group.list.length}</span></summary>
   {group.id==='leads'&&<p className="village-map-note">Names and ownership context only.</p>}
   <ul>{group.list.map((item,index)=><Item key={`${item.kind}:${item.title}:${index}`} item={item} sources={data.sources}/>)}</ul>
  </details>)}
 </section>;
}
