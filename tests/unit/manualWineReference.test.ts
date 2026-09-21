import { afterEach,describe,expect,it } from 'vitest';
import { realD1 } from './support/realD1';
import app from '../../worker/index';
import { createSession } from '../../src/lib/auth/session';
import { parseLwinReference,type LwinReferenceProduct } from '../../src/lib/wine/lwinImport';
import { lwinReferenceIdentity,referenceShardId } from '../../src/lib/wine/referenceCatalog';
import { previewWineReference } from '../../worker/manualWineReference';
import { processRolloutJob,rolloutRoute } from '../../worker/multiUser/rollout';
import { recheckWineReference } from '../../worker/wineReferenceReview';
import { referenceIdentityStatements } from '../../src/lib/wine/referenceIdentity';
import { previewLoggingReference } from '../../worker/wineLoggingReference';
import { wineInputSchema } from '../../src/lib/db/schema';

const databases:Array<ReturnType<typeof realD1>>=[];
afterEach(()=>databases.splice(0).forEach(db=>db.close()));
const secret='test-secret-value-long-enough-for-hmac';
function setup({indexed=false,status='Live',vintageConfig='sequential'}:{indexed?:boolean;status?:string;vintageConfig?:string}={}){
 const database=realD1();databases.push(database);
 const product=parseLwinReference({LWIN:'1017483',STATUS:status,REFERENCE:status==='Combined'?'1017000':null,DISPLAY_NAME:'Chateau Rieussec Premier Cru Classe, Sauternes',PRODUCER_TITLE:'Chateau',PRODUCER_NAME:'Rieussec',WINE:'Château Rieussec',COUNTRY:'France',REGION:'Bordeaux',SUB_REGION:'Sauternes',COLOUR:'White',TYPE:'Wine',SUB_TYPE:'Still',VINTAGE_CONFIG:vintageConfig});
 const targetShard=referenceShardId(product.producerKey),reads:string[]=[];
 const objects:Record<string,unknown>={
  'reference/lwin/current.json':{version:'test',prefix:'test',shardCount:256,...indexed?{lwinIdIndexPrefix:'test/id-index-'}:{}},
  [`test/shard-${targetShard}.json`]:[product],
  [`test/id-index-${referenceShardId(product.lwin7)}.json`]:{[product.lwin7]:targetShard}
 };
 const bucket={get:async(key:string)=>{reads.push(key);return objects[key]?{text:async()=>JSON.stringify(objects[key])}:null}} as unknown as R2Bucket;
 const env={DB:database.db,REFERENCE_DATA:bucket,AUTH_SECRET:secret,APP_URL:'https://wine.example'};
 database.sql.prepare("INSERT INTO wines(id,owner_id,producer,wine_name,vintage,vintage_kind,country,region,wine_style,lwin7,lwin11,elid,reference_site,reference_parcel,identity_match_status,reference_suggestions_json,tasting_notes,rating,created_at,updated_at) VALUES('w1','owner','Chateau Rieussec','Château Rieussec',2018,'vintage','France','Bordeaux','sweet','1017425','10174252018','OLD-ELID','Old site','Old parcel','conflict',?,'Keep my notes',94,'now','now')")
  .run(JSON.stringify([{field:'wineName',label:'Wine name',current:'Château Rieussec',suggested:'R Rieussec'}]));
 const row=()=>database.sql.prepare('SELECT * FROM wines WHERE id=\'w1\'').get()!;
 async function request(path:string,body?:unknown,owner='owner'){
  return app.fetch(new Request(`https://wine.example/api/wines/w1/${path}`,{method:body?'POST':'GET',headers:{authorization:`Bearer ${await createSession(owner,secret)}`,'content-type':'application/json'},...body?{body:JSON.stringify(body)}:{}}),env as never);
 }
 return {database,env,objects,product,targetShard,reads,row,request};
}

describe('manual LWIN selection',()=>{
 it('refreshes a shortened name and refuses applying the old suggestion',async()=>{
  const {database,env,product,row,request}=setup();
  product.displayName='Chateau Rieussec, Sauternes Rouge';product.wineName='Rouge';
  const {preview}=await previewWineReference(env,'owner','w1','1017483');
  expect((await request('reference-review',{action:'link',lwin7:'1017483',previewToken:preview.previewToken})).status).toBe(200);
  database.sql.prepare('UPDATE wines SET reference_suggestions_json=?').run(JSON.stringify([{field:'wineName',label:'Wine name',current:row().wine_name,suggested:'Rouge'}]));
  const before=row().wine_name;
  const response=await app.fetch(new Request('https://wine.example/api/wines/w1/reference-suggestion',{method:'PUT',headers:{authorization:`Bearer ${await createSession('owner',secret)}`,'content-type':'application/json'},body:JSON.stringify({field:'wineName',action:'apply'})}),env as never);
  expect(response.status).toBe(409);expect(row().wine_name).toBe(before);
  expect((await request('reference-review',{action:'recheck'})).status).toBe(200);
  expect(JSON.parse(String(row().reference_suggestions_json))).toEqual([{field:'wineName',label:'Wine name',current:before,suggested:'Sauternes Rouge'}]);
  expect(row().wine_name).toBe(before);
 });
 it.each([false,true])('previews Cave de Tain by exact code in a legacy catalogue (producer index: %s)',async indexed=>{
  const {database,env,objects,reads,row,request}=setup();
  const product=parseLwinReference({LWIN:'2259354',STATUS:'Live',DISPLAY_NAME:'Cave de Tain, Nobles Rives',PRODUCER_TITLE:'Cave',PRODUCER_NAME:'de Tain',WINE:'Nobles Rives',COUNTRY:'France',REGION:'Rhone',SUB_REGION:'Crozes-Hermitage',COLOUR:'Red',TYPE:'Wine',SUB_TYPE:'Still',VINTAGE_CONFIG:'sequential'});
  const shard=referenceShardId(product.producerKey);
  objects[`test/shard-${shard}.json`]=[product];
  if(indexed){
   (objects['reference/lwin/current.json'] as Record<string,unknown>).producerIndexKey='test/producer-index.json';
   objects['test/producer-index.json']={'de tain':[shard]};
  }
  database.sql.exec("UPDATE wines SET producer='Cave de Tain',wine_name='Nobles Rives',vintage=2025,region='Rhone',wine_style='white',colour='White'");
  const before=row();
  const {preview}=await previewWineReference(env,'owner','w1','2259354');
  expect(preview).toMatchObject({lwin7:'2259354',producer:'Cave de Tain',wineName:'Nobles Rives',colour:'Red'});
  expect(row()).toEqual(before);
  expect(reads.filter(key=>key.includes('/shard-')).length).toBeLessThanOrEqual(2);
  // The entered ID remains authoritative even when the current colour differs.
  expect((await request('reference-review',{action:'link',lwin7:'2259354',previewToken:preview.previewToken})).status).toBe(200);
  expect(row()).toMatchObject({lwin7:'2259354',colour:'White',wine_style:'white',tasting_notes:'Keep my notes',identity_match_status:'manual'});
  expect((await request('reference-preview?lwin7=9999999')).status).toBe(404);
 });
 it.each(['confirm','none'] as const)('reviews the named catalogue identity before creation and saves the %s decision',async(action)=>{
  const {env,database,product}=setup(),identity=lwinReferenceIdentity(product);
  const input={producer:product.producerName,wineName:identity.wineName,vintage:2018,country:'France',region:'Bordeaux',wineStyle:'dessert',tastingNotes:'My label and notes',alcoholPercentage:null,rating:null,tastingDate:null,event:null,venue:null,price:null,currency:null,recognitionConfidence:null};
  const post=async(path:string,body:unknown)=>app.fetch(new Request(`https://wine.example/api/wines${path}`,{method:'POST',headers:{authorization:`Bearer ${await createSession('owner',secret)}`,'content-type':'application/json'},body:JSON.stringify(body)}),env as never);
  const before=database.sql.prepare('SELECT count(*) AS n FROM wines').get()!.n;
  const preview=await post('/reference-check',input);expect(preview.status).toBe(200);
  const result=await preview.json() as {matched:boolean;token:string};
  expect(result).toMatchObject({matched:true,needsReview:true,producer:identity.producerName,wineName:identity.wineName});
  expect(database.sql.prepare('SELECT count(*) AS n FROM wines').get()!.n).toBe(before);
  const saved=await post('',{...input,referenceDecision:{action,token:result.token}});expect(saved.status).toBe(201);
  const {id}=await saved.json() as {id:string};
  expect(database.sql.prepare('SELECT producer,wine_name,tasting_notes,lwin7,identity_match_status FROM wines WHERE id=?').get(id)).toMatchObject({producer:input.producer,wine_name:input.wineName,tasting_notes:input.tastingNotes,lwin7:action==='confirm'?'1017483':null,identity_match_status:action==='confirm'?'matched':'manual'});
 });
 it('saves a clear match without review, including accent and case differences',async()=>{
  const {env,product}=setup();product.displayName='Rieussec, Château Rieussec';
  const preview=await previewLoggingReference(env.REFERENCE_DATA,wineInputSchema.parse({producer:'CHÂTEAU RIEUSSEC',wineName:'Chateau Rieussec',country:'France',region:'Bordeaux'}));
  expect(preview).toMatchObject({matched:true,needsReview:false});expect(preview.token).toBeTruthy();
 });
 it('rechecks the Maison Fang screenshot without suggesting removal of the producer title',async()=>{
  const {database,env,objects,row}=setup();
  // Identity fields from the imported 03383c3400811b6c snapshot, LWIN 3061244.
  const fang=parseLwinReference({LWIN:'3061244',STATUS:'Live',DISPLAY_NAME:'Maison Fang, Savigny-les-Beaune, Cuvee Zephyr',PRODUCER_TITLE:'Maison',PRODUCER_NAME:'Fang',WINE:'Cuvee Zephyr',COUNTRY:'France',REGION:'Burgundy',SUB_REGION:'Savigny-les-Beaune',COLOUR:'White',TYPE:'Wine',SUB_TYPE:'Still',VINTAGE_CONFIG:'sequential'});
  objects[`test/shard-${referenceShardId('fang')}.json`]=[fang];
  database.sql.prepare("UPDATE wines SET producer='Maison FANG',wine_name='Savigny-lès-Beaune Cuvée Zéphyr',lwin7='3061244',region='Burgundy',wine_style='white',reference_suggestions_json=?")
   .run(JSON.stringify([{field:'producer',label:'Producer',current:'Maison FANG',suggested:'Fang'},{field:'wineName',label:'Wine name',current:'Savigny-lès-Beaune Cuvée Zéphyr',suggested:'Cuvee Zephyr'}]));
  expect(await recheckWineReference(env.DB,env.REFERENCE_DATA,'owner','w1')).toBe(true);
  expect(row()).toMatchObject({producer:'Maison FANG',wine_name:'Savigny-lès-Beaune Cuvée Zéphyr',lwin7:'3061244',identity_match_status:'matched'});
  expect(row().reference_suggestions_json).toBeNull();
 });
 it('refuses a stale logging match',async()=>{
  const {env,database,product}=setup(),identity=lwinReferenceIdentity(product);
  const input={producer:product.producerName,wineName:identity.wineName,vintage:2018,country:'France',region:'Bordeaux',wineStyle:'dessert'};
  const response=await app.fetch(new Request('https://wine.example/api/wines',{method:'POST',headers:{authorization:`Bearer ${await createSession('owner',secret)}`,'content-type':'application/json'},body:JSON.stringify({...input,referenceDecision:{action:'confirm',token:'stale'}})}),env as never);
  expect(response.status).toBe(409);
  expect(database.sql.prepare('SELECT count(*) AS n FROM wines').get()!.n).toBe(1);
 });
 it('saves an unchecked wine without a reference or another catalogue lookup',async()=>{
  const {env,database,reads}=setup();
  const input={producer:'Rieussec',wineName:'Château Rieussec',vintage:2018,country:'France',region:'Bordeaux',wineStyle:'dessert',alcoholPercentage:null,rating:null,tastingDate:null,event:null,venue:null,price:null,currency:null,recognitionConfidence:null,referenceDecision:{action:'unmatched'}};
  const response=await app.fetch(new Request('https://wine.example/api/wines',{method:'POST',headers:{authorization:`Bearer ${await createSession('owner',secret)}`,'content-type':'application/json'},body:JSON.stringify(input)}),env as never);
  expect(response.status).toBe(201);
  const {id}=await response.json() as {id:string};
  expect(database.sql.prepare('SELECT lwin7,identity_match_status FROM wines WHERE id=?').get(id)).toMatchObject({lwin7:null,identity_match_status:'unmatched'});
  expect(reads).toEqual([]);
 });
 it('rejects a match, clears its reference metadata and removes it from review without changing personal fields',async()=>{
  const {database,env,row,request}=setup();
  database.sql.exec("UPDATE wines SET reference_product_key='lwin:1017425',colour='White',product_type='Wine',product_subtype='Still',identity_match_candidates_json='[\"1017483\"]',identity_match_confidence=0.9,identity_matched_at='now',reference_suggestions_updated_at='now'");
  const before=row();
  const response=await request('reference-review',{action:'reject',lwin7:before.lwin7,updatedAt:before.updated_at});
  expect(response.status).toBe(200);
  expect(row()).toMatchObject({producer:before.producer,wine_name:before.wine_name,vintage:2018,country:'France',region:'Bordeaux',wine_style:'sweet',tasting_notes:'Keep my notes',rating:94,
   lwin7:null,lwin11:null,elid:null,reference_product_key:null,reference_site:null,reference_parcel:null,colour:before.colour,product_type:before.product_type,product_subtype:before.product_subtype,
   identity_match_status:'manual',identity_match_confidence:null,identity_match_candidates_json:null,identity_matched_at:null,reference_suggestions_json:null,reference_suggestions_updated_at:null});
  const review=await rolloutRoute(new Request('https://wine.example/api/admin/rollout/lwin-review'),env as never,{id:'owner',role:'owner',status:'active',email:'owner@example.com',display_name:'Owner'});
  expect(await review!.json()).toMatchObject({total:0,items:[]});
 });
 it('preserves the no-LWIN choice through rechecks, save matching and both backfills, while allowing a later manual link',async()=>{
  const {database,env,row,request}=setup(),before=row();
  expect((await request('reference-review',{action:'reject',lwin7:before.lwin7,updatedAt:before.updated_at})).status).toBe(200);
  await recheckWineReference(env.DB,env.REFERENCE_DATA,'owner','w1');
  for(const producer of ['Chateau Rieussec','Corrected producer'])await env.DB.batch(referenceIdentityStatements(env.DB,'owner','w1',{
   producer,wineName:'Château Rieussec',identityMatchStatus:'matched',lwin7:'1017483',referenceProductKey:'lwin:1017483'
  },'later',true,{producer:'Chateau Rieussec',wine_name:'Château Rieussec',lwin7:null}));
  database.sql.exec("INSERT INTO rollout_state(name,value) VALUES('rollout_lwin_job','running'),('rollout_lwin_ai_job','running')");
  for(const kind of ['lwin','lwin_ai'] as const)expect(await processRolloutJob(env as never,kind)).toMatchObject({complete:true,processed:0});
  expect(row()).toMatchObject({lwin7:null,identity_match_status:'manual',reference_suggestions_json:null});
  const {preview}=await previewWineReference(env,'owner','w1','1017483');
  expect((await request('reference-review',{action:'link',lwin7:'1017483',previewToken:preview.previewToken})).status).toBe(200);
  expect(row()).toMatchObject({lwin7:'1017483',identity_match_status:'manual'});
 });
 it('rejects stale or incomplete rejection requests and cross-account access',async()=>{
  const {row,request}=setup(),before=row();
  expect((await request('reference-review',{action:'reject',lwin7:before.lwin7,updatedAt:'stale'})).status).toBe(409);
  expect((await request('reference-review',{action:'reject',lwin7:'9999999',updatedAt:before.updated_at})).status).toBe(409);
  expect((await request('reference-review',{action:'reject',lwin7:before.lwin7})).status).toBe(400);
  expect((await request('reference-review',{action:'reject',updatedAt:before.updated_at})).status).toBe(400);
  expect((await request('reference-review',{action:'reject',lwin7:before.lwin7,updatedAt:before.updated_at},'member')).status).toBe(404);
  expect(row()).toEqual(before);
 });
 it('can keep a conflicted wine without LWIN when only candidates remain',async()=>{
  const {database,row,request}=setup();database.sql.exec('UPDATE wines SET lwin7=NULL');
  expect((await request('reference-review',{action:'reject',lwin7:null,updatedAt:row().updated_at})).status).toBe(200);
  expect(row()).toMatchObject({lwin7:null,elid:null,identity_match_status:'manual',reference_suggestions_json:null});
 });
 it('previews without writes and replaces the wrong identity without changing personal wine fields',async()=>{
  const {env,row,request}=setup(),before=row();
  const {preview}=await previewWineReference(env,'owner','w1','1017483');
  expect(row()).toEqual(before);expect(preview).toMatchObject({lwin7:'1017483',storedLwin7:'1017425',lwin11:'10174832018'});
  expect(preview.suggestions.map(item=>item.field)).toEqual(['producer','wineName']);
  const response=await request('reference-review',{action:'link',lwin7:'1017483',previewToken:preview.previewToken});
  expect(response.status).toBe(200);
  expect(row()).toMatchObject({producer:before.producer,wine_name:before.wine_name,vintage:2018,country:'France',region:'Bordeaux',wine_style:'sweet',tasting_notes:'Keep my notes',rating:94,lwin7:'1017483',lwin11:'10174832018',elid:null,reference_site:null,reference_parcel:null,reference_product_key:'lwin:1017483',identity_match_status:'manual',identity_match_candidates_json:null,reference_suggestions_json:JSON.stringify(preview.suggestions)});
 });
 it('uses the ID index to find a different producer without scanning all shards',async()=>{
  const {database,env,reads}=setup({indexed:true});database.sql.exec("UPDATE wines SET producer='Wrong producer'");
  const {preview}=await previewWineReference(env,'owner','w1','1017483');
  expect(preview.lwin7).toBe('1017483');expect(preview.suggestions.map(item=>item.field)).toContain('producer');
  expect(reads.filter(key=>key.includes('/shard-'))).toHaveLength(1);
 });
 it.each(['abc','101748','10174832018'])('rejects invalid code %s without changing the wine',async code=>{
  const {row,request}=setup(),before=row();expect((await request(`reference-preview?lwin7=${code}`)).status).toBe(400);expect(row()).toEqual(before);
 });
 it('rejects missing and deleted codes and refuses linking without a preview',async()=>{
  const {row,request}=setup({status:'Deleted'}),before=row();
  expect((await request('reference-preview?lwin7=9999999')).status).toBe(404);
  expect((await request('reference-preview?lwin7=1017483')).status).toBe(422);
  expect((await request('reference-review',{action:'link',lwin7:'1017483'})).status).toBe(400);expect(row()).toEqual(before);
 });
 it('rejects a stale preview and cross-account access',async()=>{
  const {database,env,row,request}=setup(),{preview}=await previewWineReference(env,'owner','w1','1017483');
  expect((await request('reference-preview?lwin7=1017483',undefined,'member')).status).toBe(404);
  expect((await request('reference-review',{action:'link',lwin7:'1017483',previewToken:preview.previewToken},'member')).status).toBe(404);
  database.sql.exec("UPDATE wines SET wine_name='New name'");
  expect((await request('reference-review',{action:'link',lwin7:'1017483',previewToken:preview.previewToken})).status).toBe(409);
  expect(row()).toMatchObject({wine_name:'New name',lwin7:'1017425'});
 });
 it('clears an unprovable old vintage identifier',async()=>{
  const {env,row,request}=setup({vintageConfig:'nonSequential'}),{preview}=await previewWineReference(env,'owner','w1','1017483');
  expect(preview.lwin11).toBeNull();expect((await request('reference-review',{action:'link',lwin7:'1017483',previewToken:preview.previewToken})).status).toBe(200);expect(row().lwin11).toBeNull();
 });
 it('shows and links the live replacement of a combined code',async()=>{
  const {env,objects,product,targetShard,request,row}=setup({status:'Combined'});
  (objects['reference/lwin/current.json'] as Record<string,unknown>).redirectsKey='test/redirects.json';
  objects['test/redirects.json']={'1017483':{targetLwin7:'1017000',targetShard}};
  (objects[`test/shard-${targetShard}.json`] as LwinReferenceProduct[]).push({...product,lwin7:'1017000',productKey:'lwin:1017000',status:'Live',referenceLwin7:null});
  const {preview}=await previewWineReference(env,'owner','w1','1017483');expect(preview.lwin7).toBe('1017000');
  expect((await request('reference-review',{action:'link',lwin7:'1017483',previewToken:preview.previewToken})).status).toBe(200);expect(row().lwin7).toBe('1017000');
 });
});
