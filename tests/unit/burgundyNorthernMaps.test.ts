import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import type { FeatureCollection,MultiPolygon,Polygon } from 'geojson';
import { burgundyVillageMapTarget,type VillageMapCatalogue } from '../../src/lib/places/burgundyVillageMap';
import chablis from '../../src/lib/places/chablisVillageMapCatalogue.json';
import petit from '../../src/lib/places/petitChablisVillageMapCatalogue.json';
import irancy from '../../src/lib/places/irancyVillageMapCatalogue.json';
import saintBris from '../../src/lib/places/saintBrisVillageMapCatalogue.json';
import vezelay from '../../src/lib/places/vezelayVillageMapCatalogue.json';
import registry from '../../src/lib/places/burgundyVillageMapRegistry.json';

const premier={country:'France',region:'Burgundy',appellation:'Chablis',classification:'premier_cru',colour:'White',wineName:'Vaucoupin'};
const grand={...premier,appellation:'Chablis Grand Cru',classification:'grand_cru',wineName:'Les Clos'};
const broad={featureId:'inao-denom-438',scope:'appellation'};
const named=(c:VillageMapCatalogue,id:number)=>c.features.find(f=>f.denominationId===id)!;

describe('Chablis Premier Cru source gaps',()=>{
 const all=chablis.features.filter(f=>f.tier==='premier_cru'&&f.kind==='vineyard');
 it('keeps eight named boundaries and two explicitly partial source features',()=>{
  expect(all).toHaveLength(10);
  for(const f of all){
   const partial='coverage' in f&&f.coverage==='partial';
   for(const fields of [{wineName:f.name},{wineName:'',referenceSite:f.name},{wineName:'',appellation:`Chablis Premier Cru ${f.name}`}]){
    expect(burgundyVillageMapTarget({...premier,...fields}),f.name).toMatchObject(partial?broad:{featureId:f.id,scope:'vineyard'});
   }
  }
  expect(all.filter(f=>'coverage' in f).map(f=>f.denominationId)).toEqual([414,420]);
  expect(named(chablis,414).communes).toEqual(['89081','89175','89242']);
  expect(named(chablis,420).communes).toEqual(['89168']);
  expect(chablis.notes['inao-denom-414'].note).toContain('Chablis-Poinchy');
  expect(chablis.notes['inao-denom-420'].note).toContain('Fyé');
 });
 it('retains every missing climat in matching so it cannot vanish from a mixed label',()=>{
  const missing=registry.localPremierCrus.find(g=>g.appellation==='Chablis')!.unmappedNames;
  expect(missing).toHaveLength(30);
  for(const wineName of missing){
   expect(burgundyVillageMapTarget({...premier,wineName}),wineName).toMatchObject(broad);
   expect(burgundyVillageMapTarget({...premier,wineName:`Vaucoupin ${wineName}`}),wineName).toMatchObject(broad);
   expect(burgundyVillageMapTarget({...premier,wineName,classification:null}),wineName).toBeNull();
  }
  for(const wineName of ['Fourchaume Vaulorent','Les Beauregards Côte de Cuisy','Les Fourneaux Morein','Vaupulent et Vaulorent']){
   expect(burgundyVillageMapTarget({...premier,wineName}),wineName).toMatchObject(broad);
  }
 });
 it('accepts reviewed label spellings and geometric umbrellas without making new polygons',()=>{
  for(const wineName of ['Les Vaucopins','Domaine Long-Depaquit Chablis Premier Cru Les Vaucopins']){
   expect(burgundyVillageMapTarget({...premier,wineName})?.featureId).toBe('inao-denom-432');
  }
  expect(burgundyVillageMapTarget({...premier,wineName:'Fourchaume Vaupulent'})?.featureId).toBe('inao-denom-435');
  expect(burgundyVillageMapTarget({...premier,wineName:'Vosgros Vaugiraut'})?.featureId).toBe('inao-denom-433');
  expect(burgundyVillageMapTarget({...premier,wineName:'Vaucoupin',classification:'village'})?.featureId).toBe('inao-denom-397');
 });
});

describe('Chablis Grand Cru',()=>{
 it.each(chablis.features.filter(f=>f.kind==='vineyard'&&f.tier==='grand_cru'))('selects the full $name climat, without inventing an Atlas page',f=>{
  for(const fields of [{wineName:f.name},{wineName:'',referenceSite:f.name},{wineName:'',referenceParcel:f.name},
   {appellation:`Chablis Grand Cru ${f.name}`,wineName:''},{appellation:'Chablis',wineName:f.name},
   {colour:'',wineStyle:'white',wineName:f.name},{classification:null,wineName:f.name},
   {appellation:'Chablis',classification:null,wineName:`Chablis Grand Cru ${f.name}`}]){
   expect(burgundyVillageMapTarget({...grand,...fields}),JSON.stringify(fields)).toMatchObject({villageId:'chablis',featureId:f.id,scope:'vineyard'});
  }
  expect(f.atlasUrl).toBeNull();expect(f.parentAppellation).toBe('Chablis Grand Cru');
 });
 it('accepts Long-Depaquit label plurals as the same source climat',()=>{
  for(const [wineName,id] of [['Les Blanchots',440],['Les Preuses',444],['Les Vaudésirs',446]] as const){
   expect(burgundyVillageMapTarget({...grand,wineName:`Domaine Long-Depaquit Chablis Grand Cru ${wineName}`})?.featureId).toBe(`inao-denom-${id}`);
  }
 });
 it.each(['Chablis Grand Cru','La Moutonne','La Moutonne Vaudésir','La Moutonne Les Preuses','Unknown climat','Les Clos et Valmur','Les Clos / unknown','Le Clos','Clos des Hospices'])('keeps broad scope for %s',wineName=>{
  expect(burgundyVillageMapTarget({...grand,wineName})).toMatchObject({featureId:'inao-denom-439',scope:'appellation'});
 });
 it('requires Grand Cru evidence and never borrows a climat for another tier',()=>{
  for(const wineName of ['Blanchot','Les Blanchots','Bougros','Les Clos','Grenouilles','Les Preuses','Valmur','Vaudésir','Les Vaudésirs','La Moutonne','Moutonne']){
   expect(burgundyVillageMapTarget({...grand,appellation:'Chablis',classification:null,wineName}),wineName).toBeNull();
  }
  for(const classification of ['village','premier_cru',null]){
   const result=burgundyVillageMapTarget({...grand,appellation:'Chablis',classification});
   expect(result?.scope).not.toBe('vineyard');
  }
  expect(burgundyVillageMapTarget({...grand,appellation:'Petit Chablis',classification:'village'})).toMatchObject({featureId:'inao-denom-1024',scope:'appellation'});
  for(const fields of [{colour:'Red'},{colour:'Rosé'},{colour:'',wineStyle:'red'},{country:'USA'},{region:'Côte de Nuits'},
   {classification:'village'},{classification:'premier_cru'},{identityMatchStatus:'conflict' as const},
   {referenceSite:'Petit Chablis'},{referenceSite:'Pommard'},{wineName:'Chablis Premier Cru Les Clos'}]){
   expect(burgundyVillageMapTarget({...grand,...fields}),JSON.stringify(fields)).toBeNull();
  }
 });
});

describe.each([
 {c:chablis,id:397,colour:'White',codes:['89034','89039','89068','89081','89095','89104','89112','89123','89168','89175','89226','89227','89242','89303','89315','89477','89482']},
 {c:petit,id:1024,colour:'White',codes:['89034','89039','89068','89081','89095','89104','89112','89123','89168','89175','89226','89227','89242','89303','89315','89477','89482']},
 {c:irancy,id:1288,colour:'Red',codes:['89130','89202','89479']},
 {c:saintBris,id:1597,colour:'White',codes:['89108','89202','89319','89337','89479']},
 {c:vezelay,id:2829,colour:'White',codes:['89021','89364','89409','89446']},
])('$c.name geography and village scope',({c,id,colour,codes})=>{
 const wine={...premier,appellation:c.name,classification:'village',colour,wineName:'Unknown named vineyard'};
 it('retains broad scope, its own colour and every producing commune',()=>{
  expect(burgundyVillageMapTarget(wine)).toMatchObject({villageId:c.id,featureId:`inao-denom-${id}`,scope:'appellation'});
  expect(burgundyVillageMapTarget({...wine,colour:'',wineStyle:colour.toLowerCase()})?.featureId).toBe(`inao-denom-${id}`);
  expect(named(c,id).communes).toEqual(codes);
  expect(c.communes.map(commune=>commune.id)).toEqual(codes);
  for(const fields of [{country:'Italy'},{region:'Côte de Beaune'},{colour:colour==='Red'?'White':'Red'},{colour:'Rosé'},
   ...(c.id==='chablis'?[]:[{classification:'grand_cru'}]),{identityMatchStatus:'conflict' as const}]){
   expect(burgundyVillageMapTarget({...wine,...fields}),JSON.stringify(fields)).toBeNull();
  }
  if(c.id!=='chablis')expect(burgundyVillageMapTarget({...wine,classification:'premier_cru'})).toBeNull();
 });
 it('ships closed geographic rings, original source IDs and hashed provenance',()=>{
  const data=JSON.parse(readFileSync(`public${c.dataUrl}`,'utf8')) as FeatureCollection<Polygon|MultiPolygon>;
  expect(data.features.map(f=>f.id).sort()).toEqual([...c.features.map(f=>f.id),...codes.map(code=>`commune-${code}`)].sort());
  for(const f of data.features){
   const rings=f.geometry.type==='Polygon'?f.geometry.coordinates:f.geometry.coordinates.flat();
   for(const ring of rings){
    expect(ring.length).toBeGreaterThanOrEqual(4);expect(ring[0]).toEqual(ring.at(-1));
    expect(ring.every(([lng,lat])=>lng>3.5&&lng<4&&lat>47.4&&lat<48)).toBe(true);
   }
  }
  expect(c.sources).toHaveLength(codes.length+1);
  expect(c.sources.every(s=>s.sha256.length===64&&s.license.startsWith('Licence Ouverte'))).toBe(true);
 });
});
