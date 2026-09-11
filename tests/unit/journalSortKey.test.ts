import { readFileSync,readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach,beforeEach,describe,expect,it } from 'vitest';
import { listJournalPage } from '../../src/lib/journal/list';

const migrations='src/lib/db/migrations/';
let db:DatabaseSync;

/** What the Journal used to compute per row, in the ORDER BY, for every wine. */
const SUBQUERY=`coalesce((SELECT wi.captured_at FROM wine_images wi
  WHERE wi.owner_id=w.owner_id AND wi.wine_id=w.id AND wi.captured_at IS NOT NULL
  ORDER BY CASE WHEN wi.metadata_source='exif' THEN 0 ELSE 1 END,wi.captured_at ASC,wi.rowid ASC LIMIT 1),w.created_at)`;
/** What it reads now. */
const STORED='coalesce(w.photo_sort_at,w.created_at)';

const wine=(id:string,createdAt:string,tastingDate:string|null=null)=>
  db.prepare(`INSERT INTO wines(id,owner_id,producer,wine_name,grapes_json,tasting_notes,tasting_date,created_at,updated_at,tags_json)
    VALUES(?,'owner','P','W','[]','','${tastingDate===null?'':tastingDate}',?,?,'[]')`).run(id,createdAt,createdAt);
const image=(id:string,wineId:string,capturedAt:string|null,source:string)=>
  db.prepare(`INSERT INTO wine_images(id,owner_id,wine_id,object_key,content_type,byte_size,width,height,upload_status,recognition_status,captured_at,metadata_source,created_at)
    VALUES(?,'owner',?,'key-'||?,'image/jpeg',1,400,400,'uploaded','complete',?,?,'2026-02-01')`).run(id,wineId,id,capturedAt,source);
const sortKey=(id:string)=>db.prepare(`SELECT ${STORED} AS k FROM wines w WHERE w.id=?`).get(id)!.k;
const mismatches=()=>Number(db.prepare(`SELECT count(*) AS n FROM wines w WHERE ${STORED} IS NOT ${SUBQUERY}`).get()!.n);

beforeEach(()=>{
  db=new DatabaseSync(':memory:');
  for(const file of readdirSync(migrations).filter(file=>file.endsWith('.sql')).sort())db.exec(readFileSync(migrations+file,'utf8'));
});
afterEach(()=>db.close());

describe('the Journal sort key, kept on the wine',()=>{
  /**
   * Chronology within a day is the photograph's own capture time, and it was a
   * correlated subquery sitting in the ORDER BY. A subquery cannot be indexed,
   * so every one of an owner's wines went through a temp B-tree with all three
   * per-row subqueries evaluated before the LIMIT applied. The column has to
   * answer exactly what that subquery answered, or the Journal reorders itself
   * the day this ships.
   */
  it('answers what the subquery answered, through every shape of evidence',()=>{
    wine('bare','2026-01-01T00:00:00.000Z');
    wine('undated','2026-01-02T00:00:00.000Z');image('u1','undated',null,'none');
    wine('filename','2026-01-03T00:00:00.000Z');image('f1','filename','2025-06-01T00:00:00.000Z','filename');
    wine('exif','2026-01-04T00:00:00.000Z');
    // The exif reading wins even though the other was taken earlier.
    image('e1','exif','2025-06-01T00:00:00.000Z','filename');
    image('e2','exif','2025-09-01T00:00:00.000Z','exif');
    wine('two-exif','2026-01-05T00:00:00.000Z');
    image('t1','two-exif','2025-09-02T00:00:00.000Z','exif');
    image('t2','two-exif','2025-08-02T00:00:00.000Z','exif');

    expect(sortKey('bare'),'no photograph at all falls back to the wine').toBe('2026-01-01T00:00:00.000Z');
    expect(sortKey('undated'),'a photograph with no capture time is no evidence').toBe('2026-01-02T00:00:00.000Z');
    expect(sortKey('filename')).toBe('2025-06-01T00:00:00.000Z');
    expect(sortKey('exif'),'exif beats a guess from a filename').toBe('2025-09-01T00:00:00.000Z');
    expect(sortKey('two-exif'),'and the earliest of the readings that count').toBe('2025-08-02T00:00:00.000Z');
    expect(mismatches(),'every row agrees with the subquery it replaces').toBe(0);
  });

  it('settles again when a photograph is edited, moved or thrown away',()=>{
    wine('a','2026-01-01T00:00:00.000Z');wine('b','2026-01-02T00:00:00.000Z');
    image('x','a','2025-06-01T00:00:00.000Z','filename');
    image('y','a','2025-09-01T00:00:00.000Z','exif');
    expect(sortKey('a')).toBe('2025-09-01T00:00:00.000Z');

    db.exec("DELETE FROM wine_images WHERE id='y'");
    expect(sortKey('a'),'back to the only reading left').toBe('2025-06-01T00:00:00.000Z');

    db.exec("UPDATE wine_images SET captured_at='2024-01-01T00:00:00.000Z' WHERE id='x'");
    expect(sortKey('a'),'a corrected capture time moves the wine').toBe('2024-01-01T00:00:00.000Z');

    db.exec("UPDATE wine_images SET wine_id='b' WHERE id='x'");
    expect(sortKey('a'),'the wine it left falls back to itself').toBe('2026-01-01T00:00:00.000Z');
    expect(sortKey('b'),'and the wine it joined takes it up').toBe('2024-01-01T00:00:00.000Z');

    db.exec("DELETE FROM wine_images WHERE id='x'");
    expect(sortKey('b')).toBe('2026-01-02T00:00:00.000Z');
    expect(mismatches()).toBe(0);
  });

  it('does not rewrite the wine when a new photograph does not change the answer',()=>{
    // A trigger that fired on every photograph would rewrite the wine each time
    // one was added, for a value that had not moved.
    const changes=()=>Number(db.prepare('SELECT total_changes() AS n').get()!.n);
    wine('quiet','2026-01-01T00:00:00.000Z');image('q1','quiet','2025-06-01T00:00:00.000Z','exif');
    wine('moved','2026-01-01T00:00:00.000Z');image('m1','moved','2025-06-01T00:00:00.000Z','exif');

    const beforeQuiet=changes();
    image('q2','quiet','2025-12-01T00:00:00.000Z','exif');
    const quiet=changes()-beforeQuiet;

    const beforeMoved=changes();
    image('m2','moved','2025-01-01T00:00:00.000Z','exif');
    const moved=changes()-beforeMoved;

    expect(sortKey('quiet'),'a later photograph is not the earliest').toBe('2025-06-01T00:00:00.000Z');
    expect(sortKey('moved'),'an earlier one is').toBe('2025-01-01T00:00:00.000Z');
    // One more write is the wine row whose Journal order really changed. Photo
    // chronology is not achievement evidence, so it no longer dirties that cache.
    // The quiet case pays neither, which is the whole point of the guard.
    expect(moved-quiet).toBe(1);
  });

  it('backfills the wines that were already there',()=>{
    // The column arrives on a database full of wines, so the migration has to
    // answer for them too - not only for what is logged after it.
    const fresh=new DatabaseSync(':memory:');
    const files=readdirSync(migrations).filter(file=>file.endsWith('.sql')).sort();
    const cut=files.indexOf('0050_wines_photo_sort_at.sql');
    expect(cut,'the migration under test is in the list').toBeGreaterThan(0);
    for(const file of files.slice(0,cut))fresh.exec(readFileSync(migrations+file,'utf8'));
    fresh.exec(`INSERT INTO wines(id,owner_id,producer,wine_name,grapes_json,tasting_notes,created_at,updated_at,tags_json)
      VALUES('old','owner','P','W','[]','','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z','[]')`);
    fresh.exec(`INSERT INTO wine_images(id,owner_id,wine_id,object_key,content_type,byte_size,width,height,upload_status,recognition_status,captured_at,metadata_source,created_at)
      VALUES('i','owner','old','k','image/jpeg',1,400,400,'uploaded','complete','2025-09-01T00:00:00.000Z','exif','2026-02-01')`);
    fresh.exec(readFileSync(`${migrations}0050_wines_photo_sort_at.sql`,'utf8'));
    expect(fresh.prepare("SELECT photo_sort_at AS k FROM wines WHERE id='old'").get()!.k).toBe('2025-09-01T00:00:00.000Z');
    fresh.close();
  });
});

type CapturedQuery={sql:string;args:unknown[]};
/** Enough of D1 to run the real Journal query against real SQLite. */
const asD1=(real:DatabaseSync,captured:CapturedQuery[]=[] )=>{
  const statement=(sql:string,args:unknown[]):Record<string,unknown>=>({
    bind:(...next:unknown[])=>statement(sql,next),
    all:async()=>{captured.push({sql,args:[...args]});return {results:real.prepare(sql).all(...args as never[]),success:true}},
    first:async()=>real.prepare(sql).get(...args as never[])??null,
    run:async()=>({success:true,meta:{changes:Number(real.prepare(sql).run(...args as never[]).changes)}})
  });
  return {prepare:(sql:string)=>statement(sql,[]),
    batch:async(statements:Array<{all:()=>Promise<unknown>}>)=>Promise.all(statements.map(item=>item.all()))} as unknown as D1Database;
};

describe('what the Journal page actually costs',()=>{
  const plan=(sql:string)=>db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map(row=>String(row.detail)).join(' | ');

  it('the real newest and oldest page queries walk the index instead of sorting the whole library',async()=>{
    for(const sort of ['newest','oldest'] as const){
      const captured:CapturedQuery[]=[];
      await listJournalPage(asD1(db,captured),'owner',{sort,limit:'36'});
      const page=captured.find(item=>item.sql.includes('SELECT w.id,w.producer,w.wine_name'));
      expect(page,`${sort} page query was captured`).toBeDefined();
      const rows=db.prepare(`EXPLAIN QUERY PLAN ${page!.sql}`).all(...page!.args as never[]);
      const root=rows.filter(row=>Number(row.parent)===0).map(row=>String(row.detail)).join(' | ');
      expect(root).toContain('idx_wines_owner_journal_order');
      expect(root,'the main page must not sort the full candidate set').not.toContain('TEMP B-TREE FOR ORDER BY');
    }
  });

  it('is the tiebreakers that decide it, which is why 0044 never fired',()=>{
    // Ordering by the date alone always could use an index; adding created_at
    // and id made SQLite drop it and sort everything, before photo_sort_at was
    // even considered.
    const sorted=plan("SELECT w.id FROM wines w WHERE w.owner_id='owner' ORDER BY coalesce(w.tasting_date,w.created_at) DESC, w.created_at DESC, w.id DESC LIMIT 36");
    expect(sorted).toContain('idx_wines_owner_journal_order');
    expect(sorted).not.toContain('TEMP B-TREE FOR ORDER BY');
  });
});

describe('the order the Journal actually returns',()=>{
  /**
   * The page query is what ships, so the check that matters is not that the
   * column agrees with the subquery but that the list comes back in the same
   * order it did before - run through listJournalPage itself, against real
   * SQLite with every migration applied.
   */
  const ORDER=[
    "coalesce(w.tasting_date,w.created_at) DESC",
    SUBQUERY+" DESC","w.created_at DESC","w.id DESC"
  ].join(',');
  const asItWas=(limit:number,offset:number)=>db.prepare(
    `SELECT w.id FROM wines w WHERE w.owner_id='owner' ORDER BY ${ORDER} LIMIT ? OFFSET ?`).all(limit,offset).map(row=>String(row.id));

  beforeEach(()=>{
    // Days that repeat, so the photograph tiebreaker decides real orderings;
    // wines with no photograph, undated photographs and both sources.
    for(let index=1;index<=120;index++){
      const day=`2026-0${1+(index%3)}-1${index%5}`;
      wine(`w${index}`,`2026-01-01T00:0${index%6}:00.000Z`,index%4===0?null:day);
      if(index%7)image(`p${index}`,`w${index}`,index%5===0?null:`2025-0${1+(index%9)}-01T00:00:00.000Z`,index%2?'exif':'filename');
      if(index%6===0)image(`q${index}`,`w${index}`,`2025-0${1+(index%4)}-02T00:00:00.000Z`,'exif');
    }
  });

  it('returns exactly the order the subquery returned, page after page',async()=>{
    for(const offset of [0,36,72,108]){
      const page=await listJournalPage(asD1(db),'owner',{limit:'36',offset:String(offset)});
      expect(page.items.map(item=>item.id),`page at ${offset}`).toEqual(asItWas(36,offset));
    }
  });

  it('counts what it says it counts',async()=>{
    const page=await listJournalPage(asD1(db),'owner',{});
    expect(page.total).toBe(120);
  });

  it('holds for oldest first as well',async()=>{
    const oldest=db.prepare(`SELECT w.id FROM wines w WHERE w.owner_id='owner'
      ORDER BY coalesce(w.tasting_date,w.created_at) ASC,${SUBQUERY} ASC,w.created_at ASC,w.id ASC LIMIT 36`).all().map(row=>String(row.id));
    const page=await listJournalPage(asD1(db),'owner',{sort:'oldest',limit:'36'});
    expect(page.items.map(item=>item.id)).toEqual(oldest);
  });
});
