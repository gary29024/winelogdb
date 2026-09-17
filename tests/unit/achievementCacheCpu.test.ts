import { readFileSync,readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach,beforeEach,describe,expect,it } from 'vitest';

const migrations='src/lib/db/migrations/';
let db:DatabaseSync;

beforeEach(()=>{
  db=new DatabaseSync(':memory:');
  for(const file of readdirSync(migrations).filter(file=>file.endsWith('.sql')).sort())db.exec(readFileSync(migrations+file,'utf8'));
  db.exec(`INSERT INTO producers(id,owner_id,canonical_name,match_key,profile,created_at,updated_at)
    VALUES('p1','owner','Domaine Test','domaine test','','2026-01-01','2026-01-01');
    INSERT INTO wines(id,owner_id,producer,wine_name,producer_id,vintage,rating,created_at,updated_at)
    VALUES('w1','owner','Domaine Test','Test Wine','p1',2020,90,'2026-01-01','2026-01-01');`);
});
afterEach(()=>db.close());

const revision=()=>Number(db.prepare("SELECT revision FROM achievement_cache_state WHERE owner_id='owner'").get()?.revision??0);

describe('achievement cache CPU invalidation scope',()=>{
  it('does not invalidate progress for producer research-only fields',()=>{
    const before=revision();
    db.exec("UPDATE producers SET profile='new profile',updated_at='2026-02-01' WHERE id='p1'");
    expect(revision()).toBe(before);
  });

  it('still invalidates when producer identity or geography changes',()=>{
    const before=revision();
    db.exec("UPDATE producers SET canonical_name='Domaine Test 2' WHERE id='p1'");
    expect(revision()).toBe(before+1);
  });

  it('does not invalidate for rating-only wine edits but does for achievement fields',()=>{
    const before=revision();
    db.exec("UPDATE wines SET rating=95,updated_at='2026-02-01' WHERE id='w1'");
    expect(revision()).toBe(before);
    db.exec("UPDATE wines SET vintage=2021 WHERE id='w1'");
    expect(revision()).toBe(before+1);
  });
});
