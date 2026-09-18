import { createHash } from 'node:crypto';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { basename,join,resolve } from 'node:path';
import { lwinUpsertSql,parseLwinReference,sqlLiteral,validateLwinHeaders,type LwinInputRow } from '../src/lib/wine/lwinImport';

function csvRows(input:string){
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<input.length;i++){
  const ch=input[i];
  if(quoted){
   if(ch==='"'&&input[i+1]==='"'){cell+='"';i++;continue}
   if(ch==='"'){quoted=false;continue}
   cell+=ch;continue;
  }
  if(ch==='"'){quoted=true;continue}
  if(ch===','){row.push(cell);cell='';continue}
  if(ch==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';continue}
  cell+=ch;
 }
 if(cell.length||row.length){row.push(cell.replace(/\r$/,''));rows.push(row)}
 return rows.filter((entry,index)=>index===0||entry.some(value=>value.trim()));
}

function rowObject(headers:string[],values:string[]):LwinInputRow{
 const result:LwinInputRow={};headers.forEach((header,index)=>{result[header]=values[index]??''});return result;
}

const inputArg=process.argv[2],outputArg=process.argv[3]??'.tmp/lwin-import';
if(!inputArg)throw new Error('Usage: npm run lwin:build-import -- <LWIN.csv> [output-directory]');
const inputPath=resolve(inputArg),outputDir=resolve(outputArg),raw=await readFile(inputPath,'utf8'),rows=csvRows(raw);
if(rows.length<2)throw new Error('LWIN CSV contains no data rows');
const headers=rows[0].map(value=>value.trim().replace(/^\uFEFF/,''));validateLwinHeaders(headers);
await mkdir(outputDir,{recursive:true});
const importedAt=new Date().toISOString(),chunkSize=500;let accepted=0,rejected=0,redirected=0,latest='';
const parsed=[] as ReturnType<typeof parseLwinReference>[];
for(let index=1;index<rows.length;index++){
 try{
  const item=parseLwinReference(rowObject(headers,rows[index]),importedAt);parsed.push(item);accepted++;
  if(item.status==='Combined')redirected++;
  if((item.sourceUpdatedAt??'')>latest)latest=item.sourceUpdatedAt??latest;
 }catch(error){rejected++;console.warn(`row ${index+1}: ${(error as Error).message}`)}
}
const files:string[]=[];
for(let start=0;start<parsed.length;start+=chunkSize){
 const chunk=parsed.slice(start,start+chunkSize),name=`lwin-${String(files.length+1).padStart(4,'0')}.sql`;
 const sql=`BEGIN TRANSACTION;\n${lwinUpsertSql(chunk)}\n${chunk.map(item=>`INSERT INTO wine_reference_external_ids(provider,external_id,product_key,vintage_code,source,updated_at) VALUES('lwin7',${sqlLiteral(item.lwin7)},${sqlLiteral(item.productKey)},'','Liv-ex LWIN export',${sqlLiteral(importedAt)}) ON CONFLICT(provider,external_id) DO UPDATE SET product_key=excluded.product_key,source=excluded.source,updated_at=excluded.updated_at;`).join('\n')}\nCOMMIT;\n`;
 await writeFile(join(outputDir,name),sql,'utf8');files.push(name);
}
const hash=createHash('sha256').update(raw).digest('hex'),state=`INSERT INTO wine_reference_sync_state(source,source_version,source_hash,source_updated_at,rows_seen,rows_written,rows_redirected,rows_rejected,status,updated_at)
VALUES('lwin',${sqlLiteral(basename(inputPath))},${sqlLiteral(hash)},${sqlLiteral(latest||null)},${rows.length-1},${accepted},${redirected},${rejected},'complete',${sqlLiteral(importedAt)})
ON CONFLICT(source) DO UPDATE SET source_version=excluded.source_version,source_hash=excluded.source_hash,source_updated_at=excluded.source_updated_at,rows_seen=excluded.rows_seen,rows_written=excluded.rows_written,rows_redirected=excluded.rows_redirected,rows_rejected=excluded.rows_rejected,status=excluded.status,updated_at=excluded.updated_at;\n`;
await writeFile(join(outputDir,'lwin-sync-state.sql'),state,'utf8');
await writeFile(join(outputDir,'manifest.json'),JSON.stringify({source:basename(inputPath),sha256:hash,rows:rows.length-1,accepted,rejected,redirected,latestSourceUpdate:latest||null,files:[...files,'lwin-sync-state.sql']},null,2)+'\n','utf8');
console.log(`Prepared ${accepted} LWIN rows in ${files.length} D1 SQL chunks (${rejected} rejected). Output: ${outputDir}`);
