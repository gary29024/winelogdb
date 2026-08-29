import { describe,expect,it } from 'vitest';
import { createD1Stub } from './support/d1Stub';
import { TASTING_STALE_MS,closeOpenTastingIfDayChanged,endTasting,readActiveTasting,reopenTasting,settleStaleTasting,
  startTasting,tastingLooksStale,touchTastingActivity,type Tasting } from '../../src/lib/tastings/session';

const row=(over:Record<string,unknown>={})=>({
  id:'t1',name:'Burgundy portfolio',tasting_date:'2026-08-28',venue:'Clubhouse',
  started_at:'2026-08-28T10:00:00.000Z',ended_at:null,last_wine_at:null,
  created_at:'2026-08-28T10:00:00.000Z',updated_at:'2026-08-28T10:00:00.000Z',...over
});

const tasting=(over:Partial<Tasting>={}):Tasting=>({
  id:'t1',name:'Burgundy portfolio',tastingDate:'2026-08-28',venue:null,
  startedAt:'2026-08-28T10:00:00.000Z',endedAt:null,lastWineAt:null,
  createdAt:'2026-08-28T10:00:00.000Z',updatedAt:'2026-08-28T10:00:00.000Z',...over
});

describe('starting a tasting',()=>{
  it('closes whatever was open in the same batch as the insert',async()=>{
    // The partial unique index allows exactly one open tasting per owner, so a
    // start that closed the previous one in a separate round trip would fail
    // against its own invariant halfway through.
    const stub=createD1Stub(sql=>/SELECT \* FROM tastings/.test(sql)?{first:row()}:undefined);
    await startTasting(stub.db,'owner',{name:'Burgundy portfolio',tastingDate:'2026-08-28'});
    const statements=stub.sql();
    const close=statements.findIndex(sql=>/^UPDATE tastings SET ended_at=\?/.test(sql));
    const insert=statements.findIndex(sql=>/^INSERT INTO tastings/.test(sql));
    expect(close).toBeGreaterThanOrEqual(0);
    expect(insert).toBeGreaterThan(close);
  });

  it('resumes an evening that already has wines rather than failing on its identity',async()=>{
    // "I logged two bottles already, now let me start the tasting properly."
    // resolveTasting has already created (owner, name, date), and the unique
    // index would reject a plain insert.
    const stub=createD1Stub(sql=>/SELECT \* FROM tastings/.test(sql)?{first:row()}:undefined);
    await startTasting(stub.db,'owner',{name:'Burgundy portfolio',tastingDate:'2026-08-28'});
    const insert=stub.sql().find(sql=>/^INSERT INTO tastings/.test(sql))??'';
    expect(insert).toContain("ON CONFLICT(owner_id,name,coalesce(tasting_date,''))");
    expect(insert).toContain('ended_at=NULL');
  });

  it('refuses a tasting with no name or no date',async()=>{
    const stub=createD1Stub();
    await expect(startTasting(stub.db,'owner',{name:'   ',tastingDate:'2026-08-28'})).rejects.toThrow(/name/);
    await expect(startTasting(stub.db,'owner',{name:'Dinner',tastingDate:'  '})).rejects.toThrow(/date/);
    expect(stub.writes()).toHaveLength(0);
  });
});

describe('when an open tasting has gone quiet',()=>{
  const started=Date.parse('2026-08-28T10:00:00.000Z');

  it('is measured from the last wine, not from the start',()=>{
    // A tasting that runs past 3am is still live at 02:45. Measuring elapsed
    // time from the start would end it mid-evening.
    const late=tasting({lastWineAt:'2026-08-28T18:45:00.000Z'});
    expect(tastingLooksStale(late,Date.parse('2026-08-28T20:00:00.000Z'))).toBe(false);
    expect(tastingLooksStale(late,Date.parse('2026-08-29T05:00:00.000Z'))).toBe(true);
  });

  it('holds on either side of the threshold',()=>{
    expect(tastingLooksStale(tasting(),started+TASTING_STALE_MS)).toBe(false);
    expect(tastingLooksStale(tasting(),started+TASTING_STALE_MS+1)).toBe(true);
  });

  it('says nothing about a tasting that is already closed or was never started',()=>{
    expect(tastingLooksStale(tasting({endedAt:'2026-08-28T23:00:00.000Z'}),Date.now())).toBe(false);
    expect(tastingLooksStale(tasting({startedAt:null}),Date.now())).toBe(false);
  });

  it('writes nothing when reading a tasting that is still live',async()=>{
    // Settling is write-on-read, and this read happens on every app load: the
    // JS predicate has to gate the UPDATE or the cheapest page in the app
    // becomes a write.
    const stub=createD1Stub();
    const settled=await settleStaleTasting(stub.db,'owner',tasting({lastWineAt:new Date().toISOString()}));
    expect(stub.writes()).toHaveLength(0);
    expect(settled?.endedAt).toBeNull();
  });

  it('closes it on the way out once it is stale',async()=>{
    const stub=createD1Stub();
    const settled=await settleStaleTasting(stub.db,'owner',tasting({lastWineAt:'2020-01-01T00:00:00.000Z'}));
    expect(stub.writes()).toHaveLength(1);
    expect(settled?.endedAt).toBeTruthy();
  });

  it('reports nothing open once the stale one has been settled',async()=>{
    const stub=createD1Stub(sql=>/SELECT \* FROM tastings WHERE owner_id=\?/.test(sql)
      ?{first:row({last_wine_at:'2020-01-01T00:00:00.000Z'})}:undefined);
    expect(await readActiveTasting(stub.db,'owner')).toBeNull();
  });
});

describe('ending and reopening',()=>{
  it('treats a second end as a success, since two devices can both press it',async()=>{
    const stub=createD1Stub(sql=>/SELECT \* FROM tastings/.test(sql)?{first:row({ended_at:'2026-08-28T23:00:00.000Z'}),changes:0}:{changes:0});
    const first=await endTasting(stub.db,'owner','t1');
    const second=await endTasting(stub.db,'owner','t1');
    expect(first?.endedAt).toBeTruthy();
    expect(second?.endedAt).toBeTruthy();
  });

  it('closes any other open tasting when one is reopened',async()=>{
    const stub=createD1Stub(sql=>/SELECT \* FROM tastings/.test(sql)?{first:row()}:undefined);
    await reopenTasting(stub.db,'owner','t1');
    expect(stub.sql().some(sql=>/^UPDATE tastings SET ended_at=\?.*started_at IS NOT NULL AND ended_at IS NULL/.test(sql))).toBe(true);
  });
});

describe('the close-on-a-different-day rule',()=>{
  it('closes the open tasting only for a date that is not its own',async()=>{
    const stub=createD1Stub();
    await closeOpenTastingIfDayChanged(stub.db,'owner','2026-08-29');
    const statement=stub.writes()[0];
    expect(statement).toBeTruthy();
    // One conditional UPDATE and no read: the comparison is the WHERE clause.
    expect(stub.calls.filter(call=>/^SELECT/.test(call.sql))).toHaveLength(0);
    expect(String(statement.sql).replace(/\s+/g,' ')).toContain("coalesce(tasting_date,'')<>?");
    expect(statement.args[statement.args.length-1]).toBe('2026-08-29');
  });

  it('does nothing at all for a wine with no date',async()=>{
    const stub=createD1Stub();
    await closeOpenTastingIfDayChanged(stub.db,'owner',null);
    expect(stub.calls).toHaveLength(0);
  });

  it('keeps the tasting alive only while it is still open',async()=>{
    const stub=createD1Stub();
    await touchTastingActivity(stub.db,'owner','t1');
    const statement=stub.writes()[0];
    expect(String(statement.sql).replace(/\s+/g,' ')).toContain('started_at IS NOT NULL AND ended_at IS NULL');
    await touchTastingActivity(stub.db,'owner',null);
    expect(stub.writes()).toHaveLength(1);
  });
});
