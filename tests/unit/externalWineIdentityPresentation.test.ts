import { describe,expect,it } from 'vitest';
import { wineFactRows } from '../../src/lib/wine/detailFields';
import { sharedWine } from '../../worker/multiUser/social';

describe('external wine identity presentation',()=>{
 it('shows release, product type and registered external identifiers as bottle facts',()=>{
  const rows=wineFactRows({wineName:'Grande Cuvée',releaseDesignation:'171ème Édition',colour:'White',productSubtype:'Sparkling',referenceSite:'Montagne de Reims',referenceParcel:'Clos du Mesnil',lwin7:'1234567',lwin11:'12345672008',elid:'FR-CMP-KRUG01-N171'});
  expect(rows).toContainEqual(['Release','171ème Édition']);
  expect(rows).toContainEqual(['Type','White · Sparkling']);
  expect(rows).toContainEqual(['LWIN site','Montagne de Reims']);
  expect(rows).toContainEqual(['LWIN parcel','Clos du Mesnil']);
  expect(rows).toContainEqual(['LWIN7','1234567']);
  expect(rows).toContainEqual(['LWIN11','12345672008']);
  expect(rows).toContainEqual(['ELID','FR-CMP-KRUG01-N171']);
 });
 it('does not repeat LWIN site or parcel already visible in the wine name',()=>{
  const rows=wineFactRows({wineName:'Vosne-Romanée 1er Cru Les Suchots',region:'Burgundy',appellation:'Vosne-Romanée',referenceSite:'Vosne-Romanée',referenceParcel:'Les Suchots'});
  expect(rows.some(([label])=>label==='LWIN site'||label==='LWIN parcel')).toBe(false);
 });
 it('allow-lists external IDs to a friend without leaking match diagnostics',()=>{
  const wine=sharedWine({id:'w',producer:'Krug',wine_name:'Grande Cuvée',vintage_kind:'non_vintage',release_designation:'171ème Édition',lwin7:'1234567',reference_site:'Montagne de Reims',reference_parcel:'Clos du Mesnil',elid:'FR-CMP-KRUG01-N171',identity_match_confidence:.99});
  expect(wine).toMatchObject({lwin7:'1234567',referenceSite:'Montagne de Reims',referenceParcel:'Clos du Mesnil',elid:'FR-CMP-KRUG01-N171',releaseDesignation:'171ème Édition'});
  expect(wine).not.toHaveProperty('identityMatchConfidence');
 });
});
