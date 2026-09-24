import { afterEach,describe,expect,it,vi } from 'vitest';
import { migratedSqliteD1 } from './support/sqliteD1';
import { producerEntry } from './support/researchFixture';
import { adoptFriendResearch,loadResearchCache,upsertResearchCache,wineRowResearchTargets } from '../../src/lib/research/cache';
import * as researchCache from '../../src/lib/research/cache';
import { offerToSourceOwner,readableWine,researchWine,withSourceResearch } from '../../src/lib/research/readableWine';
import { buildResearchTargets,type CachedResearch } from '../../src/lib/research/cache';
import { producerMatchKey } from '../../src/lib/producers/entities';
import { canReadShared,sharedWineResearch } from '../../worker/multiUser/social';
import { createWineResearchRun } from '../../src/lib/research/backgroundJobs';
import { plannedUnits } from '../../worker/multiUser/credits';

const databases:Array<ReturnType<typeof migratedSqliteD1>>=[];
afterEach(()=>{for(const state of databases.splice(0))state.sqlite.close();vi.restoreAllMocks()});

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
    const row=await researchWine(db,'member',(await readableWine(db,'member','w1'))!);
    const cache=await withSourceResearch(db,'member',row,targets,await loadResearchCache(db,'member',targets));
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
    const row=await researchWine(db,'member',(await readableWine(db,'member','w1'))!);
    const cache=await withSourceResearch(db,'member',row,targets,new Map(),new Set(['producer']));
    expect(cache.has('producer')).toBe(false);
  });
});

describe('Deep Search on a shared wine: review regressions',()=>{
  const producerRow=(sqlite:ReturnType<typeof migratedSqliteD1>['sqlite'],owner:string,id:string)=>
    sqlite.prepare('INSERT INTO producers(id,owner_id,canonical_name,match_key,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(id,owner,'Domaine Dujac',producerMatchKey('Domaine Dujac'),'2026-09-01','2026-09-01');

  it('shows the friends’ research that makes the recipient’s quote free',async()=>{
    const {db,sqlite}=setup();
    sqlite.exec(`INSERT INTO app_users(id,email,display_name,role) VALUES('friend2','f@example.test','Friend','member');
      INSERT INTO friendships(user_id,friend_id) VALUES('member','friend2'),('friend2','member');`);
    // A third friend, not the owner, researched the producer and published it.
    const row=(await readableWine(db,'member','w1'))!;
    const target=buildResearchTargets({producer:row.producer,wineName:row.wine_name,vintage:row.vintage,country:row.country,region:row.region,appellation:row.appellation,wineStyle:row.wine_style}).find(item=>item.scope==='producer')!;
    await upsertResearchCache(db,'friend2',producerEntry(target));
    expect((await planned(db,'member','w1')).map(unit=>unit.scope)).not.toContain('producer');
    const deep=await sharedWineResearch(db,'member',(await canReadShared(db,'member','w1'))!);
    expect(deep?.producerDetails).toContain('Morey-Saint-Denis');
  });

  it('finds research the recipient already paid for under their own producer ID',async()=>{
    const {db,sqlite}=setup();
    producerRow(sqlite,'owner','owner-producer');producerRow(sqlite,'member','member-producer');
    sqlite.exec("UPDATE wines SET producer_id='owner-producer' WHERE id='w1'");
    // The member's own research for the house, keyed by the member's own ID.
    const mine=buildResearchTargets({producer:'Domaine Dujac',producerId:'member-producer',country:'France'}).find(item=>item.scope==='producer')!;
    await upsertResearchCache(db,'member',producerEntry(mine));
    expect((await planned(db,'member','w1')).map(unit=>unit.scope)).not.toContain('producer');
    // Execution keys it the same way: the member's producer, not the owner's.
    expect((await researchWine(db,'member',(await readableWine(db,'member','w1'))!)).producer_id).toBe('member-producer');
  });

  it('hands the recipient’s research for a non-vintage bottle to the owner’s wine, credited to them',async()=>{
    const {db,sqlite}=setup();
    sqlite.exec("UPDATE wines SET vintage=NULL WHERE id='w1'");
    const row=await researchWine(db,'member',(await readableWine(db,'member','w1'))!);
    const readerTargets=researchCache.wineRowResearchTargets(row),exact=readerTargets.find(item=>item.scope==='wine_vintage')!;
    const paid:CachedResearch={target:exact,payload:{summary:'Recipient-funded NV summary',expectedProfile:'',winemakingTechniques:'x',drinkingWindow:'y'},sources:[],model:'m',researchedAt:'2026-09-20T00:00:00.000Z'};
    await offerToSourceOwner(db,'member',row,new Map([['wine_vintage',paid]]));
    const ownerKey=researchCache.wineRowResearchTargets((await readableWine(db,'owner','w1'))!).find(item=>item.scope==='wine_vintage')!.cacheKey;
    expect(sqlite.prepare("SELECT source_user_id,result_json FROM research_cache WHERE owner_id='owner' AND scope='wine_vintage' AND cache_key=?").get(ownerKey))
      .toMatchObject({source_user_id:'member'});
    // Never over the owner's own research, and never offered on as the owner's.
    sqlite.exec("UPDATE research_cache SET result_json='{\"summary\":\"Owner original\"}',source_user_id=NULL WHERE owner_id='owner'");
    await offerToSourceOwner(db,'member',row,new Map([['wine_vintage',{...paid,payload:{...paid.payload,summary:'Second offer'}}]]));
    expect(String((sqlite.prepare("SELECT result_json FROM research_cache WHERE owner_id='owner' AND scope='wine_vintage'").get() as {result_json:string}).result_json)).toContain('Owner original');
    expect(sqlite.prepare("SELECT count(*) AS n FROM reusable_research WHERE contributor_id='owner'").get()).toMatchObject({n:0});
  });

  it('reads the owner’s research with the owner’s snapshot, as the shared page does',async()=>{
    const {db,sqlite}=setup();
    sqlite.exec(`UPDATE wines SET deep_search_json='{"snapshot":true}' WHERE id='w1'`);
    const load=vi.spyOn(researchCache,'loadWineResearchCache');
    const row=await researchWine(db,'member',(await readableWine(db,'member','w1'))!,'{"snapshot":true}');
    await withSourceResearch(db,'member',row,researchCache.wineRowResearchTargets(row),new Map());
    expect(load).toHaveBeenCalledWith(db,'owner',expect.anything(),false,'{"snapshot":true}');
  });
});
