import { DatabaseSync,type SQLInputValue } from 'node:sqlite';
import { readFileSync,readdirSync } from 'node:fs';

/** Real SQLite statements and transaction rollback, with the D1 methods used here. */
export function migratedSqliteD1(){
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  const directory='src/lib/db/migrations';
  for(const file of readdirSync(directory).filter(file=>file.endsWith('.sql')).sort())sqlite.exec(readFileSync(`${directory}/${file}`,'utf8'));
  function statement(sql:string,args:SQLInputValue[]=[]){
    return {
      bind:(...values:SQLInputValue[])=>statement(sql,values),
      first:async()=>sqlite.prepare(sql).get(...args)??null,
      all:async()=>{
        const prepared=sqlite.prepare(sql);
        if(prepared.columns().length)return {success:true,results:prepared.all(...args),meta:{changes:0}};
        const result=prepared.run(...args);
        return {success:true,results:[],meta:{changes:Number(result.changes)}};
      },
      run:async()=>{const result=sqlite.prepare(sql).run(...args);return {success:true,results:[],meta:{changes:Number(result.changes)}}}
    };
  }
  const db={prepare:statement,batch:async(statements:Array<ReturnType<typeof statement>>)=>{
    sqlite.exec('BEGIN');
    try{const results=[];for(const prepared of statements)results.push(await prepared.all());sqlite.exec('COMMIT');return results}
    catch(error){sqlite.exec('ROLLBACK');throw error}
  }} as unknown as D1Database;
  return {db,sqlite};
}
