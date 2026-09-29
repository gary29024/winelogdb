import {useEffect,useState} from 'react';

type Kind='authorisation'|'suspended'|'application'|'research'|'ownership'|'lineage'|'lead';
type Source={title:string;url:string;kind:'official'|'research'|'data'|'company'|'estate'|'other';date:string|null};
export type EvidenceItem={kind:Kind;date:string|null;title:string;detail?:string;note?:string;label?:string;via?:string;sources:string[]};
export type ParcelEvidenceData={sources:Record<string,Source>;parcels:Record<string,EvidenceItem[]>};

// Loaded on first use so the map itself does not carry the research records.
let cached:Promise<ParcelEvidenceData>|null=null;
const load=()=>cached??=import('../../lib/places/echezeauxParcelEvidence.json')
 .then(module=>module.default as unknown as ParcelEvidenceData).catch(error=>{cached=null;throw error});

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
 research:'Published research',ownership:'Ownership record',lineage:'Parcel history',lead:'Weak lead'};
const groups:{id:string;heading:string;kinds:Kind[]}[]=[
 {id:'notices',heading:'Official notices',kinds:['authorisation','suspended','application']},
 {id:'research',heading:'Published research',kinds:['research']},
 {id:'ownership',heading:'Ownership records',kinds:['ownership','lineage']},
];

const sourceLabels:Record<Source['kind'],string>={official:'Official notice',research:'Winehog',data:'Open data',company:'Company record',estate:'Estate page',other:'Other source'};
function sourceLabel(source:Source,repeated:boolean){
 let label=sourceLabels[source.kind];
 if(source.kind==='research'&&source.date)label+=` · ${source.date.slice(0,4)}`;
 if(repeated)label+=` · ${new URL(source.url).hostname.replace(/^www\./,'')}`;  // two links of one kind need telling apart
 return label;
}

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

export function ParcelEvidence({parcelId}:{parcelId:string}){
 const [data,setData]=useState<ParcelEvidenceData|null>(null),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let active=true;
  load().then(result=>{if(active){setData(result);setFailed(false)}}).catch(()=>{if(active)setFailed(true)});
  return()=>{active=false};
 },[attempt]);
 if(failed)return <div className="parcel-evidence" role="alert"><p className="village-map-note">Evidence records could not load. Parcel rights are still available.</p>
  <button type="button" className="village-map-link-button" onClick={()=>setAttempt(n=>n+1)}>Retry evidence</button></div>;
 if(!data)return <p className="village-map-note parcel-evidence" role="status">Loading evidence records…</p>;
 const items=data.parcels[parcelId]??[];
 if(!items.length)return <p className="village-map-note parcel-evidence">No dated records were found for this parcel. This does not mean nobody farms it.</p>;
 const leads=items.filter(i=>i.kind==='lead');
 return <section className="parcel-evidence" aria-label="History and evidence">
  <h5>History and evidence</h5>
  <p className="village-map-note">Dated records about this parcel. They show notices, owners and published research, not who farms it today.</p>
  {groups.map(group=>{
   const list=items.filter(i=>group.kinds.includes(i.kind));
   return list.length>0&&<div key={group.id} className="parcel-evidence-group">
    <h6>{group.heading} <span>{list.length}</span></h6>
    <ul>{list.map((item,index)=><Item key={`${item.kind}:${item.title}:${index}`} item={item} sources={data.sources}/>)}</ul>
   </div>;
  })}
  {leads.length>0&&<details className="parcel-evidence-group parcel-evidence-leads">
   <summary>Weak leads <span>{leads.length}</span></summary>
   <p className="village-map-note">Names and ownership context only. They are not evidence of who farms this parcel.</p>
   <ul>{leads.map((item,index)=><Item key={`${item.title}:${index}`} item={item} sources={data.sources}/>)}</ul>
  </details>}
 </section>;
}
