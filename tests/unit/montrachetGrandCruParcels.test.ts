import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {burgundyVillageMapTarget} from '../../src/lib/places/burgundyVillageMap';
import {loadVillageMapCatalogue} from '../../src/lib/places/loadVillageMapCatalogue';
import {grandCruFor} from '../../src/lib/places/grandCruParcels/registry';
import {loadParcelEvidence} from '../../src/lib/places/grandCruParcels/evidence';

// Extend Tier 2 only after committing each independent holder-research pass.
const tier2=[
 {slug:'montrachet',name:'Montrachet',id:'inao-denom-927',villages:['chassagne-montrachet','puligny-montrachet'],parcels:47,leads:37,unresolved:10,filings:6,groups:13,unlinked:['U21850980']},
 {slug:'chevalier-montrachet',name:'Chevalier-Montrachet',id:'inao-denom-539',villages:['puligny-montrachet'],parcels:44,leads:32,unresolved:12,filings:3,groups:13,unlinked:['349583500','212105126','752059824']},
];
const tier1=[
 {slug:'batard-montrachet',name:'Bâtard-Montrachet',id:'inao-denom-273',villages:['chassagne-montrachet','puligny-montrachet'],parcels:89},
 {slug:'bienvenues-batard-montrachet',name:'Bienvenues-Bâtard-Montrachet',id:'inao-denom-351',villages:['puligny-montrachet'],parcels:38},
 {slug:'criots-batard-montrachet',name:'Criots-Bâtard-Montrachet',id:'inao-denom-564',villages:['chassagne-montrachet'],parcels:11},
];
const reviewed=[...tier2,...tier1];
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const bundle=read('scripts/grand-crus/bundles/montrachet.json') as {crus:string[]};
const config=(slug:string)=>read(`scripts/grand-crus/${slug}.json`) as {parentFeatureId:string;villageMaps:string[];namedPlots:{displayLayer:boolean;plots:{id:string;name:string;sourceName:string}[]}};

describe('Montrachet bundle reviewed crus',()=>{
 it('enables each reviewed cru in every village context with its own evidence',async()=>{
  for(const cru of tier1){
   for(const village of cru.villages)expect(grandCruFor(cru.id,village)).toMatchObject({slug:cru.slug,domaineGrouping:false,evidenceFrom:[cru.slug]});
   const evidence=await loadParcelEvidence(cru.id);
   expect(evidence).not.toBeNull();
   expect(Object.keys(evidence.holderDomains??{})).toHaveLength(0);
  }
  for(const slug of bundle.crus.filter(slug=>!reviewed.some(cru=>cru.slug===slug))){
   const pending=config(slug);
   for(const village of pending.villageMaps)expect(grandCruFor(pending.parentFeatureId,village)).toBeUndefined();
  }
 });
 it('enables Tier 2 research grouping while keeping every farming claim unverified',async()=>{
  for(const cru of tier2){
   for(const village of cru.villages)expect(grandCruFor(cru.id,village)).toMatchObject({slug:cru.slug,domaineGrouping:true,evidenceFrom:[cru.slug]});
   const evidence=await loadParcelEvidence(cru.id);
   expect(Object.keys(evidence.holderDomains??{})).toHaveLength(cru.groups);
   for(const hid of cru.unlinked)expect(evidence.holderDomains).not.toHaveProperty(hid);
   // The Laguiche GFA reaches Drouhin only as a reported arrangement, never as a filed lease.
   if(cru.slug==='montrachet')expect(evidence.holderDomains?.U18179542).toMatchObject({name:'Maison Joseph Drouhin',basis:'reported-operator-relationship'});
   const register=read(`docs/research/${cru.slug}/register.json`);
   expect(register.counts).toMatchObject({holderLead:cru.leads,unresolved:cru.unresolved,withParcelFiling:cru.filings,currentFarmerConfirmed:0});
   expect(register.parcels.every((p:{currentFarmer:unknown})=>p.currentFarmer===null)).toBe(true);
  }
 });
 it('keeps Chassagne parcels outside Chevalier membership and measures them as neighbours',()=>{
  const register=read('docs/research/chevalier-montrachet/register.json') as {parcels:{parcelId:string}[]};
  expect(register.parcels.every(p=>p.parcelId.startsWith('21512'))).toBe(true);
  const audit=read('scripts/grand-crus/reports/chevalier-montrachet-commune-audit.json');
  expect(audit.importedCommunes).toEqual(['21512']);
  expect(audit.neighbours.find((n:{commune:string})=>n.commune==='21150').contactAreaM2).toBe(12.3);
  expect(audit.notCoveredByBundleParcelsM2).toBe(135.9);
  expect(audit.notCoveredByBundleParcels.coveredByNeighbourParcelsM2).toBe(7.7);
 });
 it('keeps white wines on their full INAO feature when the cru name is a constituent name',async()=>{
  for(const cru of reviewed){
   const named=config(cru.slug).namedPlots;
   expect(named.displayLayer).toBe(false);
   for(const village of cru.villages){
    const catalogue=await loadVillageMapCatalogue(village);
    expect(catalogue.namedPlots?.some(layer=>layer.parentFeatureId===cru.id)??false).toBe(false);
   }
   for(const colour of ['white','White']){
    const wine={country:'France',region:'Burgundy',appellation:cru.name,classification:'grand_cru',colour,wineName:cru.name};
    for(const target of [wine,{...wine,referenceParcel:'Unknown area'},...named.plots.map(plot=>({...wine,referenceParcel:plot.sourceName}))]){
     const result=burgundyVillageMapTarget(target);
     expect(result).toMatchObject({featureId:cru.id});
     expect(result?.namedPlotId).toBeUndefined();
    }
   }
  }
 });
 it('keeps both communes in one unique parcel set without cropping at their line',()=>{
  const manifest=read('src/lib/places/grandCruParcels/montrachet.manifest.json') as {dataUrl:string};
  const asset=read(`public${manifest.dataUrl}`) as {features:{id:string;properties:{commune:string;overlaps:{parentFeatureId:string}[]}}[]};
  expect(new Set(asset.features.map(f=>f.id)).size).toBe(asset.features.length);
  for(const cru of reviewed){
   const members=asset.features.filter(f=>f.properties.overlaps.some(o=>o.parentFeatureId===cru.id));
   expect(members).toHaveLength(cru.parcels);
   const register=read(`docs/research/${cru.slug}/register.json`) as {parcels:{parcelId:string}[]};
   expect(register.parcels.map(p=>p.parcelId).sort()).toEqual(members.map(f=>f.id).sort());
   if(cru.villages.length===2){
    expect([...new Set(members.map(f=>f.properties.commune))].sort()).toEqual(['21150','21512']);
    const audit=read(`scripts/grand-crus/reports/${cru.slug}-commune-audit.json`);
    const coverage=audit.crossCommuneCoverage;
    expect(coverage.crossCommuneOverlaps).toHaveLength(1);
    expect(coverage.crossCommuneOverlaps[0].areaM2).toBeGreaterThan(0);
    expect(coverage.coverageByCommuneM2['21150']+coverage.coverageByCommuneM2['21512']-coverage.crossCommuneOverlaps[0].areaM2).toBeCloseTo(coverage.unionCoverageM2,5);
   }
  }
 });
 it('withholds the chronologically inconsistent 2013 notice from a parcel event',()=>{
  const history=read('docs/research/montrachet/notice-history.json');
  const match=history.reviewedMatches.find((m:{originalPrintedReference:string})=>m.originalPrintedReference==='AE 172');
  expect(match).toMatchObject({originalDate:null,directMatchWithheld:'notice-act-date-unresolved',directCurrentParcelIds:[],contextPaths:[],currentFarmer:null});
  expect(match.originalRecord.printedDate).toBe('3 décembre 2013');
  expect(match.originalRecord.publicationDate).toBe('2013-01-31');
  expect(history.unreviewedCandidates).toHaveLength(0);
 });
 it('preserves the image-reviewed Bâtard refusal without granting authorisation',async()=>{
  const evidence=await loadParcelEvidence('inao-denom-273');
  const items=evidence.parcels['21512000AI0015'];
  expect(items).toEqual(expect.arrayContaining([expect.objectContaining({kind:'notice',label:'Application refused',date:'2019-02-07',title:'S.C. Guillaume BOILLOT'})]));
  expect(items.some(item=>item.kind==='authorisation')).toBe(false);
  const register=read('docs/research/batard-montrachet/register.json');
  expect(register.counts).toMatchObject({historicalApplication:1,historicalAuthorisation:0,currentFarmerConfirmed:0});
  expect(register.parcels.find((p:{parcelId:string})=>p.parcelId==='21512000AI0015').currentFarmer).toBeNull();
  expect(read('docs/research/batard-montrachet/notice-history.json').unreviewedCandidates).toHaveLength(0);
 });
});
