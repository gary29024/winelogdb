import { describe,expect,it } from 'vitest';
import { realD1 } from './support/realD1';
import { buildResearchTargets,loadResearchCache,upsertResearchCache,type CachedResearch } from '../../src/lib/research/cache';

const wine={producer:'Domaine Dujac',wineName:'Clos de la Roche',vintage:2019,country:'France',region:'Burgundy',appellation:'Clos de la Roche',wineStyle:'red'};
const seed=(sql:ReturnType<typeof realD1>['sql'],id:string)=>
  sql.exec(`INSERT INTO app_users(id,email,display_name,role) VALUES('${id}','${id}@e.com','${id}','member') ON CONFLICT(id) DO NOTHING`);
const befriend=(sql:ReturnType<typeof realD1>['sql'],a:string,b:string)=>
  sql.exec(`INSERT INTO friendships(user_id,friend_id) VALUES('${a}','${b}'),('${b}','${a}')`);

function producerEntry(target:CachedResearch['target']):CachedResearch{
  return {target,
    payload:{producerDetails:'Domaine Dujac is a Morey-Saint-Denis estate farming its Clos de la Roche holdings biodynamically, with whole-cluster fermentation a house signature across the range.',
      producerWinemakingPractices:'The domaine ferments with a high proportion of whole clusters, uses gentle extraction and ages in a modest share of new oak, a practice that holds across vintages rather than varying by release.'},
    sources:[{title:'Domaine Dujac',url:'https://www.dujac.com/'},{title:'BIVB',url:'https://www.bourgogne-wines.com/'}],
    model:'gemini-3.8-flash',researchedAt:new Date().toISOString()};
}

describe('what a wine view costs to read',()=>{
  /**
   * Four scopes, each with up to two alias keys, used to be one awaited lookup
   * per scope and one per key inside it, plus a repeat read of the same
   * producer's aliases for every scope. The ceiling below is the whole friend
   * path: the alias read plus one batched query.
   */
  it('reads friends research in one query however many scopes are missing',async()=>{
    const {sql,db,counts,close}=realD1();
    try{
      seed(sql,'alice');seed(sql,'bob');befriend(sql,'alice','bob');
      const targets=buildResearchTargets(wine);
      expect(targets.length,'this wine has all four scopes').toBe(4);
      await upsertResearchCache(db,'alice',producerEntry(targets.find(t=>t.scope==='producer')!));

      const before=counts().reads;
      const cache=await loadResearchCache(db,'bob',targets,true);
      const spent=counts().reads-before;

      expect(cache.get('producer')?.contributorId,'Bob still finds it').toBe('alice');
      // One own-cache lookup + one alias read + one friend lookup.
      expect(spent,'the friend path must not scale with scope or key count').toBe(3);
    }finally{close()}
  });

  it('costs one batched lookup when only some scopes are the reader own',async()=>{
    const {sql,db,counts,close}=realD1();
    try{
      seed(sql,'bob');
      const targets=buildResearchTargets(wine);
      await upsertResearchCache(db,'bob',producerEntry(targets.find(t=>t.scope==='producer')!));
      const before=counts().reads;
      await loadResearchCache(db,'bob',targets,true);
      // Three scopes are still missing, so one alias read and one batched query.
      expect(counts().reads-before).toBe(3);
    }finally{close()}
  });
});
