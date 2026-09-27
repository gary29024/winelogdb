import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {burgundyVillageMapTarget} from '../../src/lib/places/burgundyVillageMap';
import {loadVillageMapCatalogue} from '../../src/lib/places/loadVillageMapCatalogue';
import config from '../../scripts/burgundy-regional-maps.json';

const base={country:'France',region:'Burgundy',classification:null,productType:'Wine',productSubtype:'Sparkling',wineStyle:'sparkling',appellation:'Crémant de Bourgogne'};
const target={villageId:'cremant-de-bourgogne',featureId:'inao-denom-561',scope:'appellation',mapKind:'regional'};

describe('Crémant de Bourgogne sparkling source overview',()=>{
 it.each(['Crémant de Bourgogne','Cremant-de-Bourgogne AOP','Crémant de Bourgogne AOC Blanc',
  'Crémant de Bourgogne Rosé','Crémant de Bourgogne Brut','Crémant de Bourgogne Extra-Brut',
  'Crémant de Bourgogne Brut Nature','Crémant de Bourgogne Pas Dosé','Crémant de Bourgogne Demi-Sec',
  'Crémant de Bourgogne Grand Éminent Brut','Crémant de Bourgogne Éminent','Crémant de Bourgogne Millésimé',
 ])('reads the full recorded denomination and reviewed label terms: %s',appellation=>{
  expect(burgundyVillageMapTarget({...base,appellation})).toMatchObject(target);
 });
 it.each(['White','Rosé',null])('accepts sparkling colour %s without inventing a separate boundary',colour=>{
  const result=burgundyVillageMapTarget({...base,colour,wineName:'Les Lavots',referenceParcel:'Les Lavots'});
  expect(result).toMatchObject(target);expect(result).not.toHaveProperty('locationContext');
 });
 it.each([
  {wineStyle:null},{productSubtype:null},{wineStyle:null,productSubtype:null,productType:null},
  {productType:'Sparkling Wine',productSubtype:'Sparkling Wine'},
  {appellation:'Bourgogne',wineName:'Crémant de Bourgogne'},
  {appellation:'Bourgogne Blanc',wineName:'Crémant-de-Bourgogne Blanc de Noirs'},
  {appellation:'Bourgogne Rosé',wineName:'Crémant de Bourgogne'},
  {appellation:'Burgundy',wineName:'Crémant de Bourgogne Brut'},
  {wineName:'Crémant de Bourgogne Aligoté'},
 ])('allows explicit identity without requiring redundant style fields: %j',fields=>{
  expect(burgundyVillageMapTarget({...base,...fields})).toMatchObject(target);
 });
 it.each(['Châtillonnais','Chablis','Grand Auxerrois','Côte de Nuits','Côte de Beaune','Côte Chalonnaise','Mâconnais','Beaujolais','Rhône'])(
  'keeps appellation scope in %s',region=>expect(burgundyVillageMapTarget({...base,region})).toMatchObject(target));
 it.each(['Blanc de Blancs','Blanc de Noirs','Blanc de Blanc','Blanc de Noir'])(
  'recognises %s as white wine, including black grapes',mention=>{
   for(const fields of [{appellation:`Crémant de Bourgogne ${mention}`},{wineName:mention}]){
    expect(burgundyVillageMapTarget({...base,...fields,colour:'White'})).toMatchObject(target);
    expect(burgundyVillageMapTarget({...base,...fields,colour:null})).toMatchObject(target);
    expect(burgundyVillageMapTarget({...base,...fields,colour:'Rosé'})).toBeNull();
   }
  });
 it.each(['Pinot Noir','Gamay','Gamay Noir','Gamay Noir à Jus Blanc','Chardonnay','Aligoté','Pinot Blanc','Pinot Gris','Melon de Bourgogne','Sacy'])(
  'does not apply still-wine colour assumptions to Crémant grapes: %s',grape=>{
   for(const colour of ['White','Rosé'])expect(burgundyVillageMapTarget({...base,appellation:`Crémant de Bourgogne ${grape}`,colour})).toMatchObject(target);
  });
 it.each([
  {appellation:null},{appellation:'Crémant'},{appellation:'Bourgogne',wineName:'Crémant'},
  {appellation:null,wineName:'Crémant de Bourgogne'},{appellation:null,referenceSite:'Crémant de Bourgogne'},
  {appellation:null,referenceParcel:'Crémant de Bourgogne'},{appellation:null,producer:'Crémant de Bourgogne'},
  {appellation:null,region:'Crémant de Bourgogne'},
  {appellation:'Bourgogne',wineName:'Domaine de Crémant-de-Bourgogne'},
  {appellation:'Bourgogne',wineName:'Crémant-de-Bourgogne-Something'},
  {appellation:'Bourgogne',wineName:'Crémant de Bourgogne',producer:'Crémant de Bourgogne'},
  {appellation:'Crémant de Bourgogne Unknown Place'},{appellation:'Crémant de Bourgogne Nouveau'},
  {appellation:'Crémant de Bourgogne Rouge'},{colour:'Red'},{wineName:'Rouge'},
  {appellation:'Crémant de Bourgogne Blanc de Noirs Rosé'},
  {appellation:'Bourgogne Rouge',wineName:'Crémant de Bourgogne'},
  {wineName:'Bourgogne Mousseux'},{wineName:'Bourgogne Aligoté'},{wineName:'Coteaux Bourguignons'},
  {appellation:'Crémant de Bourgogne Bourgogne Aligoté'},
  {wineName:'Crémant de Bourgogne Bourgogne Aligoté'},
  {wineName:'Crémant de Loire'},{wineName:'Crémant d’Alsace'},
  {wineName:'Morgon'},{referenceSite:'Beaujolais-Villages'},{referenceParcel:'Fleurie'},
  {wineName:'Grand Cru'},{wineName:'Premier Cru'},{referenceSite:'Chablis'},
  {classification:'regional'},{classification:'premier_cru'},{classification:'grand_cru'},
  {productSubtype:'Still'},{productType:'Still Wine'},{productType:'Spirit'},
  {wineStyle:'white'},{wineStyle:'rose'},{wineStyle:'red'},
  {country:'USA'},{region:'Bordeaux'},{identityMatchStatus:'conflict' as const},
 ])('withholds an incomplete or conflicting identity: %j',fields=>{
  expect(burgundyVillageMapTarget({...base,...fields})).toBeNull();
 });
 it('keeps new sparkling grape and label rules scoped to Crémant',()=>{
  const still={country:'France',region:'Burgundy',colour:'White',wineStyle:'white'};
  expect(burgundyVillageMapTarget({...still,appellation:'Coteaux Bourguignons Pinot Noir'})).toBeNull();
  expect(burgundyVillageMapTarget({...still,appellation:'Coteaux Bourguignons Blanc de Noirs'})).toBeNull();
  expect(burgundyVillageMapTarget({...still,appellation:'Bourgogne Grand Éminent'})).toBeNull();
  expect(burgundyVillageMapTarget({...base,appellation:'Bourgogne Mousseux Pinot Noir',colour:'White'})).toBeNull();
  expect(burgundyVillageMapTarget({...base,appellation:'Bourgogne Mousseux Pinot Noir',colour:'Red'})).toMatchObject({featureId:'inao-denom-391'});
 });
 it('retains all 372 communes, including Rhône and both historical Porte des Pierres Dorées rows',async()=>{
  const catalogue=await loadVillageMapCatalogue('cremant-de-bourgogne');
  expect(catalogue.features).toHaveLength(1);
  expect(catalogue.features[0]).toMatchObject({id:'inao-denom-561',appellationId:175,areaHa:103005.92});
  expect(catalogue.features[0].coverage).toBeUndefined();
  expect(catalogue.colourScope).toBe('overview');
  expect(catalogue.communes).toHaveLength(372);
  for(const [department,count] of [['21',90],['69',77],['71',152],['89',53]] as const){
   expect(catalogue.communes.filter(c=>c.id.startsWith(department))).toHaveLength(count);
  }
  expect(catalogue.communes.find(c=>c.id==='69114')?.name).toBe('Porte des Pierres Dorées');
  expect(catalogue.communes.some(c=>c.id==='69159')).toBe(false);
  expect(catalogue.communes.some(c=>c.name==='Chablis')).toBe(true);
  expect(catalogue.coverageNote).toContain('all 378 records');
  expect(catalogue.coverageNote).toContain('not a colour-specific area');
  expect(catalogue.geobufUrl).toBe('/maps/cremant-de-bourgogne.2026-09-21.pbf.gz');
  expect(catalogue.downloadTimeoutMs).toBe(120000);
  const source=config.maps.find(m=>m.id==='cremant-de-bourgogne')!;
  expect(source.sourceCommunes).toHaveLength(372);
  expect(source.communeAliases).toEqual({'69159':'69114'});
  expect(catalogue.communes.map(c=>c.id).sort()).toEqual(source.communes);
  const data=JSON.parse(readFileSync(`public${catalogue.dataUrl}`,'utf8'));
  expect(data.features).toHaveLength(373);
  expect(data.features[0].properties.communes).toEqual(source.communes);
  expect(data.features.slice(1).map((f:{id:string})=>f.id).sort()).toEqual(source.communes.map(c=>`commune-${c}`));
 });
});
