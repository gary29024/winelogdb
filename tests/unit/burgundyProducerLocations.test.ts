import { describe,expect,it } from 'vitest';
import { burgundyVillageMapTarget } from '../../src/lib/places/burgundyVillageMap';
import { burgundyAtlasPremierCru,burgundyAtlasWineDetailPlace } from '../../src/lib/places/burgundyAtlasPremierCru';
import { producerLocations } from '../../src/lib/places/burgundyProducerLocations';
import fuisse from '../../src/lib/places/pouillyFuisseVillageMapCatalogue.json';
import chablis from '../../src/lib/places/chablisVillageMapCatalogue.json';

const wine={producer:'Domaine Ferret',country:'France',region:'Mâconnais',appellation:'Pouilly-Fuissé',
 wineName:'Le Clos',vintage:2018,classification:'village',colour:'White'};

describe('reviewed producer vineyard locations',()=>{
 it.each(['village','premier_cru',null])('locates Ferret independently of recorded tier %s, without changing the wine',classification=>{
  for(const vintage of [2018,2019,2020,2023,null]){
   const input=Object.freeze({...wine,classification,vintage}),before={...input};
   const target=burgundyVillageMapTarget(input);
   expect(target).toMatchObject({featureId:'inao-denom-2873',scope:'vineyard',locationContext:{
    sourceUrl:producerLocations[0].sourceUrl,
   }});
   expect(target?.locationContext?.note).toContain('whole climat');
   expect(target?.locationContext?.note).toContain('Pre-2020 bottles were village wines');
   expect(input).toEqual(before);
   expect(burgundyAtlasPremierCru(input)).toBeNull();
   const link=burgundyAtlasWineDetailPlace(input);
   if(classification===null)expect(link).toBeNull();
   else expect(link).toMatchObject({scope:'appellation',name:classification==='village'?'Pouilly-Fuissé':'Pouilly-Fuissé Premier Cru'});
  }
 });
 it('accepts reviewed full names and consistent reference metadata',()=>{
  for(const fields of [
   {wineName:'Pouilly-Fuissé Tête de Cru "Le Clos" 2018'},
   {wineName:'Domaine Ferret Pouilly-Fuissé Le Clos'},
   {producer:'J.A. Ferret',wineName:'Tête de Cru Le Clos'},
   {producer:null,wineName:'Domaine Ferret Pouilly-Fuissé Le Clos'},
   {producer:null,wineName:'Ferret Le Clos'},
   {wineName:'Le Clos de Jeanne',vintage:2020},
   {wineName:'Clos de Jeanne',referenceSite:'Les Perrières'},
   {wineName:'Le Clos',referenceSite:'Les Perrières',referenceParcel:'Clos de Jeanne'},
   {wineName:'Pouilly-Fuissé',referenceSite:'Le Clos'},
   {wineName:'',referenceParcel:'Le Clos'},
   {appellation:'Pouilly-Fuissé Le Clos',wineName:''},
  ])expect(burgundyVillageMapTarget({...wine,...fields}),JSON.stringify(fields)).toMatchObject({featureId:'inao-denom-2873',locationContext:expect.any(Object)});
 });
 it('keeps missing, ambiguous and conflicting producers broad',()=>{
  for(const fields of [
   {producer:null},{producer:''},{producer:'Unknown'},{producer:'Ferret & Château Fuissé'},
   {producer:'Domaine Ferret et Fils'},{producer:'Jean Ferret'},{producer:'Ferretti'},
   {producer:'Château Fuissé',wineName:'Domaine Ferret Le Clos'},
   {producer:'Domaine Ferret',wineName:'Château Fuissé Le Clos'},
   {producer:null,wineName:'Some merchant Ferret Le Clos'},
   {producer:null,wineName:'Château Fuissé et Domaine Ferret Le Clos'},
  ]){
   for(const classification of ['village','premier_cru']){
    const input={...wine,classification,...fields};
    expect(burgundyVillageMapTarget(input),JSON.stringify(input)).toMatchObject({
     featureId:classification==='village'?'inao-denom-1055':'inao-denom-2865',scope:'appellation',
    });
    expect(burgundyAtlasPremierCru(input)).toBeNull();
   }
  }
 });
 it('keeps unknown suffixes, blends, other crus and reference conflicts broad',()=>{
  for(const fields of [
   {wineName:'Le Clos des Prouges'},{wineName:'Le Clos du Moulin'},{wineName:'Le Clos inconnu'},
   {wineName:'Le Clos et Les Crays'},{wineName:'Le Clos / Les Crays'},
   {wineName:'Le Clos + Les Perrières'},{wineName:'Le Clos & Les Perrières'},
   {wineName:'Le Clos Les Crays'},{wineName:'Le Clos assemblage'},
   {referenceSite:'Les Crays'},{referenceParcel:'Unknown parcel'},
   {referenceSite:'Les Perrières et Les Crays'},
  ])expect(burgundyVillageMapTarget({...wine,...fields}),JSON.stringify(fields)).toMatchObject({featureId:'inao-denom-1055',scope:'appellation'});
 });
 it('preserves all shared geography, colour and identity conflict guards',()=>{
  for(const fields of [
   {country:'USA'},{region:'Loire'},{appellation:'Mâcon-Fuissé'},{appellation:'Pouilly-Fumé'},
   {appellation:'Meursault'},{appellation:'Pouilly-Vinzelles'},
   {referenceSite:'Meursault Les Perrières'},
   {identityMatchStatus:'conflict' as const},{colour:'Red'},{colour:'Rosé'},
   {colour:null,wineStyle:'red'},{classification:'grand_cru'},
   {wineName:'Le Clos Grand Cru'},
  ]){
   const target=burgundyVillageMapTarget({...wine,...fields});
   expect(target?.featureId,JSON.stringify(fields)).not.toBe('inao-denom-2873');
   expect(target?.locationContext).toBeUndefined();
  }
 });
 it('retains Château Fuissé’s distinct Le Clos and other Perrières maps',()=>{
  for(const fields of [
   {producer:'Château Fuissé'},{producer:'Château de Fuissé'},
   {producer:null,wineName:'Château Fuissé Pouilly-Fuissé Le Clos Monopole'},
  ]){
   const input={...wine,classification:'premier_cru',...fields};
   expect(burgundyVillageMapTarget(input)).toMatchObject({featureId:'inao-denom-2870'});
   expect(burgundyVillageMapTarget(input)?.locationContext).toBeUndefined();
   expect(burgundyAtlasPremierCru(input)?.name).toBe('Pouilly-Fuissé — Le Clos');
  }
  expect(burgundyVillageMapTarget({...wine,producer:'Domaine Example',region:'Burgundy',appellation:'Meursault',wineName:'Perrières',classification:'premier_cru'})?.featureId).toBe('inao-denom-858');
 });
 it('backs the producer alias with an existing containing boundary and primary evidence',()=>{
  const entry=producerLocations[0];
  expect(fuisse.features.find(feature=>feature.matchId===entry.matchId)).toMatchObject({id:'inao-denom-2873',name:entry.climat});
  expect(entry.renamedFromVintage).toBe(2020);
  expect(new URL(entry.sourceUrl).hostname).toBe('www.domaine-ferret.com');
  expect(new URL(entry.homonym!.sourceUrl).hostname).toBe('chateau-fuisse.fr');
 });
 it('accepts the documented Domaine Vincent producer field only for Pouilly-Fuissé Le Clos',()=>{
  const base={...wine,producer:'Domaine Vincent',classification:'premier_cru'};
  for(const fields of [{},{producer:' DOMAINE VINCENT '},{wineName:'Pouilly-Fuissé 1er Cru Le Clos Monopole'},
   {wineName:'Pouilly-Fuissé',referenceSite:'Le Clos'}]){
   const input={...base,...fields};
   expect(burgundyVillageMapTarget(input)).toMatchObject({featureId:'inao-denom-2870',scope:'vineyard'});
   expect(burgundyAtlasPremierCru(input)?.name).toBe('Pouilly-Fuissé — Le Clos');
   expect(burgundyVillageMapTarget(input)?.locationContext).toBeUndefined();
  }
  for(const fields of [{wineName:'Le Clos et Les Crays'},{referenceSite:'Les Perrières'},
   {wineName:'Domaine Ferret Le Clos'},{wineName:'Marie-Antoinette'}]){
   expect(burgundyVillageMapTarget({...base,...fields})).toMatchObject({featureId:'inao-denom-2865',scope:'appellation'});
  }
  const villageWine={...base,classification:'village',vintage:2018};
  expect(burgundyVillageMapTarget(villageWine)?.featureId).toBe('inao-denom-1055');
  expect(burgundyVillageMapTarget({...base,classification:null})).toBeNull();
  for(const fields of [{appellation:'Meursault'},{appellation:'Pouilly-Loché'},{appellation:'Mâcon-Fuissé'},
   {country:'USA'},{region:'Loire'},{colour:'Red'},{identityMatchStatus:'conflict' as const}]){
   expect(burgundyVillageMapTarget({...base,...fields})?.featureId).not.toBe('inao-denom-2870');
  }
 });
 it('does not treat Vincent as a surname wildcard or an ambiguous title prefix',()=>{
  for(const fields of [
   {producer:'Vincent'},{producer:'Famille Vincent'},{producer:'Domaine Vincent Cornin'},
   {producer:'Domaine Vincent Girardin'},{producer:'Domaine Vincent et Fils'},
   {producer:null,wineName:'Domaine Vincent Pouilly-Fuissé Le Clos'},
   {producer:null,wineName:'Domaine Vincent Cornin Pouilly-Fuissé Le Clos'},
  ])expect(burgundyVillageMapTarget({...wine,classification:'premier_cru',...fields})).toMatchObject({featureId:'inao-denom-2865',scope:'appellation'});
  // Cornin's actual longer climat name still selects its own reviewed boundary.
  expect(burgundyVillageMapTarget({...wine,producer:'Domaine Vincent Cornin',wineName:'Le Clos Reyssier',classification:'premier_cru'})?.featureId).toBe('inao-denom-2867');
 });
});

describe('La Moutonne producer illustration',()=>{
 const grand={country:'France',region:'Burgundy',appellation:'Chablis Grand Cru',classification:'grand_cru',colour:'White',wineName:'La Moutonne'};
 it('locates the unique monopole with its one-off approximation, with or without producer metadata',()=>{
  for(const fields of [{},{wineName:'Moutonne'},{producer:'Domaine Long-Depaquit'},
   {producer:'Albert Bichot',wineName:'Domaine Long-Depaquit La Moutonne Monopole'},
   {wineName:'Albert Bichot Domaine Long-Depaquit Chablis Grand Cru Moutonne 2020'},
   {wineName:'Chablis Grand Cru',referenceSite:'La Moutonne'},
   {wineName:'',referenceParcel:'La Moutonne'},
   {appellation:'Chablis Grand Cru La Moutonne',wineName:''},
   {appellation:'Chablis',wineName:'La Moutonne'},
   {appellation:'Chablis',classification:null,wineName:'Chablis Grand Cru La Moutonne'}]){
   const input=Object.freeze({...grand,...fields}),before={...input};
   const target=burgundyVillageMapTarget(input);
   expect(target,JSON.stringify(fields)).toMatchObject({villageId:'chablis',featureId:'inao-denom-439',locationContext:{
    selectionId:'location-long-depaquit-la-moutonne',name:'La Moutonne',featureIds:['inao-denom-446','inao-denom-444'],
    approximateOutline:'la-moutonne',
   }});
   expect(target?.locationContext?.note).toContain('schematic');
   expect(target?.locationContext?.note).toContain('larger than the stated holding');
   expect(input).toEqual(before);
  }
 });
 it('never treats blends, unknown names or conflicting producers/references as a location',()=>{
  for(const fields of [{producer:'Unknown'},{producer:'Domaine Example'},
   {wineName:'La Moutonne Vaudésir'},{wineName:'La Moutonne Les Preuses'},
   {wineName:'La Moutonne et Les Clos'},{wineName:'La Moutonne / Les Preuses'},
   {wineName:'La Moutonne & Vaudésir'},{wineName:'La Moutonne + Valmur'},
   {wineName:'La Moutonne inconnue'},{wineName:'Some merchant La Moutonne'},
   {wineName:'Domaine Raveneau La Moutonne',producer:'Albert Bichot'},
   {referenceSite:'Vaudésir'},{referenceParcel:'Les Preuses'},
   {referenceSite:'Unknown parcel'},{referenceSite:'Les Clos'},
  ]){
   const target=burgundyVillageMapTarget({...grand,...fields});
   expect(target,JSON.stringify(fields)).toMatchObject({featureId:'inao-denom-439',scope:'appellation'});
   expect(target?.locationContext).toBeUndefined();
  }
 });
 it('requires verified Grand Cru geography, classification and colour',()=>{
  for(const fields of [{country:'USA'},{region:'Loire'},{appellation:'Corton'},
   {appellation:'Petit Chablis'},{classification:'village'},{classification:'premier_cru'},
   {appellation:'Chablis',classification:null},{identityMatchStatus:'conflict' as const},
   {colour:'Red'},{colour:'Rosé'},{colour:null,wineStyle:'red'},
   {referenceSite:'Meursault'},{wineName:'La Moutonne Premier Cru'},
  ])expect(burgundyVillageMapTarget({...grand,...fields})?.locationContext,JSON.stringify(fields)).toBeUndefined();
 });
 it('keeps the illustration separate from the official climat catalogue and exclusive to La Moutonne',()=>{
  const entry=producerLocations.find(location=>location.id==='long-depaquit-la-moutonne')!;
  expect(entry.containingMatchIds?.map(id=>chablis.features.find(f=>f.matchId===id)?.name)).toEqual(['Vaudésir','Les Preuses']);
  expect(chablis.features.some(f=>f.name==='La Moutonne')).toBe(false);
  expect(producerLocations.filter(location=>location.approximateOutline).map(location=>location.id)).toEqual(['long-depaquit-la-moutonne']);
  expect(burgundyVillageMapTarget(wine)?.locationContext?.approximateOutline).toBeUndefined();
  for(const feature of chablis.features){
   expect(burgundyVillageMapTarget({...grand,wineName:feature.name})?.locationContext?.approximateOutline).toBeUndefined();
  }
  expect(new URL(entry.sourceUrl).hostname).toBe('www.albert-bichot.com');
 });
});
