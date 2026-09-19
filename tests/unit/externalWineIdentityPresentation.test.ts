import { describe,expect,it } from 'vitest';
import { hasReference,referenceRows,wineFactRows } from '../../src/lib/wine/detailFields';
import { sharedWine } from '../../worker/multiUser/social';

const krug={releaseDesignation:'171ème Édition',colour:'White',productSubtype:'Sparkling',lwin7:'1234567',elid:'FR-CMP-KRUG01-N171'};

describe('external wine identity presentation',()=>{
 it('keeps the catalogue’s facts out of the table of the owner’s own',()=>{
  // The identifiers and the catalogue's product wording used to sit in Wine
  // details among Region, Grapes and Alcohol, which said a Liv-ex registry
  // number and a hand-typed appellation were the same kind of claim. They are
  // still shown - they moved to a panel that says whose they are.
  const facts=wineFactRows(krug);
  expect(facts).toContainEqual(['Release','171ème Édition']);
  expect(facts.map(([label])=>label)).not.toContain('LWIN7');
  expect(facts.map(([label])=>label)).not.toContain('ELID');
  expect(facts.map(([label])=>label)).not.toContain('Product type');
 });

 it('still shows every registered identifier, under the reference panel',()=>{
  const rows=referenceRows(krug);
  expect(rows).toContainEqual(['LWIN7','1234567']);
  expect(rows).toContainEqual(['ELID','FR-CMP-KRUG01-N171']);
  expect(rows).toContainEqual(['Product type','Sparkling']);
  expect(rows).toContainEqual(['Colour','White']);
 });

 it('names the match status in words rather than in the database’s enum',()=>{
  expect(referenceRows({...krug,identityMatchStatus:'matched'})).toContainEqual(['Match status','Verified']);
  expect(referenceRows({...krug,identityMatchStatus:'manual'})).toContainEqual(['Match status','Set by hand']);
 });

 it('says the parcel is unknown rather than leaving the row out',()=>{
  // LWIN can say a wine is Corton; it cannot yet say it is from the Pernand
  // side of Corton. Dropping the row would let a reader assume the question was
  // never asked, when it was asked and the catalogue has no answer.
  expect(referenceRows(krug)).toContainEqual(['Site / parcel','—']);
 });

 it('shows no reference panel at all for a wine no catalogue has heard of',()=>{
  // An empty panel would claim the catalogues were consulted and came back
  // blank, which is a different statement from never having matched.
  const unmatched={releaseDesignation:'171ème Édition',colour:'White'};
  expect(hasReference(unmatched)).toBe(false);
  expect(referenceRows(unmatched)).toEqual([]);
 });

 it('allow-lists external IDs to a friend without leaking match diagnostics',()=>{
  const wine=sharedWine({id:'w',producer:'Krug',wine_name:'Grande Cuvée',vintage_kind:'non_vintage',release_designation:'171ème Édition',lwin7:'1234567',elid:'FR-CMP-KRUG01-N171',identity_match_confidence:.99});
  expect(wine).toMatchObject({lwin7:'1234567',elid:'FR-CMP-KRUG01-N171',releaseDesignation:'171ème Édition'});
  expect(wine).not.toHaveProperty('identityMatchConfidence');
 });

 it('drops a match status a recipient was never given, without being asked to',()=>{
  // referenceRows declares the owner-only fields optional rather than keeping
  // them out, so the protection is the type: SharedWine has no field for a
  // match status, so the row cannot be built from one.
  const shared=sharedWine({id:'w',producer:'Krug',wine_name:'Grande Cuvée',lwin7:'1234567',identity_match_status:'matched'});
  expect(referenceRows(shared).map(([label])=>label)).not.toContain('Match status');
 });
});
