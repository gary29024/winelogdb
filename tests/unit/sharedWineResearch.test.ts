import { afterEach,describe,expect,it } from 'vitest';
import { migratedSqliteD1 } from './support/sqliteD1';
import { producerEntry } from './support/researchFixture';
import { wineRowResearchTargets,upsertResearchCache } from '../../src/lib/research/cache';
import { canReadShared,sharedWineResearch } from '../../worker/multiUser/social';

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
});
