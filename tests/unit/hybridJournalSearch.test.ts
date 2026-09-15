import { describe,expect,it } from 'vitest';
import { listJournalPage } from '../../src/lib/journal/list';
import { createD1Stub } from './support/d1Stub';
import { migratedSqliteD1 } from './support/sqliteD1';

describe('hybrid Journal search',()=>{
  it('unions semantic candidates with FTS and ranks semantic results first by default',async()=>{
    const stub=createD1Stub(sql=>/count\(\*\)/i.test(sql)?{all:[{total:2}]}:{all:[]});
    const ids=['semantic-2','semantic-1'];
    await listJournalPage(stub.db,'owner',{query:'floral elegant Burgundy'},ids);
    const page=stub.calls.find(call=>/FROM wines w/.test(call.sql)&&/ORDER BY/.test(call.sql));
    expect(page).toBeDefined();
    expect(page!.sql).toContain('wine_search MATCH ?');
    expect(page!.sql).toContain('w.id IN (SELECT CAST(value AS TEXT) FROM json_each(?))');
    expect(page!.sql).toContain('COALESCE((SELECT CAST(key AS INTEGER) FROM json_each(?) WHERE CAST(value AS TEXT)=w.id), 2)');
    expect(page!.args[0]).toBe('owner');
    const packed=JSON.stringify(ids);
    expect(page!.args.filter(value=>value===packed)).toHaveLength(2);
    expect(page!.args).not.toContain('semantic-2');
    expect(page!.args).not.toContain('semantic-1');
  });

  it('keeps the full 72 semantic candidates comfortably below the D1 variable ceiling',async()=>{
    const stub=createD1Stub(sql=>/count\(\*\)/i.test(sql)?{all:[{total:72}]}:{all:[]});
    const ids=Array.from({length:72},(_,index)=>`semantic-${index}`);
    await listJournalPage(stub.db,'owner',{query:'elegant pinot noir',limit:'36',offset:'0'},ids);
    const page=stub.calls.find(call=>/FROM wines w/.test(call.sql)&&/ORDER BY/.test(call.sql));
    const count=stub.calls.find(call=>/count\(\*\)/i.test(call.sql));
    expect(page).toBeDefined();
    expect(count).toBeDefined();
    expect(page!.args).toHaveLength(9);
    expect(count!.args).toHaveLength(6);
    expect(page!.args.filter(value=>value===JSON.stringify(ids))).toHaveLength(2);
    expect(count!.args.filter(value=>value===JSON.stringify(ids))).toHaveLength(1);
  });

  it('executes JSON membership and semantic rank ordering on real SQLite',async()=>{
    const {db,sqlite}=migratedSqliteD1();
    try{
      const insert=sqlite.prepare(`INSERT INTO wines(id,owner_id,producer,wine_name,vintage,country,region,appellation,grapes_json,wine_style,tasting_notes,rating,event,venue,tags_json,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      insert.run('w1','owner','Producer One','First Wine',2019,'France','Burgundy','Volnay','["Pinot Noir"]','red','earthy structured',90,'Dinner','Home','[]','2026-01-01','2026-09-01');
      insert.run('w2','owner','Producer Two','Second Wine',2020,'France','Burgundy','Gevrey-Chambertin','["Pinot Noir"]','red','silky perfumed',92,'Dinner','Home','[]','2026-01-02','2026-09-02');
      insert.run('w3','owner','Producer Three','Third Wine',2021,'France','Burgundy','Chambolle-Musigny','["Pinot Noir"]','red','floral fine tannins',94,'Dinner','Home','[]','2026-01-03','2026-09-03');
      insert.run('w4','owner','Producer Four','Riesling probe',2022,'France','Alsace','Alsace','["Riesling"]','white','floral',96,'Dinner','Home','[]','2026-01-04','2026-09-04');
      insert.run('123','foreign-owner','Other owner','Riesling probe',2022,'France','Alsace','Alsace','["Riesling"]','white','floral',99,'Dinner','Home','[]','2026-01-05','2026-09-05');

      const result=await listJournalPage(db,'owner',{query:'semantic ranking probe'},['w2','w1','w3']);
      expect(result.total).toBe(3);
      expect(result.items.map(item=>item.id)).toEqual(['w2','w1','w3']);
      const hybrid=await listJournalPage(db,'owner',{query:'riesling'},['w2','w1','w3','w2','123']);
      expect(hybrid.total).toBe(4);
      expect(hybrid.items.map(item=>item.id)).toEqual(['w2','w1','w3','w4']);
      const page=await listJournalPage(db,'owner',{query:'riesling',limit:'2',offset:'2'},['w2','w1','w3']);
      expect(page.total).toBe(4);expect(page.items.map(item=>item.id)).toEqual(['w3','w4']);expect(page.nextOffset).toBeNull();
      const sorted=await listJournalPage(db,'owner',{query:'riesling',sort:'rating'},['w2','w1','w3']);
      expect(sorted.items.map(item=>item.id)).toEqual(['w4','w3','w2','w1']);
    }finally{sqlite.close()}
  });

  it('honours an explicit user sort instead of semantic ranking',async()=>{
    const stub=createD1Stub(sql=>/count\(\*\)/i.test(sql)?{all:[{total:1}]}:{all:[]});
    await listJournalPage(stub.db,'owner',{query:'floral elegant Burgundy',sort:'rating'},['semantic-1']);
    const page=stub.calls.find(call=>/FROM wines w/.test(call.sql)&&/ORDER BY/.test(call.sql));
    expect(page).toBeDefined();
    expect(page!.sql).toContain('ORDER BY w.rating DESC');
    expect(page!.sql).not.toContain('SELECT CAST(key AS INTEGER)');
  });
});
