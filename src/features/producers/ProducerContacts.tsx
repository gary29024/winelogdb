import { useState } from 'react';
import { createSupplementaryContact,deleteSupplementaryContact,updateSupplementaryContact,type ManualProducerContact,type ManualProducerContactType,type ProducerDetail } from './api';

type Props={producer:ProducerDetail;onChanged:()=>Promise<void>};
type Draft={type:ManualProducerContactType;label:string;value:string;note:string};
const EMPTY:Draft={type:'email',label:'',value:'',note:''};
const LABELS:Record<ManualProducerContactType,string>={email:'Email',phone:'Phone',website:'Website',instagram:'Instagram',other:'Other'};

function contactHref(type:ManualProducerContactType,value:string){
 if(type==='email')return `mailto:${value}`;
 if(type==='phone')return `tel:${value.replace(/[^+\d]/g,'')}`;
 if(type==='website'||type==='instagram')return value;
 return null;
}

function ContactValue({type,value}:{type:ManualProducerContactType;value:string}){
 const href=contactHref(type,value);return href?<a href={href} target={type==='website'||type==='instagram'?'_blank':undefined} rel={type==='website'||type==='instagram'?'noreferrer':undefined}>{value}{type==='website'||type==='instagram'?' ↗':''}</a>:<span className="producer-contact-value">{value}</span>;
}

export function ProducerContacts({producer,onChanged}:Props){
 const [draft,setDraft]=useState<Draft>(EMPTY),[editingId,setEditingId]=useState<string|null>(null),[showForm,setShowForm]=useState(false),[saving,setSaving]=useState(false),[localError,setLocalError]=useState('');
 const verified=[
  producer.officialWebsiteUrl?{label:'Website',type:'website' as const,value:producer.officialWebsiteUrl}:null,
  producer.instagramUrl?{label:'Instagram',type:'instagram' as const,value:producer.instagramUrl}:null,
  producer.contactEmail?{label:'Email',type:'email' as const,value:producer.contactEmail}:null,
  producer.contactPhone?{label:'Phone',type:'phone' as const,value:producer.contactPhone}:null
 ].filter((x):x is NonNullable<typeof x>=>Boolean(x));
 function startAdd(){setEditingId(null);setDraft(EMPTY);setLocalError('');setShowForm(true)}
 function startEdit(contact:ManualProducerContact){setEditingId(contact.id);setDraft({type:contact.type,label:contact.label??'',value:contact.value,note:contact.note??''});setLocalError('');setShowForm(true)}
 function cancel(){setShowForm(false);setEditingId(null);setDraft(EMPTY);setLocalError('')}
 async function save(){if(saving)return;setSaving(true);setLocalError('');try{if(editingId)await updateSupplementaryContact(producer.id,editingId,draft);else await createSupplementaryContact(producer.id,draft);await onChanged();cancel()}catch(e){setLocalError((e as Error).message)}finally{setSaving(false)}}
 async function remove(contact:ManualProducerContact){if(!confirm(`Delete ${contact.label||LABELS[contact.type]}: ${contact.value}?`))return;setLocalError('');try{await deleteSupplementaryContact(producer.id,contact.id);await onChanged();if(editingId===contact.id)cancel()}catch(e){setLocalError((e as Error).message)}}
 return <div className="producer-contact">
  <div className="producer-contact-head"><p className="section-label">CONTACT</p><button type="button" className="producer-contact-add" onClick={startAdd}>+ Add contact</button></div>
  <div className="producer-contact-group"><div className="producer-contact-group-title"><strong>Verified by research</strong></div>
   {producer.researchedAt?(verified.length?<div className="producer-contact-compact">{verified.map(item=><div className="producer-contact-row" key={`${item.type}-${item.value}`}><span>{item.label}</span><ContactValue type={item.type} value={item.value}/></div>)}</div>:<p className="producer-contact-empty">No verified public contact found in this research run.</p>):<p className="producer-contact-empty">Producer contact research has not been run yet.</p>}
   {producer.contactSources.length>0&&<details className="producer-contact-sources"><summary>{producer.contactSources.length} contact reference{producer.contactSources.length===1?'':'s'}</summary><div>{producer.contactSources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</div></details>}
  </div>
  <div className="producer-contact-group supplementary"><div className="producer-contact-group-title"><strong>Supplementary contacts</strong><small>Added by you · kept separate from Deep Search</small></div>
   {producer.supplementaryContacts.length?<div className="producer-manual-contacts">{producer.supplementaryContacts.map(contact=><div className="producer-manual-contact" key={contact.id}><div className="producer-manual-contact-copy"><span>{contact.label||LABELS[contact.type]}</span><ContactValue type={contact.type} value={contact.value}/>{contact.note&&<small>{contact.note}</small>}</div><div className="producer-contact-actions"><button type="button" onClick={()=>startEdit(contact)}>Edit</button><button type="button" className="danger" onClick={()=>void remove(contact)}>Delete</button></div></div>)}</div>:<p className="producer-contact-empty">No supplementary contacts added.</p>}
  </div>
  {showForm&&<div className="producer-contact-form"><div className="producer-contact-form-grid">
   <label><span>Type</span><select value={draft.type} onChange={e=>setDraft({...draft,type:e.target.value as ManualProducerContactType})}>{Object.entries(LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   <label><span>Label <em>optional</em></span><input value={draft.label} maxLength={80} placeholder="Appointments, importer, winemaker…" onChange={e=>setDraft({...draft,label:e.target.value})}/></label>
   <label className="wide"><span>Contact</span><input value={draft.value} maxLength={500} type={draft.type==='email'?'email':draft.type==='phone'?'tel':draft.type==='website'||draft.type==='instagram'?'url':'text'} placeholder={draft.type==='email'?'name@example.com':draft.type==='phone'?'+33 …':draft.type==='instagram'?'https://instagram.com/…':draft.type==='website'?'https://…':'Contact detail'} onChange={e=>setDraft({...draft,value:e.target.value})}/></label>
   <label className="wide"><span>Note <em>optional</em></span><textarea rows={2} maxLength={300} value={draft.note} placeholder="Useful context for this contact" onChange={e=>setDraft({...draft,note:e.target.value})}/></label>
  </div>{localError&&<p className="producer-contact-form-error" role="alert">{localError}</p>}<div className="producer-contact-form-actions"><button type="button" onClick={cancel} disabled={saving}>Cancel</button><button type="button" onClick={()=>void save()} disabled={saving||!draft.value.trim()}>{saving?'Saving…':editingId?'Save changes':'Add contact'}</button></div></div>}
 </div>
}
