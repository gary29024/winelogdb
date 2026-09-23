import { createHash } from 'node:crypto';
import { mkdir,readFile,stat,writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ELID_PRODUCER_PATH,elidParts,heading,htmlLinks,producerKeyFromName,retryAfterMs,robotsAllows,sitemapPaths,validRegistryElid } from '../src/lib/wine/elidRegistry';
import { REFERENCE_SHARDS,producerLookupKeys,referenceShardId,type ElidProducerIndex,type ElidReferenceRecord,type ReferenceManifest } from '../src/lib/wine/referenceCatalog';
import { DEFAULT_REFERENCE_BUCKET,flag,option,recordSyncState,uploadReferenceFiles,writeShardFiles } from './referenceR2';

const BASE='https://elid.wine',CACHE=join('.tmp','elid-cache'),AGENT='WineLogDB-ELID-Registry-Sync';
const USER_AGENT=`${AGENT}/1.0 (+https://github.com/gary29024/winelogdb)`;
const DELAY_MS=Math.max(250,Number(option('delay-ms')??500)),MAX_PAGE_BYTES=8*1024*1024,MAX_429_RETRIES=3;
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const cacheFile=(url:string)=>join(CACHE,createHash('sha1').update(url).digest('hex')+'.html');
let robotsTextPromise:Promise<string>|null=null;
let nextRequest=0;
async function pace(){const now=Date.now(),start=Math.max(now,nextRequest);nextRequest=start+DELAY_MS;if(start>now)await sleep(start-now)}

async function networkText(url:string,accept='text/html'){
 for(let attempt=0;attempt<=MAX_429_RETRIES;attempt++){
  let response:Response|undefined;
  try{
   await pace();
   response=await fetch(url,{headers:{'User-Agent':USER_AGENT,'Accept':accept},signal:AbortSignal.timeout(30_000)});
   if(response.status===429){
    const delay=Math.min(retryAfterMs(response.headers.get('retry-after'))??(2000*2**attempt),5*60*1000);
    if(attempt===MAX_429_RETRIES)throw new Error(`ELID returned 429 after ${attempt+1} attempts for ${url}`);
    nextRequest=Math.max(nextRequest,Date.now()+delay);await sleep(delay);continue;
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
 if(!robotsTextPromise)robotsTextPromise=(async()=>{
  let response:Response|undefined;
  try{
   response=await fetch(BASE+'/robots.txt',{headers:{'User-Agent':USER_AGENT,'Accept':'text/plain'},signal:AbortSignal.timeout(30_000)});
   if(response.status===404||response.status===410)return '';
   if(!response.ok)throw new Error(`ELID robots.txt unavailable (${response.status}); sync aborted`);
   return await response.text();
  }finally{
   await sleep(DELAY_MS);
  }
 })();
 return robotsTextPromise;
}
async function assertRobotsAllowed(url:string){
 const rules=await robotsText();if(!rules)return;
 const parsed=new URL(url);
 if(!robotsAllows(rules,parsed.pathname+parsed.search,AGENT))
  throw new Error(`ELID robots.txt disallows ${parsed.pathname}; sync aborted`);
}
const pending=new Map<string,Promise<string>>();
async function readCached(url:string){
 await mkdir(CACHE,{recursive:true});const file=cacheFile(url),fresh=flag('fresh');
 await assertRobotsAllowed(url);
 if(!fresh)try{const info=await stat(file);if(Date.now()-info.mtimeMs<7*24*60*60*1000)return await readFile(file,'utf8')}catch{}
 const html=await networkText(url);await writeFile(file,html,'utf8');return html;
}

const producerFilter=(option('producer')??'').toUpperCase(),countryFilter=(option('country')??'').toUpperCase();
if(producerFilter&&!ELID_PRODUCER_PATH.test('/producer/'+producerFilter))throw new Error('Invalid ELID producer code');
if(countryFilter&&!/^[A-Z]{2}$/.test(countryFilter))throw new Error('Invalid country code');
const sitemapIndex=await cached(BASE+'/sitemap.xml');
const maps=sitemapPaths(sitemapIndex).filter(path=>/^\/sitemap-wine-[A-Z]{2}\.xml$/.test(path)&&(!countryFilter||path===`/sitemap-wine-${countryFilter}.xml`)&&(!producerFilter||path===`/sitemap-wine-${producerFilter.slice(0,2)}.xml`));
if(!maps.length)throw new Error('No wine sitemaps matched the requested scope');
const versions=new Map<string,Set<string>>();
for(const map of maps){
 for(const path of sitemapPaths(await cached(BASE+map))){
  const parts=elidParts(path);if(!parts?.elid||!validRegistryElid(parts.elid))continue;
  const paths=versions.get(parts.baseElid)??new Set<string>();paths.add(path);versions.set(parts.baseElid,paths);
 }
}
function cached(url:string){
 const hit=pending.get(url);if(hit)return hit;
 const read=readCached(url).finally(()=>pending.delete(url));pending.set(url,read);return read;
}
if(producerFilter){
 const producerHtml=await cached(`${BASE}/producer/${producerFilter}`);
 const bases=new Set(htmlLinks(producerHtml).map(link=>elidParts(new URL(link.href,BASE).pathname)?.baseElid));
 for(const base of versions.keys())if(!bases.has(base))versions.delete(base);
}
console.log(`ELID sitemaps: ${versions.size} base wines with registered vintage/release URLs`);
const records:ElidReferenceRecord[]=[],producerIndex:ElidProducerIndex={},producers=new Set<string>();let baseWineCount=0;
async function readWine(baseElid:string,paths:Set<string>){
 const baseHtml=await cached(`${BASE}/wine/${baseElid}`),wineName=heading(baseHtml,1);
 const producerLinks=htmlLinks(baseHtml).filter(link=>{const url=new URL(link.href,BASE);return url.origin===BASE&&ELID_PRODUCER_PATH.test(url.pathname)});
 const producerPaths=[...new Set(producerLinks.map(link=>new URL(link.href,BASE).pathname))];
 if(!wineName||producerPaths.length!==1)throw new Error(`Missing or ambiguous registry identity on ${baseElid}`);
 const producerPath=producerPaths[0],producerCode=producerPath.split('/').pop()!;
 const producerName=heading(await cached(BASE+producerPath),1);
 if(!producerName)throw new Error(`Missing registry producer name on ${producerPath}`);
 if(producerFilter&&producerCode!==producerFilter)throw new Error(`Unexpected producer on ${baseElid}`);
 producers.add(producerCode);
 for(const key of producerLookupKeys(producerName))producerIndex[key]=[...new Set([...(producerIndex[key]??[]),producerCode])].sort();
 for(const path of paths){
  const parts=elidParts(path)!;
  records.push({elid:parts.elid!,baseElid,producerCode,producerName,producerKey:producerKeyFromName(producerName),wineName,wineKey:producerKeyFromName(wineName),vintageCode:parts.vintageCode,sourceUrl:BASE+path});
 }
 baseWineCount++;
 if(baseWineCount%25===0||baseWineCount===versions.size)console.log(`ELID wines ${baseWineCount}/${versions.size} · ${records.length} registered versions`);
}
// Four requests may be in flight, but all starts share the same rate limit.
// Finish a batch before advancing; failed imports never publish partial data.
const entries=[...versions.entries()];
for(let offset=0;offset<entries.length;offset+=4){
 const results=await Promise.allSettled(entries.slice(offset,offset+4).map(([base,paths])=>readWine(base,paths)));
 const failure=results.find(result=>result.status==='rejected');if(failure?.status==='rejected')throw failure.reason;
}
const unique=[...new Map(records.map(row=>[row.elid,row])).values()].sort((a,b)=>a.elid.localeCompare(b.elid));
if(!unique.length)throw new Error('ELID crawl found no registered vintage/release identifiers');
// Matching names/index changes must publish a new immutable catalogue too.
const sortedIndex=Object.fromEntries(Object.entries(producerIndex).sort(([a],[b])=>a.localeCompare(b)));
const digest=createHash('sha256').update(JSON.stringify({records:unique,producerIndex:sortedIndex})).digest('hex'),version=digest.slice(0,16),generatedAt=new Date().toISOString();
const shards=new Map<string,ElidReferenceRecord[]>();
for(const row of unique){const id=referenceShardId(row.producerCode,REFERENCE_SHARDS),items=shards.get(id)??[];items.push(row);shards.set(id,items)}
const prefix=`reference/elid/versions/${version}`,manifest:ReferenceManifest={
 provider:'elid',version,prefix,shardCount:REFERENCE_SHARDS,rows:unique.length,source:'https://elid.wine/sitemap.xml',sourceUpdatedAt:null,generatedAt,
 producerIndexKey:`${prefix}/producer-index.json`
};
const built=await writeShardFiles('elid',version,shards,manifest,{'producer-index.json':sortedIndex});
console.log(`Prepared ${unique.length} ELID registry identifiers from ${producers.size} producers / ${baseWineCount} base wines. Version ${version}.`);
if(flag('dry-run')){console.log(`Dry run only. Files: ${built.dir}`);process.exit(0)}
const bucket=option('bucket')??DEFAULT_REFERENCE_BUCKET;
uploadReferenceFiles('elid',version,built.files,built.manifestPath,bucket);
recordSyncState('elid',manifest,{seen:unique.length,written:unique.length});
console.log(`ELID ${version} is now current in R2 bucket ${bucket}.`);
