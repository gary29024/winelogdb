import { describe,expect,it } from 'vitest';
import { realD1 } from './support/realD1';
import { similarFriendProducers,suggestionFor,withinEditDistance } from '../../src/lib/research/similarProducers';
import { producerNameVariants,rememberProducerAlias } from '../../src/lib/research/aliasBridge';

describe('which names are worth suggesting',()=>{
  // The motivating case, and the reason plain edit distance is not the rule:
  // this pair is six edits apart, further than two unrelated producers often are.
  it('reads an abbreviation as the same producer',()=>{
    expect(suggestionFor('ch margaux','chateau margaux')).toBe('abbreviation');
    expect(withinEditDistance('ch margaux','chateau margaux',2),'six edits apart').toBe(false);
    expect(suggestionFor('dom de la romanee conti','domaine de la romanee conti')).toBe('abbreviation');
  });

  it('reads a dropped generic head word as the same producer',()=>{
    expect(suggestionFor('dujac','domaine dujac')).toBe('prefix');
    expect(suggestionFor('domaine dujac','dujac')).toBe('prefix');
  });

  it('reads a typo as the same producer, on a name long enough to be sure',()=>{
    expect(suggestionFor('chateau margaux','chateau margeaux')).toBe('spelling');
    expect(suggestionFor('bergat','berget'),'too short to risk').toBeNull();
  });

  // Every one of these is two genuinely different producers.
  it('stays quiet on names that merely resemble each other',()=>{
    // Dujac and Dugat are two real Morey-Saint-Denis estates, two edits apart.
    // Measuring the whole name instead of the distinctive part calls them a typo.
    expect(suggestionFor('domaine dujac','domaine dugat')).toBeNull();
    expect(suggestionFor('chateau margaux','chateau palmer')).toBeNull();
    expect(suggestionFor('c margaux','chateau margaux'),'one letter is not an abbreviation').toBeNull();
    expect(suggestionFor('domaine leflaive','domaine leroy')).toBeNull();
    expect(suggestionFor('chateau margaux','chateau margaux')).toBeNull();
  });
});

describe('suggesting a friend research name',()=>{
  const seed=(sql:ReturnType<typeof realD1>['sql'],id:string)=>
    sql.exec(`INSERT INTO app_users(id,email,display_name,role) VALUES('${id}','${id}@e.com','${id}','member') ON CONFLICT(id) DO NOTHING`);
  const publish=(sql:ReturnType<typeof realD1>['sql'],contributor:string,name:string)=>
    sql.prepare("INSERT INTO reusable_research(contributor_id,subject_key,scope,entry_json,researched_at) VALUES(?,?,'producer','{}',?)")
      .run(contributor,JSON.stringify([name]),new Date().toISOString());

  it('offers a friend name and unlocks reuse once confirmed',async()=>{
    const {sql,db,close}=realD1();
    try{
      seed(sql,'alice');seed(sql,'bob');
      sql.exec("INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice')");
      publish(sql,'alice','chateau margaux');

      const offered=await similarFriendProducers(db,'bob','Ch Margaux');
      expect(offered).toEqual([{name:'chateau margaux',reason:'abbreviation'}]);

      // Before confirming, Bob's lookup only knows his own spelling.
      expect(await producerNameVariants(db,'bob','Ch Margaux')).toEqual(['ch margaux']);
      await rememberProducerAlias(db,'bob','Ch Margaux','chateau margaux');
      expect(await producerNameVariants(db,'bob','Ch Margaux')).toEqual(['ch margaux','chateau margaux']);
    }finally{close()}
  });

  it('never offers a stranger research',async()=>{
    const {sql,db,close}=realD1();
    try{
      seed(sql,'alice');seed(sql,'bob');
      publish(sql,'alice','chateau margaux');
      expect(await similarFriendProducers(db,'bob','Ch Margaux'),'not friends').toEqual([]);
    }finally{close()}
  });

  it('says nothing when the friend wrote the same name',async()=>{
    const {sql,db,close}=realD1();
    try{
      seed(sql,'alice');seed(sql,'bob');
      sql.exec("INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice')");
      publish(sql,'alice','chateau margaux');
      expect(await similarFriendProducers(db,'bob','Château Margaux'),'already matches, nothing to fix').toEqual([]);
    }finally{close()}
  });
});
