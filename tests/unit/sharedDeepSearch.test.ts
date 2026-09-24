import { afterEach,describe,expect,it } from 'vitest';
import { migratedSqliteD1 } from './support/sqliteD1';
import { producerEntry } from './support/researchFixture';
import { adoptFriendResearch,loadResearchCache,upsertResearchCache,wineRowResearchTargets } from '../../src/lib/research/cache';
import { readableWine,withSourceResearch } from '../../src/lib/research/readableWine';
import { createWineResearchRun } from '../../src/lib/research/backgroundJobs';
import { plannedUnits } from '../../worker/multiUser/credits';

const databases:Array<ReturnType<typeof migratedSqliteD1>>=[];
afterEach(()=>{for(const state of databases.splice(0))state.sqlite.close()});

function setup(){
  const state=migratedSqliteD1();databases.push(state);
  state.sqlite.exec(`INSERT INTO app_users(id,email,display_name,role) VALUES('member','m@example.test','Member','member'),('stranger','s@example.test','Stranger','member');
    INSERT INTO friendships(user_id,friend_id) VALUES('member','owner'),('owner','member');
    INSERT INTO wines(id,owner_id,producer,wine_name,vintage,country,region,appellation,wine_style,created_at,updated_at)
      VALUES('w1','owner','Domaine Dujac','Clos de la Roche',2019,'France','Burgundy','Clos de la Roche','red','2026-09-01','2026-09-01'),
            ('private','owner','Domaine Dujac','Unshared',2019,'France','Burgundy','Morey-Saint-Denis','red','2026-09-01','2026-09-01');
    INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('w1','owner','member');`);
  return state;
}
const planned=(db:D1Database,user:string,wineId:string,refresh='none')=>plannedUnits(new Request(`https://x/api/wines/${wineId}/deep-search`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmation:'RUN_DEEP_SEARCH',refresh})}),db,user);
async function ownerProducerResearch(db:D1Database){
  const row=(await readableWine(db,'owner','w1'))!,targets=wineRowResearchTargets(row);
  await upsertResearchCache(db,'owner',producerEntry(targets.find(target=>target.scope==='producer')!));
  return targets;
}

describe('Deep Search on a shared wine',()=>{
  it('reads a wine for research only when it is the reader’s own or shared with them',async()=>{
    const {db,sqlite}=setup();
    expect((await readableWine(db,'owner','w1'))?.source_owner_id).toBe('owner');
    expect((await readableWine(db,'member','w1'))?.source_owner_id).toBe('owner');
    expect(await readableWine(db,'member','private')).toBeNull();
    expect(await readableWine(db,'stranger','w1')).toBeNull();
    sqlite.exec("DELETE FROM wine_shares WHERE wine_id='w1'");
    expect(await readableWine(db,'member','w1')).toBeNull();
  });

  it('charges the recipient only for sections the owner has not researched',async()=>{
    const {db}=setup();await ownerProducerResearch(db);
    const scopes=(await planned(db,'member','w1')).map(unit=>unit.scope);
    expect(scopes).not.toContain('producer');
    expect(scopes.length).toBeGreaterThan(0);
    await expect(planned(db,'member','private')).rejects.toThrow('Wine not found');
    await expect(planned(db,'stranger','w1')).rejects.toThrow('Wine not found');
  });

  it('prices a vintage refresh as the vintage sections plus anything still missing, never what the owner has',async()=>{
    const {db}=setup();await ownerProducerResearch(db);
    expect((await planned(db,'member','w1','vintage')).map(unit=>unit.scope).sort()).toEqual(['terroir','vintage_context','wine_vintage']);
  });

  it('files the run under the recipient, and refuses a wine that is not shared',async()=>{
    const {db,sqlite}=setup();
    expect((await createWineResearchRun(db,'member','w1','none'))?.created).toBe(true);
    expect(sqlite.prepare("SELECT owner_id FROM wine_research_runs WHERE wine_id='w1'").get()).toMatchObject({owner_id:'member'});
    expect(await createWineResearchRun(db,'member','private','none')).toBeNull();
  });

  it('keeps the owner’s research credited to the owner, and never overwrites it',async()=>{
    const {db,sqlite}=setup(),targets=await ownerProducerResearch(db);
    const cache=await withSourceResearch(db,'member','owner',targets,await loadResearchCache(db,'member',targets));
    expect(cache.get('producer')?.contributorId).toBe('owner');
    await adoptFriendResearch(db,'member',cache);
    expect(sqlite.prepare("SELECT source_user_id FROM research_cache WHERE owner_id='member' AND scope='producer'").get()).toMatchObject({source_user_id:'owner'});
    // Adopting never republishes under the recipient's name.
    expect(sqlite.prepare("SELECT count(*) AS n FROM reusable_research WHERE contributor_id='member'").get()).toMatchObject({n:0});
    // The owner's own row is untouched and still theirs.
    expect(sqlite.prepare("SELECT source_user_id FROM research_cache WHERE owner_id='owner' AND scope='producer'").get()).toMatchObject({source_user_id:null});
  });

  it('skips the owner’s scopes the recipient is refreshing',async()=>{
    const {db}=setup(),targets=await ownerProducerResearch(db);
    const cache=await withSourceResearch(db,'member','owner',targets,new Map(),new Set(['producer']));
    expect(cache.has('producer')).toBe(false);
  });
});
