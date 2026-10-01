import { readFileSync } from 'node:fs';
import { afterEach,beforeEach,describe,expect,it } from 'vitest';
import { realD1 } from './support/realD1';
import { listJournalPage } from '../../src/lib/journal/list';

const core={summary:'S',producerDetails:'P',producerWinemakingPractices:'W',terroir:'T',winemakingTechniques:'M',drinkingWindow:'D'};
let database:ReturnType<typeof realD1>;
const insert=(id:string,owner:string,vintage:number|null,deep:unknown)=>database.sql.prepare(`INSERT INTO wines(id,owner_id,producer,wine_name,vintage,deep_search_json,created_at,updated_at)
 VALUES(?,?,'Domaine Test',?,?,?,'2026-01-01','2026-01-01')`).run(id,owner,id,vintage,deep==null?null:JSON.stringify(deep));
const ids=async(owner:string,research:string,shared=false)=>(await listJournalPage(database.db,owner,{research},[],shared)).items.map(item=>item.id).sort();

beforeEach(()=>{
 database=realD1();
 insert('complete-2019','alice',2019,{...core,vintageQuality:'Q'});
 insert('missing-vintage','alice',2020,core);             // vintage wine without its vintage section
 insert('partial-cache','alice',2018,{summary:'S',producerDetails:'P'}); // e.g. scopes borrowed from other wines
 insert('complete-nv','alice',null,core);
 insert('never','alice',2021,null);
 // The backfill in the migration, applied to rows that predate it.
 const migration=readFileSync('src/lib/db/migrations/0089_wine_research_complete.sql','utf8');
 database.sql.exec(migration.slice(migration.indexOf('UPDATE wines')));
});
afterEach(()=>database.close());

describe('journal Deep Search filter',()=>{
 it('counts only complete Deep Search as researched; partial and missing research are not researched',async()=>{
  expect(await ids('alice','complete')).toEqual(['complete-2019','complete-nv']);
  expect(await ids('alice','incomplete')).toEqual(['missing-vintage','never','partial-cache']);
  const page=await listJournalPage(database.db,'alice',{},[],false);
  expect(Object.fromEntries(page.items.map(item=>[item.id,item.researchComplete]))).toMatchObject({'complete-2019':true,'partial-cache':false,never:false});
 });
 it('gives a shared bottle its source wine\'s status',async()=>{
  database.sql.exec(`INSERT INTO app_users(id,email,display_name,role) VALUES('alice','a@example.com','Alice','member'),('bob','b@example.com','Bob','member');
   INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice');
   INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('complete-2019','alice','bob'),('partial-cache','alice','bob')`);
  expect(await ids('bob','complete',true)).toEqual(['complete-2019']);
  expect(await ids('bob','incomplete',true)).toEqual(['partial-cache']);
 });
});
