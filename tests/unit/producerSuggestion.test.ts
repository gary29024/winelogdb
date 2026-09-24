import { describe,expect,it } from 'vitest';
import { suggestExistingProducer } from '../../src/lib/producers/entities';
import { createD1Stub } from './support/d1Stub';
import { migratedSqliteD1 } from './support/sqliteD1';
import { sharedProducerId } from '../../src/lib/producers/sharedRef';

/** The owner's producers, as the one query this reads returns them. */
const library=(...names:string[])=>createD1Stub(sql=>
  /FROM producers p WHERE p.owner_id=\?/.test(sql)
    ? {all:names.map((canonical_name,index)=>({id:`p${index}`,canonical_name,tasted_count:index+1}))}
    : undefined);

const suggest=(name:string,...names:string[])=>suggestExistingProducer(library(...names).db,'owner',name);

describe('the house you almost certainly meant',()=>{
  // The exact resolvers never strip "Domaine", "Château" or "Marchesi", and are
  // right not to - those words can be the whole difference between two real
  // producers. But saying nothing at all means a label read as "Antinori"
  // against a library holding "Marchesi Antinori" quietly makes a second
  // producer, joined only by hand afterwards.

  it('proposes the fuller name a read name sits inside',async()=>{
    expect(await suggest('Antinori','Marchesi Antinori','Tenuta San Guido'))
      .toMatchObject({canonicalName:'Marchesi Antinori'});
  });

  it('proposes the shorter name too, when the label is the wordier one',async()=>{
    expect(await suggest('Tenuta dell’Ornellaia','Ornellaia'))
      .toMatchObject({canonicalName:'Ornellaia'});
  });

  it('says nothing when two houses would fit',async()=>{
    // The case where guessing is worst: whichever it picked would be wrong half
    // the time, and silently.
    expect(await suggest('Antinori','Marchesi Antinori','Antinori Napa Valley')).toBeNull();
  });

  it('says nothing about a name that is only the word every house shares',async()=>{
    // A bare "Château" belongs to every château in the library; with exactly one
    // of them it would otherwise read as a confident match.
    expect(await suggest('Château','Château Margaux')).toBeNull();
    expect(await suggest('Domaine','Domaine Dujac')).toBeNull();
  });

  it('says nothing when the words do not sit inside each other at all',async()=>{
    expect(await suggest('Ridge Vineyards','Ridge Farms','Montevertine')).toBeNull();
  });

  it('says nothing about a name the library already holds exactly',async()=>{
    // That is a match, not a suggestion, and the resolver above found it first.
    expect(await suggest('Marchesi Antinori','Marchesi Antinori')).toBeNull();
  });

  it('carries how many wines the house has, so the offer can be judged',async()=>{
    expect(await suggest('Dujac','Domaine Dujac')).toMatchObject({tastedCount:1});
  });

  it('reads the producer list once, and only once',async()=>{
    const stub=library('Marchesi Antinori');
    await suggestExistingProducer(stub.db,'owner','Antinori');
    expect(stub.calls).toHaveLength(1);
    expect(stub.writes(),'a suggestion decides nothing, so it writes nothing').toHaveLength(0);
  });

  it('does not read the list at all for a name with nothing to go on',async()=>{
    const stub=library('Château Margaux');
    await suggestExistingProducer(stub.db,'owner','Château');
    expect(stub.calls).toHaveLength(0);
  });
});

describe('a house the reader only knows through a friend',()=>{
  // A member saving "Domaine Henri Magnien" beside a shared "Henri Magnien" used
  // to be told "New producer": the hint only read the member's own producers.
  function sharedLibrary(){
    const state=migratedSqliteD1(),{sqlite}=state;
    sqlite.exec(`INSERT INTO app_users(id,email,display_name,role) VALUES('member','m@example.test','Member','member');
      INSERT INTO friendships(user_id,friend_id) VALUES('member','owner'),('owner','member');
      INSERT INTO producers(id,owner_id,canonical_name,match_key,created_at,updated_at) VALUES('hm','owner','Henri Magnien','henri magnien','2026-09-01','2026-09-01');
      INSERT INTO wines(id,owner_id,producer,wine_name,producer_id,created_at,updated_at) VALUES('w1','owner','Henri Magnien','Gevrey-Chambertin','hm','2026-09-01','2026-09-01');
      INSERT INTO wines(id,owner_id,producer,wine_name,producer_id,created_at,updated_at) VALUES('w2','owner','Henri Magnien','Unshared bottle','hm','2026-09-01','2026-09-01');
      INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('w1','owner','member');`);
    return state;
  }

  it('proposes the shared producer, marked as a friend’s, counting only visible wines',async()=>{
    const {db,sqlite}=sharedLibrary();
    try{
      expect(await suggestExistingProducer(db,'member','Domaine Henri Magnien'))
        .toEqual({id:sharedProducerId('owner','hm'),canonicalName:'Henri Magnien',tastedCount:1,sharedOnly:true});
    }finally{sqlite.close()}
  });

  it('prefers the reader’s own producer of the same name',async()=>{
    const {db,sqlite}=sharedLibrary();
    try{
      sqlite.exec(`INSERT INTO producers(id,owner_id,canonical_name,match_key,created_at,updated_at) VALUES('mine','member','Henri Magnien','henri magnien','2026-09-02','2026-09-02');`);
      expect(await suggestExistingProducer(db,'member','Domaine Henri Magnien')).toMatchObject({id:'mine',canonicalName:'Henri Magnien'});
      expect((await suggestExistingProducer(db,'member','Domaine Henri Magnien'))?.sharedOnly).toBeUndefined();
    }finally{sqlite.close()}
  });

  it('forgets the friend’s producer once the share is revoked',async()=>{
    const {db,sqlite}=sharedLibrary();
    try{
      sqlite.exec("DELETE FROM wine_shares WHERE wine_id='w1'");
      expect(await suggestExistingProducer(db,'member','Domaine Henri Magnien')).toBeNull();
    }finally{sqlite.close()}
  });
});
