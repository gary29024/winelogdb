import {describe,expect,it} from 'vitest';
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {cruOnVillageMap,grandCruFor,grandCrus,parcelBundles,parcelManifestFor} from '../../src/lib/places/grandCruParcels/registry';
import {loadParcelEvidence,mergeParcelEvidence,type ParcelEvidenceData} from '../../src/lib/places/grandCruParcels/evidence';
import {parcelRightsSnapshot} from '../../src/lib/places/grandCruParcels/holders';

type CruConfig={slug:string;name:string;parentFeatureId:string;bundle:string;villageMaps:string[];evidenceFrom:string[];research?:object};
type BundleConfig={id:string;crus:string[];villageMap:string;parcels:{parentFeatureIds:string[]}};
const read=<T>(path:string)=>JSON.parse(readFileSync(path,'utf8')) as T;
const configs=readdirSync('scripts/grand-crus').filter(name=>name.endsWith('.json')).map(name=>read<CruConfig>(`scripts/grand-crus/${name}`));
const bundles=readdirSync('scripts/grand-crus/bundles').map(name=>read<BundleConfig>(`scripts/grand-crus/bundles/${name}`));
// A cru reaches the app only once its commune-edge audit is committed (scripts/grand_cru.py app_cru_slugs).
const audited=(slug:string)=>existsSync(`scripts/grand-crus/reports/${slug}-commune-audit.json`);
const shown=configs.filter(c=>audited(c.slug)),hidden=configs.filter(c=>!audited(c.slug));

describe('Grand Cru registry',()=>{
 it('mirrors every cru config and commune bundle used by the build scripts',()=>{
  expect(grandCrus.map(c=>c.slug).sort()).toEqual(shown.map(c=>c.slug).sort());
  for(const config of hidden)expect(grandCruFor(config.parentFeatureId),config.slug).toBeUndefined();
  for(const config of shown){
   const cru=grandCruFor(config.parentFeatureId)!;
   expect(cru).toMatchObject({slug:config.slug,name:config.name,bundle:config.bundle,evidenceFrom:config.evidenceFrom,villageMaps:config.villageMaps});
   for(const map of config.villageMaps)expect(grandCruFor(config.parentFeatureId,map)).toBe(cru);
   expect(parcelManifestFor(config.parentFeatureId)).toBe(parcelBundles[cru.bundle]);
   for(const source of config.evidenceFrom)expect(configs.find(c=>c.slug===source)?.research).toBeTruthy();
  }
  expect(Object.keys(parcelBundles).sort()).toEqual([...new Set(shown.map(c=>c.bundle))].sort());
  for(const id of Object.keys(parcelBundles))expect([...parcelBundles[id as keyof typeof parcelBundles].parentFeatureIds].sort())
   .toEqual(configs.filter(c=>c.bundle===id).map(c=>c.parentFeatureId).sort());
  expect(bundles.map(b=>b.id)).toEqual(expect.arrayContaining(Object.keys(parcelBundles)));
 });
 it('offers domaine grouping exactly where a cru’s research files link holders to domaines',async()=>{
  for(const cru of grandCrus){
   const evidence=await loadParcelEvidence(cru.parentFeatureId);
   expect(cru.domaineGrouping,cru.slug).toBe(Object.keys(evidence.holderDomains??{}).length>0);
  }
 });
 it('finds a cru only on its own village map',()=>{
  expect(grandCruFor('inao-denom-645','vosne-romanee')?.name).toBe('Grands-Échezeaux');
  expect(grandCruFor('inao-denom-645','gevrey-chambertin')).toBeUndefined();
  expect(grandCruFor('inao-denom-655')).toBeUndefined();  // La Romanée: history delivered, commune audit pending
  expect(grandCruFor('inao-denom-unknown')).toBeUndefined();
  const multiMapCru={...grandCrus[0],villageMaps:['chassagne-montrachet','puligny-montrachet']};
  expect(cruOnVillageMap(multiMapCru,'chassagne-montrachet')).toBe(true);
  expect(cruOnVillageMap(multiMapCru,'puligny-montrachet')).toBe(true);
  expect(cruOnVillageMap(multiMapCru,'vosne-romanee')).toBe(false);
 });
 it('keeps each cru’s producer links on its own rights snapshot and holders',()=>{
  const echezeaux=parcelRightsSnapshot('inao-denom-565')!,grands=parcelRightsSnapshot('inao-denom-645')!;
  expect(echezeaux.rightsAsOf).toBe('2025-01-01');
  expect(grands.holderIds).toHaveLength(9);
  expect(parcelRightsSnapshot('inao-denom-unknown')).toBeUndefined();
 });
 it('loads Grands-Échezeaux evidence from its own research, including the D0093 application',async()=>{
  const evidence=await loadParcelEvidence('inao-denom-645');
  expect(evidence.parcels['212670000D0093']?.map(i=>i.kind)).toContain('application');
  expect(await loadParcelEvidence('inao-denom-unknown')).toEqual({sources:{},parcels:{},holderDomains:{}});
 });
 it('keeps a history file for every rollout cru, with independent Yonne coverage',()=>{
  expect(configs).toHaveLength(33);
  // Hidden crus are not wired into the app, so read every research file directly.
  for(const cru of configs){
   const data=read<ParcelEvidenceData>(`src/lib/places/grandCruParcels/${cru.slug}.evidence.json`);
   const coverage=data.coverage?.[cru.parentFeatureId];
   expect(coverage,cru.slug).toBeTruthy();
   expect(Object.keys(data.tracing??{}).length,cru.slug).toBeGreaterThan(0);
   expect(coverage?.rightsImported).toEqual(['2019-01-01','2020-01-01','2021-01-01','2022-01-01','2023-01-01','2024-01-01','2025-01-01']);
  }
  const chablis=read<ParcelEvidenceData>('src/lib/places/grandCruParcels/chablis-grand-cru.evidence.json');
  expect(chablis.coverage?.['inao-denom-439'].dfiSources.map(s=>s.department)).toEqual(['89']);
  // Chablis is searched only with Yonne's own (archived, partial) bulletin index.
  const notices=chablis.coverage?.['inao-denom-439'].notices as {missingDepartmentIndexes:string[];indexes:{id:string;department:string}[]}|undefined;
  expect(notices?.missingDepartmentIndexes).toEqual([]);
  expect(notices?.indexes.map(i=>[i.id,i.department])).toEqual([['departmental-yonne-archive','89']]);
  expect(Object.keys(chablis.tracing??{}).every(id=>id.startsWith('89068'))).toBe(true);
 });
 it('loads Vougeot’s 69 holders and dated notices without inventing domaine research',async()=>{
  expect(grandCruFor('inao-denom-546','vougeot')?.slug).toBe('clos-de-vougeot');
  expect(grandCruFor('inao-denom-546','vosne-romanee')).toBeUndefined();
  const snapshot=parcelRightsSnapshot('inao-denom-546')!;
  expect(snapshot.rightsAsOf).toBe('2025-01-01');
  expect(snapshot.holderIds).toHaveLength(69);
  const evidence=await loadParcelEvidence('inao-denom-546');
  expect(evidence.parcels['217160000A0001'].map(i=>i.kind)).toContain('suspended');
  expect(evidence.parcels['217160000A0523'].map(i=>i.kind)).toContain('application');
  expect(evidence.holderDomains).toEqual({});
  expect(Object.keys(evidence.parcels).every(id=>id.startsWith('21716'))).toBe(true);
 });
 it('merges several research files without dropping records or overriding the first domaine heading',()=>{
  const item=(title:string)=>({kind:'lead' as const,date:null,title,sources:[]});
  const heading=(name:string)=>({name,basis:'estate-context',note:'',sources:[]});
  const merged=mergeParcelEvidence([
   {sources:{a:{title:'A',url:'https://a.test',kind:'data',date:null}},parcels:{p:[item('one')]},holderDomains:{h:heading('First')}},
   {sources:{b:{title:'B',url:'https://b.test',kind:'data',date:null}},parcels:{p:[item('two')],q:[item('three')]},holderDomains:{h:heading('Second')}},
  ]);
  expect(Object.keys(merged.sources)).toEqual(['a','b']);
  expect(merged.parcels.p.map(i=>i.title)).toEqual(['one','two']);
  expect(merged.holderDomains?.h.name).toBe('First');
 });
});
