import { afterEach,describe,expect,it } from 'vitest';
import { realD1 } from './support/realD1';
import { recheckWineReference } from '../../worker/wineReferenceReview';
import { rolloutRoute } from '../../worker/multiUser/rollout';
import { parseLwinReference } from '../../src/lib/wine/lwinImport';
import { lwinReferenceIdentity,referenceShardId } from '../../src/lib/wine/referenceCatalog';
import { createSession } from '../../src/lib/auth/session';
import app from '../../worker/index';
import { ensureWineIdentity } from '../../src/lib/wine/identity';
import { loadResearchCache,upsertResearchCache,wineRowResearchTargets } from '../../src/lib/research/cache';
import { ensureAllCuveeLinksForProducer } from '../../src/lib/cuvees/entities';
import { referenceMatchForProduct } from '../../src/lib/wine/referenceIdentity';
import { resolveStoredLwin,lwinEnrichmentStatement,type StoredLwinWine } from '../../worker/lwinEnrichment';
import { rolloutStatus } from '../../worker/multiUser/rollout';

const databases:Array<ReturnType<typeof realD1>>=[];
afterEach(()=>{databases.splice(0).forEach(db=>db.close())});
const owner={id:'owner',email:'owner@example.com',display_name:'Owner',role:'owner' as const,status:'active' as const};
const secret='test-secret-value-long-enough-for-hmac';
function setup(){
 const database=realD1();databases.push(database);
 const product=parseLwinReference({LWIN:'1059328',STATUS:'Live',DISPLAY_NAME:'Domaine de la Vougeraie, Bourgogne, Terres de Famille Pinot Noir',PRODUCER_TITLE:'Domaine',PRODUCER_NAME:'de la Vougeraie',WINE:'Terres de Famille Pinot Noir',COUNTRY:'France',REGION:'Burgundy',COLOUR:'Red',VINTAGE_CONFIG:'sequential'});
 const objects:Record<string,unknown>={'reference/lwin/current.json':{provider:'lwin',prefix:'test',shardCount:256},[`test/shard-${referenceShardId(product.producerKey)}.json`]:[product]};
 const bucket={get:async(key:string)=>objects[key]?{text:async()=>JSON.stringify(objects[key])}:null} as unknown as R2Bucket;
 const env={DB:database.db,REFERENCE_DATA:bucket,AUTH_SECRET:secret,APP_URL:'https://wine.example'};
 function insert(id='w1',lwin='1059328',account='owner'){
  database.sql.prepare("INSERT INTO wines(id,owner_id,producer,wine_name,lwin7,identity_match_status,country,region,reference_suggestions_json,created_at,updated_at) VALUES(?,?,?,?,?,'conflict','France','Burgundy',?,'now','now')")
   .run(id,account,'Domaine de la Vougeraie','Terres de Famille Pinot Noir',lwin,JSON.stringify([{field:'producer',label:'Producer',current:'Domaine de la Vougeraie',suggested:'de la Vougeraie'}]));
 }
 async function request(path:string,body:unknown,method='POST',account='owner'){
  return app.fetch(new Request(`https://wine.example/api/wines/${path}`,{method,headers:{authorization:`Bearer ${await createSession(account,secret)}`,'content-type':'application/json'},body:JSON.stringify(body)}),env as never);
 }
 const queue=(after='')=>rolloutRoute(new Request(`https://wine.example/api/admin/rollout/lwin-review?after=${after}`),env as never,owner).then(r=>r!.json()) as Promise<{items:Array<{id:string}>;total:number;nextCursor:string|null}>;
 return {database,env,bucket,insert,request,queue,objects};
}

describe('LWIN review repair and queue',()=>{
 async function hairyArm(){
  const context=setup(),{database,bucket,objects,insert}=context;insert();
  const product=parseLwinReference({LWIN:'2409267',STATUS:'Live',DISPLAY_NAME:'The Hairy Arm, Nebbiolo, Heathcote',PRODUCER_NAME:'The Hairy Arm',WINE:'Nebbiolo',COUNTRY:'Australia',REGION:'Victoria',SUB_REGION:'Heathcote',COLOUR:'Red',TYPE:'Wine',SUB_TYPE:'Still'});
  objects[`test/shard-${referenceShardId(product.producerKey)}.json`]=[product];
  const input={producer:'The Hairy Arm Wine Company',wineName:'Heathcote Nebbiolo'};
  const match=await referenceMatchForProduct(bucket,product,input,{includeElid:false});
  const reference={...match.lwinReference!,method:'ai',confidence:0.95,input,conflicts:[{field:'producer',current:input.producer,reference:'The Hairy Arm'},{field:'wineName',current:input.wineName,reference:'Nebbiolo'}]};
  const suggestions=[{field:'producer',label:'Producer',current:input.producer,suggested:'The Hairy Arm'},{field:'wineName',label:'Wine name',current:input.wineName,suggested:'Nebbiolo, Heathcote'}];
  database.sql.prepare("UPDATE wines SET producer=?,wine_name=?,lwin7='2409267',identity_match_status='matched',country='Australia',region='Victoria',lwin_reference_json=?,reference_suggestions_json=?").run(input.producer,input.wineName,JSON.stringify(reference),JSON.stringify(suggestions));
  const row=()=>database.sql.prepare('SELECT * FROM wines').get() as StoredLwinWine;
  const refresh=async()=>{const next=await resolveStoredLwin(bucket,row());const statement=next&&lwinEnrichmentStatement(database.db,row(),next,next.lwinReference?.method);if(statement)await statement.run()};
  return {...context,row,refresh};
 }
 it('keeps the reviewed Hairy Arm AI identity through repeated enrichment refreshes',async()=>{
  const {request,row,refresh,queue}=await hairyArm();
  expect((await request('w1/reference-suggestion',{field:'producer',action:'apply'},'PUT')).status).toBe(200);
  expect((await request('w1/reference-suggestion',{field:'wineName',action:'keep'},'PUT')).status).toBe(200);
  expect(JSON.parse(String(row().lwin_reference_json)).input).toEqual({producer:'The Hairy Arm',wineName:'Heathcote Nebbiolo'});
  await refresh();await refresh();
  expect(row()).toMatchObject({producer:'The Hairy Arm',wine_name:'Heathcote Nebbiolo',lwin7:'2409267',identity_match_status:'matched',reference_suggestions_json:null});
  expect((await queue()).total).toBe(0);
 });
 it('preserves owned research when approving a producer rename relinks entities',async()=>{
  const field='producer';
  const {database,request,row}=await hairyArm();
  await ensureWineIdentity(database.db,'owner','w1');
  const target=wineRowResearchTargets(row()).find(target=>target.scope==='terroir')!;
  await upsertResearchCache(database.db,'owner',{target,payload:{terroir:'The vineyard has stony soils.'},sources:[{title:'Estate',url:'https://example.com/estate'}],model:'saved-model',researchedAt:'2026-09-13T00:00:00.000Z'});
  expect((await request('w1/reference-suggestion',{field,action:'apply'},'PUT')).status).toBe(200);
  const targets=wineRowResearchTargets(row()),next=targets.find(target=>target.scope==='terroir')!;
  expect(next.cacheKey).not.toBe(target.cacheKey);
  expect((await loadResearchCache(database.db,'owner',targets)).get('terroir')).toMatchObject({target:next,payload:{terroir:'The vineyard has stony soils.'},model:'saved-model',researchedAt:'2026-09-13T00:00:00.000Z'});
  expect((await loadResearchCache(database.db,'owner',[target])).size).toBe(1);
 });
 it('rejects a rename if the vintage changes while saved research is being read',async()=>{
  const {database,request,row}=await hairyArm();
  await ensureWineIdentity(database.db,'owner','w1');
  const original=row().producer,prepare=database.db.prepare.bind(database.db);
  database.db.prepare=(sql:string)=>{
   if(sql.includes('FROM research_cache'))database.sql.exec("UPDATE wines SET vintage=2021,updated_at='changed-during-review' WHERE id='w1'");
   return prepare(sql);
  };
  expect((await request('w1/reference-suggestion',{field:'producer',action:'apply'},'PUT')).status).toBe(409);
  expect(row()).toMatchObject({producer:original,vintage:2021});
 });
 it.each([false,true])('repairs legacy reviewed-name conflicts only with compatible clues (incompatible: %s)',async incompatible=>{
  const {database,row,request}=await hairyArm();
  database.sql.prepare("UPDATE wines SET producer='The Hairy Arm',identity_match_status='conflict',reference_suggestions_json=NULL,colour=?").run(incompatible?'White':'Red');
  expect((await request('w1/reference-review',{action:'recheck'})).status).toBe(200);
  expect(row().identity_match_status).toBe(incompatible?'conflict':'matched');
  expect(row().wine_name).toBe('Heathcote Nebbiolo');
 });
 it('counts current owner review items separately from historical run totals',async()=>{
  const {database,insert,request}=setup();insert();insert('w2');insert('private','1059328','other-owner');
  database.sql.exec("UPDATE wines SET identity_match_status='manual' WHERE id='w2'; INSERT INTO rollout_state(name,value) VALUES('lwin_conflict','17')");
  const before=await rolloutStatus(database.db,'owner');
  expect(before.lwinCurrent).toMatchObject({total:2,manual:1,identityConflicts:1,fieldUpdates:1,needsReview:2});
  expect((await request('w2/reference-suggestion',{field:'producer',action:'keep'},'PUT')).status).toBe(200);
  const after=await rolloutStatus(database.db,'owner');
  expect(after.lwinCurrent).toMatchObject({total:2,manual:1,identityConflicts:1,fieldUpdates:0,needsReview:1});
  expect(after.lwin.conflict).toBe(17);
 });
 it('preserves the full producer from the display name, with title fallback',()=>{
  expect(lwinReferenceIdentity({producerTitle:'Domaine',producerName:'de la Vougeraie'}).producerName).toBe('Domaine de la Vougeraie');
  expect(lwinReferenceIdentity({displayName:'Domaine de la Vougeraie, Bourgogne',producerName:'de la Vougeraie'}).producerName).toBe('Domaine de la Vougeraie');
  expect(lwinReferenceIdentity({producerTitle:'Domaine',producerName:'Domaine de la Vougeraie'}).producerName).toBe('Domaine de la Vougeraie');
 });
 it('rechecks the photographed mismatch and removes stale suggestions without renaming the wine',async()=>{
  const {database,bucket,insert,queue}=setup();insert();
  expect((await queue()).total).toBe(1);
  expect(await recheckWineReference(database.db,bucket,'owner','w1')).toBe(true);
  expect(database.sql.prepare('SELECT producer,lwin7,identity_match_status,reference_suggestions_json FROM wines').get()).toMatchObject({producer:'Domaine de la Vougeraie',lwin7:'1059328',identity_match_status:'matched',reference_suggestions_json:null});
  expect((await queue()).total).toBe(0);
 });
 it('keeps real identity conflicts after dismissing a field and requires explicit confirmation',async()=>{
  const {database,insert,request,queue}=setup();insert('w1','1000001');
  expect((await request('w1/reference-suggestion',{field:'producer',action:'keep'},'PUT')).status).toBe(200);
  expect((await queue()).total).toBe(1);
  const row=database.sql.prepare('SELECT * FROM wines').get()!;
  expect(row.producer).toBe('Domaine de la Vougeraie');expect(row.identity_match_status).toBe('conflict');
  expect((await request('w1/reference-review',{action:'confirm',lwin7:'1000001',updatedAt:'stale'})).status).toBe(409);
  expect((await request('w1/reference-review',{action:'confirm',lwin7:'1000001',updatedAt:row.updated_at})).status).toBe(200);
  expect((await queue()).total).toBe(0);
 });
 it('clears a verifiable conflict when the final field is kept',async()=>{
  const {insert,request,queue}=setup();insert();
  expect((await request('w1/reference-suggestion',{field:'producer',action:'keep'},'PUT')).status).toBe(200);
  expect((await queue()).total).toBe(0);
 });
 it('does not resurrect a kept field when rechecking later',async()=>{
  const {database,insert,request,queue}=setup();insert();
  database.sql.prepare('UPDATE wines SET producer=?,reference_suggestions_json=?').run('de la Vougeraie',JSON.stringify([{field:'producer',label:'Producer',current:'de la Vougeraie',suggested:'Domaine de la Vougeraie'}]));
  expect((await request('w1/reference-suggestion',{field:'producer',action:'keep'},'PUT')).status).toBe(200);
  expect((await request('w1/reference-review',{action:'recheck'})).status).toBe(200);
  expect((await queue()).total).toBe(0);
  expect(database.sql.prepare('SELECT producer FROM wines').get()!.producer).toBe('de la Vougeraie');
 });
 it.each(['apply','keep'] as const)('allows %s when the saved wine-name snapshot differs only by an accent',async action=>{
  const {database,insert,request,queue}=setup();insert();
  database.sql.prepare("UPDATE wines SET producer='Forget-Chemin',wine_name='Special Club',region='Champagne',lwin7='2428042',identity_match_status='manual',reference_suggestions_json=?")
   .run(JSON.stringify([{field:'wineName',label:'Wine name',current:'Spécial Club',suggested:'Special Club Brut'}]));
  const response=await request('w1/reference-suggestion',{field:'wineName',action},'PUT');
  expect(response.status).toBe(200);
  expect(database.sql.prepare('SELECT wine_name,lwin7,identity_match_status,reference_suggestions_json FROM wines').get()).toMatchObject({wine_name:action==='apply'?'Special Club Brut':'Special Club',lwin7:'2428042',identity_match_status:'manual',reference_suggestions_json:null});
  expect((await queue()).total).toBe(0);
 });
 it.each(['apply','keep'] as const)('still rejects %s when the stored wine name meaningfully changed',async action=>{
  const {database,insert,request}=setup();insert();
  const suggestions=JSON.stringify([{field:'wineName',label:'Wine name',current:'Spécial Club',suggested:'Special Club Brut'}]);
  database.sql.prepare("UPDATE wines SET wine_name='Special Club Rosé',reference_suggestions_json=?").run(suggestions);
  const response=await request('w1/reference-suggestion',{field:'wineName',action},'PUT');
  expect(response.status).toBe(409);
  expect(database.sql.prepare('SELECT wine_name,reference_suggestions_json FROM wines').get()).toMatchObject({wine_name:'Special Club Rosé',reference_suggestions_json:suggestions});
 });
 it.each(['apply','keep'] as const)('%s uses the intended name when the wine already has an older recognition and cuvee link',async action=>{
  const {database,insert,request,queue}=setup();insert();
  const original='Grand Cru Grand Vintage',suggested='Grand Vintage Brut Grand Cru';
  database.sql.prepare("UPDATE wines SET producer='Varnier-Fannière',wine_name=?,recognized_wine_name=?,vintage=2015,region='Champagne',appellation='Avize AOC',wine_style='sparkling',lwin7='1560279',lwin11='15602792015',identity_match_status='manual',reference_suggestions_json=?")
   .run(original,original,JSON.stringify([{field:'wineName',label:'Wine name',current:original,suggested}]));
  database.sql.prepare("UPDATE wines SET lwin_reference_json=? WHERE id='w1'").run(JSON.stringify({source:'lwin',version:'test',lwin7:'1560279',producer:'Varnier-Fannière',wineName:suggested,country:'France',region:'Champagne',subRegion:null,site:null,parcel:null,designation:null,classification:null,colour:'White',productType:'Wine',productSubtype:'Sparkling',vintageConfig:'sequential',firstVintage:null,finalVintage:null,sourceUpdatedAt:null,method:'manual',confidence:null,filled:{},conflicts:[]}));
  await ensureWineIdentity(database.db,'owner','w1');
  const before=database.sql.prepare('SELECT * FROM wines WHERE id=\'w1\'').get()!;
  expect(before.cuvee_id).toBeTruthy();
  const researchTarget=wineRowResearchTargets(before).find(target=>target.scope==='terroir')!;
  await upsertResearchCache(database.db,'owner',{target:researchTarget,payload:{terroir:'Chalk soils in the vineyard.'},sources:[{title:'Estate',url:'https://example.com/estate'}],model:'saved-model',researchedAt:'2026-09-13T00:00:00.000Z'});
  const response=await request('w1/reference-suggestion',{field:'wineName',action},'PUT');
  expect(response.status).toBe(200);
  const expected=action==='apply'?suggested:original;
  const check=()=>{
   const wine=database.sql.prepare('SELECT * FROM wines WHERE id=\'w1\'').get()!;
   expect(wine).toMatchObject({wine_name:expected,recognized_wine_name:expected,lwin7:'1560279',lwin11:'15602792015',vintage:2015,producer:before.producer,reference_suggestions_json:null});
   expect(database.sql.prepare('SELECT canonical_name FROM cuvees WHERE id=?').get(wine.cuvee_id)!.canonical_name).toBe(expected);
  };
  check();
  const savedWine=database.sql.prepare("SELECT * FROM wines WHERE id='w1'").get()!;
  expect((await loadResearchCache(database.db,'owner',wineRowResearchTargets(savedWine))).get('terroir')?.payload.terroir).toBe('Chalk soils in the vineyard.');
  await ensureWineIdentity(database.db,'owner','w1');
  await ensureAllCuveeLinksForProducer(database.db,'owner',String(before.producer_id));
  check();expect((await queue()).total).toBe(0);
 });
 it('paginates beyond 20, includes suggestion-only wines, and excludes other accounts',async()=>{
  const {database,insert,queue}=setup();for(let i=0;i<45;i++)insert(`w${String(i).padStart(2,'0')}`);insert('private','1059328','another-owner');
  database.sql.exec("UPDATE wines SET identity_match_status='matched' WHERE id='w00'");
  const first=await queue();expect(first.total).toBe(45);expect(first.items).toHaveLength(40);expect(first.items[0].id).toBe('w00');
  const second=await queue(first.nextCursor!);expect(second.items).toHaveLength(5);expect(second.nextCursor).toBeNull();
 });
 it('rejects another account trying to resolve the owner wine',async()=>{
  const {insert,request}=setup();insert();
  expect((await request('w1/reference-suggestion',{field:'producer',action:'keep'},'PUT','member')).status).toBe(404);
  expect((await request('w1/reference-review',{action:'confirm',lwin7:'1059328',updatedAt:'now'},'POST','member')).status).toBe(409);
 });
});
