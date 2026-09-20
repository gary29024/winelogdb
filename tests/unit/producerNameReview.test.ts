import { afterEach,describe,expect,it } from 'vitest';
import { realD1 } from './support/realD1';
import { applyProducerNameReview,previewProducerNameReview } from '../../worker/producerNameReview';
import { ensureProducerEntity } from '../../src/lib/producers/entities';
import { ensureWineIdentity } from '../../src/lib/wine/identity';

const databases:Array<ReturnType<typeof realD1>>=[];
afterEach(()=>databases.splice(0).forEach(database=>database.close()));
async function setup(count=3){
 const database=realD1();databases.push(database);const {db,sql}=database;
 const oldName='de la Vougeraie',newName='Domaine de la Vougeraie';
 const producer=await ensureProducerEntity(db,'owner',oldName);
 sql.prepare("UPDATE producers SET profile='Saved research',researched_at='before' WHERE id=?").run(producer.id);
 for(let i=0;i<count;i++){
  sql.prepare("INSERT INTO wines(id,owner_id,producer,producer_id,recognized_producer,wine_name,vintage,lwin7,identity_match_status,reference_suggestions_json,tasting_notes,created_at,updated_at) VALUES(?,'owner',?,?,?,'Pinot Noir',2020,'1059328','matched',?,'Personal notes','before','before')")
   .run(`w${i}`,oldName,producer.id,oldName,JSON.stringify([{field:'producer',label:'Producer',current:oldName,suggested:newName}]));
  await ensureWineIdentity(db,'owner',`w${i}`);
 }
 const snapshot=()=>({wines:sql.prepare('SELECT * FROM wines ORDER BY id').all(),producers:sql.prepare('SELECT * FROM producers ORDER BY id').all(),aliases:sql.prepare('SELECT * FROM producer_aliases ORDER BY normalized_alias').all(),pool:sql.prepare('SELECT * FROM producer_alias_pool ORDER BY normalized_alias').all()});
 return {db,sql,producer,oldName,newName,snapshot};
}
describe('producer-wide name review',()=>{
 it('previews all linked wines without writes, applies once, and maps both names to the same identity',async()=>{
  const {db,sql,producer,oldName,newName,snapshot}=await setup(45),before=snapshot();
  const {preview}=await previewProducerNameReview(db,'owner','w0');
  expect(preview).toMatchObject({wineCount:45,currentName:oldName,name:newName,conflictProducerId:null});expect(snapshot()).toEqual(before);
  expect(await applyProducerNameReview(db,'owner','w0',preview.previewToken)).toMatchObject({updated:45});
  const after=snapshot();expect(after.wines).toHaveLength(45);
  for(const wine of after.wines){
   const previous=before.wines.find(item=>item.id===wine.id)!;
   expect(wine).toMatchObject({...previous,producer:newName,reference_suggestions_json:null,updated_at:expect.any(String)});
  }
  expect(sql.prepare('SELECT canonical_name,profile,researched_at FROM producers WHERE id=?').get(producer.id)).toEqual({canonical_name:newName,profile:'Saved research',researched_at:'before'});
  expect((await ensureProducerEntity(db,'owner',oldName)).id).toBe(producer.id);expect((await ensureProducerEntity(db,'owner',newName)).id).toBe(producer.id);
  expect(sql.prepare('SELECT count(*) AS n FROM producers').get()!.n).toBe(1);
 });
 it('keeps other differences and real identity conflicts, while refreshing a different producer suggestion snapshot',async()=>{
  const {db,sql,newName}=await setup();
  const other={field:'wineName',label:'Wine name',current:'Pinot Noir',suggested:'Terres de Famille Pinot Noir'};
  sql.prepare("UPDATE wines SET identity_match_status='conflict',reference_suggestions_json=? WHERE id='w1'").run(JSON.stringify([other,{field:'producer',label:'Producer',current:'de la Vougeraie',suggested:'Another house'}]));
  sql.prepare("UPDATE wines SET reference_suggestions_json=NULL WHERE id='w2'").run();
  const {preview}=await previewProducerNameReview(db,'owner','w0');await applyProducerNameReview(db,'owner','w0',preview.previewToken);
  const row=sql.prepare("SELECT identity_match_status,reference_suggestions_json FROM wines WHERE id='w1'").get()!;
  expect(row.identity_match_status).toBe('conflict');expect(JSON.parse(String(row.reference_suggestions_json))).toEqual([other,{field:'producer',label:'Producer',current:newName,suggested:'Another house'}]);
  expect(sql.prepare("SELECT reference_suggestions_json FROM wines WHERE id='w2'").get()!.reference_suggestions_json).toBeNull();
 });
 it('does not touch another producer or account, and denies cross-account previews and writes',async()=>{
  const {db,sql,snapshot}=await setup();
  sql.exec("INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at) VALUES('unrelated','owner','de la Vougeraie','Other','before','before'),('private','member','de la Vougeraie','Private','before','before')");
  const before=snapshot().wines.filter(wine=>wine.id==='unrelated'||wine.id==='private');
  const {preview}=await previewProducerNameReview(db,'owner','w0');expect(preview.wineCount).toBe(3);
  await expect(previewProducerNameReview(db,'member','w0')).rejects.toMatchObject({status:404});
  await expect(applyProducerNameReview(db,'member','w0',preview.previewToken)).rejects.toMatchObject({status:404});
  await applyProducerNameReview(db,'owner','w0',preview.previewToken);expect(snapshot().wines.filter(wine=>wine.id==='unrelated'||wine.id==='private')).toEqual(before);
 });
 it('shows an existing producer collision and refuses to steal its alias or merge it silently',async()=>{
  const {db,newName,snapshot}=await setup(),other=await ensureProducerEntity(db,'owner',newName),before=snapshot();
  const {preview}=await previewProducerNameReview(db,'owner','w0');expect(preview.conflictProducerId).toBe(other.id);
  await expect(applyProducerNameReview(db,'owner','w0',preview.previewToken)).rejects.toMatchObject({status:409});expect(snapshot()).toEqual(before);
 });
 it('requires a preview and rejects a stale group without changing anything else',async()=>{
  const {db,sql,snapshot}=await setup(),{preview}=await previewProducerNameReview(db,'owner','w0');
  await expect(applyProducerNameReview(db,'owner','w0',null)).rejects.toMatchObject({status:400});
  sql.exec("UPDATE wines SET producer='Edited name' WHERE id='w1'");const before=snapshot();
  await expect(applyProducerNameReview(db,'owner','w0',preview.previewToken)).rejects.toMatchObject({status:409});expect(snapshot()).toEqual(before);
 });
 it('rejects a membership race inside the transaction before making changes',async()=>{
  const {db,sql,producer,snapshot}=await setup(),{preview}=await previewProducerNameReview(db,'owner','w0');
  const raced={prepare:db.prepare,batch:async(statements:D1PreparedStatement[])=>{
   sql.prepare("INSERT INTO wines(id,owner_id,producer,producer_id,wine_name,created_at,updated_at) VALUES('new','owner','de la Vougeraie',?,'New','before','before')").run(producer.id);
   return db.batch(statements);
  }} as D1Database;
  const before=snapshot();await expect(applyProducerNameReview(raced,'owner','w0',preview.previewToken)).rejects.toMatchObject({status:409});
  expect(snapshot().producers).toEqual(before.producers);expect(snapshot().aliases).toEqual(before.aliases);expect(snapshot().wines.filter(wine=>wine.id!=='new')).toEqual(before.wines);
 });
 it('rolls names and aliases back together if the final write fails',async()=>{
  const {db,snapshot}=await setup(),{preview}=await previewProducerNameReview(db,'owner','w0'),before=snapshot();
  const failed={prepare:db.prepare,batch:(statements:D1PreparedStatement[])=>db.batch([...statements,db.prepare("SELECT json('forced failure')")])} as D1Database;
  await expect(applyProducerNameReview(failed,'owner','w0',preview.previewToken)).rejects.toBeDefined();expect(snapshot()).toEqual(before);
 });
});
