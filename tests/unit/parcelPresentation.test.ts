import {describe,it,expect} from 'vitest';
import {groupParcelRightHolders,matchesLinkedProducer,type HolderResearch} from '../../src/lib/places/parcelPresentation';
import evidence from '../../src/lib/places/echezeauxParcelEvidence.json';
const link={holderId:'holder',producerId:'nicole',producerName:'Domaine Nicole Lamarche',status:'manual' as const,updatedAt:'2026-09-30'};
const context:HolderResearch={name:'Domaine Example',basis:'estate-context',note:'Unverified context',sources:['estate']};
const parcel=(id:string,ids:string[],area=100,parent='cru')=>({properties:{id,recordedRights:ids.map(holderId=>({holderId,name:`GFA ${holderId}`})),overlaps:[{parentFeatureId:parent,areaM2:area}]}});
describe('parcel presentation without identity or farming promotion',()=>{
 it('uses exact catalogue identity before normalized full-name fallback',()=>{
  expect(matchesLinkedProducer(link,'Old producer spelling','nicole')).toBe(true);
  expect(matchesLinkedProducer(link,'Domaine Nicole Lamarche','another-id')).toBe(false);
  expect(matchesLinkedProducer(link,'Nicole Lamarche')).toBe(true);
  expect(matchesLinkedProducer(link,'Jean-Marc Millot')).toBe(false);
  expect(matchesLinkedProducer(link,'Lamarche')).toBe(false);
  expect(matchesLinkedProducer(link,'')).toBe(false);
  expect(matchesLinkedProducer(link)).toBe(true);
 });
 it('does not confuse related domaines',()=>{
  expect(matchesLinkedProducer({...link,producerName:'Domaine Coudray-Bizot'},'Domaine Jean-Yves Bizot')).toBe(false);
  expect(matchesLinkedProducer({...link,producerName:'Anne Gros'},'Michel Gros')).toBe(false);
  expect(matchesLinkedProducer({...link,producerName:'Domaine Méo-Camuzet'},'Meo Camuzet')).toBe(true);
 });
 it('counts the union of parcels once for multiple rights/holders of one domaine',()=>{
  const rows=[parcel('p1',['a','a','b'],120),parcel('p2',['b'],80),parcel('outside',['a'],999,'other')];
  const groups=groupParcelRightHolders(rows,'cru',{a:context,b:context});
  expect(groups).toHaveLength(1);
  expect(groups[0]).toMatchObject({name:'Domaine Example',holderIds:['a','b'],areaM2:200,count:2,sources:['estate'],domaine:true});
  expect(groupParcelRightHolders(rows,'cru')).toHaveLength(2);
 });
 it('retains unresolved legal identities rather than creating a domaine from their spelling',()=>{
  const groups=groupParcelRightHolders([parcel('p',['unknown'])],'cru');
  expect(groups[0]).toMatchObject({id:'unknown',domaine:false,name:'GFA Unknown',sources:[]});
 });
 it('publishes research names and their actual sources, not verified-farmer fields',()=>{
  expect(evidence.holderDomains['775567928'].name).toMatch(/Faiveley/);
  expect(evidence.holderDomains['U32852627'].name).toMatch(/Drouhin/);
  for(const item of Object.values(evidence.holderDomains)){
   expect(item.sources.length).toBeGreaterThan(0);
   for(const id of item.sources)expect(id in evidence.sources).toBe(true);
   expect(item).not.toHaveProperty('currentFarmer');
   expect(item).not.toHaveProperty('verified');
  }
 });
});
