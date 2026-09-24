import type {LwinReference} from '../../../src/lib/wine/lwinMetadata';

/** Complete synthetic catalogue snapshot, including enrichment provenance. */
export const lwinReferenceFixture:LwinReference={
 identityVersion:2,source:'lwin',version:'test-catalogue',lwin7:'1234567',
 producer:'Domaine Dujac',wineName:'Morey-Saint-Denis 1er Cru',country:'France',region:'Burgundy',
 subRegion:'Côte de Nuits',site:null,parcel:null,designation:'AOP',classification:'Premier Cru',
 colour:'Red',productType:'Wine',productSubtype:'Still',vintageConfig:'Sequential',
 firstVintage:null,finalVintage:null,sourceUpdatedAt:null,method:'deterministic',confidence:1,
 filled:{productType:'Wine'},conflicts:[]
};
