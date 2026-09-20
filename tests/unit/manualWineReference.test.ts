import { afterEach,describe,expect,it } from 'vitest';
import { realD1 } from './support/realD1';
import app from '../../worker/index';
import { createSession } from '../../src/lib/auth/session';
import { parseLwinReference,type LwinReferenceProduct } from '../../src/lib/wine/lwinImport';
import { referenceShardId } from '../../src/lib/wine/referenceCatalog';
import { previewWineReference } from '../../worker/manualWineReference';

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
 it('previews without writes and replaces the wrong identity without changing personal wine fields',async()=>{
  const {env,row,request}=setup(),before=row();
  const {preview}=await previewWineReference(env,'owner','w1','1017483');
  expect(row()).toEqual(before);expect(preview).toMatchObject({lwin7:'1017483',storedLwin7:'1017425',lwin11:'10174832018'});
  expect(preview.suggestions.map(item=>item.field)).toEqual(['producer']);
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
