import {describe,it,expect} from 'vitest';
import {burgundyVillageMapTarget} from '../../src/lib/places/burgundyVillageMap';
import {loadVillageMapCatalogue} from '../../src/lib/places/loadVillageMapCatalogue';

const base={country:'France',region:'Burgundy',classification:null,productType:'Wine',productSubtype:'Still',appellation:'Bourgogne Aligoté'};

describe('Bourgogne Aligoté source overview',()=>{
 it.each(['Bourgogne Aligoté','Bourgogne Aligote AOC','Bourgogne-Aligoté AOP','Bourgogne Aligoté Blanc','Bourgogne Aligoté White'])(
  'opens its own regional AOC for %s',appellation=>{
   expect(burgundyVillageMapTarget({...base,appellation,wineName:'Vieilles Vignes',colour:'White'}))
    .toMatchObject({villageId:'bourgogne-aligote',featureId:'inao-denom-389',scope:'appellation',mapKind:'regional'});
  });
 it.each(['Côte d’Or','Côte de Nuits','Côte de Beaune','Côte Chalonnaise','Mâconnais','Yonne','Saône-et-Loire','Chablis','Grand Auxerrois','Chablis et Grand Auxerrois'])(
  'keeps appellation scope with region %s',region=>{
   expect(burgundyVillageMapTarget({...base,region,colour:'White'})).toMatchObject({featureId:'inao-denom-389'});
  });
 it.each([
  {colour:null},{wineStyle:'white'},{wineName:'Aligoté Vieilles Vignes'},
  {wineName:'Les Champs',referenceParcel:'Les Champs'},
  {wineName:'Domaine de Chitry Vieilles Vignes',producer:'Domaine de Chitry'},
  {wineName:'Bourgogne Aligoté Vin de Bourgogne'},
 ])('does not infer a plot from label context %j',fields=>{
  const target=burgundyVillageMapTarget({...base,...fields});
  expect(target).toMatchObject({featureId:'inao-denom-389',scope:'appellation'});
  expect(target).not.toHaveProperty('locationContext');
 });
 it.each([
  {appellation:null,wineName:'Bourgogne Aligoté'},
  {appellation:null,referenceSite:'Bourgogne Aligoté'},
  {appellation:null,referenceParcel:'Bourgogne Aligoté'},
  {appellation:null,producer:'Bourgogne Aligoté'},
  {appellation:'Aligoté'},
  {appellation:'Bourgogne Aligoté Unknown Place'},
  {appellation:'Bourgogne Aligoté Rouge'},{appellation:'Bourgogne Aligoté Clairet'},
  {appellation:'Bourgogne Aligoté Rosé'},{appellation:'Bourgogne Aligoté Chardonnay'},
  {appellation:'Bourgogne Aligoté Pinot Noir'},{appellation:'Bourgogne Aligoté Gamay'},
  {colour:'Red'},{colour:'Rosé'},{wineStyle:'red'},{wineStyle:'rose'},
  {colour:'White',wineStyle:'red'},{wineName:'Clairet'},{wineName:'Rouge'},
  {wineName:'Chardonnay'},{wineName:'Passetoutgrain'},
  {wineName:'Bouzeron'},{referenceSite:'Bouzeron'},{wineName:'Bourgogne Chitry'},
  {wineName:'Mâcon-Villages'},{referenceParcel:'Bourgogne Côte d’Or'},
  {wineName:'Crémant de Bourgogne'},{wineName:'Bourgogne Mousseux'},
  {wineName:'Premier Cru'},{wineName:'Grand Cru'},
  {country:'USA'},{region:'Bordeaux'},{region:'Beaujolais'},{region:'Rhône'},
  {classification:'village'},{classification:'premier_cru'},{classification:'grand_cru'},
  {productType:'Spirit'},{productSubtype:'Sparkling'},{wineStyle:'sparkling'},
  {identityMatchStatus:'conflict' as const},
 ])('withholds insufficient or contradictory evidence %j',fields=>{
  expect(burgundyVillageMapTarget({...base,...fields})).toBeNull();
 });
 it('preserves Bouzeron as a separate village appellation',()=>{
  expect(burgundyVillageMapTarget({...base,appellation:'Bouzeron',region:'Côte Chalonnaise',classification:'village',colour:'White'}))
   .toMatchObject({villageId:'bouzeron',scope:'appellation'});
 });
 it('keeps the source gap visible without claiming mixed-colour scope',async()=>{
  const catalogue=await loadVillageMapCatalogue('bourgogne-aligote');
  expect(catalogue.features).toHaveLength(1);
  expect(catalogue.features[0]).toMatchObject({id:'inao-denom-389',appellationId:140,coverage:'partial',areaHa:54991.42});
  expect(catalogue.communes).toHaveLength(272);
  expect(catalogue.communes.filter(c=>c.id.startsWith('21'))).toHaveLength(90);
  expect(catalogue.communes.filter(c=>c.id.startsWith('71'))).toHaveLength(145);
  expect(catalogue.communes.filter(c=>c.id.startsWith('89'))).toHaveLength(37);
  expect(catalogue.coverageNote).toContain('white-wine production boundaries');
  expect(catalogue.coverageNote).toContain('not the complete appellation');
  expect(catalogue.colourScope).toBeUndefined();
  expect(catalogue.geobufUrl).toBe('/maps/bourgogne-aligote.2026-09-21.pbf.gz');
  expect(catalogue.downloadTimeoutMs).toBe(60000);
  expect(catalogue.communes.find(c=>c.id==='71372')?.name).toBe('Romanèche-Thorins');
 });
});

describe('Bourgogne Aligoté review cases',()=>{
 // Plain Bourgogne cannot be made from Aligoté, so a plain or white Bourgogne
 // record naming the grape is Bourgogne Aligoté.
 it.each([
  {appellation:'Bourgogne',wineName:'Aligoté'},
  {appellation:'Bourgogne Blanc',wineName:'Aligoté Vieilles Vignes',colour:'White'},
  {appellation:'Burgundy',wineName:'Aligoté'},
  {appellation:'Bourgogne',wineName:'Bourgogne Aligoté'},
  {appellation:'Bourgogne',wineName:'Aligoté',region:'Chablis'},
  {appellation:'Bourgogne',wineName:'Bourgogne-Aligoté'},
  {appellation:'Bourgogne Blanc',wineName:'Bourgogne-Aligoté Vieilles Vignes'},
  {appellation:'Bourgogne Vieilles Vignes',wineName:'Aligoté'},
  {appellation:'Bourgogne Blanc Vieille Vigne',wineName:'Bourgogne-Aligoté'},
 ])('reads a split plain Bourgogne + Aligoté label %j',wine=>{
  expect(burgundyVillageMapTarget({...base,...wine})).toMatchObject({featureId:'inao-denom-389',mapKind:'regional'});
 });
 it.each([
  {appellation:'Bourgogne',wineName:'Aligoté',colour:'Red'},
  {appellation:'Bourgogne Rouge',wineName:'Aligoté'},
  {appellation:'Bourgogne',wineName:'Aligoté Bouzeron'},
  {appellation:'Bourgogne',wineName:'Aligoté Meursault'},
  {appellation:'Bourgogne',wineName:'Aligoté Chardonnay'},
  {appellation:'Bourgogne Rouge Vieilles Vignes',wineName:'Aligoté'},
  {appellation:'Bourgogne Rosé Vieilles Vignes',wineName:'Aligoté'},
  {appellation:'Bourgogne Clairet Vieilles Vignes',wineName:'Aligoté'},
  {appellation:'Bourgogne Chardonnay Vieilles Vignes',wineName:'Aligoté'},
  {appellation:'Bourgogne Vieilles Vignes Premier Cru',wineName:'Aligoté'},
  {appellation:'Bourgogne Vieilles Vignes',wineName:'Aligoté Bouzeron'},
  {appellation:'Bourgogne Vieilles Vignes',wineName:'Domaine de Bourgogne-Aligoté',producer:'Domaine de Bourgogne-Aligoté'},
  {appellation:'Bourgogne',wineName:'Domaine de Bourgogne-Aligoté'},
  {appellation:'Bourgogne',wineName:'Bourgogne-Aligoté-Something'},
 ])('withholds a contradictory split Aligoté label %j',wine=>{
  expect(burgundyVillageMapTarget({...base,...wine})).toBeNull();
 });
 // The reviewed Bourgogne AOC 138 denominations exclude Aligoté.
 it.each([
  ['Bourgogne Hautes Côtes de Nuits','White'],['Bourgogne Hautes Côtes de Beaune','White'],
  ['Bourgogne Côte d’Or','White'],['Bourgogne Côte Chalonnaise','White'],
  ['Bourgogne Chitry','White'],['Bourgogne Coulanges-la-Vineuse','White'],
  ['Bourgogne Côte Saint-Jacques','White'],['Bourgogne Côtes du Couchois','Red'],
  ['Bourgogne Épineuil','Red'],['Bourgogne La Chapelle Notre-Dame','White'],
  ['Bourgogne Le Chapitre','White'],['Bourgogne Montrecul','White'],['Bourgogne Tonnerre','White'],
 ])('withholds %s when the wine name says Aligoté',(appellation,colour)=>{
  expect(burgundyVillageMapTarget({...base,appellation,wineName:'Vieilles Vignes',colour}))
   .toMatchObject({mapKind:'regional'});
  expect(burgundyVillageMapTarget({...base,appellation,wineName:'Aligoté',colour})).toBeNull();
 });
 // Keep an explicit Mâcon identity when a label mentions a grape blend.
 // Resolving a recorded AOC does not certify its grape proportions or vintage.
 it.each([
  ['Mâcon','inao-denom-1713'],
  ['Mâcon-Villages','inao-denom-2893'],
  ['Mâcon Lugny','inao-denom-1726'],
 ])('does not impose Bourgogne grape exclusions on %s',(appellation,featureId)=>{
  expect(burgundyVillageMapTarget({...base,appellation,wineName:'Chardonnay avec Aligoté',colour:'White'}))
   .toMatchObject({featureId,mapKind:'regional'});
  expect(burgundyVillageMapTarget({...base,appellation,wineName:'Bourgogne Aligoté',colour:'White'})).toBeNull();
 });
 it('still opens Montrecul-style sites without Aligoté and rejects them with it',()=>{
  expect(burgundyVillageMapTarget({...base,appellation:'Bourgogne',wineName:'Montrecul',colour:'White'})).toMatchObject({featureId:'inao-denom-373'});
  expect(burgundyVillageMapTarget({...base,appellation:'Bourgogne',wineName:'Montrecul Aligoté',colour:'White'})).toBeNull();
 });
 it.each([
  ['Bourgogne Vieilles Vignes','Montrecul','inao-denom-373'],
  ['Mâcon Blanc Vieilles Vignes','Lugny','inao-denom-1726'],
 ])('normalises old-vine wording on a split base: %s + %s',(appellation,wineName,featureId)=>{
  expect(burgundyVillageMapTarget({...base,appellation,wineName,colour:'White'})).toMatchObject({featureId});
 });
 // Old vines is a label mention, not part of the denomination.
 it.each([
  ['Bourgogne Aligoté Vieilles Vignes','inao-denom-389','White'],
  ['Bourgogne Aligoté Vieille Vigne','inao-denom-389','White'],
  ['Bourgogne Vieilles Vignes','inao-denom-362','Red'],
  ['Mâcon-Villages Vieilles Vignes','inao-denom-2893','White'],
  ['Mâcon Fuissé Vieilles Vignes','inao-denom-2069','White'],
  ['Bourgogne Hautes Côtes de Nuits Vieilles Vignes','inao-denom-364','Red'],
 ])('accepts %s in the appellation field',(appellation,featureId,colour)=>{
  expect(burgundyVillageMapTarget({...base,appellation,colour})).toMatchObject({featureId,mapKind:'regional'});
 });
 it.each(['Bourgogne Aligoté Vieilles Vignes Rouge','Bourgogne Vieilles Vignes Premier Cru','Mâcon-Villages Vieilles Vignes Rouge'])(
  'still withholds contradictions around Vieilles Vignes in %s',appellation=>{
   expect(burgundyVillageMapTarget({...base,appellation,colour:null})).toBeNull();
  });
});
