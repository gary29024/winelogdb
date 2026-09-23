import { describe,expect,it } from 'vitest';
import { realD1 } from './support/realD1';
import { adoptFriendResearch,buildResearchTargets,loadResearchCache,upsertResearchCache,type CachedResearch,type ResearchScope } from '../../src/lib/research/cache';
import { producerEntry } from './support/researchFixture';

const wine={producer:'Domaine Dujac',wineName:'Clos de la Roche',vintage:2019,country:'France',region:'Burgundy',appellation:'Clos de la Roche',wineStyle:'red'};
const seedUser=(sql:ReturnType<typeof realD1>['sql'],id:string,role='member')=>
  sql.exec(`INSERT INTO app_users(id,email,display_name,role) VALUES('${id}','${id}@example.com','${id}','${role}') ON CONFLICT(id) DO UPDATE SET role=excluded.role`);
const befriend=(sql:ReturnType<typeof realD1>['sql'],a:string,b:string)=>
  sql.exec(`INSERT INTO friendships(user_id,friend_id) VALUES('${a}','${b}'),('${b}','${a}')`);

describe('friend research is kept, not borrowed',()=>{
  it('survives the friendship ending and stops needing the friendship join',async()=>{
    const {sql,db,close}=realD1();
    try{
      seedUser(sql,'alice');seedUser(sql,'bob');befriend(sql,'alice','bob');
      const targets=buildResearchTargets(wine),producer=targets.find(t=>t.scope==='producer')!;

      // Alice pays for it, which publishes it to her friends. A producer scope is
      // filed under both [producer,country] and [producer], so a friend who has
      // no country recorded for the same producer still meets the research.
      await upsertResearchCache(db,'alice',producerEntry(producer));
      expect(sql.prepare('SELECT count(*) AS n FROM reusable_research').get()!.n).toBe(2);

      // Bob sees it only through the friendship, and owns nothing yet.
      const borrowed=await loadResearchCache(db,'bob',targets,true);
      expect(borrowed.get('producer')?.contributorId).toBe('alice');
      expect(sql.prepare("SELECT count(*) AS n FROM research_cache WHERE owner_id='bob'").get()!.n).toBe(0);

      // Showing it to Bob makes it his, tagged with who paid.
      await adoptFriendResearch(db,'bob',borrowed);
      const adopted=sql.prepare("SELECT source_user_id FROM research_cache WHERE owner_id='bob' AND scope='producer'").get();
      expect(adopted!.source_user_id).toBe('alice');

      // Adoption never republishes: only the account that paid offers research on.
      expect(sql.prepare("SELECT count(*) AS n FROM reusable_research WHERE contributor_id='bob'").get()!.n).toBe(0);

      // The friendship ends. Bob keeps the text, and finds it without the join.
      sql.exec("DELETE FROM friendships WHERE user_id='bob' OR friend_id='bob'");
      const kept=await loadResearchCache(db,'bob',targets,false);
      expect(kept.get('producer')?.payload.producerDetails).toContain('Morey-Saint-Denis');
    }finally{close()}
  });

  it('never overwrites research the reader already paid for',async()=>{
    const {sql,db,close}=realD1();
    try{
      seedUser(sql,'alice');seedUser(sql,'bob');befriend(sql,'alice','bob');
      const targets=buildResearchTargets(wine),producer=targets.find(t=>t.scope==='producer')!;
      const own=producerEntry(producer);
      own.payload.producerDetails=`${own.payload.producerDetails} Bob's own run.`;
      await upsertResearchCache(db,'bob',own);
      await adoptFriendResearch(db,'bob',new Map<ResearchScope,CachedResearch>([['producer',{...producerEntry(producer),contributorId:'alice'}]]));
      const row=sql.prepare("SELECT result_json,source_user_id FROM research_cache WHERE owner_id='bob' AND scope='producer'").get();
      expect(String(row!.result_json)).toContain("Bob's own run.");
      expect(row!.source_user_id).toBe(null);
    }finally{close()}
  });
});
