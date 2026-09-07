import { readFileSync,readdirSync } from 'node:fs';
import { DatabaseSync,type SQLInputValue } from 'node:sqlite';
import { describe,expect,it } from 'vitest';
import { mergeProducerEntities,unlinkProducerMerge } from '../../src/lib/producers/merge';
import { profileIsFresh } from '../../src/lib/producers/batchResearch';

// Exercise the actual INSERT and UPDATE bindings against the migrated schema.
function database(){
  const sql=new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys=ON');
  for(const file of readdirSync('src/lib/db/migrations').filter(file=>file.endsWith('.sql')).sort())
    sql.exec(readFileSync(`src/lib/db/migrations/${file}`,'utf8'));
  function statement(query:string,args:SQLInputValue[]=[]){
    return {
      bind:(...values:SQLInputValue[])=>statement(query,values),
      first:async()=>sql.prepare(query).get(...args)??null,
      all:async()=>({results:sql.prepare(query).all(...args)}),
      run:async()=>({meta:sql.prepare(query).run(...args)})
    };
  }
  const db={prepare:statement,batch:async(items:Array<{run:()=>Promise<unknown>}>)=>{
    sql.exec('BEGIN');
    try{const results=[];for(const item of items)results.push(await item.run());sql.exec('COMMIT');return results}
    catch(error){sql.exec('ROLLBACK');throw error}
  }};
  return {sql,db:db as unknown as D1Database};
}

describe('profile dates after undoing a producer merge',()=>{
  it.each(['dated','undated','legacy'] as const)('restores both profiles from %s snapshots',async mode=>{
    const {sql,db}=database();
    try{
      const stamp=new Date().toISOString();
      const sourceDate=mode==='undated'?null:stamp;
      for(const [id,date] of [['dest',stamp],['src',sourceDate]])
        sql.prepare(`INSERT INTO producers(id,owner_id,canonical_name,match_key,home_country,profile,researched_at,profile_researched_at,created_at,updated_at)
          VALUES(?,'owner',?,?,'France',?,?,?,?,?)`).run(id,id,id,`Profile ${id}`,stamp,date,stamp,stamp);
      const result=await mergeProducerEntities(db,'owner','dest','src');
      if(mode==='legacy'){
        const row=sql.prepare('SELECT source_snapshot_json,destination_snapshot_json FROM producer_merges WHERE id=?').get(result.mergeId)!;
        const snapshots=['source_snapshot_json','destination_snapshot_json'].map(column=>{
          const snapshot=JSON.parse(String(row[column]));delete snapshot.profile_researched_at;return JSON.stringify(snapshot);
        });
        sql.prepare('UPDATE producer_merges SET source_snapshot_json=?,destination_snapshot_json=? WHERE id=?').run(...snapshots,result.mergeId);
      }
      await unlinkProducerMerge(db,'owner','dest',result.mergeId);
      const source=sql.prepare("SELECT profile,home_country,profile_researched_at FROM producers WHERE id='src'").get()!;
      const destination=sql.prepare("SELECT profile,home_country,profile_researched_at FROM producers WHERE id='dest'").get()!;
      expect(source.profile).toBe('Profile src');
      expect(source.profile_researched_at).toBe(mode==='legacy'?null:sourceDate);
      expect(profileIsFresh(source)).toBe(mode==='dated');
      expect(destination.profile).toBe('Profile dest');
      expect(destination.profile_researched_at).toBe(mode==='legacy'?null:stamp);
    }finally{sql.close()}
  });
});
