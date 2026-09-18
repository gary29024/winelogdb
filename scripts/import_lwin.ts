import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname,basename,resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { LWIN_HEADERS,parseLwinReference,validateLwinHeaders,type LwinInputRow,type LwinReferenceProduct } from '../src/lib/wine/lwinImport';
import { REFERENCE_SHARDS,referenceShardId,type ReferenceManifest } from '../src/lib/wine/referenceCatalog';
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
const products:LwinReferenceProduct[]=[];let rejected=0,redirected=0,latest='';
for(const [index,row] of inputRows.entries())try{
 const product=parseLwinReference(row,generatedAt);products.push(product);if(product.status==='Combined')redirected++;
 if((product.sourceUpdatedAt??'')>latest)latest=product.sourceUpdatedAt??latest;
}catch(error){rejected++;console.warn(`row ${index+2}: ${(error as Error).message}`)}
if(!products.length)throw new Error('No valid LWIN rows were found');
const shards=new Map<string,LwinReferenceProduct[]>(),byLwin=new Map(products.map(product=>[product.lwin7,product]));
for(const product of products){const id=referenceShardId(product.producerKey,REFERENCE_SHARDS),rows=shards.get(id)??[];rows.push(product);shards.set(id,rows)}
const redirects:Record<string,LwinReferenceProduct>={};
for(const product of products)if(product.status==='Combined'&&product.referenceLwin7){const target=byLwin.get(product.referenceLwin7);if(target)redirects[product.lwin7]=target}
const prefix=`reference/lwin/versions/${version}`,manifest:ReferenceManifest={
 provider:'lwin',version,prefix,shardCount:REFERENCE_SHARDS,rows:products.length,source:basename(inputPath),sourceUpdatedAt:latest||null,generatedAt,
 redirectsKey:`${prefix}/redirects.json`
};
const built=await writeShardFiles('lwin',version,shards,manifest,{'redirects.json':redirects});
console.log(`Prepared ${products.length} LWIN rows in ${shards.size} R2 shards; ${redirected} combined, ${rejected} rejected. Version ${version}.`);
if(flag('dry-run')){console.log(`Dry run only. Files: ${built.dir}`);process.exit(0)}
const bucket=option('bucket')??DEFAULT_REFERENCE_BUCKET;
uploadReferenceFiles('lwin',version,built.files,built.manifestPath,bucket);
recordSyncState('lwin',manifest,{seen:inputRows.length,written:products.length,redirected,rejected});
console.log(`LWIN ${version} is now current in R2 bucket ${bucket}.`);
