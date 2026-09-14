export type ManualProducerContactType='email'|'phone'|'website'|'instagram'|'other';
export type ManualProducerContact={id:string;type:ManualProducerContactType;label:string|null;value:string;note:string|null;createdAt:string;updatedAt:string};
export type ManualProducerContactInput={type?:unknown;label?:unknown;value?:unknown;note?:unknown;official?:unknown};
type ContactSource={title:string;url:string};

type Row={id:string;producer_id:string;contact_type:ManualProducerContactType;label:string|null;value:string;note:string|null;created_at:string;updated_at:string};
const TYPES=new Set<ManualProducerContactType>(['email','phone','website','instagram','other']);
export const USER_CONFIRMED_WEBSITE_SOURCE='Confirmed by you · official website';
export const USER_CONFIRMED_INSTAGRAM_SOURCE='Confirmed by you · official Instagram';

function cleanOptional(value:unknown,max:number){const text=typeof value==='string'?value.trim():'';return text?text.slice(0,max):null}
function normalizeUrl(value:string,instagram=false){
  let text=value.trim();if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(text))text=`https://${text}`;
  let url:URL;try{url=new URL(text)}catch{throw new Error('Enter a valid website URL')}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Enter a valid website URL');
  if(instagram){const host=url.hostname.toLowerCase().replace(/^www\./,'');if(host!=='instagram.com')throw new Error('Instagram contact must use instagram.com');url.search=''}
  url.hash='';return url.toString();
}

export function normalizeManualProducerContact(input:ManualProducerContactInput){
  const type=String(input.type??'').trim().toLowerCase() as ManualProducerContactType;if(!TYPES.has(type))throw new Error('Choose a valid contact type');
  const label=cleanOptional(input.label,80),note=cleanOptional(input.note,300);let value=String(input.value??'').trim();if(!value)throw new Error('Contact value is required');if(value.length>500)throw new Error('Contact value is too long');
  if(type==='email'){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw new Error('Enter a valid email address');value=value.toLowerCase()}
  else if(type==='phone'){if(value.replace(/\D/g,'').length<6)throw new Error('Enter a valid phone number')}
  else if(type==='website')value=normalizeUrl(value);
  else if(type==='instagram')value=normalizeUrl(value,true);
  return {type,label,value,note};
}

export function manualProducerContactKey(contact:{type:ManualProducerContactType;label?:string|null;value:string}){
  return `${contact.type}::${String(contact.label??'').trim().toLowerCase()}::${contact.value.trim().toLowerCase()}`;
}

export function dedupeManualProducerContacts(rows:ManualProducerContact[]){
  const seen=new Set<string>();return rows.filter(row=>{const key=manualProducerContactKey(row);if(seen.has(key))return false;seen.add(key);return true});
}

function parseSources(value:unknown){
  try{const parsed=JSON.parse(String(value??'[]')) as unknown;if(!Array.isArray(parsed))return [] as ContactSource[];return parsed.filter((item):item is ContactSource=>Boolean(item&&typeof item==='object'&&typeof (item as ContactSource).url==='string'&&typeof (item as ContactSource).title==='string'))}catch{return [] as ContactSource[]}
}

export function prepareOfficialContactPromotion(contact:{type:ManualProducerContactType;value:string},existingSources:ContactSource[]=[]){
  if(contact.type!=='website'&&contact.type!=='instagram')throw new Error('Only a website or Instagram contact can be made official');
  const value=normalizeUrl(contact.value,contact.type==='instagram'),url=new URL(value);
  if(url.protocol!=='https:')throw new Error('Official contacts must use HTTPS');
  const title=contact.type==='website'?USER_CONFIRMED_WEBSITE_SOURCE:USER_CONFIRMED_INSTAGRAM_SOURCE;
  const otherUserTitle=contact.type==='website'?USER_CONFIRMED_WEBSITE_SOURCE:USER_CONFIRMED_INSTAGRAM_SOURCE;
  const sources=[{title,url:value},...existingSources.filter(source=>source.title!==otherUserTitle&&source.url!==value)].slice(0,10);
  return {type:contact.type,value,sources};
}

const mapRow=(row:Row):ManualProducerContact=>({id:row.id,type:row.contact_type,label:row.label??null,value:row.value,note:row.note??null,createdAt:row.created_at,updatedAt:row.updated_at});

async function producerExists(db:D1Database,owner:string,producerId:string){return Boolean(await db.prepare('SELECT id FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<{id:string}>())}
async function contactForProducer(db:D1Database,owner:string,producerId:string,contactId:string){
  return (await db.prepare(`SELECT id,producer_id,contact_type,label,value,note,created_at,updated_at FROM producer_manual_contacts c
    WHERE c.owner_id=? AND c.id=? AND (c.producer_id=? OR c.producer_id IN (
      SELECT source_producer_id FROM producer_merges WHERE owner_id=? AND destination_producer_id=? AND undone_at IS NULL
    )) LIMIT 1`).bind(owner,contactId,producerId,owner,producerId).first<Row>())??null;
}

export async function listManualProducerContacts(db:D1Database,owner:string,producerId:string){
  const rows=await db.prepare(`SELECT id,producer_id,contact_type,label,value,note,created_at,updated_at FROM producer_manual_contacts c
    WHERE c.owner_id=? AND (c.producer_id=? OR c.producer_id IN (
      SELECT source_producer_id FROM producer_merges WHERE owner_id=? AND destination_producer_id=? AND undone_at IS NULL
    )) ORDER BY CASE WHEN c.producer_id=? THEN 0 ELSE 1 END,c.created_at ASC,c.id ASC`).bind(owner,producerId,owner,producerId,producerId).all<Row>();
  return dedupeManualProducerContacts(rows.results.map(mapRow));
}

export async function createManualProducerContact(db:D1Database,owner:string,producerId:string,input:ManualProducerContactInput){
  if(!await producerExists(db,owner,producerId))throw new Error('Producer not found');const contact=normalizeManualProducerContact(input),stamp=new Date().toISOString(),id=crypto.randomUUID();
  await db.prepare('INSERT INTO producer_manual_contacts(id,owner_id,producer_id,contact_type,label,value,note,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,owner,producerId,contact.type,contact.label,contact.value,contact.note,stamp,stamp).run();
  return {id,...contact,createdAt:stamp,updatedAt:stamp} satisfies ManualProducerContact;
}

export async function updateManualProducerContact(db:D1Database,owner:string,producerId:string,contactId:string,input:ManualProducerContactInput){
  const existing=await contactForProducer(db,owner,producerId,contactId);if(!existing)throw new Error('Supplementary contact not found');const contact=normalizeManualProducerContact(input),stamp=new Date().toISOString();
  if(input.official===true){
    const producer=await db.prepare('SELECT contact_sources_json FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<{contact_sources_json:string|null}>();if(!producer)throw new Error('Producer not found');
    const promoted=prepareOfficialContactPromotion(contact,parseSources(producer.contact_sources_json)),sources=JSON.stringify(promoted.sources);
    const update=promoted.type==='website'
      ?db.prepare('UPDATE producers SET official_website_url=?,contact_sources_json=?,updated_at=? WHERE owner_id=? AND id=?').bind(promoted.value,sources,stamp,owner,producerId)
      :db.prepare('UPDATE producers SET instagram_url=?,contact_sources_json=?,updated_at=? WHERE owner_id=? AND id=?').bind(promoted.value,sources,stamp,owner,producerId);
    await db.batch([update,db.prepare('DELETE FROM producer_manual_contacts WHERE owner_id=? AND id=?').bind(owner,contactId)]);
    return {id:contactId,...contact,value:promoted.value,createdAt:existing.created_at,updatedAt:stamp} satisfies ManualProducerContact;
  }
  await db.prepare('UPDATE producer_manual_contacts SET contact_type=?,label=?,value=?,note=?,updated_at=? WHERE owner_id=? AND id=?').bind(contact.type,contact.label,contact.value,contact.note,stamp,owner,contactId).run();
  return {id:contactId,...contact,createdAt:existing.created_at,updatedAt:stamp} satisfies ManualProducerContact;
}

export async function deleteManualProducerContact(db:D1Database,owner:string,producerId:string,contactId:string){
  const existing=await contactForProducer(db,owner,producerId,contactId);if(!existing)throw new Error('Supplementary contact not found');await db.prepare('DELETE FROM producer_manual_contacts WHERE owner_id=? AND id=?').bind(owner,contactId).run();return {id:contactId,deleted:true as const};
}
