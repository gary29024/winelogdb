import { afterEach,describe,expect,it } from 'vitest';
import { migratedSqliteD1 } from './support/sqliteD1';
import { producerEntry } from './support/researchFixture';
import { wineRowResearchTargets,upsertResearchCache } from '../../src/lib/research/cache';
import { canReadShared,sharedWineResearch } from '../../worker/multiUser/social';
import { recordSharedResearchComplete,sharedResearchForReader } from '../../src/lib/research/readableWine';
import { listJournalPage } from '../../src/lib/journal/list';

const databases:Array<ReturnType<typeof migratedSqliteD1>>=[];
afterEach(()=>{for(const state of databases.splice(0))state.sqlite.close()});

function setup(){
  const state=migratedSqliteD1();databases.push(state);
  state.sqlite.exec(`INSERT INTO app_users(id,email,display_name,role) VALUES('member','m@example.test','Member','member');
    INSERT INTO friendships(user_id,friend_id) VALUES('member','owner'),('owner','member');
    INSERT INTO wines(id,owner_id,producer,wine_name,vintage,country,region,appellation,wine_style,created_at,updated_at)
      VALUES('w1','owner','Domaine Dujac','Clos de la Roche',2019,'France','Burgundy','Clos de la Roche','red','2026-09-01','2026-09-01');
    INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('w1','owner','member');`);
  return state;
}

describe('research on a shared bottle',()=>{
  it('shows the owner’s partial research, marked partial, without private diagnostics',async()=>{
    const {db}=setup(),row=(await canReadShared(db,'member','w1'))!;
    const producer=wineRowResearchTargets(row).find(target=>target.scope==='producer')!;
    await upsertResearchCache(db,'owner',producerEntry(producer));
    const deep=await sharedWineResearch(db,'member',row);
    expect(deep?.producerDetails).toContain('Morey-Saint-Denis');
    expect(deep?.complete).toBe(false);
    expect(deep).not.toHaveProperty('model');
    expect(deep).not.toHaveProperty('quality');
    expect(deep).not.toHaveProperty('provenance');
  });

  it('shows nothing when neither account has researched the bottle',async()=>{
    const {db}=setup(),row=(await canReadShared(db,'member','w1'))!;
    expect(await sharedWineResearch(db,'member',row)).toBeNull();
  });

  it('calls the owner’s research shared, and the reader’s own research theirs',async()=>{
    const {db}=setup(),row=(await canReadShared(db,'member','w1'))!;
    await upsertResearchCache(db,'owner',producerEntry(wineRowResearchTargets(row).find(target=>target.scope==='producer')!));
    expect((await sharedWineResearch(db,'member',row))?.origin).toBe('shared');
    const {targets}=await sharedResearchForReader(db,'member',row as typeof row&{owner_id:unknown});
    await upsertResearchCache(db,'member',producerEntry(targets.find(target=>target.scope==='producer')!));
    expect((await sharedWineResearch(db,'member',row))?.origin).toBe('yours');
  });

  it('marks the bottle researched in the reader’s journal once the reader completes it',async()=>{
    const {db}=setup();
    const marked=async()=>(await listJournalPage(db,'member',{},[],true)).items.find(item=>item.id==='w1')?.researchComplete;
    expect(await marked()).toBe(false);
    await recordSharedResearchComplete(db,'member','owner','w1',true);
    expect(await marked()).toBe(true);
    expect((await listJournalPage(db,'member',{research:'complete'},[],true)).items.map(item=>item.id)).toEqual(['w1']);
    await recordSharedResearchComplete(db,'member','owner','w1',false);
    expect(await marked()).toBe(false);
    // The owner's own journal is untouched by the reader's flag.
    expect((await listJournalPage(db,'owner',{},[],true)).items.find(item=>item.id==='w1')?.researchComplete).toBe(false);
  });
});
