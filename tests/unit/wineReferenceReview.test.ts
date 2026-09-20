import { afterEach,describe,expect,it } from 'vitest';
import { realD1 } from './support/realD1';
import { recheckWineReference } from '../../worker/wineReferenceReview';
import { rolloutRoute } from '../../worker/multiUser/rollout';
import { parseLwinReference } from '../../src/lib/wine/lwinImport';
import { lwinReferenceIdentity,referenceShardId } from '../../src/lib/wine/referenceCatalog';
import { createSession } from '../../src/lib/auth/session';
import app from '../../worker/index';

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
 return {database,env,bucket,insert,request,queue};
}

describe('LWIN review repair and queue',()=>{
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
