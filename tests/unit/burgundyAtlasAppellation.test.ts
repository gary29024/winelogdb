import { describe,expect,it } from 'vitest';
import { burgundyAtlasPremierCru,burgundyAtlasWineDetailPlace } from '../../src/lib/places/burgundyAtlasPremierCru';
import mapping from '../../src/lib/places/burgundyAtlasAppellationLinks.json';
import unmapped from '../../src/lib/places/burgundyAtlasUnmappedPremierCruNames.json';
import premiers from '../../src/lib/places/burgundyAtlasPremierCruLinks.json';

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

  it.each([
    {appellation:'Vosne-Romanée',wineName:'Vosne-Romanée Les Suchots'},
    {appellation:'Puligny-Montrachet',wineName:'Puligny-Montrachet Les Pucelles'},
    {appellation:'Gevrey-Chambertin',wineName:'Gevrey-Chambertin Clos Saint-Jacques'},
    // Gevrey's own Premier Cru, not the Vosne-Romanée Grand Cru namesake.
    {appellation:'Gevrey-Chambertin',wineName:'Gevrey-Chambertin La Romanée'},
    {appellation:'Vosne-Romanée',wineName:'Vosne-Romanée La Romanée'},
    {appellation:'Meursault',wineName:'Meursault Les Perrières'},
    {appellation:'Meursault',wineName:'Domaine X',referenceSite:'Charmes'},
    {appellation:'Chablis',wineName:'Chablis Les Clos'},
    {appellation:'Chablis',wineName:'Chablis Vaudésir'},
  ])('withholds the village page when an unclassified wine names a cru of its village: %j',fields=>{
    expect(burgundyAtlasWineDetailPlace({...wine,classification:null,...fields})).toBeNull();
  });

  it.each([
    // Les Perrières is a Premier Cru in Meursault, Puligny and Beaune, not here.
    {appellation:'Saint-Romain',wineName:'Saint-Romain Les Perrières',url:'saint-romain'},
    // A Gevrey Premier Cru name says nothing about a Chambolle village wine.
    {appellation:'Chambolle-Musigny',wineName:'Chambolle-Musigny Cazetiers',url:'chambolle-musigny'},
    {appellation:'Meursault',wineName:'Meursault Les Narvaux',url:'meursault'},
    {appellation:'Chablis',wineName:'Chablis Vieilles Vignes',url:'chablis'},
    // "Clos" alone is not the complete Chablis Grand Cru name "Les Clos".
    {appellation:'Chablis',wineName:'Chablis Clos du Domaine',url:'chablis'},
  ])('only counts crus of the wine’s own village when the tier is unrecorded: %j',({url,...fields})=>{
    const result=burgundyAtlasWineDetailPlace({...wine,classification:null,...fields});
    expect(result?.url).toMatch(new RegExp(`/${url}$`));
    expect(result?.scope).toBe('appellation');
  });

  it('keeps a recorded village classification authoritative over a cru name',()=>{
    expect(burgundyAtlasWineDetailPlace({...wine,classification:'village',wineName:'Meursault Les Perrières'})?.url).toBe(village);
  });

  it('broadens an unmapped Chablis climat to Chablis Premier Cru',()=>{
    expect(burgundyAtlasWineDetailPlace({...wine,appellation:'Chablis',wineName:'Chablis Montée de Tonnerre'})?.url)
      .toBe('https://burgundyatlas.com/place/ba_appellation_cicui7m4g4teqmvx2nmg6jsj2m/chablis-premier-cru');
  });

  it.each(unmapped.groups)('preserves the tier for unmapped $appellation crus',group=>{
    const appellation=mapping.groups.find(candidate=>candidate.appellation===group.appellation)!;
    for(const entry of group.entries){
      const facts={...wine,appellation:group.appellation,wineName:`${group.appellation} ${entry.name}`};
      for(const classification of [null,undefined]){
        expect(burgundyAtlasWineDetailPlace({...facts,classification}),entry.name).toBeNull();
        expect(burgundyAtlasWineDetailPlace({...facts,classification,wineName:entry.name.replace(/^(?:les|le|la) /i,'')}),entry.name).toBeNull();
        for(const field of ['referenceSite','referenceParcel'] as const)
          expect(burgundyAtlasWineDetailPlace({...facts,classification,wineName:group.appellation,[field]:entry.name}),entry.name).toBeNull();
      }
      // A known tier may use its appellation, but no mapless plot gets a link.
      expect(burgundyAtlasPremierCru(facts),entry.name).toBeNull();
      const premierResult=burgundyAtlasWineDetailPlace(facts);
      if(appellation.premierCruPath)expect(premierResult?.url,entry.name).toBe(`https://burgundyatlas.com${appellation.premierCruPath}`);
      else expect(premierResult,entry.name).toBeNull();
      expect(burgundyAtlasWineDetailPlace({...facts,classification:'village'})?.url,entry.name)
        .toBe(`https://burgundyatlas.com${appellation.villagePath}`);
      // A same-name vineyard elsewhere must not inherit this cru's tier.
      expect(burgundyAtlasWineDetailPlace({...facts,classification:null,appellation:'Saint-Romain',wineName:`Saint-Romain ${entry.name}`})?.url,entry.name)
        .toMatch(/\/saint-romain$/);
    }
  });

  it('keeps the reviewed guard names separate from navigable plot coverage',()=>{
    const entries=unmapped.groups.flatMap(group=>group.entries);
    expect(entries).toHaveLength(premiers.excludedWithoutMap);
    expect(new Set(entries.map(entry=>entry.placeId)).size).toBe(entries.length);
    const mappedIds=new Set(premiers.groups.flatMap(group=>group.entries.map(entry=>entry.path.split('/')[2])));
    for(const entry of entries){
      expect(entry.placeId).toMatch(/^ba_designation_[a-z2-7]{26}$/);
      expect(mappedIds.has(entry.placeId),entry.name).toBe(false);
    }
  });

  it('matches whole unmapped names without leaking regex state between wines',()=>{
    for(let i=0;i<3;i++){
      expect(burgundyAtlasWineDetailPlace({...wine,classification:null,appellation:'Chablis',wineName:'Chablis Forester'})?.url).toMatch(/\/chablis$/);
      expect(burgundyAtlasWineDetailPlace({...wine,classification:null,appellation:'Chablis',wineName:'Chablis Forets'})).toBeNull();
    }
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
