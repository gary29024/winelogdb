import { readdirSync,readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { clickOrder,countLabel,joinPlaces,snapshotLabel,umbrellaNote,burgundyVillageMapTarget,type VillageMapCatalogue } from '../../src/lib/places/burgundyVillageMap';
import catalogue from '../../src/lib/places/burgundyVillageMapCatalogue.json';
import morey from '../../src/lib/places/moreyVillageMapCatalogue.json';
import chambolle from '../../src/lib/places/chambolleVillageMapCatalogue.json';
import vosne from '../../src/lib/places/vosneVillageMapCatalogue.json';
import fixin from '../../src/lib/places/fixinVillageMapCatalogue.json';
import vougeot from '../../src/lib/places/vougeotVillageMapCatalogue.json';
import nuits from '../../src/lib/places/nuitsVillageMapCatalogue.json';
import marsannay from '../../src/lib/places/marsannayVillageMapCatalogue.json';
import coteNuits from '../../src/lib/places/coteNuitsVillageMapCatalogue.json';
import meursault from '../../src/lib/places/meursaultVillageMapCatalogue.json';
import puligny from '../../src/lib/places/pulignyVillageMapCatalogue.json';
import chassagne from '../../src/lib/places/chassagneVillageMapCatalogue.json';
import saintAubin from '../../src/lib/places/saintAubinVillageMapCatalogue.json';
import blagny from '../../src/lib/places/blagnyVillageMapCatalogue.json';
import aloxe from '../../src/lib/places/aloxeVillageMapCatalogue.json';
import pernand from '../../src/lib/places/pernandVillageMapCatalogue.json';
import ladoix from '../../src/lib/places/ladoixVillageMapCatalogue.json';
import beaune from '../../src/lib/places/beauneVillageMapCatalogue.json';
import pommard from '../../src/lib/places/pommardVillageMapCatalogue.json';
import volnay from '../../src/lib/places/volnayVillageMapCatalogue.json';
import savigny from '../../src/lib/places/savignyVillageMapCatalogue.json';
import chorey from '../../src/lib/places/choreyVillageMapCatalogue.json';
import auxey from '../../src/lib/places/auxeyVillageMapCatalogue.json';
import monthelie from '../../src/lib/places/monthelieVillageMapCatalogue.json';
import saintRomain from '../../src/lib/places/saintRomainVillageMapCatalogue.json';
import santenay from '../../src/lib/places/santenayVillageMapCatalogue.json';
import maranges from '../../src/lib/places/marangesVillageMapCatalogue.json';
import coteBeaune from '../../src/lib/places/coteBeauneVillageMapCatalogue.json';
import coteBeauneVillages from '../../src/lib/places/coteBeauneVillagesMapCatalogue.json';
import bouzeron from '../../src/lib/places/bouzeronVillageMapCatalogue.json';
import rully from '../../src/lib/places/rullyVillageMapCatalogue.json';
import mercurey from '../../src/lib/places/mercureyVillageMapCatalogue.json';
import givry from '../../src/lib/places/givryVillageMapCatalogue.json';
import montagny from '../../src/lib/places/montagnyVillageMapCatalogue.json';
import pouillyFuisse from '../../src/lib/places/pouillyFuisseVillageMapCatalogue.json';
import pouillyLoche from '../../src/lib/places/pouillyLocheVillageMapCatalogue.json';
import pouillyVinzelles from '../../src/lib/places/pouillyVinzellesVillageMapCatalogue.json';
import saintVeran from '../../src/lib/places/saintVeranVillageMapCatalogue.json';
import vireClesse from '../../src/lib/places/vireClesseVillageMapCatalogue.json';
import registry from '../../src/lib/places/burgundyVillageMapRegistry.json';
import { loadVillageMapCatalogue } from '../../src/lib/places/loadVillageMapCatalogue';
import type { FeatureCollection,MultiPolygon,Polygon } from 'geojson';
import coverage from '../../scripts/burgundy-map-coverage.json';
import mapConfig from '../../scripts/burgundy-villages.json';
import appellationLinks from '../../src/lib/places/burgundyAtlasAppellationLinks.json';

const catalogues:VillageMapCatalogue[]=[catalogue,morey,chambolle,vosne,fixin,vougeot,nuits,marsannay,coteNuits,meursault,puligny,chassagne,saintAubin,blagny,aloxe,pernand,ladoix,beaune,pommard,volnay,savigny,chorey,auxey,monthelie,saintRomain,santenay,maranges,coteBeaune,coteBeauneVillages,bouzeron,rully,mercurey,givry,montagny,pouillyFuisse,pouillyLoche,pouillyVinzelles,saintVeran,vireClesse];

const wine={country:'France',region:'Burgundy',appellation:'Gevrey-Chambertin',wineName:'Les Cazetiers',classification:'premier_cru'};

describe('Gevrey village map identity',()=>{
 it('maps all 9 Grand Crus and 26 Premier Cru climats to their own INAO identities',()=>{
  const named=catalogue.features.filter(f=>f.kind==='vineyard');
  expect(named.filter(f=>f.tier==='grand_cru')).toHaveLength(9);
  expect(named.filter(f=>f.tier==='premier_cru')).toHaveLength(26);
  for(const feature of named){
   const target=burgundyVillageMapTarget({...wine,classification:feature.tier,wineName:feature.name,
    appellation:feature.tier==='grand_cru'?feature.name:'Gevrey-Chambertin'});
   expect(target,feature.name).toMatchObject({featureId:feature.id,scope:'vineyard'});
  }
 });
 it('accepts accents, aliases, and accepted reference site metadata',()=>{
  expect(burgundyVillageMapTarget({...wine,wineName:'',referenceSite:'Les Cazetiers'})?.featureId).toBe('inao-denom-610');
  expect(burgundyVillageMapTarget({...wine,wineName:'Gevrey Chambertin 1er Cru Cazetiers',classification:null})?.featureId).toBe('inao-denom-610');
  expect(burgundyVillageMapTarget({...wine,appellation:'Chambertin Clos de Beze Grand Cru',classification:'grand_cru',wineName:''})?.featureId).toBe('inao-denom-448');
 });
 it('broadens unnamed and blended Premier Crus without selecting a vineyard',()=>{
  for(const wineName of ['Gevrey-Chambertin Premier Cru','Les Cazetiers et Les Corbeaux','Unknown vineyard']){
   expect(burgundyVillageMapTarget({...wine,wineName})).toMatchObject({featureId:'inao-denom-616',scope:'appellation'});
  }
  expect(burgundyVillageMapTarget({...wine,wineName:'Gevrey-Chambertin',classification:'village'})).toMatchObject({featureId:'inao-denom-589',scope:'appellation'});
 });
 it('withholds conflicts, incompatible geography, unsupported villages and an unproven cru tier',()=>{
  for(const fields of [{country:'USA'},{region:'Bordeaux'},{appellation:'Irancy'},
   {identityMatchStatus:'conflict' as const},{classification:null},{appellation:'Chablis Grand Cru',classification:'grand_cru'}]){
   expect(burgundyVillageMapTarget({...wine,...fields}),JSON.stringify(fields)).toBeNull();
  }
 });
});

describe('published village geometry',()=>{
 const data=JSON.parse(readFileSync(`public${catalogue.dataUrl}`,'utf8')) as FeatureCollection<Polygon|MultiPolygon>;
 it('ships every catalogue identity once with closed rings and geographic coordinates',()=>{
  expect(data.type).toBe('FeatureCollection');
  expect(data.features).toHaveLength(39);
  expect(new Set(data.features.map(f=>f.id)).size).toBe(39);
  for(const feature of catalogue.features){
   const polygon=data.features.find(f=>f.id===feature.id)!;
   expect(polygon?.properties).toMatchObject({denominationId:feature.denominationId,name:feature.name});
  }
  for(const feature of data.features){
   const rings=feature.geometry.type==='Polygon'?feature.geometry.coordinates:feature.geometry.coordinates.flat();
   for(const ring of rings){
    expect(ring.length).toBeGreaterThanOrEqual(4);
    expect(ring[0]).toEqual(ring.at(-1));
    for(const [lng,lat] of ring){expect(lng).toBeGreaterThan(4.8);expect(lng).toBeLessThan(5.1);expect(lat).toBeGreaterThan(47.1);expect(lat).toBeLessThan(47.3)}
   }
  }
 });
 it('keeps Brochon coverage and overlapping legal designations instead of inventing disjoint plots',()=>{
  expect(catalogue.features.find(f=>f.denominationId===589)?.communes).toEqual(['21110','21295']);
  const geometry=(id:number)=>data.features.find(f=>f.properties?.denominationId===id)!.geometry;
  expect(geometry(477)).toEqual(geometry(809));
  expect(catalogue.features.find(f=>f.denominationId===447)!.areaHa).toBeGreaterThan(catalogue.features.find(f=>f.denominationId===448)!.areaHa);
  expect(catalogue.sources.every(source=>source.sha256.length===64&&source.license.startsWith('Licence Ouverte'))).toBe(true);
 });
});

describe('overlap notes',()=>{
 it('only names catalogue crus, and leaves a cru unpainted only where a same-tier fill covers it',()=>{
  const byId=new Map(catalogues.flatMap(c=>c.features).map(f=>[f.id,f]));
  const notes=Object.assign({},...catalogues.map(c=>c.notes)) as VillageMapCatalogue['notes'];
  const unpaintedVillageMapIds=Object.entries(notes).filter(([,entry])=>entry.paintedBy).map(([id])=>id);
  for(const [id,entry] of Object.entries(notes)){
   expect(byId.has(id),id).toBe(true);
   if(!entry.paintedBy)continue;
   expect(byId.get(id)?.kind,id).toBe('vineyard');
   const cover=byId.get(entry.paintedBy)!;
   expect(cover.kind,id).toBe('vineyard');
   expect(cover.tier,id).toBe(byId.get(id)!.tier);
   // The cover must itself be painted and at least as large.
   expect(unpaintedVillageMapIds).not.toContain(cover.id);
   expect(cover.areaHa).toBeGreaterThanOrEqual(byId.get(id)!.areaHa);
  }
  expect(unpaintedVillageMapIds.sort()).toEqual(['inao-denom-1170','inao-denom-448','inao-denom-809']);
 });
});

describe.each([
 {catalogue:morey,grands:5,premiers:20,broad:'inao-denom-949',village:'inao-denom-928'},
 {catalogue:chambolle,grands:2,premiers:24,broad:'inao-denom-474',village:'inao-denom-449'},
 {catalogue:vosne,grands:8,premiers:14,broad:'inao-denom-1277',village:'inao-denom-1262'},
 {catalogue:fixin,grands:0,premiers:6,broad:'inao-denom-574',village:'inao-denom-566'},
 {catalogue:vougeot,grands:1,premiers:4,broad:'inao-denom-1283',village:'inao-denom-1278'},
 {catalogue:nuits,grands:0,premiers:41,broad:'inao-denom-1016',village:'inao-denom-974'},
 {catalogue:meursault,grands:0,premiers:19,broad:'inao-denom-862',village:'inao-app-204-village'},
 {catalogue:puligny,grands:4,premiers:17,broad:'inao-denom-1079',village:'inao-app-219-village'},
 {catalogue:chassagne,grands:3,premiers:55,broad:'inao-denom-534',village:'inao-denom-478'},
 {catalogue:saintAubin,grands:0,premiers:30,broad:'inao-denom-1156',village:'inao-app-227-village'},
 {catalogue:blagny,grands:0,premiers:7,broad:'inao-denom-360',village:'inao-denom-352'},
 {catalogue:aloxe,grands:27,premiers:14,broad:'inao-denom-257',village:'inao-denom-242'},
 {catalogue:pernand,grands:27,premiers:8,broad:'inao-denom-1023',village:'inao-denom-1017'},
 {catalogue:ladoix,grands:27,premiers:11,broad:'inao-denom-665',village:'inao-app-192-village'},
 {catalogue:beaune,grands:0,premiers:42,broad:'inao-denom-350',village:'inao-denom-307'},
 {catalogue:pommard,grands:0,premiers:28,broad:'inao-denom-1054',village:'inao-denom-1025'},
 {catalogue:volnay,grands:0,premiers:29,broad:'inao-denom-1261',village:'inao-denom-1225'},
 {catalogue:savigny,grands:0,premiers:22,broad:'inao-denom-1196',village:'inao-app-231-village'},
 {catalogue:auxey,grands:0,premiers:9,broad:'inao-denom-272',village:'inao-app-129-village'},
 {catalogue:monthelie,grands:0,premiers:15,broad:'inao-denom-926',village:'inao-denom-914'},
 {catalogue:santenay,grands:0,premiers:12,broad:'inao-denom-1172',village:'inao-app-230-village'},
 {catalogue:maranges,grands:0,premiers:7,broad:'inao-denom-805',village:'inao-app-198-village'},
 {catalogue:rully,grands:0,premiers:23,broad:'inao-denom-1111',village:'inao-denom-1087'},
 {catalogue:mercurey,grands:0,premiers:32,broad:'inao-denom-843',village:'inao-denom-810'},
 {catalogue:givry,grands:0,premiers:37,broad:'inao-denom-644',village:'inao-denom-617'},
 {catalogue:montagny,grands:0,premiers:49,broad:'inao-denom-913',village:'inao-denom-863'},
 {catalogue:pouillyFuisse,grands:0,premiers:22,broad:'inao-denom-2865',village:'inao-denom-1055'},
 {catalogue:pouillyLoche,grands:0,premiers:1,broad:'inao-denom-2931',village:'inao-denom-1057'},
 {catalogue:pouillyVinzelles,grands:0,premiers:3,broad:'inao-denom-2927',village:'inao-denom-1059'},
])('$catalogue.name identities and boundaries',({catalogue:c,grands,premiers,broad,village})=>{
 const data=JSON.parse(readFileSync(`public${c.dataUrl}`,'utf8')) as FeatureCollection<Polygon|MultiPolygon>;
 it('resolves every named cru and retains appellation scope for broad wines',()=>{
  const base={...wine,appellation:c.name};
  expect(c.features.filter(f=>f.tier==='grand_cru')).toHaveLength(grands);
  expect(c.features.filter(f=>f.kind==='vineyard'&&f.tier==='premier_cru')).toHaveLength(premiers);
  for(const feature of c.features.filter(f=>f.kind==='vineyard')){
   const target=burgundyVillageMapTarget({...base,classification:feature.tier,wineName:feature.name,
    appellation:feature.tier==='grand_cru'?feature.name:c.name});
   expect(target,feature.name).toMatchObject({featureId:feature.id,scope:'vineyard',
    villageId:(mapConfig.sharedDefaults as Record<string,string>)[String(feature.denominationId)]??c.id});
  }
  const blend=c.features.filter(f=>f.kind==='vineyard'&&f.tier==='premier_cru').slice(0,2).map(f=>f.name).join(' et ')+(premiers===1?' et another plot':'');
  for(const wineName of [c.name+' Premier Cru','Unknown vineyard',blend]){
   expect(burgundyVillageMapTarget({...base,wineName})).toMatchObject({featureId:broad,villageId:c.id,scope:'appellation'});
  }
  expect(burgundyVillageMapTarget({...base,wineName:c.name,classification:'village'})).toMatchObject({featureId:village,scope:'appellation'});
 });
 it('rejects conflicts and an unproven Premier Cru tier',()=>{
  for(const overrides of [{country:'USA'},{region:'Bordeaux'},{identityMatchStatus:'conflict' as const},{classification:null}]){
   const wineName=c.features.find(f=>f.kind==='vineyard'&&f.tier==='premier_cru')!.name;
   expect(burgundyVillageMapTarget({...wine,appellation:c.name,wineName,...overrides})).toBeNull();
  }
 });
 it('publishes exactly the expected wine and commune identities with intact rings',()=>{
  const expectedIds=[...c.features.map(f=>f.id),...c.communes.map(commune=>`commune-${commune.id}`)].sort();
  expect(data.features.map(f=>f.id).sort()).toEqual(expectedIds);
  for(const feature of data.features){
   expect(['Polygon','MultiPolygon']).toContain(feature.geometry.type);
   const rings=feature.geometry.type==='Polygon'?feature.geometry.coordinates:feature.geometry.coordinates.flat();
   for(const ring of rings){
    expect(ring.length).toBeGreaterThanOrEqual(4);expect(ring[0]).toEqual(ring.at(-1));
    expect(ring.every(([lng,lat])=>c.region==='Mâconnais'?lng>4.6&&lng<4.95&&lat>46.15&&lat<46.6:c.region==='Côte Chalonnaise'?lng>4.6&&lng<4.85&&lat>46.6&&lat<46.96:c.region==='Côte de Beaune'?lng>4.6&&lng<4.98&&lat>46.85&&lat<47.15:lng>4.8&&lng<5.1&&lat>47.0&&lat<47.4)).toBe(true);
   }
  }
  for(const feature of c.features){
   expect(data.features.find(f=>f.id===feature.id)?.properties).toMatchObject({name:feature.name,denominationId:feature.denominationId,communes:feature.communes});
  }
  expect(c.sources.every(s=>s.sha256.length===64&&s.license.startsWith('Licence Ouverte'))).toBe(true);
 });
});

describe('village registry',()=>{
 it('tracks every Bourgogne village appellation, including those missing from Atlas',()=>{
  expect(coverage.villages).toHaveLength(44);
  expect(new Set(coverage.villages.map(v=>v.appellationId)).size).toBe(44);
  expect(coverage.villages.map(v=>v.name).sort()).toEqual([...appellationLinks.groups.map(g=>g.appellation),'Côte de Beaune-Villages'].sort());
  const nuitsCoverage=coverage.villages.filter(v=>v.region==='Côte de Nuits');
  expect(nuitsCoverage).toHaveLength(9);
  expect(mapConfig.villages).toHaveLength(39);
  expect(mapConfig.villages.filter(v=>v.region==='Côte de Beaune')).toHaveLength(20);
  expect(mapConfig.villages.filter(v=>v.region==='Côte Chalonnaise')).toHaveLength(5);
  expect(mapConfig.villages.filter(v=>v.region==='Mâconnais')).toHaveLength(5);
  for(const row of nuitsCoverage)expect(mapConfig.villages.some(v=>v.appellationId===row.appellationId&&v.name===row.name)).toBe(true);
  for(const village of mapConfig.villages)expect(coverage.villages.some(row=>row.appellationId===village.appellationId&&row.name===village.name)).toBe(true);
 });
 it('keeps shared Bonnes-Mares whole and identical in both village contexts',()=>{
  const features=[morey,chambolle].map(c=>JSON.parse(readFileSync(`public${c.dataUrl}`,'utf8')).features.find((f:{id:string})=>f.id==='inao-denom-361'));
  expect(features[0]).toEqual(features[1]);
  expect(features[0].properties.communes).toEqual(['21133','21442']);
  expect(morey.features.find(f=>f.id==='inao-denom-361')).toEqual(chambolle.features.find(f=>f.id==='inao-denom-361'));
  expect(burgundyVillageMapTarget({...wine,appellation:'Bonnes Mares Grand Cru',wineName:'Bonnes-Mares',classification:'grand_cru'}))
   .toMatchObject({villageId:'chambolle-musigny',featureId:'inao-denom-361'});
 });
 it('distinguishes identically named Premier Crus by village',()=>{
  expect(burgundyVillageMapTarget({...wine,appellation:'Morey-Saint-Denis',wineName:'Les Gruenchers'})?.featureId).toBe('inao-denom-944');
  expect(burgundyVillageMapTarget({...wine,appellation:'Chambolle-Musigny',wineName:'Les Gruenchers'})?.featureId).toBe('inao-denom-467');
  expect(burgundyVillageMapTarget({...wine,appellation:'Chambolle-Musigny',wineName:'Les Fuees'})?.featureId).toBe('inao-denom-465');
  expect(burgundyVillageMapTarget({...wine,appellation:'Chambolle-Musigny',wineName:'Les Feusselotes'})?.featureId).toBe('inao-denom-464');
 });
 it('has one target per identity and a working lazy catalogue for every village',async()=>{
  expect(registry.targets).toHaveLength(754);
  expect(new Set(registry.targets.map(t=>t.matchId)).size).toBe(754);
  for(const village of registry.villages){
   const c=await loadVillageMapCatalogue(village.id);
   expect(catalogues.find(expected=>expected.id===village.id)).toEqual(c);
   for(const target of registry.targets.filter(t=>t.villageId===village.id)){
    expect(c.features.find(f=>f.matchId===target.matchId)).toMatchObject({id:target.featureId,name:target.name,kind:target.scope});
   }
  }
  await expect(loadVillageMapCatalogue('unknown-village')).rejects.toThrow('unavailable');
 });
});

describe('Vosne-Romanée and Flagey-Échezeaux',()=>{
 it('keeps full source boundaries alongside the three reviewed overview-only exclusions',()=>{
  const data=JSON.parse(readFileSync(`public${vosne.dataUrl}`,'utf8')) as {
   features:Array<{id:string;geometry:Polygon|MultiPolygon;contextGeometry?:Polygon|MultiPolygon}>
  };
  const contextFeatures=data.features.filter(f=>f.contextGeometry);
  expect(contextFeatures.map(f=>f.id).sort()).toEqual(['inao-denom-1269','inao-denom-1271','inao-denom-1276']);
  for(const feature of contextFeatures){
   expect(feature.contextGeometry).not.toEqual(feature.geometry);
   const context=feature.contextGeometry!;
   const rings=context.type==='Polygon'?context.coordinates:context.coordinates.flat();
   expect(rings.every(r=>r.length>=4&&r[0][0]===r.at(-1)![0]&&r[0][1]===r.at(-1)![1])).toBe(true);
  }
  expect(data.features.find(f=>f.id==='inao-denom-565')?.contextGeometry).toBeUndefined();
 });
 it('includes both producing communes without clipping shared Premier Cru or appellation areas',()=>{
  const byDenom=(id:number)=>vosne.features.find(f=>f.denominationId===id)!;
  for(const id of [1262,1277,1271])expect(byDenom(id).communes).toEqual(['21267','21714']);
  for(const id of [565,645,1269,1275])expect(byDenom(id).communes).toEqual(['21267']);
  for(const id of [654,655,656,1083,1084,1085])expect(byDenom(id).communes).toEqual(['21714']);
  expect(vosne.communes.map(c=>c.id).sort()).toEqual(['21267','21714']);
 });
 it('keeps similarly named Grand Crus and the Gevrey Premier Cru La Romanée separate',()=>{
  const grand=(appellation:string)=>burgundyVillageMapTarget({...wine,appellation,wineName:appellation,classification:'grand_cru'});
  expect(grand('Echezeaux')).toMatchObject({villageId:'vosne-romanee',featureId:'inao-denom-565'});
  expect(grand('Grands Echezeaux')).toMatchObject({villageId:'vosne-romanee',featureId:'inao-denom-645'});
  expect(grand('La Romanee')?.featureId).toBe('inao-denom-655');
  expect(grand('Romanee Conti')?.featureId).toBe('inao-denom-1084');
  expect(grand('Romanee St Vivant')?.featureId).toBe('inao-denom-1085');
  const gevreyRomanee=catalogue.features.find(f=>f.name==='La Romanée')!;
  expect(burgundyVillageMapTarget({...wine,wineName:'La Romanée'}))
   .toMatchObject({villageId:'gevrey-chambertin',featureId:gevreyRomanee.id});
 });
 it('accepts reviewed label spellings and preserves the exact source identities',()=>{
  for(const [wineName,id] of [['Les Petits Monts',1274],['Les Petis Monts',1274],['Aux Reignots',1266],['Aux Raignots',1266],['Aux Brûlées',1264]] as const){
   const base={...wine,appellation:'Vosne-Romanée',wineName};
   expect(burgundyVillageMapTarget(base)).toMatchObject({featureId:`inao-denom-${id}`,scope:'vineyard'});
   expect(burgundyVillageMapTarget({...base,classification:null})).toBeNull();
  }
  expect(vosne.features.find(f=>f.id==='inao-denom-1274')).toMatchObject({name:'Les Petits Monts',sourceName:'Vosne-Romanée premier cru Les Petis Monts'});
  expect(burgundyVillageMapTarget({...wine,appellation:'Vosne-Romanée',wineName:'Aux Reignots et Les Petits Monts'}))
   .toMatchObject({featureId:'inao-denom-1277',scope:'appellation'});
 });
});

describe('southern Côte de Beaune',()=>{
 const geometry=(c:VillageMapCatalogue,id:number)=>JSON.parse(readFileSync(`public${c.dataUrl}`,'utf8')).features.find((f:{id:string})=>f.id===`inao-denom-${id}`).geometry;
 it('keeps both shared Montrachet boundaries identical and defaults to Puligny',()=>{
  for(const [id,name] of [[927,'Montrachet'],[273,'Bâtard-Montrachet']] as const){
   expect(geometry(puligny,id)).toEqual(geometry(chassagne,id));
   const feature=puligny.features.find(f=>f.denominationId===id)!;
   expect(feature).toEqual(chassagne.features.find(f=>f.denominationId===id));
   expect(feature.communes).toEqual(['21150','21512']);
   expect(burgundyVillageMapTarget({...wine,appellation:name,wineName:name,classification:'grand_cru'}))
    .toMatchObject({villageId:'puligny-montrachet',featureId:`inao-denom-${id}`});
  }
  expect(chassagne.features.find(f=>f.denominationId===478)?.communes).toEqual(['21150','71369']);
  expect(chassagne.communes.find(c=>c.id==='71369')?.name).toBe('Remigny');
  expect(chassagne.sources.some(s=>s.url.includes('/71/71369/'))).toBe(true);
 });
 it('keeps the seven red Blagny identities separate from their white counterparts on the same land',()=>{
  for(const [red,white,c] of [[353,1067,puligny],[354,1068,puligny],[355,848,meursault],[356,849,meursault],[357,860,meursault],[358,861,meursault],[359,1078,puligny]] as const){
   const redFeature=blagny.features.find(f=>f.denominationId===red)!;
   const whiteFeature=c.features.find(f=>f.denominationId===white)!;
   // Source rings may start at different vertices on the same boundary.
   expect(redFeature.bounds).toEqual(whiteFeature.bounds);
   expect(redFeature.areaHa).toBe(whiteFeature.areaHa);
   expect(redFeature.matchId).not.toBe(whiteFeature.matchId);
   expect(burgundyVillageMapTarget({...wine,appellation:'Blagny',wineName:redFeature.name,colour:'Red'})?.featureId).toBe(redFeature.id);
   expect(burgundyVillageMapTarget({...wine,appellation:c.name,wineName:whiteFeature.name,colour:'White'})?.featureId).toBe(whiteFeature.id);
  }
  expect(burgundyVillageMapTarget({...wine,appellation:'Meursault',wineName:'Blagny',colour:'White'}))
   .toMatchObject({villageId:'meursault',featureId:'inao-denom-2373'});
  const base={...wine,appellation:'Blagny',wineName:'Blagny',classification:'village'};
  for(const fields of [{colour:'White'},{colour:'Rosé'},{colour:'',wineStyle:'white'}])expect(burgundyVillageMapTarget({...base,...fields})).toBeNull();
  expect(burgundyVillageMapTarget(base)?.featureId).toBe('inao-denom-352');
 });
 it('distinguishes repeated climat names and the reviewed Clavoillon spelling',()=>{
  for(const [appellation,wineName,id] of [['Chassagne-Montrachet','En Remilly',491],['Saint-Aubin','En Remilly',1132],['Meursault','Perrières',858],['Puligny-Montrachet','Les Perrières',1075],['Saint-Aubin','Les Perrières',1147],['Puligny-Montrachet','Clavoillon',1064]] as const){
   expect(burgundyVillageMapTarget({...wine,appellation,wineName})?.featureId).toBe(`inao-denom-${id}`);
  }
  expect(puligny.features.find(f=>f.denominationId===1064)).toMatchObject({name:'Clavoillon',sourceName:'Puligny-Montrachet premier cru Clavaillon'});
 });
 it.each([
  {c:meursault,white:844,red:2062,app:204},
  {c:puligny,white:2047,red:1061,app:219},
  {c:saintAubin,white:1125,red:2083,app:227},
 ])('$c.name preserves official colour identities and labels its derived combined overview',({c,white,red,app})=>{
  const base={...wine,appellation:c.name,wineName:c.name,classification:'village'};
  for(const [fields,id] of [[{colour:'White'},white],[{colour:'Red'},red],[{colour:'',wineStyle:'white'},white],[{colour:null,wineStyle:'red'},red]] as const){
   expect(burgundyVillageMapTarget({...base,...fields})).toMatchObject({featureId:`inao-denom-${id}`,scope:'appellation'});
  }
  for(const fields of [{},{colour:null,wineStyle:'sparkling'}]){
   expect(burgundyVillageMapTarget({...base,...fields})?.featureId).toBe(`inao-app-${app}-village`);
  }
  expect(c.features.find(f=>f.id===`inao-app-${app}-village`)).toMatchObject({denominationId:null,denominationIds:[white,red].sort((a,b)=>a-b),name:`${c.name} (all colours)`});
 });
 it('preserves distinct colour geometries in Meursault and equal ones in the Saint-Aubin source',()=>{
  expect(geometry(meursault,844)).not.toEqual(geometry(meursault,2062));
  expect(geometry(saintAubin,1125)).toEqual(geometry(saintAubin,2083));
 });
 it.each([meursault,puligny,chassagne,saintAubin,blagny])('$name paints tier unions separately from selectable source boundaries',c=>{
  const data=JSON.parse(readFileSync(`public${c.dataUrl}`,'utf8')) as FeatureCollection<Polygon|MultiPolygon>&{overviewFills:FeatureCollection<Polygon|MultiPolygon>['features']};
  expect(data.overviewFills).toHaveLength(c.features.some(f=>f.tier==='grand_cru')?2:1);
  expect(data.overviewFills.map(f=>f.properties?.tier).sort()).toEqual([...new Set(c.features.filter(f=>f.kind==='vineyard').map(f=>f.tier))].sort());
  for(const f of data.overviewFills){
   expect(data.features.some(source=>source.id===f.id)).toBe(false);
   const rings=f.geometry.type==='Polygon'?f.geometry.coordinates:f.geometry.coordinates.flat();
   expect(rings.every(r=>r.length>=4&&JSON.stringify(r[0])===JSON.stringify(r.at(-1)))).toBe(true);
  }
 });
});

describe('Beaune, Pommard and Volnay',()=>{
 it('retains Santenots in Meursault within the complete Volnay map',()=>{
  expect(volnay.communes).toEqual([{id:'21712',name:'Volnay'},{id:'21412',name:'Meursault'}]);
  expect(volnay.sources.some(source=>source.url.includes('/21/21412/'))).toBe(true);
  for(const id of [1225,1261])expect(volnay.features.find(f=>f.denominationId===id)?.communes).toEqual(['21412','21712']);
  const santenots=volnay.features.find(f=>f.denominationId===1259)!;
  expect(santenots).toMatchObject({communes:['21412'],areaHa:29.01});
  for(const fields of [
   {appellation:'Volnay',wineName:'Santenots'},
   {appellation:'Volnay-Santenots Premier Cru',wineName:''},
   {appellation:'Volnay',wineName:'Santenots du Milieu'},
   {appellation:'Volnay',wineName:'',referenceSite:'Santenots'},
  ])expect(burgundyVillageMapTarget({...wine,...fields,colour:'Red'})).toMatchObject({villageId:'volnay',featureId:santenots.id});
  expect(volnay.notes['inao-denom-1259'].note).toContain('whole Santenots area');
  for(const white of meursault.features.filter(f=>f.name.includes('Santenots'))){
   expect(white.matchId).not.toBe(santenots.matchId);
   expect(white.bounds).not.toEqual(santenots.bounds);
   expect(burgundyVillageMapTarget({...wine,appellation:'Meursault',wineName:white.name,colour:'White'}))
    .toMatchObject({villageId:'meursault',featureId:white.id});
  }
 });
 it.each([pommard,volnay])('$name accepts red or unknown colour but rejects white and rosé at both tiers',c=>{
  for(const [classification,wineName] of [['village',c.name],['premier_cru',c.features.find(f=>f.kind==='vineyard')!.name]]){
   const base={...wine,appellation:c.name,classification,wineName};
   for(const fields of [{colour:'White'},{colour:'Rosé'},{colour:'',wineStyle:'white'},{colour:null,wineStyle:'rosé'}]){
    expect(burgundyVillageMapTarget({...base,...fields})).toBeNull();
   }
   for(const fields of [{},{colour:'Red'},{colour:'',wineStyle:'red'}])expect(burgundyVillageMapTarget({...base,...fields})?.villageId).toBe(c.id);
  }
 });
 it('keeps one Beaune boundary for red and white wines, as in the source',()=>{
  for(const [classification,wineName,id] of [['village','Beaune',307],['premier_cru','Clos des Mouches',325]] as const){
   for(const colour of ['Red','White',''])expect(burgundyVillageMapTarget({...wine,appellation:'Beaune',classification,wineName,colour})?.featureId).toBe(`inao-denom-${id}`);
   expect(burgundyVillageMapTarget({...wine,appellation:'Beaune',classification,wineName,colour:'Rosé'})).toBeNull();
  }
 });
 it('distinguishes repeated cru names and similarly named Pommard plots',()=>{
  for(const [appellation,wineName,id] of [
   ['Beaune','Les Boucherottes',328],['Pommard','Les Boucherottes',1039],
   ['Beaune','Les Bressandes',329],['Pommard','Le Village',1036],['Volnay','Le Village',1247],
   ['Beaune','Les Epenotes',332],['Pommard','Clos des Epeneaux',1029],
   ['Pommard','Les Grands Epenots',1046],['Pommard','Les Petits Epenots',1048],
   ['Pommard','Les Rugiens Bas',1051],['Pommard','Les Rugiens Hauts',1052],
  ] as const)expect(burgundyVillageMapTarget({...wine,appellation,wineName})?.featureId).toBe(`inao-denom-${id}`);
 });
 it('accepts reviewed label spellings without changing source identities',()=>{
  for(const [appellation,wineName,id] of [
   ['Beaune','Les Cent Vignes',330],['Beaune','Cent Vignes',330],
   ['Volnay','Les Taillepieds',1260],['Volnay','Taillepieds',1260],
  ] as const){
   expect(burgundyVillageMapTarget({...wine,appellation,wineName})?.featureId).toBe(`inao-denom-${id}`);
   expect(burgundyVillageMapTarget({...wine,appellation,wineName:'',referenceSite:wineName})?.featureId).toBe(`inao-denom-${id}`);
   expect(burgundyVillageMapTarget({...wine,appellation,wineName,classification:'village'})?.scope).toBe('appellation');
  }
  for(const [appellation,wineName,id] of [
   ['Beaune','Les Epenottes',332],['Beaune','Epenottes',332],
   ['Pommard','Les Jarollières',1047],['Pommard','Saucilles',1053],['Pommard','Les Saucilles',1053],
   ['Volnay','Chevret',1240],['Volnay','Les Chevrets',1240],['Volnay',"Bousse d'Or",1232],
  ] as const)expect(burgundyVillageMapTarget({...wine,appellation,wineName})?.featureId).toBe(`inao-denom-${id}`);
  expect(beaune.features.find(f=>f.denominationId===330)?.sourceName).toBe('Beaune premier cru Les Cents Vignes');
  expect(volnay.features.find(f=>f.denominationId===1260)?.sourceName).toBe('Volnay premier cru Taille Pieds');
 });
 it('selects a walled clos named with the neighbouring cru it was once part of',()=>{
  for(const [appellation,wineName,id] of [
   ['Beaune','Vignes Franches Clos des Ursules',319],['Beaune','Les Vignes Franches - Clos des Ursules',319],
   ['Volnay','Caillerets Clos des 60 Ouvrées',1252],['Volnay','Les Caillerets - Clos des 60 Ouvrées',1252],
   ['Volnay','Clos des 60 Ouvrées En Caillerets',1252],['Volnay','Clos des Soixante Ouvrées',1252],
  ] as const)expect(burgundyVillageMapTarget({...wine,appellation,wineName}),wineName).toMatchObject({featureId:`inao-denom-${id}`,scope:'vineyard'});
  // The neighbours alone still select themselves.
  expect(burgundyVillageMapTarget({...wine,appellation:'Beaune',wineName:'Vignes Franches'})?.featureId).toBe('inao-denom-345');
  expect(burgundyVillageMapTarget({...wine,appellation:'Volnay',wineName:'Caillerets'})?.featureId).toBe('inao-denom-1251');
 });
 it('shows a red Meursault Santenots on Volnay, and keeps white Santenots on Meursault',()=>{
  for(const fields of [
   {appellation:'Meursault',wineName:'Santenots',colour:'Red'},
   {appellation:'Meursault',wineName:'Les Santenots du Milieu',colour:'Red'},
   {appellation:'Meursault Premier Cru',wineName:'Santenots',colour:'',wineStyle:'red'},
  ])expect(burgundyVillageMapTarget({...wine,...fields}),JSON.stringify(fields)).toMatchObject({villageId:'volnay',featureId:'inao-denom-1259'});
  expect(volnay.notes['inao-denom-1259'].note).toContain('Meursault Santenots is shown here');
  expect(burgundyVillageMapTarget({...wine,appellation:'Meursault',wineName:'Les Santenots Blancs',colour:'White'})?.featureId).toBe('inao-denom-856');
  for(const colour of ['White',''])expect(burgundyVillageMapTarget({...wine,appellation:'Meursault',wineName:'Santenots',colour})?.villageId).toBe('meursault');
  // Other red Meursault stays on the Meursault map.
  expect(burgundyVillageMapTarget({...wine,appellation:'Meursault',wineName:'Meursault',classification:'village',colour:'Red'})?.villageId).toBe('meursault');
 });
 it('keeps incomplete names and blends broad instead of picking a nearby plot',()=>{
  for(const [appellation,wineName,id] of [
   ['Pommard','Les Rugiens',1054],['Pommard','Les Epenots',1054],
   ['Pommard','Les Rugiens Bas et Les Rugiens Hauts',1054],
   ['Beaune','Les Cent Vignes et Les Bressandes',350],
   ['Volnay','Santenots et Les Taillepieds',1261],
  ] as const)expect(burgundyVillageMapTarget({...wine,appellation,wineName})).toMatchObject({featureId:`inao-denom-${id}`,scope:'appellation'});
 });
 it('carries the merged umbrella matching into Beaune while keeping unrelated names ambiguous',()=>{
  expect(beaune.umbrellas).toEqual({'inao-denom-348':['inao-denom-349']});
  expect(umbrellaNote(beaune,'inao-denom-349')).toContain('lies within Sur les Grèves');
  expect(burgundyVillageMapTarget({...wine,appellation:'Beaune',wineName:'Sur les Grèves',referenceSite:'Sur les Grèves - Clos Saint-Anne'})?.featureId).toBe('inao-denom-349');
  expect(burgundyVillageMapTarget({...wine,appellation:'Beaune',wineName:'Sur les Grèves',referenceSite:'Les Teurons'}))
   .toMatchObject({featureId:'inao-denom-350',scope:'appellation'});
 });
});

describe('source snapshot labels',()=>{
 it('shows a dated release by day and a monthly snapshot by month alone',()=>{
  expect(snapshotLabel('2026-09-21')).toBe('21 Sep 2026');
  expect(snapshotLabel('2026-06-01',true)).toBe('Jun 2026');
 });
 it('falls back to the raw value rather than inventing a date',()=>{
  expect(snapshotLabel('unknown')).toBe('unknown');
  expect(snapshotLabel(undefined)).toBe('');
 });
});

describe('remaining Côte de Nuits appellations',()=>{
 it('retains both producing communes for Fixin and Nuits, including the southern crus',()=>{
  expect(fixin.features.find(f=>f.id==='inao-denom-571')?.communes).toEqual(['21110','21265']);
  expect(nuits.features.find(f=>f.id==='inao-denom-989')?.communes).toEqual(['21506']);
  expect(nuits.features.find(f=>f.id==='inao-denom-974')?.communes).toEqual(['21464','21506']);
 });
 it('distinguishes Clos de la Perrière in Fixin and Vougeot, and the Clos de Vougeot Grand Cru',()=>{
  for(const [appellation,id] of [['Fixin',571],['Vougeot',1279]] as const){
   expect(burgundyVillageMapTarget({...wine,appellation,wineName:'Clos de la Perrière'})?.featureId).toBe(`inao-denom-${id}`);
  }
  for(const appellation of ['Clos de Vougeot','Clos Vougeot','Clos de Vougeot Grand Cru']){
   expect(burgundyVillageMapTarget({...wine,appellation,wineName:appellation,classification:'grand_cru'}))
    .toMatchObject({villageId:'vougeot',featureId:'inao-denom-546'});
  }
 });
 it('selects Marsannay colour boundaries only with explicit evidence, preserving an unknown-colour overview',()=>{
  const base={...wine,appellation:'Marsannay',wineName:'Les Longeroies',classification:'village'};
  for(const colour of ['Red','White',' red ']){
   expect(burgundyVillageMapTarget({...base,colour})).toMatchObject({featureId:'inao-denom-806-red-white',scope:'appellation'});
  }
  for(const colour of ['Rosé','Rose','rosé'])expect(burgundyVillageMapTarget({...base,colour})?.featureId).toBe('inao-denom-806-rose');
  expect(burgundyVillageMapTarget({...base,appellation:'Marsannay Rosé'})?.featureId).toBe('inao-denom-806-rose');
  expect(burgundyVillageMapTarget({...base,appellation:'Marsannay Rosé',colour:'Red'})).toBeNull();
  expect(burgundyVillageMapTarget(base)).toMatchObject({featureId:'inao-denom-806',scope:'appellation'});
  expect(burgundyVillageMapTarget({...base,classification:'premier_cru'})).toBeNull();
  const redWhite=marsannay.features.find(f=>f.id==='inao-denom-806-red-white')!;
  const rose=marsannay.features.find(f=>f.id==='inao-denom-806-rose')!;
  expect(redWhite.sourceName).toBe('Marsannay (rouge et blanc)');
  expect(rose.sourceName).toBe('Marsannay (rosé)');
  expect(rose.areaHa-redWhite.areaHa).toBeGreaterThan(90);
 });
 it('keeps Côte de Nuits-Villages at appellation scope across all five communes',()=>{
  for(const appellation of ['Côte de Nuits-Villages','Vins fins de la Côte de Nuits']){
   expect(burgundyVillageMapTarget({...wine,appellation,wineName:'Le Vaucrain',classification:'village'}))
    .toMatchObject({villageId:'cote-de-nuits-villages',featureId:'inao-denom-557',scope:'appellation'});
  }
  expect(coteNuits.features[0].communes).toEqual(['21110','21186','21194','21265','21506']);
  expect(coteNuits.bounds[1]).toBeLessThan(47.1);expect(coteNuits.bounds[3]).toBeGreaterThan(47.24);
 });
 it.each([marsannay,coteNuits])('publishes intact broad-area polygons for $name',c=>{
  const data=JSON.parse(readFileSync(`public${c.dataUrl}`,'utf8')) as FeatureCollection<Polygon|MultiPolygon>;
  expect(data.features.map(f=>f.id).sort()).toEqual([...c.features.map(f=>f.id),...c.communes.map(x=>`commune-${x.id}`)].sort());
  for(const feature of data.features){
   const rings=feature.geometry.type==='Polygon'?feature.geometry.coordinates:feature.geometry.coordinates.flat();
   for(const ring of rings){
    expect(ring.length).toBeGreaterThanOrEqual(4);expect(ring[0]).toEqual(ring.at(-1));
    expect(ring.every(([lng,lat])=>lng>4.8&&lng<5.1&&lat>47&&lat<47.4)).toBe(true);
   }
  }
 });
});

describe('display names',()=>{
 it('shows one spelling where INAO records alternatives, keeping the source name and Atlas identity',()=>{
  const feature=chambolle.features.find(f=>f.id==='inao-denom-464')!;
  expect(feature.name).toBe('Les Feusselottes');
  expect(feature.sourceName).toBe('Chambolle-Musigny premier cru Les Feusselottes ou Les Feusselotes');
  expect(feature.atlasUrl).toContain('les-feusselottes-ou-les-feusselotes');
 });
});

describe('click order on overlapping designations',()=>{
 it('answers with what the spot is coloured as: a Grand Cru before an overlapping Premier Cru',()=>{
  expect(clickOrder([
   {id:'inao-denom-1271',tier:'premier_cru',areaHa:11.99},
   {id:'inao-denom-565',tier:'grand_cru',areaHa:38.83},
  ])).toEqual(['inao-denom-565','inao-denom-1271']);
 });
 it('keeps the smaller of two Grand Crus first, so Clos de Bèze is reachable inside Chambertin',()=>{
  expect(clickOrder([
   {id:'inao-denom-447',tier:'grand_cru',areaHa:28.23},
   {id:'inao-denom-448',tier:'grand_cru',areaHa:15.35},
  ])).toEqual(['inao-denom-448','inao-denom-447']);
 });
 it('orders identical areas by id and lists each designation once',()=>{
  expect(clickOrder([
   {id:'inao-denom-809',tier:'grand_cru',areaHa:30.94},
   {id:'inao-denom-477',tier:'grand_cru',areaHa:30.94},
   {id:'inao-denom-809',tier:'grand_cru',areaHa:30.94},
  ])).toEqual(['inao-denom-477','inao-denom-809']);
 });
});

describe('side panel wording',()=>{
 it('counts one cru in the singular',()=>{
  expect(countLabel(1,'Grand Cru','Grand Crus')).toBe('1 Grand Cru');
  expect(countLabel(9,'Grand Cru','Grand Crus')).toBe('9 Grand Crus');
  expect(countLabel(0,'Grand Cru','Grand Crus')).toBe('0 Grand Crus');
 });
 it('lists a pair with an ampersand and longer lists with commas',()=>{
  expect(joinPlaces(['Vougeot'])).toBe('Vougeot');
  expect(joinPlaces(['Gevrey-Chambertin','Brochon'])).toBe('Gevrey-Chambertin & Brochon');
  expect(joinPlaces(['Fixin','Brochon','Premeaux-Prissey'])).toBe('Fixin, Brochon & Premeaux-Prissey');
 });
});

describe('Marsannay colour evidence',()=>{
 const marsannay={country:'France',region:'Burgundy',appellation:'Marsannay',wineName:'Marsannay',classification:'village'};
 it('uses a red, white or rosé wine style when no colour is recorded',()=>{
  expect(burgundyVillageMapTarget({...marsannay,colour:null,wineStyle:'rose'})?.featureId).toBe('inao-denom-806-rose');
  expect(burgundyVillageMapTarget({...marsannay,colour:null,wineStyle:'white'})?.featureId).toBe('inao-denom-806-red-white');
  expect(burgundyVillageMapTarget({...marsannay,colour:null,wineStyle:'sparkling'})?.featureId).toBe('inao-denom-806');
  expect(burgundyVillageMapTarget({...marsannay,colour:null,wineStyle:null})?.featureId).toBe('inao-denom-806');
 });
 it('lets a recorded colour win over the wine style, and still withholds a contradiction',()=>{
  expect(burgundyVillageMapTarget({...marsannay,colour:'Rosé',wineStyle:'red'})?.featureId).toBe('inao-denom-806-rose');
  expect(burgundyVillageMapTarget({...marsannay,wineName:'Marsannay Rosé',colour:null,wineStyle:'red'})).toBeNull();
 });
});

describe('separate parts of one appellation',()=>{
 it('splits Côte de Nuits-Villages into a northern and a southern part within its bounds',()=>{
  const areas=(coteNuits as VillageMapCatalogue).areas!;
  expect(areas.map(area=>area.id)).toEqual(['north','south']);
  const [west,south,east,north]=coteNuits.bounds;
  for(const area of areas){
   const [w,s,e,n]=area.bounds;
   expect(w).toBeGreaterThanOrEqual(west);expect(s).toBeGreaterThanOrEqual(south);
   expect(e).toBeLessThanOrEqual(east);expect(n).toBeLessThanOrEqual(north);
  }
  // The two parts are kilometres apart, with the north part wholly north.
  expect(areas[0].bounds[1]).toBeGreaterThan(areas[1].bounds[3]);
  // Together they span the whole appellation.
  expect(Math.min(...areas.map(a=>a.bounds[0]))).toBe(west);expect(Math.max(...areas.map(a=>a.bounds[3]))).toBe(north);
 });
});

describe('umbrella Premier Cru notes',()=>{
 const load=(file:string)=>JSON.parse(readFileSync(`src/lib/places/${file}VillageMapCatalogue.json`,'utf8')) as VillageMapCatalogue;
 const chassagne=load('chassagne'),meursault=load('meursault');
 const id=(catalogue:VillageMapCatalogue,name:string)=>catalogue.features.find(feature=>feature.name===name)!.id;
 it('says what a wider name covers, and where a vineyard lies within one',()=>{
  expect(umbrellaNote(chassagne,id(chassagne,'Morgeot'))).toMatch(/^Morgeot is a wider Premier Cru name covering 19 named vineyards, including /);
  expect(umbrellaNote(chassagne,id(chassagne,'La Grande Montagne'))).toBe('La Grande Montagne is a wider Premier Cru name covering La Romanée, En Virondot, Les Grandes Ruchottes and Tonton Marcel.');
  expect(umbrellaNote(chassagne,id(chassagne,'La Romanée'))).toBe('La Romanée lies within La Grande Montagne, a wider Premier Cru name.');
  // Nested umbrellas name every wider name, the largest first.
  expect(umbrellaNote(chassagne,id(chassagne,'Les Chaumes'))).toBe('Les Chaumes lies within Morgeot and La Boudriotte, wider Premier Cru names.');
 });
 it('adds no note to a cru that overlaps nothing',()=>{
  for(const name of ['Charmes','Perrières','Genevrières'])expect(umbrellaNote(meursault,id(meursault,name)),name).toBeUndefined();
  expect(umbrellaNote(chassagne,id(chassagne,'En Cailleret'))).toBeUndefined();
 });
 it('only records Premier Crus that exist in the same catalogue, each wider than what it covers',()=>{
  for(const catalogue of [chassagne,meursault,load('saintAubin')]){
   const byId=new Map(catalogue.features.map(feature=>[feature.id,feature]));
   for(const [outer,inner] of Object.entries(catalogue.umbrellas??{})){
    expect(byId.get(outer)?.tier).toBe('premier_cru');
    for(const covered of inner){
     expect(byId.get(covered)?.tier).toBe('premier_cru');
     expect(byId.get(covered)!.areaHa).toBeLessThan(byId.get(outer)!.areaHa);
    }
   }
  }
 });
});

describe('umbrella identities for the wine matcher',()=>{
 it('mirror every catalogue umbrella by match ID',()=>{
  const expected:Record<string,string[]>={};
  // Every village catalogue, so a new village's umbrellas cannot be missed.
  for(const file of readdirSync('src/lib/places').filter(name=>name.endsWith('VillageMapCatalogue.json'))){
   const catalogue=JSON.parse(readFileSync(`src/lib/places/${file}`,'utf8')) as VillageMapCatalogue;
   const match=new Map(catalogue.features.map(feature=>[feature.id,feature.matchId]));
   for(const [outer,inner] of Object.entries(catalogue.umbrellas??{}))expected[match.get(outer)!]=inner.map(id=>match.get(id)!);
  }
  expect((registry as {umbrellas:Record<string,string[]>}).umbrellas).toEqual(expected);
 });
});
