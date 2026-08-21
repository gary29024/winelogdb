import { describe,expect,it } from 'vitest';
import { matchCuveeReleaseVariantToCatalog,parseCuveeReleaseVariant } from '../../src/lib/cuvees/releaseVariants';

const rows=[
  {id:'grande',canonicalName:'Grande Cuvée',appellation:'Champagne',wineStyle:'sparkling'},
  {id:'vintage',canonicalName:'Vintage',appellation:'Champagne',wineStyle:'sparkling'}
];

describe('cuvée release variants',()=>{
  it('extracts French and English edition designations while preserving the parent wine',()=>{
    expect(parseCuveeReleaseVariant('Grande Cuvée 170ème Édition')).toEqual({kind:'edition',parentName:'Grande Cuvée',designation:'170ème Édition',sequence:170});
    expect(parseCuveeReleaseVariant('Grande Cuvee 171st Edition')).toEqual({kind:'edition',parentName:'Grande Cuvee',designation:'171st Edition',sequence:171});
    expect(parseCuveeReleaseVariant('Grande Cuvée Edition 172')).toEqual({kind:'edition',parentName:'Grande Cuvée',designation:'Edition 172',sequence:172});
  });

  it('does not reinterpret an ordinary vintage wine as a release variant',()=>{
    expect(parseCuveeReleaseVariant('Vintage 2013')).toBeNull();
    expect(parseCuveeReleaseVariant('Clos du Mesnil 2008')).toBeNull();
  });

  it('removes a known producer prefix before finding the parent cuvée',()=>{
    expect(parseCuveeReleaseVariant('Krug Grande Cuvée 173ème Édition',['Krug'])).toEqual({kind:'edition',parentName:'Grande Cuvée',designation:'173ème Édition',sequence:173});
  });

  it('maps an edition only when the exact parent exists with compatible style and appellation',()=>{
    const match=matchCuveeReleaseVariantToCatalog({name:'Grande Cuvée 170ème Édition',appellation:'Champagne',wineStyle:'sparkling'},rows);
    expect(match).toEqual({catalogCuveeId:'grande',catalogName:'Grande Cuvée',variant:{kind:'edition',parentName:'Grande Cuvée',designation:'170ème Édition',sequence:170}});
    expect(matchCuveeReleaseVariantToCatalog({name:'Grande Cuvée 170ème Édition',appellation:'Champagne',wineStyle:'red'},rows)).toBeNull();
    expect(matchCuveeReleaseVariantToCatalog({name:'Mystery Cuvée 170ème Édition',appellation:'Champagne',wineStyle:'sparkling'},rows)).toBeNull();
  });

  it('refuses an ambiguous parent instead of guessing',()=>{
    const ambiguous=[...rows,{id:'grande-2',canonicalName:'Grande Cuvee',appellation:'Champagne',wineStyle:'sparkling'}];
    expect(matchCuveeReleaseVariantToCatalog({name:'Grande Cuvée 170ème Édition',appellation:'Champagne',wineStyle:'sparkling'},ambiguous)).toBeNull();
  });
});
