import { readFileSync,readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe,expect,it } from 'vitest';
import { profileIsFresh } from '../../src/lib/producers/batchResearch';

const BACKFILL='0053_backfill_profile_researched_at.sql';
const files=readdirSync('src/lib/db/migrations').filter(name=>name.endsWith('.sql')).sort();

/** The database as it stood the moment before the backfill ran. */
function beforeBackfill(){
  const sql=new DatabaseSync(':memory:');
  for(const file of files.slice(0,files.indexOf(BACKFILL)))
    sql.exec(readFileSync(`src/lib/db/migrations/${file}`,'utf8'));
  return sql;
}

const stamp='2026-09-01T00:00:00.000Z';
const producer=(sql:DatabaseSync,id:string,model:string|null,researched:string|null=stamp,profile='An estate.')=>
  sql.prepare(`INSERT INTO producers(id,owner_id,canonical_name,match_key,home_country,profile,research_model,researched_at,created_at,updated_at)
    VALUES(?,'owner',?,?,'France',?,?,?,?,?)`).run(id,id,id,profile,model,researched,stamp,stamp);

describe('recovering the profile dates that can be recovered',()=>{
  it('dates a profile whose own save wrote the timestamp, and leaves the rest alone',()=>{
    const sql=beforeBackfill();
    try{
      producer(sql,'profile-last','gemini-3.8-flash (batch profile)');
      producer(sql,'catalog-last','gemini-3.8-flash + x (atomic bounded catalog)');
      producer(sql,'never-researched',null,null);
      producer(sql,'no-profile-text','gemini-3.8-flash (batch profile)',stamp,'   ');
      sql.exec(readFileSync(`src/lib/db/migrations/${BACKFILL}`,'utf8'));
      const dates=Object.fromEntries(sql.prepare('SELECT id,profile_researched_at FROM producers').all()
        .map(row=>[String(row.id),row.profile_researched_at]));
      expect(dates['profile-last'],'the profile save wrote this timestamp itself').toBe(stamp);
      expect(dates['catalog-last'],'a catalog refresh may have moved this one on').toBeNull();
      expect(dates['never-researched']).toBeNull();
      expect(dates['no-profile-text'],'a date without a profile would say a blank one is current').toBeNull();
    }finally{sql.close()}
  });

  it('does not touch a profile that has already been dated',()=>{
    const sql=beforeBackfill();
    try{
      producer(sql,'already','gemini-3.8-flash (batch profile)');
      sql.prepare("UPDATE producers SET profile_researched_at='2026-05-05T00:00:00.000Z' WHERE id='already'").run();
      sql.exec(readFileSync(`src/lib/db/migrations/${BACKFILL}`,'utf8'));
      expect(sql.prepare("SELECT profile_researched_at AS at FROM producers WHERE id='already'").get()!.at)
        .toBe('2026-05-05T00:00:00.000Z');
    }finally{sql.close()}
  });

  it('spares the recovered producer its next profile research',()=>{
    // The point of the whole thing: a producer researched a month ago is
    // current again, and its next run asks for the range alone.
    const sql=beforeBackfill();
    try{
      producer(sql,'recent','gemini-3.8-flash (batch profile)',new Date(Date.now()-30*24*60*60*1000).toISOString());
      sql.exec(readFileSync(`src/lib/db/migrations/${BACKFILL}`,'utf8'));
      const row=sql.prepare("SELECT profile,home_country,profile_researched_at FROM producers WHERE id='recent'").get()!;
      expect(profileIsFresh(row)).toBe(true);
    }finally{sql.close()}
  });

  it('is re-runnable, because a migration that is applied twice must not undo itself',()=>{
    const sql=beforeBackfill();
    try{
      producer(sql,'profile-last','gemini-3.8-flash (batch profile)');
      const backfill=readFileSync(`src/lib/db/migrations/${BACKFILL}`,'utf8');
      sql.exec(backfill);sql.exec(backfill);
      expect(sql.prepare("SELECT profile_researched_at AS at FROM producers WHERE id='profile-last'").get()!.at).toBe(stamp);
    }finally{sql.close()}
  });
});
