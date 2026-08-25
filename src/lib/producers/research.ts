// Producer research run lifecycle plus the grounding-checked contact helpers
// shared by the batch research pipeline. The synchronous single-shot producer
// researcher that used to live here was unreachable behind the queue router and
// has been removed; src/lib/producers/batchResearch.ts is the one implementation.
type ContactSource={title:string;url:string};
type ContactField='officialWebsiteUrl'|'instagramUrl'|'contactEmail'|'contactPhone';
type GroundingChunk={web?:{title?:string;uri?:string}};
type GroundingSupport={segment?:{startIndex?:number;endIndex?:number;text?:string};groundingChunkIndices?:number[]};
type GroundingMetadata={groundingChunks?:GroundingChunk[];groundingSupports?:GroundingSupport[]};
export type ProducerResearchStage='preparing'|'searching'|'retrying'|'parsing'|'saving'|'image'|'complete'|'failed';
export type ProducerResearchRun={requestId:string;producerId:string;status:'running'|'complete'|'failed';stage:ProducerResearchStage;attempt:number;message:string|null;startedAt:string;updatedAt:string;completedAt:string|null;durationMs:number|null};
const CONTACT_FIELDS:ContactField[]=['officialWebsiteUrl','instagramUrl','contactEmail','contactPhone'];
const now=()=>new Date().toISOString();

export async function getActiveProducerResearchRun(db:D1Database,owner:string,producerId:string){
  return db.prepare(`SELECT request_id FROM producer_research_runs WHERE owner_id=? AND producer_id=? AND status='running'
    AND updated_at>datetime('now','-20 minutes') ORDER BY updated_at DESC LIMIT 1`).bind(owner,producerId).first<{request_id:string}>();
}

export async function createQueuedProducerResearchRun(db:D1Database,owner:string,producerId:string,requestedId?:string){
  const active=await getActiveProducerResearchRun(db,owner,producerId);if(active)return {requestId:active.request_id,created:false};
  const exists=await db.prepare('SELECT id FROM producers WHERE owner_id=? AND id=?').bind(owner,producerId).first<{id:string}>();if(!exists)return null;
  const requestId=requestedId&&/^[A-Za-z0-9_-]{8,64}$/.test(requestedId)?requestedId:crypto.randomUUID(),stamp=now();
  await db.prepare(`INSERT INTO producer_research_runs(owner_id,request_id,producer_id,status,stage,attempt,message,started_at,updated_at,completed_at,duration_ms)
    VALUES(?,?,?,'running','preparing',0,'Queued for background producer research',?,?,NULL,NULL)
    ON CONFLICT(owner_id,request_id) DO UPDATE SET producer_id=excluded.producer_id,status='running',stage='preparing',attempt=0,message=excluded.message,started_at=excluded.started_at,updated_at=excluded.updated_at,completed_at=NULL,duration_ms=NULL`)
    .bind(owner,requestId,producerId,stamp,stamp).run();
  return {requestId,created:true};
}

function safeHttpsUrl(value:unknown,base?:string){
  if(typeof value!=='string'||!value.trim())return null;
  try{
    const url=new URL(value.trim(),base),host=url.hostname.toLowerCase();
    if(url.protocol!=='https:'||url.username||url.password||!host||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal'))return null;
    if(/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)||host.includes(':'))return null;
    url.hash='';
    return url;
  }catch{return null}
}

function jsonFieldRange(text:string,field:ContactField){
  const key=`"${field}"`,start=text.indexOf(key);if(start<0)return null;
  const colon=text.indexOf(':',start+key.length);if(colon<0)return null;
  let end=colon+1;while(end<text.length&&/\s/.test(text[end]))end++;
  if(text[end]==='"'){
    end++;let escaped=false;
    for(;end<text.length;end++){
      const char=text[end];
      if(escaped){escaped=false;continue}
      if(char==='\\'){escaped=true;continue}
      if(char==='"'){end++;break}
    }
  }else{
    while(end<text.length&&!/[},\n]/.test(text[end]))end++;
  }
  return {start,end};
}

export async function getProducerResearchRun(db:D1Database,owner:string,producerId:string,requestId:string):Promise<ProducerResearchRun|null>{
  const row=await db.prepare(`SELECT request_id,producer_id,status,stage,attempt,message,started_at,updated_at,completed_at,duration_ms
    FROM producer_research_runs WHERE owner_id=? AND producer_id=? AND request_id=?`).bind(owner,producerId,requestId).first<Record<string,unknown>>();
  if(!row)return null;
  return {requestId:String(row.request_id),producerId:String(row.producer_id),status:String(row.status) as ProducerResearchRun['status'],stage:String(row.stage) as ProducerResearchStage,attempt:Number(row.attempt)||0,message:row.message?String(row.message):null,startedAt:String(row.started_at),updatedAt:String(row.updated_at),completedAt:row.completed_at?String(row.completed_at):null,durationMs:row.duration_ms==null?null:Number(row.duration_ms)};
}

export function extractContactGrounding(text:string,metadata?:GroundingMetadata){
  const ranges=new Map<ContactField,{start:number;end:number}>();
  for(const field of CONTACT_FIELDS){const range=jsonFieldRange(text,field);if(range)ranges.set(field,range)}
  const groundedFields=new Set<ContactField>(),sources=new Map<string,ContactSource>(),chunks=metadata?.groundingChunks??[];
  for(const support of metadata?.groundingSupports??[]){
    const segment=support.segment,segmentStart=segment?.startIndex,segmentEnd=segment?.endIndex;
    const touched=CONTACT_FIELDS.filter(field=>{
      const range=ranges.get(field);if(!range)return false;
      if(Number.isFinite(segmentStart)&&Number.isFinite(segmentEnd))return Number(segmentStart)<range.end&&Number(segmentEnd)>range.start;
      return Boolean(segment?.text&&segment.text.includes(field));
    });
    if(!touched.length)continue;
    let hasWebSource=false;
    for(const index of support.groundingChunkIndices??[]){
      const web=chunks[index]?.web,url=safeHttpsUrl(web?.uri)?.toString();if(!url)continue;
      hasWebSource=true;if(!sources.has(url))sources.set(url,{title:web?.title?.trim()||new URL(url).hostname,url});
    }
    if(hasWebSource)for(const field of touched)groundedFields.add(field);
  }
  return {fields:[...groundedFields],sources:[...sources.values()].slice(0,10)};
}

export function normalizeProducerEmail(value:unknown){
  if(typeof value!=='string')return null;
  const email=value.trim();
  return email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:null;
}

export function normalizeProducerPhone(value:unknown){
  if(typeof value!=='string')return null;
  const phone=value.trim().replace(/\s+/g,' ');
  return phone.length>=5&&phone.length<=50&&/^[+()0-9.\s/-]+$/.test(phone)?phone:null;
}

export function safeInstagramUrl(value:unknown){
  const url=safeHttpsUrl(value);if(!url)return null;
  const host=url.hostname.toLowerCase().replace(/^www\./,'');
  if(host!=='instagram.com'||url.pathname==='/'||!url.pathname)return null;
  url.search='';url.hash='';
  return url.toString();
}
