import {describe,expect,it} from 'vitest';
import {readdirSync,readFileSync} from 'node:fs';
import {grandCruFor,grandCrus,parcelBundles,parcelManifestFor} from '../../src/lib/places/grandCruParcels/registry';
import {loadParcelEvidence,mergeParcelEvidence} from '../../src/lib/places/grandCruParcels/evidence';
import {parcelRightsSnapshot} from '../../src/lib/places/grandCruParcels/holders';

type CruConfig={slug:string;name:string;parentFeatureId:string;bundle:string;evidenceFrom:string[];research?:object};
type BundleConfig={id:string;crus:string[];villageMap:string;parcels:{parentFeatureIds:string[]}};
const read=<T>(path:string)=>JSON.parse(readFileSync(path,'utf8')) as T;
const configs=readdirSync('scripts/grand-crus').filter(name=>name.endsWith('.json')).map(name=>read<CruConfig>(`scripts/grand-crus/${name}`));
const bundles=readdirSync('scripts/grand-crus/bundles').map(name=>read<BundleConfig>(`scripts/grand-crus/bundles/${name}`));

describe('Grand Cru registry',()=>{
 it('mirrors every cru config and commune bundle used by the build scripts',()=>{
  expect(grandCrus.map(c=>c.slug).sort()).toEqual(configs.map(c=>c.slug).sort());
  for(const config of configs){
   const cru=grandCruFor(config.parentFeatureId)!;
   const bundle=bundles.find(b=>b.id===config.bundle)!;
   expect(cru).toMatchObject({slug:config.slug,name:config.name,bundle:config.bundle,evidenceFrom:config.evidenceFrom,villageMap:bundle.villageMap});
   expect(parcelManifestFor(config.parentFeatureId)).toBe(parcelBundles[cru.bundle]);
   for(const source of config.evidenceFrom)expect(configs.find(c=>c.slug===source)?.research).toBeTruthy();
  }
  expect(Object.keys(parcelBundles).sort()).toEqual(bundles.map(b=>b.id).sort());
  for(const bundle of bundles)expect([...parcelBundles[bundle.id as keyof typeof parcelBundles].parentFeatureIds].sort())
   .toEqual(grandCrus.filter(c=>c.bundle===bundle.id).map(c=>c.parentFeatureId).sort());
 });
 it('finds a cru only on its own village map',()=>{
  expect(grandCruFor('inao-denom-645','vosne-romanee')?.name).toBe('Grands-Échezeaux');
  expect(grandCruFor('inao-denom-645','gevrey-chambertin')).toBeUndefined();
  expect(grandCruFor('inao-denom-655')).toBeUndefined();
 });
 it('keeps each cru’s producer links on its own rights snapshot and holders',()=>{
  const echezeaux=parcelRightsSnapshot('inao-denom-565')!,grands=parcelRightsSnapshot('inao-denom-645')!;
  expect(echezeaux.rightsAsOf).toBe('2025-01-01');
  expect(grands.holderIds).toHaveLength(9);
  expect(parcelRightsSnapshot('inao-denom-655')).toBeUndefined();
 });
 it('loads Grands-Échezeaux evidence from its own research, including the D0093 application',async()=>{
  const evidence=await loadParcelEvidence('inao-denom-645');
  expect(evidence.parcels['212670000D0093']?.map(i=>i.kind)).toContain('application');
  expect(await loadParcelEvidence('inao-denom-655')).toEqual({sources:{},parcels:{},holderDomains:{}});
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
