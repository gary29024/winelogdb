import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname,basename,resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { parseLwinReference,validateLwinHeaders,type LwinInputRow,type LwinReferenceProduct } from '../src/lib/wine/lwinImport';
import { normalizeLwinId } from '../src/lib/wine/referenceIdentity';
import { REFERENCE_SHARDS,producerLookupKeys,referenceShardId,type LwinProducerIndex,type LwinRedirect,type ReferenceManifest } from '../src/lib/wine/referenceCatalog';
import { DEFAULT_REFERENCE_BUCKET,flag,option,positional,recordSyncState,uploadReferenceFiles,writeShardFiles } from './referenceR2';

function csvRows(input:string){
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<input.length;i++){const ch=input[i];
  if(quoted){if(ch==='"'&&input[i+1]==='"'){cell+='"';i++;continue}if(ch==='"'){quoted=false;continue}cell+=ch;continue}
  if(ch==='"'){quoted=true;continue}if(ch===','){row.push(cell);cell='';continue}
  if(ch==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';continue}cell+=ch;
 }
 if(cell.length||row.length){row.push(cell.replace(/\r$/,''));rows.push(row)}
 return rows.filter((entry,index)=>index===0||entry.some(value=>value.trim()));
}
const value=(v:ExcelJS.CellValue|undefined)=>{
 if(v==null)return null;
 if(v instanceof Date)return v.toISOString();
 if(typeof v==='object'){
  if('result' in v&&v.result!=null)return String(v.result);
  if('text' in v&&typeof v.text==='string')return v.text;
  if('richText' in v&&Array.isArray(v.richText))return v.richText.map(x=>x.text).join('');
 }
 return typeof v==='string'||typeof v==='number'?v:String(v);
};
async function rowsFromXlsx(path:string){
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(path);
 const sheet=workbook.worksheets[0];if(!sheet)throw new Error('The LWIN workbook has no worksheet');
 const headers=(sheet.getRow(1).values as ExcelJS.CellValue[]).slice(1).map(v=>String(value(v)??'').trim().replace(/^\uFEFF/,''));
 validateLwinHeaders(headers);
 const rows:LwinInputRow[]=[];
 sheet.eachRow((row,rowNumber)=>{if(rowNumber===1)return;const values=(row.values as ExcelJS.CellValue[]).slice(1);const item:LwinInputRow={};headers.forEach((header,index)=>{item[header]=value(values[index])});rows.push(item)});
 return rows;
}
async function rowsFromCsv(path:string){
 const raw=await readFile(path,'utf8'),rows=csvRows(raw);if(rows.length<2)throw new Error('LWIN CSV contains no data rows');
 const headers=rows[0].map(v=>v.trim().replace(/^\uFEFF/,''));validateLwinHeaders(headers);
 return rows.slice(1).map(values=>{const item:LwinInputRow={};headers.forEach((header,index)=>{item[header]=values[index]??''});return item});
}
const args=positional(),inputArg=args[0];
if(!inputArg)throw new Error('Usage: npm run lwin:import -- <LWIN.xlsx|LWIN.csv> [--dry-run] [--bucket=winelog-private]');
const inputPath=resolve(inputArg),extension=extname(inputPath).toLowerCase();
if(!['.xlsx','.csv'].includes(extension))throw new Error('LWIN import accepts the official .xlsx workbook or a UTF-8 .csv export');
const raw=await readFile(inputPath),hash=createHash('sha256').update(raw).digest('hex'),version=hash.slice(0,16),generatedAt=new Date().toISOString();
const inputRows=extension==='.xlsx'?await rowsFromXlsx(inputPath):await rowsFromCsv(inputPath);
const products:LwinReferenceProduct[]=[],sourceLwins=new Set<string>(),rejectedByLwin=new Map<string,string>();
let rejected=0,redirected=0,unresolvedRedirects=0,latest='';
for(const row of inputRows){const id=normalizeLwinId(row.LWIN);if(id)sourceLwins.add(id)}
for(const [index,row] of inputRows.entries())try{
 const product=parseLwinReference(row,generatedAt);products.push(product);if(product.status==='Combined')redirected++;
 if((product.sourceUpdatedAt??'')>latest)latest=product.sourceUpdatedAt??latest;
}catch(error){
 rejected++;const message=(error as Error).message,lwin=normalizeLwinId(row.LWIN);
 if(lwin)rejectedByLwin.set(lwin,message);
 console.warn(`row ${index+2}: ${message}`);
}
if(!products.length)throw new Error('No valid LWIN rows were found');
const shards=new Map<string,LwinReferenceProduct[]>(),byLwin=new Map(products.map(product=>[product.lwin7,product])),producerIndex:LwinProducerIndex={};
let sparse=0;
const addIndex=(key:string,shard:string)=>{const values=producerIndex[key]??[];if(!values.includes(shard))values.push(shard);producerIndex[key]=values};
for(const product of products){
 if(!product.producerKey||!product.wineKey)sparse++;
 const id=referenceShardId(product.producerKey||product.lwin7,REFERENCE_SHARDS),rows=shards.get(id)??[];rows.push(product);shards.set(id,rows);
 for(const key of producerLookupKeys(product.producerName)){addIndex(key,id);for(const token of key.split(' ').filter(token=>token.length>=4))addIndex(`t:${token}`,id)}
}
const redirects:Record<string,LwinRedirect>={};
for(const product of products)if(product.status==='Combined'&&product.referenceLwin7){
 const seen=new Set([product.lwin7]);let targetId=product.referenceLwin7,target:LwinReferenceProduct|undefined,unresolvedReason:string|null=null;
 while(targetId){
  target=byLwin.get(targetId);
  if(!target){
   const rejectedReason=rejectedByLwin.get(targetId);
   unresolvedReason=rejectedReason
    ?`target ${targetId} was rejected during parse: ${rejectedReason}`
    :sourceLwins.has(targetId)
      ?`target ${targetId} is present in the workbook but unavailable after validation`
      :`target ${targetId} is absent from the workbook`;
   break;
  }
  if(seen.has(target.lwin7))throw new Error(`Combined LWIN ${product.lwin7} has a circular REFERENCE chain at ${target.lwin7}`);
  seen.add(target.lwin7);
  if(target.status!=='Combined')break;
  if(!target.referenceLwin7){
   unresolvedReason=`target ${target.lwin7} is Combined but has no valid REFERENCE after validation`;break;
  }
  targetId=target.referenceLwin7;
 }
 if(unresolvedReason||!target){
  unresolvedRedirects++;
  console.warn(`LWIN ${product.lwin7}: unresolved redirect — ${unresolvedReason??'no terminal target'}`);
  continue;
 }
 redirects[product.lwin7]={targetLwin7:target.lwin7,targetShard:referenceShardId(target.producerKey||target.lwin7,REFERENCE_SHARDS)};
}
const prefix=`reference/lwin/versions/${version}`,manifest:ReferenceManifest={
 provider:'lwin',version,prefix,shardCount:REFERENCE_SHARDS,rows:products.length,matchableRows:products.length-sparse,sparseRows:sparse,source:basename(inputPath),sourceUpdatedAt:latest||null,generatedAt,
 redirectsKey:`${prefix}/redirects.json`,producerIndexKey:`${prefix}/producer-index.json`
};
const built=await writeShardFiles('lwin',version,shards,manifest,{'redirects.json':redirects,'producer-index.json':producerIndex});
console.log(`Prepared ${products.length} LWIN rows in ${shards.size} R2 shards; ${products.length-sparse} matchable, ${sparse} sparse, ${redirected} combined, ${unresolvedRedirects} unresolved redirects, ${rejected} rejected rows. Version ${version}.`);
if(flag('dry-run')){console.log(`Dry run only. Files: ${built.dir}`);process.exit(0)}
const bucket=option('bucket')??DEFAULT_REFERENCE_BUCKET;
uploadReferenceFiles('lwin',version,built.files,built.manifestPath,bucket);
recordSyncState('lwin',manifest,{seen:inputRows.length,written:products.length,redirected,rejected,unresolved:unresolvedRedirects,sparse});
console.log(`LWIN ${version} is now current in R2 bucket ${bucket}.`);
