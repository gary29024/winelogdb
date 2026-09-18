import { createHash } from 'node:crypto';
import { mkdir,readFile,stat,writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ELID_PRODUCER_PATH,elidParts,heading,htmlLinks,producerKeyFromName,retryAfterMs,robotsAllows,validRegistryElid } from '../src/lib/wine/elidRegistry';
import { REFERENCE_SHARDS,producerLookupKeys,referenceShardId,type ElidProducerIndex,type ElidReferenceRecord,type ReferenceManifest } from '../src/lib/wine/referenceCatalog';
import { DEFAULT_REFERENCE_BUCKET,flag,option,recordSyncState,uploadReferenceFiles,writeShardFiles } from './referenceR2';

const BASE='https://elid.wine',CACHE=join('.tmp','elid-cache'),AGENT='WineLogDB-ELID-Registry-Sync';
const USER_AGENT=`${AGENT}/1.0 (+https://github.com/gary29024/winelogdb)`;
const DELAY_MS=Math.max(250,Number(option('delay-ms')??500)),MAX_PAGE_BYTES=8*1024*1024,MAX_429_RETRIES=3;
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const cacheFile=(url:string)=>join(CACHE,createHash('sha1').update(url).digest('hex')+'.html');
let robotsTextPromise:Promise<string>|null=null;

async function networkText(url:string,accept='text/html'){
 for(let attempt=0;attempt<=MAX_429_RETRIES;attempt++){
  let response:Response|undefined;
  try{
   response=await fetch(url,{headers:{'User-Agent':USER_AGENT,'Accept':accept}});
   if(response.status===429){
    const delay=Math.min(retryAfterMs(response.headers.get('retry-after'))??(2000*2**attempt),5*60*1000);
    if(attempt===MAX_429_RETRIES)throw new Error(`ELID returned 429 after ${attempt+1} attempts for ${url}`);
    await sleep(delay);continue;
   }
   if(!response.ok)throw new Error(`ELID returned ${response.status} for ${url}`);
   const length=Number(response.headers.get('content-length')||0);if(length>MAX_PAGE_BYTES)throw new Error(`ELID page is unexpectedly large: ${url}`);
   const body=await response.text();if(Buffer.byteLength(body)>MAX_PAGE_BYTES)throw new Error(`ELID page exceeded the crawler safety limit: ${url}`);
   return body;
  }finally{
   await sleep(DELAY_MS);
  }
 }
 throw new Error(`ELID request failed for ${url}`);
}
async function robotsText(){
 if(!robotsTextPromise)robotsTextPromise=networkText(BASE+'/robots.txt','text/plain');
 return robotsTextPromise;
}
async function assertRobotsAllowed(url:string){
 const rules=await robotsText();if(!rules)return;
 const parsed=new URL(url);
 if(!robotsAllows(rules,parsed.pathname+parsed.search,AGENT))
  throw new Error(`ELID robots.txt disallows ${parsed.pathname}; sync aborted`);
}
async function cached(url:string){
 await mkdir(CACHE,{recursive:true});const file=cacheFile(url),fresh=flag('fresh');
 if(!fresh)try{const info=await stat(file);if(Date.now()-info.mtimeMs<7*24*60*60*1000)return await readFile(file,'utf8')}catch{}
 await assertRobotsAllowed(url);
 const html=await networkText(url);await writeFile(file,html,'utf8');return html;
}

const producerFilter=(option('producer')??'').toUpperCase(),countryFilter=(option('country')??'').toUpperCase();
const root=await cached(BASE+'/producer');
let producerPaths=[...new Set(htmlLinks(root).map(link=>new URL(link.href,BASE).pathname).filter(path=>ELID_PRODUCER_PATH.test(path)))];
if(producerFilter)producerPaths=producerPaths.filter(path=>path.endsWith('/'+producerFilter));
if(countryFilter)producerPaths=producerPaths.filter(path=>path.startsWith('/producer/'+countryFilter+'-'));
if(!producerPaths.length)throw new Error('No ELID producers matched the requested scope');

const records:ElidReferenceRecord[]=[],producerIndex:ElidProducerIndex={};let producerCount=0,baseWineCount=0;
for(const [index,producerPath] of producerPaths.entries()){
 const producerHtml=await cached(BASE+producerPath),producerName=heading(producerHtml,1),producerCode=producerPath.split('/').pop()!;
 if(!producerName)continue;producerCount++;
 for(const key of producerLookupKeys(producerName))producerIndex[key]=[...new Set([...(producerIndex[key]??[]),producerCode])];
 const initial=[...new Set(htmlLinks(producerHtml).map(link=>new URL(link.href,BASE).pathname).filter(path=>path.startsWith('/wine/')))];
 const bases=[...new Set(initial.map(path=>elidParts(path)?.baseElid).filter((x):x is string=>Boolean(x)))];
 for(const baseElid of bases){
  baseWineCount++;const basePath=`/wine/${baseElid}`;let baseHtml:string;
  try{baseHtml=await cached(BASE+basePath)}catch(error){console.warn(String(error));continue}
  const wineName=heading(baseHtml,1);if(!wineName)continue;
  const variantPaths=[...new Set([basePath,...htmlLinks(baseHtml).map(link=>new URL(link.href,BASE).pathname),...initial].filter(path=>path.startsWith('/wine/')))];
  for(const path of variantPaths){
   const parts=elidParts(path);if(!parts||parts.baseElid!==baseElid||!parts.vintageCode||!validRegistryElid(parts.elid))continue;
   records.push({elid:parts.elid,baseElid,producerCode,producerName,producerKey:producerKeyFromName(producerName),
    wineName,wineKey:producerKeyFromName(wineName),vintageCode:parts.vintageCode,sourceUrl:BASE+path});
  }
 }
 console.log(`ELID producers ${index+1}/${producerPaths.length}: ${producerCode} · ${records.length} registered versions`);
}
const unique=[...new Map(records.map(row=>[row.elid,row])).values()].sort((a,b)=>a.elid.localeCompare(b.elid));
if(!unique.length)throw new Error('ELID crawl found no registered vintage/release identifiers');
const digest=createHash('sha256').update(unique.map(row=>row.elid).join('\n')).digest('hex'),version=digest.slice(0,16),generatedAt=new Date().toISOString();
const shards=new Map<string,ElidReferenceRecord[]>();
for(const row of unique){const id=referenceShardId(row.producerCode,REFERENCE_SHARDS),items=shards.get(id)??[];items.push(row);shards.set(id,items)}
const prefix=`reference/elid/versions/${version}`,manifest:ReferenceManifest={
 provider:'elid',version,prefix,shardCount:REFERENCE_SHARDS,rows:unique.length,source:'https://elid.wine/producer',sourceUpdatedAt:null,generatedAt,
 producerIndexKey:`${prefix}/producer-index.json`
};
const built=await writeShardFiles('elid',version,shards,manifest,{'producer-index.json':producerIndex});
console.log(`Prepared ${unique.length} ELID registry identifiers from ${producerCount} producers / ${baseWineCount} base wines. Version ${version}.`);
if(flag('dry-run')){console.log(`Dry run only. Files: ${built.dir}`);process.exit(0)}
const bucket=option('bucket')??DEFAULT_REFERENCE_BUCKET;
uploadReferenceFiles('elid',version,built.files,built.manifestPath,bucket);
recordSyncState('elid',manifest,{seen:unique.length,written:unique.length});
console.log(`ELID ${version} is now current in R2 bucket ${bucket}.`);
