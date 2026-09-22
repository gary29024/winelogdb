import { afterEach,describe,expect,it } from 'vitest';
import { realD1 } from './support/realD1';
import worker from '../../worker/multiUserEntry';
import { hash,seconds } from '../../worker/multiUser/common';

const databases:Array<ReturnType<typeof realD1>>=[];
afterEach(()=>{databases.splice(0).forEach(db=>db.close())});

async function setup(){
 const database=realD1();databases.push(database);
 for(const id of ['owner','alice','bob','carol'])
  database.sql.prepare('INSERT INTO app_users(id,email,display_name,role) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING')
   .run(id,`${id}@example.com`,id,id==='owner'?'owner':'member');
 for(const [id,account] of [['w1','owner'],['w2','owner'],['w3','alice']] as const)
  database.sql.prepare("INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at) VALUES(?,?,'Domaine Test','Test Cuvee','now','now')").run(id,account);
 database.sql.prepare('INSERT INTO auth_sessions VALUES(?,?,?)').run(await hash('owner-session'),'owner',seconds()+3600);
 const env={DB:database.db,AUTH_SECRET:'a'.repeat(48),APP_URL:'https://wine.example',WINE_IMAGES:{get:async()=>null},REFERENCE_DATA:{get:async()=>null},RESEARCH_QUEUE:{send:async()=>{}}} as unknown as Parameters<typeof worker.fetch>[1];
 const tasks:Promise<unknown>[]=[],ctx={waitUntil:(task:Promise<unknown>)=>tasks.push(task)} as unknown as ExecutionContext;
 const wine=async(id:string)=>{
  const response=await worker.fetch(new Request(`https://wine.example/api/wines/${id}`,{headers:{Cookie:'__Host-winelog=owner-session',Origin:env.APP_URL}}),env,ctx);
  await Promise.all(tasks.splice(0));
  return {status:response.status,body:await response.json() as Record<string,unknown>};
 };
 const share=(wineId:string,owner:string,recipient:string)=>
  database.sql.prepare('INSERT INTO wine_shares(wine_id,owner_id,recipient_id,created_at) VALUES(?,?,?,?)').run(wineId,owner,recipient,'2026-09-22T00:00:00Z');
 return {wine,share};
}

// The detail page colours the tag button from this number. It used to buy it
// with a second request per wine opened, which also meant the button had a
// window where it claimed a wine was unshared because a read had not landed.
describe('a wine detail carries how many friends it is tagged with',()=>{
 it('reports nothing shared on a wine nobody has been tagged on',async()=>{
  const {wine}=await setup();
  const {status,body}=await wine('w1');
  expect(status).toBe(200);
  expect(body.friendTagCount).toBe(0);
 });

 it('counts the recipients of that wine',async()=>{
  const {wine,share}=await setup();
  share('w1','owner','alice');share('w1','owner','bob');
  expect((await wine('w1')).body.friendTagCount).toBe(2);
 });

 // One number off the wrong rows would light the icon on a wine that is not
 // shared, which is the only thing the icon is there to say.
 it('does not count another wine, or another owner tagging the same friends',async()=>{
  const {wine,share}=await setup();
  share('w1','owner','alice');
  share('w2','owner','bob');share('w2','owner','carol');
  share('w3','alice','bob');
  expect((await wine('w1')).body.friendTagCount).toBe(1);
  expect((await wine('w2')).body.friendTagCount).toBe(2);
 });

 it('leaves a wine the caller does not own unreachable rather than counted',async()=>{
  const {wine,share}=await setup();
  share('w3','alice','bob');
  expect((await wine('w3')).status).toBe(404);
 });
});
