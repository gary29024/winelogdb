import { spawnSync } from 'node:child_process';
import { mkdir,writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ReferenceManifest,ReferenceProvider } from '../src/lib/wine/referenceCatalog';

export const DEFAULT_REFERENCE_BUCKET='winelog-private';

export function flag(name:string){
 const exact=`--${name}`;return process.argv.includes(exact);
}
export function option(name:string){
 const prefix=`--${name}=`;const arg=process.argv.find(value=>value.startsWith(prefix));return arg?.slice(prefix.length)??null;
}
export function positional(){
 return process.argv.slice(2).filter(value=>!value.startsWith('--'));
}
function npx(){return process.platform==='win32'?'npx.cmd':'npx'}
export function wrangler(args:string[]){
 const result=spawnSync(npx(),['wrangler',...args],{stdio:'inherit',shell:false});
 if(result.error)throw result.error;
 if(result.status!==0)throw new Error(`wrangler ${args.join(' ')} failed with exit code ${result.status}`);
}
export async function writeShardFiles<T>(provider:ReferenceProvider,version:string,shards:Map<string,T[]>,manifest:ReferenceManifest,extra:Record<string,unknown>={}){
 const dir=join('.tmp',`${provider}-reference`,version);await mkdir(dir,{recursive:true});
 const files:string[]=[];
 for(const [id,rows] of [...shards.entries()].sort(([a],[b])=>a.localeCompare(b))){
  const path=join(dir,`shard-${id}.json`);await writeFile(path,JSON.stringify(rows),'utf8');files.push(path);
 }
 for(const [name,value] of Object.entries(extra)){const path=join(dir,name);await writeFile(path,JSON.stringify(value),'utf8');files.push(path)}
 const manifestPath=join(dir,'manifest.json');await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');
 return {dir,files,manifestPath};
}
export function uploadReferenceFiles(provider:ReferenceProvider,version:string,files:string[],manifestPath:string,bucket=DEFAULT_REFERENCE_BUCKET){
 const prefix=`reference/${provider}/versions/${version}`;
 for(const file of files){
  const name=file.split(/[\\/]/).pop()!;
  wrangler(['r2','object','put',`${bucket}/${prefix}/${name}`,'--remote','--file',file,'--content-type','application/json','--force']);
 }
 wrangler(['r2','object','put',`${bucket}/${prefix}/manifest.json`,'--remote','--file',manifestPath,'--content-type','application/json','--force']);
 wrangler(['r2','object','put',`${bucket}/reference/${provider}/current.json`,'--remote','--file',manifestPath,'--content-type','application/json','--force']);
}
export function recordSyncState(source:string,manifest:ReferenceManifest,counts:{seen:number;written:number;redirected?:number;rejected?:number}){
 const q=(value:string|null)=>value==null?'NULL':`'${value.replace(/'/g,"''")}'`;
 const sql=`INSERT INTO wine_reference_sync_state(source,source_version,source_hash,source_updated_at,rows_seen,rows_written,rows_redirected,rows_rejected,status,updated_at)
 VALUES(${q(source)},${q(manifest.source)},${q(manifest.version)},${q(manifest.sourceUpdatedAt)},${counts.seen},${counts.written},${counts.redirected??0},${counts.rejected??0},'complete',${q(manifest.generatedAt)})
 ON CONFLICT(source) DO UPDATE SET source_version=excluded.source_version,source_hash=excluded.source_hash,source_updated_at=excluded.source_updated_at,rows_seen=excluded.rows_seen,rows_written=excluded.rows_written,rows_redirected=excluded.rows_redirected,rows_rejected=excluded.rows_rejected,status=excluded.status,updated_at=excluded.updated_at;`;
 wrangler(['d1','execute','DB','--remote','--command',sql,'--yes']);
}
