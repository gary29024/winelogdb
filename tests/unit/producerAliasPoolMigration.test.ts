import { afterEach,describe,expect,it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const open:DatabaseSync[]=[];
afterEach(()=>{while(open.length)open.pop()?.close()});

function fixture(){
  const db=new DatabaseSync(':memory:');open.push(db);db.exec('PRAGMA foreign_keys=ON');
  db.exec(`
    CREATE TABLE app_users(id TEXT PRIMARY KEY);
    CREATE TABLE producers(owner_id TEXT NOT NULL,id TEXT NOT NULL,match_key TEXT NOT NULL,PRIMARY KEY(owner_id,id));
    CREATE TABLE producer_aliases(owner_id TEXT NOT NULL,normalized_alias TEXT NOT NULL,producer_id TEXT NOT NULL);
    CREATE TABLE producer_merges(owner_id TEXT NOT NULL,source_match_key TEXT NOT NULL,destination_producer_id TEXT NOT NULL,undone_at TEXT);
  `);
  return db;
}

const migrate=(db:DatabaseSync)=>db.exec(readFileSync('src/lib/db/migrations/0068_producer_alias_pool.sql','utf8'));

describe('0068 producer alias pool migration',()=>{
  it('seeds valid accounts while skipping stale legacy owner ids',()=>{
    const db=fixture();
    db.exec(`
      INSERT INTO app_users(id) VALUES('alice');
      INSERT INTO producers(owner_id,id,match_key) VALUES
        ('alice','p1','chateau margaux'),
        ('ghost','p2','domaine ghost');
      INSERT INTO producer_aliases(owner_id,normalized_alias,producer_id) VALUES
        ('alice','ch margaux','p1'),
        ('ghost','ghost alias','p2');
    `);

    expect(()=>migrate(db)).not.toThrow();
    expect(db.prepare('SELECT owner_id,normalized_alias,producer_key FROM producer_alias_pool ORDER BY owner_id').all()).toEqual([
      {owner_id:'alice',normalized_alias:'ch margaux',producer_key:'chateau margaux'}
    ]);
  });

  it('applies the same account guard to merge-history seeds',()=>{
    const db=fixture();
    db.exec(`
      INSERT INTO app_users(id) VALUES('alice');
      INSERT INTO producers(owner_id,id,match_key) VALUES
        ('alice','p1','chateau margaux'),
        ('ghost','p2','domaine ghost');
      INSERT INTO producer_merges(owner_id,source_match_key,destination_producer_id,undone_at) VALUES
        ('alice','ch margaux','p1',NULL),
        ('ghost','ghost alias','p2',NULL);
    `);

    expect(()=>migrate(db)).not.toThrow();
    expect(db.prepare('SELECT owner_id,normalized_alias,producer_key FROM producer_alias_pool ORDER BY owner_id').all()).toEqual([
      {owner_id:'alice',normalized_alias:'ch margaux',producer_key:'chateau margaux'}
    ]);
  });
});
