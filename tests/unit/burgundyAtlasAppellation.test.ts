import { describe,expect,it } from 'vitest';
import { burgundyAtlasWineDetailPlace } from '../../src/lib/places/burgundyAtlasPremierCru';
import mapping from '../../src/lib/places/burgundyAtlasAppellationLinks.json';

const village='https://burgundyatlas.com/place/ba_appellation_i5feobqdq556kq7i5jynpzeelu/meursault';
const premier='https://burgundyatlas.com/place/ba_appellation_d2dm6decs2nnkxhviyfpoa4bla/meursault-premier-cru';
const wine={country:'France',region:'Burgundy',appellation:'Meursault',classification:'premier_cru',wineName:'Meursault Premier Cru'};

describe('Atlas appellation fallbacks',()=>{
  it('links every verified destination at its recorded tier',()=>{
    const counts={village:0,premier_cru:0};
    for(const group of mapping.groups)for(const tier of ['village','premier_cru'] as const){
      const path=tier==='village'?group.villagePath:group.premierCruPath;
      const result=burgundyAtlasWineDetailPlace({...wine,appellation:group.appellation,wineName:group.appellation,classification:tier});
      if(!path){expect(result,`${group.appellation}: ${tier}`).toBeNull();continue}
      expect(result?.url,`${group.appellation}: ${tier}`).toBe(`https://burgundyatlas.com${path}`);
      expect(result?.scope).toBe('appellation');
      expect(result?.name).toBe(`${group.appellation}${tier==='premier_cru'?' Premier Cru':''}`);
      counts[tier]++;
      for(const alias of group.aliases)expect(burgundyAtlasWineDetailPlace({...wine,appellation:alias,wineName:'',classification:tier})?.url,alias)
        .toBe(`https://burgundyatlas.com${path}`);
    }
    expect(counts).toEqual({village:43,premier_cru:29});
  });

  it.each([
    {classification:'village',wineName:'Meursault'},
    {classification:'village',wineName:'Meursault Les Narvaux'},
    {classification:'village',wineName:'Meursault Les Perrières'},
    {classification:null,wineName:'Meursault'},
    {classification:'village',wineName:'Meursault',appellation:null},
    {classification:'village',wineName:'Les Narvaux',appellation:null,region:'Meursault'},
  ])('uses the village page without promoting the wine to Premier Cru: %j',fields=>{
    expect(burgundyAtlasWineDetailPlace({...wine,...fields})?.url).toBe(village);
  });

  it.each([
    {},{wineName:''},
    {classification:null,wineName:'Meursault 1er Cru'},
    {classification:null,appellation:'Meursault Premier Cru',wineName:''},
    {wineName:'Meursault Les Perrières / Charmes'},
    {wineName:'Meursault Les Perrières et Charmes'},
    {wineName:'Meursault Les Perrières & Unknown Plot'},
    {wineName:'Meursault Assemblage Les Perrières'},
    {wineName:'Meursault blend Les Perrières'},
    {wineName:'Meursault multi-parcelles Les Perrières'},
    {wineName:'Meursault Les Perrières Charmes'},
    {wineName:'Meursault',referenceSite:'Les Perrières',referenceParcel:'Charmes'},
    {appellation:'Meursault Premier Cru Les Perrières / Charmes',wineName:''},
    {wineName:'Meursault Unknown Vineyard'},
    {appellation:null,region:'Meursault',wineName:'Unnamed cuvée'},
  ])('uses the Premier Cru area for unnamed, mixed or unmapped plots: %j',fields=>{
    const result=burgundyAtlasWineDetailPlace({...wine,...fields});
    expect(result?.url).toBe(premier);
    expect(result?.scope).toBe('appellation');
    expect(result?.name).toBe('Meursault Premier Cru');
  });

  it('keeps a clear single vineyard destination ahead of the broader area',()=>{
    const result=burgundyAtlasWineDetailPlace({...wine,wineName:'Meursault Les Perrières'});
    expect(result?.url).toBe('https://burgundyatlas.com/place/ba_designation_3ftvudbzi36k7gndmas6x36rje/perrieres');
    expect(result?.scope).toBeUndefined();
  });

  it('broadens an unmapped Chablis climat to Chablis Premier Cru',()=>{
    expect(burgundyAtlasWineDetailPlace({...wine,appellation:'Chablis',wineName:'Chablis Montée de Tonnerre'})?.url)
      .toBe('https://burgundyatlas.com/place/ba_appellation_cicui7m4g4teqmvx2nmg6jsj2m/chablis-premier-cru');
  });

  it.each([
    {country:'Italy'},{region:'Bordeaux'},{region:'Côte de Nuits'},{region:'Unknown'},
    {identityMatchStatus:'conflict' as const},{classification:'grand_cru'},
    {classification:'village'}, // Explicit Premier Cru in the title contradicts the field.
    {wineName:'Meursault Grand Cru'},
    {wineName:'Puligny-Montrachet Les Perrières'},
    {wineName:'Meursault Les Perrières / Puligny-Montrachet Charmes'},
    {wineName:'Saint-Romain Les Perrières'},
    {referenceSite:'Saint-Romain'},
    {appellation:'Blagny',wineName:'Meursault Les Perrières'},
    {appellation:'Blagny Premier Cru Hameau de Blagny',wineName:'Meursault Les Perrières'},
    {appellation:'Meursault / Puligny-Montrachet'},
    {appellation:'Unknown'},
    {appellation:null,wineName:'Les Perrières / Charmes'},
    {classification:'village',appellation:'Chablis',wineName:'Petit Chablis'},
    {classification:'village',appellation:null,region:'Côte de Beaune',wineName:''},
    {appellation:'Bouzeron',wineName:'Bouzeron Premier Cru'},
    {appellation:'Pouilly-Loché',wineName:'Pouilly-Loché Premier Cru'},
  ])('does not broaden an uncertain identity or downgrade a missing Premier Cru page: %j',fields=>{
    expect(burgundyAtlasWineDetailPlace({...wine,...fields})).toBeNull();
  });
});
