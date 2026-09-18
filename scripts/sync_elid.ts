import { createHash } from 'node:crypto';
import { mkdir,readFile,stat,writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ELID_PRODUCER_PATH,elidParts,heading,htmlLinks,producerKeyFromName,validRegistryElid } from '../src/lib/wine/elidRegistry';
import { REFERENCE_SHARDS,referenceShardId,type ElidReferenceRecord,type ReferenceManifest } from '../src/lib/wine/referenceCatalog';
import { DEFAULT_REFERENCE_BUCKET,flag,option,recordSyncState,uploadReferenceFiles,writeShardFiles } from './referenceR2';

const BASE='https://elid.wine',CACHE=join('.tmp','elid-cache'),DELAY_MS=Math.max(250,Number(option('delay-ms')??500)),MAX_PAGE_BYTES=8*1024*1024;
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const cacheFile=(url:string)=>join(CACHE,createHash('sha1').update(url).digest('hex')+'.html');
async function cached(url:string){
 await mkdir(CACHE,{recursive:true});const file=cacheFile(url),fresh=flag('fresh');
 if(!fresh)try{const info=await stat(file);if(Date.now()-info.mtimeMs<7*24*60*60*1000)return await readFile(file,'utf8')}catch{}
 const response=await fetch(url,{headers:{'User-Agent':'WineLogDB-ELID-Registry-Sync/1.0 (+https://github.com/gary29024/winelogdb)','Accept':'text/html'}});
 if(!response.ok)throw new Error(`ELID returned ${response.status} for ${url}`);
 const length=Number(response.headers.get('content-length')||0);if(length>MAX_PAGE_BYTES)throw new Error(`ELID page is unexpectedly large: ${url}`);
 const html=await response.text();if(Buffer.byteLength(html)>MAX_PAGE_BYTES)throw new Error(`ELID page exceeded the crawler safety limit: ${url}`);
 await writeFile(file,html,'utf8');await sleep(DELAY_MS);return html;
}
async function robotsAllowed(){
 try{
  const response=await fetch(BASE+'/robots.txt',{headers:{'User-Agent':'WineLogDB-ELID-Registry-Sync/1.0'}});
  if(!response.ok)return true;const text=await response.text(),blocks=text.split(/\n(?=User-agent:)/i);
  const star=blocks.find(block=>/^User-agent:\s*\*/im.test(block));if(!star)return true;
  const denied=[...star.matchAll(/^Disallow:\s*(\S+)/gim)].map(match=>match[1]);
  return !denied.some(path=>path==='/'||'/producer/'.startsWith(path)||'/wine/'.startsWith(path));
 }catch{return true}
}
if(!await robotsAllowed())throw new Error('ELID robots.txt currently disallows the registry paths; sync aborted');

const producerFilter=(option('producer')??'').toUpperCase(),countryFilter=(option('country')??'').toUpperCase();
const root=await cached(BASE+'/producer');
let producerPaths=[...new Set(htmlLinks(root).map(link=>new URL(link.href,BASE).pathname).filter(path=>ELID_PRODUCER_PATH.test(path)))];
if(producerFilter)producerPaths=producerPaths.filter(path=>path.endsWith('/'+producerFilter));
if(countryFilter)producerPaths=producerPaths.filter(path=>path.startsWith('/producer/'+countryFilter+'-'));
if(!producerPaths.length)throw new Error('No ELID producers matched the requested scope');

const records:ElidReferenceRecord[]=[];let producerCount=0,baseWineCount=0;
for(const [index,producerPath] of producerPaths.entries()){
 const producerHtml=await cached(BASE+producerPath),producerName=heading(producerHtml,1),producerCode=producerPath.split('/').pop()!;
 if(!producerName)continue;producerCount++;
 const initial=[...new Set(htmlLinks(producerHtml).map(link=>new URL(link.href,BASE).pathname).filter(path=>path.startsWith('/wine/')))];
 const bases=[...new Set(initial.map(path=>elidParts(path)?.baseElid).filter((x):x is string=>Boolean(x)))];
 for(const baseElid of bases){
  baseWineCount++;const basePath=`/wine/${baseElid}`;let baseHtml:string;
  try{baseHtml=await cached(BASE+basePath)}catch{continue}
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
for(const row of unique){const id=referenceShardId(row.producerKey,REFERENCE_SHARDS),items=shards.get(id)??[];items.push(row);shards.set(id,items)}
const prefix=`reference/elid/versions/${version}`,manifest:ReferenceManifest={provider:'elid',version,prefix,shardCount:REFERENCE_SHARDS,rows:unique.length,source:'https://elid.wine/producer',sourceUpdatedAt:null,generatedAt};
const built=await writeShardFiles('elid',version,shards,manifest);
console.log(`Prepared ${unique.length} ELID registry identifiers from ${producerCount} producers / ${baseWineCount} base wines. Version ${version}.`);
if(flag('dry-run')){console.log(`Dry run only. Files: ${built.dir}`);process.exit(0)}
const bucket=option('bucket')??DEFAULT_REFERENCE_BUCKET;
uploadReferenceFiles('elid',version,built.files,built.manifestPath,bucket);
recordSyncState('elid',manifest,{seen:unique.length,written:unique.length});
console.log(`ELID ${version} is now current in R2 bucket ${bucket}.`);
