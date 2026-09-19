import { describe,expect,it } from 'vitest';
import { wineFactRows } from '../../src/lib/wine/detailFields';
import { sharedWine } from '../../worker/multiUser/social';

describe('external wine identity presentation',()=>{
 it('shows release, product type and registered external identifiers as bottle facts',()=>{
  const rows=wineFactRows({releaseDesignation:'171ème Édition',colour:'White',productSubtype:'Sparkling',lwin7:'1234567',elid:'FR-CMP-KRUG01-N171'});
  expect(rows).toContainEqual(['Release','171ème Édition']);
  expect(rows).toContainEqual(['Type','White · Sparkling']);
  expect(rows).toContainEqual(['LWIN7','1234567']);
  expect(rows).toContainEqual(['ELID','FR-CMP-KRUG01-N171']);
 });
 it('allow-lists external IDs to a friend without leaking match diagnostics',()=>{
  const wine=sharedWine({id:'w',producer:'Krug',wine_name:'Grande Cuvée',vintage_kind:'non_vintage',release_designation:'171ème Édition',lwin7:'1234567',elid:'FR-CMP-KRUG01-N171',identity_match_confidence:.99});
  expect(wine).toMatchObject({lwin7:'1234567',elid:'FR-CMP-KRUG01-N171',releaseDesignation:'171ème Édition'});
  expect(wine).not.toHaveProperty('identityMatchConfidence');
 });
});
