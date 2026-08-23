import { describe,expect,it } from 'vitest';
import { matchCuveeReleaseVariantToCatalog,parseCuveeReleaseVariant } from '../../src/lib/cuvees/releaseVariants';

const rows=[
  {id:'grande',canonicalName:'Grande Cuvée',appellation:'Champagne',wineStyle:'sparkling'},
  {id:'vintage',canonicalName:'Vintage',appellation:'Champagne',wineStyle:'sparkling'}
];

const giraudRows=[
  {id:'fut20',canonicalName:'Fût de Chêne MV20',appellation:'Champagne',wineStyle:'sparkling'},
  {id:'pr21',canonicalName:'PR 90-21',appellation:'Champagne',wineStyle:'sparkling'},
  {id:'prrose22',canonicalName:'PR Rosé 90-22',appellation:'Champagne',wineStyle:'rose'},
  {id:'ratafia19',canonicalName:'Solera Ratafia Champenois 90-19',appellation:'Ratafia Champenois',wineStyle:'fortified'}
];

describe('cuvée release variants',()=>{
  it('extracts French and English edition designations while preserving the parent wine',()=>{
    expect(parseCuveeReleaseVariant('Grande Cuvée 170ème Édition')).toEqual({kind:'edition',parentName:'Grande Cuvée',designation:'170ème Édition',sequence:170});
    expect(parseCuveeReleaseVariant('Grande Cuvee 171st Edition')).toEqual({kind:'edition',parentName:'Grande Cuvee',designation:'171st Edition',sequence:171});
    expect(parseCuveeReleaseVariant('Grande Cuvée Edition 172')).toEqual({kind:'edition',parentName:'Grande Cuvée',designation:'Edition 172',sequence:172});
  });

  it('recognizes multi-vintage and reserve-span release codes without turning them into vintages',()=>{
    expect(parseCuveeReleaseVariant('Fût de Chêne MV20')).toEqual({kind:'multi_vintage',parentName:'Fût de Chêne MV',designation:'MV20',sequence:20});
    expect(parseCuveeReleaseVariant('MV20 Brut')).toEqual({kind:'multi_vintage',parentName:'MV',designation:'MV20',sequence:20});
    expect(parseCuveeReleaseVariant('PR 90-21')).toEqual({kind:'reserve_span',parentName:'PR',designation:'90-21',sequence:9021});
    expect(parseCuveeReleaseVariant('Solera Ratafia Champenois 90–19')).toEqual({kind:'reserve_span',parentName:'Solera Ratafia Champenois',designation:'90–19',sequence:9019});
  });

  it('does not reinterpret an ordinary vintage wine as a release variant',()=>{
    expect(parseCuveeReleaseVariant('Vintage 2013')).toBeNull();
    expect(parseCuveeReleaseVariant('Clos du Mesnil 2008')).toBeNull();
    expect(parseCuveeReleaseVariant('Argonne 2015')).toBeNull();
  });

  it('removes a known producer prefix before finding the parent cuvée',()=>{
    expect(parseCuveeReleaseVariant('Krug Grande Cuvée 173ème Édition',['Krug'])).toEqual({kind:'edition',parentName:'Grande Cuvée',designation:'173ème Édition',sequence:173});
    expect(parseCuveeReleaseVariant('Henri Giraud Fût de Chêne MV20',['Henri Giraud'])).toEqual({kind:'multi_vintage',parentName:'Fût de Chêne MV',designation:'MV20',sequence:20});
  });

  it('maps an edition only when the exact parent exists with compatible style and appellation',()=>{
    const match=matchCuveeReleaseVariantToCatalog({name:'Grande Cuvée 170ème Édition',appellation:'Champagne',wineStyle:'sparkling'},rows);
    expect(match).toEqual({catalogCuveeId:'grande',catalogName:'Grande Cuvée',variant:{kind:'edition',parentName:'Grande Cuvée',designation:'170ème Édition',sequence:170}});
    expect(matchCuveeReleaseVariantToCatalog({name:'Grande Cuvée 170ème Édition',appellation:'Champagne',wineStyle:'red'},rows)).toBeNull();
    expect(matchCuveeReleaseVariantToCatalog({name:'Mystery Cuvée 170ème Édition',appellation:'Champagne',wineStyle:'sparkling'},rows)).toBeNull();
  });

  it('maps Henri Giraud release codes onto their stable family even when the catalog has a different release',()=>{
    expect(matchCuveeReleaseVariantToCatalog({name:'Fût de Chêne MV19',appellation:'Champagne',wineStyle:'sparkling'},giraudRows)).toEqual({
      catalogCuveeId:'fut20',catalogName:'Fût de Chêne MV',variant:{kind:'multi_vintage',parentName:'Fût de Chêne MV',designation:'MV19',sequence:19}
    });
    expect(matchCuveeReleaseVariantToCatalog({name:'PR 90-20',appellation:'Champagne',wineStyle:'sparkling'},giraudRows)).toEqual({
      catalogCuveeId:'pr21',catalogName:'PR',variant:{kind:'reserve_span',parentName:'PR',designation:'90-20',sequence:9020}
    });
    expect(matchCuveeReleaseVariantToCatalog({name:'Solera Ratafia Champenois 90-16',appellation:'Ratafia Champenois',wineStyle:'fortified'},giraudRows)).toEqual({
      catalogCuveeId:'ratafia19',catalogName:'Solera Ratafia Champenois',variant:{kind:'reserve_span',parentName:'Solera Ratafia Champenois',designation:'90-16',sequence:9016}
    });
  });

  it('can resolve a short release-only recognition only when one compatible catalog family is unique',()=>{
    expect(matchCuveeReleaseVariantToCatalog({name:'MV19 Brut',appellation:'Champagne',wineStyle:'sparkling'},giraudRows)).toEqual({
      catalogCuveeId:'fut20',catalogName:'Fût de Chêne MV',variant:{kind:'multi_vintage',parentName:'MV',designation:'MV19',sequence:19}
    });
    expect(matchCuveeReleaseVariantToCatalog({name:'90-16',appellation:'Ratafia Champenois',wineStyle:'fortified'},giraudRows)).toEqual({
      catalogCuveeId:'ratafia19',catalogName:'Solera Ratafia Champenois',variant:{kind:'reserve_span',parentName:'',designation:'90-16',sequence:9016}
    });
    expect(matchCuveeReleaseVariantToCatalog({name:'90-20',appellation:'Champagne',wineStyle:'sparkling'},giraudRows)).toBeNull();
  });

  it('uses one deterministic latest catalog anchor when several releases of the same family exist',()=>{
    const catalog=[
      {id:'fut18',canonicalName:'Fût de Chêne MV18',appellation:'Champagne',wineStyle:'sparkling'},
      {id:'fut20',canonicalName:'Fût de Chêne MV20',appellation:'Champagne',wineStyle:'sparkling'},
      {id:'fut19',canonicalName:'Fût de Chêne MV19',appellation:'Champagne',wineStyle:'sparkling'}
    ];
    expect(matchCuveeReleaseVariantToCatalog({name:'Fût de Chêne MV17',appellation:'Champagne',wineStyle:'sparkling'},catalog)?.catalogCuveeId).toBe('fut20');
    expect(matchCuveeReleaseVariantToCatalog({name:'MV17',appellation:'Champagne',wineStyle:'sparkling'},catalog)?.catalogCuveeId).toBe('fut20');
  });

  it('refuses ambiguous parents or release-only families instead of guessing',()=>{
    const ambiguous=[...rows,{id:'grande-2',canonicalName:'Grande Cuvee',appellation:'Champagne',wineStyle:'sparkling'}];
    expect(matchCuveeReleaseVariantToCatalog({name:'Grande Cuvée 170ème Édition',appellation:'Champagne',wineStyle:'sparkling'},ambiguous)).toBeNull();
    const ambiguousMv=[
      {id:'fut20',canonicalName:'Fût de Chêne MV20',appellation:'Champagne',wineStyle:'sparkling'},
      {id:'other20',canonicalName:'Another Cuvée MV20',appellation:'Champagne',wineStyle:'sparkling'}
    ];
    expect(matchCuveeReleaseVariantToCatalog({name:'MV19',appellation:'Champagne',wineStyle:'sparkling'},ambiguousMv)).toBeNull();
  });
});
