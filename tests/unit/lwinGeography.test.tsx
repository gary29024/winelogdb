// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { afterEach,describe,expect,it,vi } from 'vitest';
import { LwinEditPanel } from '../../src/features/wines/LwinEditPanel';
import { referenceAppRegion,regionWithin } from '../../src/lib/wine/referenceGeography';
import { buildReferenceSuggestions } from '../../src/lib/wine/referenceSuggestions';
import { enrichLwinTaxonomy,type LwinReference } from '../../src/lib/wine/lwinMetadata';
import { compatibleLwinProduct } from '../../src/lib/wine/lwinMatching';
import { parseLwinReference } from '../../src/lib/wine/lwinImport';
import { referenceShardId } from '../../src/lib/wine/referenceCatalog';
import { enrichRecognitionReference,referenceMatchForProduct,resolveWineReference } from '../../src/lib/wine/referenceIdentity';
import { lwinEnrichmentStatement,type StoredLwinWine } from '../../worker/lwinEnrichment';
import { realD1 } from './support/realD1';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const product=parseLwinReference({LWIN:'1443192',STATUS:'Live',DISPLAY_NAME:'Majella, Cabernet Sauvignon, Coonawarra',PRODUCER_NAME:'Majella',WINE:'Cabernet Sauvignon',COUNTRY:'Australia',REGION:'South Australia',SUB_REGION:'Coonawarra',COLOUR:'Red',TYPE:'Wine',SUB_TYPE:'Still',VINTAGE_CONFIG:'sequential'});
const input={producer:'Majella',wineName:'Cabernet Sauvignon',country:'Australia',region:'Coonawarra',wineStyle:'red',vintage:2019};
function catalogue(){
 const shard=referenceShardId(product.producerKey),objects:Record<string,unknown>={
  'reference/lwin/current.json':{version:'geo',prefix:'geo',shardCount:256},
  [`geo/shard-${shard}.json`]:[product]
 };
 return {get:async(key:string)=>key in objects?{text:async()=>JSON.stringify(objects[key])}:null} as unknown as R2Bucket;
}
async function reference(){return (await referenceMatchForProduct(catalogue(),product,input,{includeElid:false})).lwinReference!}
const databases:Array<ReturnType<typeof realD1>>=[];
let root:Root|undefined,host:HTMLDivElement|undefined;
afterEach(async()=>{if(root)await act(()=>root!.unmount());root=undefined;host?.remove();host=undefined;for(const db of databases.splice(0))db.close()});

describe('LWIN geography follows the app hierarchy',()=>{
 it.each([
  ['Coonawarra','South Australia','Australia',true],
  ['Barossa','South Australia','Australia',true],
  ['Napa Valley','California','United States',true],
  ['Oakville','Napa Valley','United States',true],
  ['Bourgogne','Burgundy','France',true],
  ['Coonawarra','Barossa Valley','Australia',false],
  ['Coonawarra','Victoria','Australia',false],
  ['Unknown Valley','South Australia','Australia',false],
  ['Coonawarra','South Australia','France',false],
  ['South Australia','Coonawarra','Australia',false]
 ])('compares %s with %s in %s', (current,broader,country,expected)=>{
  expect(regionWithin(current,broader,country,country)).toBe(expected);
 });
 it('does not infer containment across conflicting countries',()=>{
  expect(regionWithin('Coonawarra','South Australia','Australia','France')).toBe(false);
 });
 it.each([
  [{country:'Australia',region:'South Australia',subRegion:'Coonawarra'},'Coonawarra'],
  [{country:'United States',region:'California',subRegion:'Oakville'},'Napa Valley'],
  [{country:'France',region:'Burgundy',subRegion:'Chablis'},'Burgundy'],
  [{country:'Australia',region:'South Australia',subRegion:'Unknown Valley'},'South Australia'],
  [{country:'Australia',region:'South Australia',subRegion:'Yarra Valley'},'South Australia'],
  [{country:'Australia',region:null,subRegion:null},null]
 ])('places reference geography using existing region/appellation rules: %j',(ref,expected)=>{
  expect(referenceAppRegion(ref)).toBe(expected);
 });
 it('accepts containment during matching but rejects sibling regions and wrong countries',()=>{
  expect(compatibleLwinProduct({...product,subRegion:null},input)).toBe(true);
  expect(compatibleLwinProduct(product,{...input,region:'South Australia'})).toBe(true);
  expect(compatibleLwinProduct(product,{...input,region:'Barossa Valley'})).toBe(false);
  expect(compatibleLwinProduct(product,{...input,country:'France'})).toBe(false);
 });
 it('preserves the specific saved region without a false conflict or downgrade suggestion',async()=>{
  const ref=await reference();
  for(const subRegion of ['Coonawarra',null]){
   const enriched=enrichLwinTaxonomy(input,{...ref,subRegion});
   expect(enriched.region).toBe('Coonawarra');
   expect(enriched.lwinReference.conflicts.filter(item=>item.field==='region')).toEqual([]);
   expect(buildReferenceSuggestions({...input,referenceCountry:ref.country,referenceRegion:ref.region,referenceSubRegion:subRegion})).toEqual([]);
  }
  expect(ref.region).toBe('South Australia');
 });
 it('fills blank regions with the narrowest app region while retaining the original catalogue facts',async()=>{
  const enriched=enrichLwinTaxonomy({...input,region:null},await reference());
  expect(enriched.region).toBe('Coonawarra');
  expect(enriched.lwinReference).toMatchObject({region:'South Australia',subRegion:'Coonawarra',filled:{region:'Coonawarra'}});
 });
 it('keeps a real geographic disagreement actionable and offers narrowing rather than widening',async()=>{
  const ref=await reference(),enriched=enrichLwinTaxonomy({...input,region:'Barossa Valley'},ref);
  expect(enriched.lwinReference.conflicts).toContainEqual({field:'region',current:'Barossa Valley',reference:'Coonawarra'});
  expect(buildReferenceSuggestions({...input,region:'South Australia',referenceCountry:ref.country,referenceRegion:ref.region,referenceSubRegion:ref.subRegion})).toContainEqual({field:'region',label:'Region',current:'South Australia',suggested:'Coonawarra'});
 });
 it('matches and enriches recognition without replacing Coonawarra',async()=>{
  expect(await enrichRecognitionReference(catalogue(),input)).toMatchObject({lwin7:'1443192',region:'Coonawarra',lwinReference:{region:'South Australia',conflicts:[]}});
 });
 it('clears an obsolete region review on refresh without changing the saved region',async()=>{
  const database=realD1();databases.push(database);
  database.sql.prepare("INSERT INTO wines(id,owner_id,producer,wine_name,country,region,wine_style,vintage,lwin7,identity_match_status,reference_suggestions_json,created_at,updated_at) VALUES('geo','owner','Majella','Cabernet Sauvignon','Australia','Coonawarra','red',2019,'1443192','matched',?,'now','now')")
   .run(JSON.stringify([{field:'region',label:'Region',current:'Coonawarra',suggested:'South Australia'}]));
  const row=database.sql.prepare("SELECT * FROM wines WHERE id='geo'").get() as StoredLwinWine;
  await lwinEnrichmentStatement(database.db,row,await resolveWineReference(catalogue(),input))!.run();
  expect(database.sql.prepare("SELECT region,reference_suggestions_json FROM wines WHERE id='geo'").get()).toEqual({region:'Coonawarra',reference_suggestions_json:null});
 });
});

async function panel(region:string,ref:LwinReference){
 host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);const onApply=vi.fn();
 await act(()=>root!.render(<LwinEditPanel wine={{id:'geo',lwin7:'1443192',identityMatchStatus:'matched',lwinReference:ref} as never} values={{...input,region,classification:'',classificationOverride:''}} dirty={false} disabled={false} canMatch initiallyOpen onApply={onApply} onBusy={()=>{}} onUpdated={()=>{}}/>));
 return {onApply,regionButton:()=>Array.from(host!.querySelectorAll('button')).find(button=>button.textContent==='Use LWIN region')};
}
describe('LWIN edit region comparison',()=>{
 it('removes the downgrade button while keeping original South Australia catalogue details',async()=>{
  const {regionButton}=await panel('Coonawarra',await reference());
  expect(regionButton()).toBeUndefined();expect(host!.textContent).toContain('South Australia');
 });
 it('applies Coonawarra when the user chooses to refine South Australia',async()=>{
  const {regionButton,onApply}=await panel('South Australia',await reference());
  expect(regionButton()).toBeDefined();await act(()=>regionButton()!.click());
  expect(onApply).toHaveBeenCalledWith({region:'Coonawarra'});
 });
});
