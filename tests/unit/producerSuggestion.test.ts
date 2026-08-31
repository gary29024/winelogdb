import { describe,expect,it } from 'vitest';
import { suggestExistingProducer } from '../../src/lib/producers/entities';
import { createD1Stub } from './support/d1Stub';

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
