import { describe,expect,it } from 'vitest';
import { realD1 } from './support/realD1';
import { buildResearchTargets } from '../../src/lib/research/cache';
import { sharedSubjectKeys } from '../../src/lib/research/shared';
import { producerNameVariants,rememberProducerAlias } from '../../src/lib/research/aliasBridge';
import { mergeProducerEntities } from '../../src/lib/producers/merge';

const scope=(wine:Record<string,unknown>,name:string)=>buildResearchTargets(wine).find(t=>t.scope===name)!;
const full={producer:'Domaine Dujac',wineName:'Clos de la Roche',vintage:2019,country:'France',region:'Burgundy',appellation:'Clos de la Roche',wineStyle:'red'};

describe('what reuse refuses, and why',()=>{
  // Every one of these used to return null and say nothing, so a run that
  // silently missed reuse looked identical to one that had none to find.
  it('names the reason rather than failing silently',()=>{
    expect(sharedSubjectKeys(scope({...full,wineStyle:null},'wine_vintage')).skipped).toBe('no-style');
    expect(sharedSubjectKeys(scope({...full,country:null},'wine_vintage')).skipped).toBe('no-country');
    expect(sharedSubjectKeys(scope({...full,producer:''},'wine_vintage')).skipped).toBe('no-producer');
    expect(sharedSubjectKeys(scope({...full,vintage:null},'wine_vintage')).skipped).toBe('no-vintage');
  });

  // A producer's profile is a fact about a producer, not about a place.
  it('shares a producer profile with no country recorded',()=>{
    const keys=sharedSubjectKeys(scope({...full,country:null},'producer')).keys;
    expect(keys).toEqual([JSON.stringify(['domaine dujac'])]);
  });

  it('files a known country under both keys so both readers meet',()=>{
    const keys=sharedSubjectKeys(scope(full,'producer')).keys;
    expect(keys[0],'the specific key is preferred on read').toBe(JSON.stringify(['domaine dujac','france']));
    expect(keys).toContain(JSON.stringify(['domaine dujac']));
  });

  // Terroir is a fact about a vineyard; the colour on the row does not change it.
  it('does not require a wine style for terroir',()=>{
    expect(sharedSubjectKeys(scope({...full,wineStyle:null},'terroir')).skipped).toBeUndefined();
    expect(sharedSubjectKeys(scope({...full,wineStyle:null},'terroir')).keys)
      .toEqual(sharedSubjectKeys(scope(full,'terroir')).keys);
  });

  // A vintage genuinely differs by colour, so style stays part of that key.
  it('still separates a red and a white vintage context',()=>{
    expect(sharedSubjectKeys(scope(full,'vintage_context')).keys[0])
      .not.toBe(sharedSubjectKeys(scope({...full,wineStyle:'white'},'vintage_context')).keys[0]);
  });
});

describe('matching the same producer under two names',()=>{
  const seed=(sql:ReturnType<typeof realD1>['sql'])=>{
    sql.exec("INSERT INTO app_users(id,email,display_name,role) VALUES('alice','a@e.com','alice','member') ON CONFLICT(id) DO NOTHING");
  };

  it('returns the name as given when nothing has been confirmed',async()=>{
    const {sql,db,close}=realD1();
    try{seed(sql);expect(await producerNameVariants(db,'Château Margaux')).toEqual(['chateau margaux'])}finally{close()}
  });

  it('links two spellings once somebody confirms them',async()=>{
    const {sql,db,close}=realD1();
    try{
      seed(sql);
      await rememberProducerAlias(db,'alice','Ch. Margaux','Château Margaux');
      expect(await producerNameVariants(db,'Ch. Margaux')).toEqual(['ch margaux','chateau margaux']);
      // The bridge reads both ways: the canonical name finds the alias too.
      expect(await producerNameVariants(db,'Château Margaux')).toEqual(['chateau margaux','ch margaux']);
    }finally{close()}
  });

  // A merge is the strongest signal the app has: a person saying these are one.
  it('records a merge so every account can reuse across the two names',async()=>{
    const {sql,db,close}=realD1();
    try{
      seed(sql);
      const now=new Date().toISOString();
      for(const [id,name,key] of [['p1','Domaine Dujac','domaine dujac'],['p2','Dujac','dujac']])
        sql.prepare('INSERT INTO producers(id,owner_id,canonical_name,match_key,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(id,'alice',name,key,now,now);
      await mergeProducerEntities(db,'alice','p1','p2');
      expect(await producerNameVariants(db,'Dujac')).toContain('domaine dujac');
    }finally{close()}
  });
});
