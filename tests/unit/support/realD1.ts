import { DatabaseSync,type SQLInputValue } from 'node:sqlite';
import { readFileSync,readdirSync } from 'node:fs';
export function realD1(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const file of readdirSync('src/lib/db/migrations').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(`src/lib/db/migrations/${file}`,'utf8'));
 let reads=0,writes=0;
 function statement(query:string,args:SQLInputValue[]=[]){
  const first=async(column?:string)=>{reads++;const row=sql.prepare(query).get(...args);return column?row?.[column]??null:row??null};
  const all=async()=>{reads++;return {results:sql.prepare(query).all(...args),success:true,meta:{}}};
  const run=async()=>{writes++;const result=sql.prepare(query).run(...args);return {success:true,results:[],meta:{changes:Number(result.changes)}}};
  return {bind:(...values:SQLInputValue[])=>statement(query,values),first,all,run,raw:async()=>[]};
 }
 let transactions=Promise.resolve();
 const db={prepare:statement,batch:(items:Array<{run:()=>Promise<unknown>}>)=>{const result=transactions.then(async()=>{sql.exec('BEGIN');try{const out=[];for(const item of items)out.push(await item.run());sql.exec('COMMIT');return out}catch(error){sql.exec('ROLLBACK');throw error}});transactions=result.then(()=>undefined,()=>undefined);return result}};
 return {sql,db:db as unknown as D1Database,counts:()=>({reads,writes}),close:()=>sql.close()};
}
