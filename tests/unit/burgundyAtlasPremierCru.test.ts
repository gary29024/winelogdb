import { describe,expect,it } from 'vitest';
import { burgundyAtlasPremierCru,burgundyAtlasWineDetailPlace } from '../../src/lib/places/burgundyAtlasPremierCru';
import mapping from '../../src/lib/places/burgundyAtlasPremierCruLinks.json';

const cazetiers='https://burgundyatlas.com/place/ba_designation_4wgzv3yeruhebw2d535r27kjfm/les-cazetiers';
const wine={country:'France',region:'Burgundy',appellation:'Gevrey-Chambertin',classification:'premier_cru',
  wineName:'Gevrey-Chambertin Les Cazetiers'};

describe('Premier Cru wine-detail destinations',()=>{
  it('links a named Premier Cru in a title, appellation, or reference place',()=>{
    for(const fields of [
      {},{wineName:'Domaine Example Gevrey-Chambertin 1er Cru Les Cazetiers 2020'},
      {wineName:'Les Cazetiers'},{wineName:'',referenceSite:'Les Cazetiers'},
      {wineName:'',referenceParcel:'Les Cazetiers'},
      {wineName:'',appellation:'Gevrey-Chambertin Premier Cru Les Cazetiers'},
      {wineName:'Gevrey Chambertin Cazetiers',country:null,region:null},
      {wineName:'',appellation:'Les Cazetiers',region:'Gevrey-Chambertin'},
      {appellation:null},{appellation:null,region:'Gevrey-Chambertin',wineName:'Les Cazetiers'},
      {classification:null,wineName:'Gevrey-Chambertin 1er Cru Les Cazetiers'},
      {classification:null,appellation:'Gevrey-Chambertin Premier Cru'},
      {classification:null,wineName:'Gevrey-Chambertin 1erCru Les Cazetiers'},
    ])expect(burgundyAtlasPremierCru({...wine,...fields})?.url,JSON.stringify(fields)).toBe(cazetiers);
  });

  it('resolves every published mapped record using its complete village and cru name',()=>{
    const destinations=new Set<string>();
    for(const group of mapping.groups)for(const entry of group.entries){
      const result=burgundyAtlasPremierCru({country:'France',region:'Bourgogne',
        appellation:group.appellation,classification:'premier_cru',wineName:`${group.appellation} Premier Cru ${entry.name}`});
      expect(result?.url,`${group.appellation}: ${entry.name}`).toBe(`https://burgundyatlas.com${entry.path}`);
      expect(burgundyAtlasWineDetailPlace({country:'France',region:'Bourgogne',appellation:group.appellation,
        classification:'premier_cru',wineName:`${group.appellation} Premier Cru ${entry.name}`})?.url,
      `${group.appellation}: ${entry.name} must retain its specific destination`).toBe(result?.url);
      expect(result?.placeId).toMatch(/^ba_designation_[a-z2-7]+$/);
      destinations.add(result!.url);
    }
    expect(destinations.size).toBe(630);
    expect(mapping.groups).toHaveLength(29);
    expect(mapping.excludedWithoutMap).toBe(36);
  });

  it('distinguishes duplicate names by village and gives them contextual accessible names',()=>{
    const find=(appellation:string)=>burgundyAtlasPremierCru({...wine,appellation,wineName:'Les Perrières'});
    expect(find('Meursault')?.name).toBe('Meursault — Perrières');
    expect(find('Puligny-Montrachet')?.name).toBe('Puligny-Montrachet — Les Perrières');
    expect(find('Meursault')?.url).not.toBe(find('Puligny-Montrachet')?.url);
    expect(burgundyAtlasPremierCru({...wine,appellation:null,wineName:'Les Perrières'})).toBeNull();
  });

  it('keeps named clos and exact names separate from shorter names inside them',()=>{
    const find=(wineName:string)=>burgundyAtlasPremierCru({...wine,appellation:'Meursault',wineName});
    expect(find('Clos des Perrières')?.name).toBe('Meursault — Clos des Perrières');
    expect(find('Porusot')?.name).toBe('Meursault — Porusot');
    expect(find('Le Porusot')?.name).toBe('Meursault — Le Porusot');
    expect(find('Porusot')?.url).not.toBe(find('Le Porusot')?.url);
    expect(find('Perrières Clos des Perrières')).toBeNull();
  });

  it('supports accent folding, published alternative names and common article omission',()=>{
    const find=(appellation:string,wineName:string)=>burgundyAtlasPremierCru({...wine,appellation,wineName});
    expect(find('VOSNE ROMANEE','AUX BRULEES')?.name).toContain('Aux Brulées');
    expect(find('Gevrey-Chambertin','Clos Saint Jacques')?.name).toContain('Le Clos Saint-Jacques');
    expect(find('Chambolle-Musigny','Les Feusselotes')?.url).toBe(find('Chambolle-Musigny','Les Feusselottes')?.url);
    expect(find('Chablis Premier Cru','Fourchaume')?.name).toBe('Chablis — Fourchaume');
  });

  it.each([
    {country:'United States'},{region:'Bordeaux'},{region:'Côte de Beaune'},{region:'Unknown'},
    {classification:'village'},{classification:'grand_cru'},{classification:null},
    {identityMatchStatus:'conflict' as const},
    {wineName:'Les Cazetiers Grand Cru'},
    {appellation:'Meursault'},
    {wineName:'Meursault Les Cazetiers'},
    {wineName:'Les Cazetiers',referenceSite:'Meursault Perrières'},
    {referenceSite:'Clos Saint-Jacques'},
    {wineName:'Les Cazetiers Clos Saint-Jacques'},
    {wineName:'Les Cazetiers / Unknown Vineyard'},
    {wineName:'Les Cazetiers et Unknown Vineyard'},
    {wineName:'Les Cazetiers & Unknown Vineyard'},
    {wineName:'Les CazetiersUnknown'},
    {wineName:'Gevrey-Chambertin Premier Cru'},
    {wineName:'Gevrey-Chambertin Cuvée Duvault-Blochet'},
    {wineName:'Gevrey-Chambertin Unknown Vineyard'},
    {appellation:'Unknown',referenceSite:'Les Cazetiers'},
    {appellation:'Gevrey-Chambertin / Meursault'},
    {appellation:'Chassagne-Montrachet',wineName:'Chassagne-Montrachet Premier Cru'},
  ])('withholds an absent, unsupported, contradictory or ambiguous identity: %j',fields=>{
    expect(burgundyAtlasPremierCru({...wine,...fields})).toBeNull();
  });

  it('does not turn a Premier Cru La Romanée into the Grand Cru namesake',()=>{
    const result=burgundyAtlasPremierCru({...wine,wineName:'La Romanée'});
    expect(result?.name).toBe('Gevrey-Chambertin — La Romanée');
    expect(result?.url).not.toContain('ba_designation_z4rwjlfbbel4n3rsdrx5iazjca');
    expect(burgundyAtlasWineDetailPlace({...wine,classification:null,appellation:'La Romanée',
      wineName:'Gevrey-Chambertin Premier Cru La Romanée'})?.url).toBe(result?.url);
    expect(burgundyAtlasWineDetailPlace({...wine,classification:null,appellation:'La Romanée',
      wineName:'La Romanée Premier Cru'})).toBeNull();
    expect(burgundyAtlasWineDetailPlace({appellation:'La Romanée',classification:'grand_cru'})?.url)
      .toContain('ba_designation_z4rwjlfbbel4n3rsdrx5iazjca');
  });

  it('does not infer a village solely from a name inside the climat',()=>{
    expect(burgundyAtlasPremierCru({...wine,appellation:null,wineName:'Sous Blagny'})).toBeNull();
  });

  it('withholds registry records that have no mapped geographic presentation',()=>{
    expect(burgundyAtlasPremierCru({...wine,appellation:'Chablis',wineName:'Montée de Tonnerre'})).toBeNull();
  });
});
