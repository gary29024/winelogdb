import type { DatabaseSync } from 'node:sqlite';
import { afterEach,beforeEach,describe,expect,it } from 'vitest';
import { addManualCatalogEntry,deleteManualCatalogEntry,ignoreMissingCandidate,listCatalogRangeCorrections,saveResearchedCatalog,syncMissingCandidates } from '../../src/lib/producers/catalogRangeOverlay';
import { migratedSqliteD1 } from './support/sqliteD1';

let sqlite:DatabaseSync,db:D1Database;
const visible=()=>JSON.parse(String(sqlite.prepare("SELECT catalog_json FROM producers WHERE owner_id='owner' AND id='p1'").get()!.catalog_json)) as Array<{name:string}>;

beforeEach(()=>{
 ({sqlite,db}=migratedSqliteD1());
 sqlite.exec(`INSERT INTO producers(id,owner_id,canonical_name,match_key,profile,catalog_json,catalog_researched_json,created_at,updated_at)
   VALUES('p1','owner','Domaine Test','domaine test','Profile','[{"name":"Clos A","category":"red"}]','[{"name":"Clos A","category":"red"}]','2026-01-01','2026-01-01');
   INSERT INTO producer_aliases(owner_id,normalized_alias,producer_id,display_alias,created_at) VALUES('owner','domaine test','p1','Domaine Test','2026-01-01');`);
});
afterEach(()=>sqlite.close());

describe('durable producer range corrections',()=>{
 it('keeps a user-added missing wine across a researched-base replacement',async()=>{
  const manual=await addManualCatalogEntry(db,'owner','p1',{name:'Clos B',category:'red',appellation:'Bourgogne'});
  expect(visible().map(x=>x.name)).toEqual(['Clos B','Clos A']);
  await saveResearchedCatalog(db,'owner','p1',[{name:'Clos C',category:'white'}],[{title:'Official range',url:'https://domaine.example/wines'}],'test-model');
  expect(new Set(visible().map(x=>x.name))).toEqual(new Set(['Clos B','Clos C']));
  await deleteManualCatalogEntry(db,'owner','p1',manual.id);
  expect(visible().map(x=>x.name)).toEqual(['Clos C']);
 });

 it('deduplicates a manual entry against the researched identity',async()=>{
  await addManualCatalogEntry(db,'owner','p1',{name:'Clos A',category:'red'});
  expect(visible().filter(x=>x.name==='Clos A')).toHaveLength(1);
 });

 it('turns partial direct evidence into dismissible missing-wine suggestions',async()=>{
  expect(await syncMissingCandidates(db,'owner','p1',[{name:'Clos A',category:'red'},{name:'Clos Missing',category:'white',sourceUrl:'https://domaine.example/wines'}])).toBe(1);
  let corrections=await listCatalogRangeCorrections(db,'owner','p1');expect(corrections.missingCandidates.map(x=>x.name)).toEqual(['Clos Missing']);
  await ignoreMissingCandidate(db,'owner','p1',corrections.missingCandidates[0].id);
  corrections=await listCatalogRangeCorrections(db,'owner','p1');expect(corrections.missingCandidates).toHaveLength(0);
 });

 it('batches a large set of missing-wine suggestions into one D1 round trip',async()=>{
  const original=db.batch.bind(db);let batches=0;
  db.batch=(async statements=>{batches++;return original(statements)}) as D1Database['batch'];
  const found=Array.from({length:40},(_,index)=>({name:`Possible ${index+1}`,category:'red'}));
  expect(await syncMissingCandidates(db,'owner','p1',found)).toBe(40);
  expect(batches).toBe(1);
  expect(Number(sqlite.prepare("SELECT count(*) AS count FROM producer_catalog_missing_candidates WHERE owner_id='owner' AND producer_id='p1'").get()!.count)).toBe(40);
 });

 it('stops suggesting a wine once later research confirms it',async()=>{
  await syncMissingCandidates(db,'owner','p1',[{name:'Clos Missing',category:'white',sourceUrl:'https://domaine.example/wines'}]);
  expect((await listCatalogRangeCorrections(db,'owner','p1')).missingCandidates.map(x=>x.name)).toEqual(['Clos Missing']);
  await saveResearchedCatalog(db,'owner','p1',[{name:'Clos A',category:'red'},{name:'Clos Missing',category:'white'}],[{title:'Official range',url:'https://domaine.example/wines'}],'test-model');
  expect((await listCatalogRangeCorrections(db,'owner','p1')).missingCandidates).toHaveLength(0);
 });

 it('cascades manual additions and missing suggestions when their producer is deleted',async()=>{
  await addManualCatalogEntry(db,'owner','p1',{name:'Clos Manual',category:'red'});
  await syncMissingCandidates(db,'owner','p1',[{name:'Clos Suggested',category:'white'}]);
  expect(Number(sqlite.prepare("SELECT count(*) AS count FROM producer_catalog_manual_entries WHERE producer_id='p1'").get()!.count)).toBe(1);
  expect(Number(sqlite.prepare("SELECT count(*) AS count FROM producer_catalog_missing_candidates WHERE producer_id='p1'").get()!.count)).toBe(1);
  sqlite.prepare("DELETE FROM producers WHERE owner_id='owner' AND id='p1'").run();
  expect(Number(sqlite.prepare("SELECT count(*) AS count FROM producer_catalog_manual_entries WHERE producer_id='p1'").get()!.count)).toBe(0);
  expect(Number(sqlite.prepare("SELECT count(*) AS count FROM producer_catalog_missing_candidates WHERE producer_id='p1'").get()!.count)).toBe(0);
 });
});
