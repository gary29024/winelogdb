import { afterEach,beforeEach,describe,expect,it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { realD1 } from './support/realD1';
import { friendRequestRoute } from '../../worker/multiUser/friendRequests';
import { socialRoute } from '../../worker/multiUser/social';
import { buildResearchTargets,loadResearchCache } from '../../src/lib/research/cache';
import { publishResearch } from '../../src/lib/research/shared';
import type { Member } from '../../worker/multiUser/common';

let db:ReturnType<typeof realD1>;
const member=(id:string):Member=>({id,email:`${id}@example.com`,display_name:id,role:'member',status:'active'});
const env=()=>({DB:db.db,AUTH_SECRET:'test',APP_URL:'https://wine.example',WINE_IMAGES:{} as R2Bucket});
const call=(user:string,path:string,method='GET',data?:unknown)=>friendRequestRoute(new Request(`https://wine.example/api/friends/${path}`,{method,...data?{body:JSON.stringify(data),headers:{'Content-Type':'application/json'}}:{}}),env(),member(user));
const code=(user:string)=>String(db.sql.prepare('SELECT code FROM friend_codes WHERE user_id=?').get(user)!.code);
async function send(sender='alice',recipient='bob'){return await (await call(sender,'requests','POST',{code:code(recipient)}))!.json() as {id:string}}
const edges=()=>Number(db.sql.prepare('SELECT count(*) AS n FROM friendships').get()!.n);
beforeEach(()=>{db=realD1();for(const id of ['alice','bob','carol'])db.sql.prepare("INSERT INTO app_users(id,email,display_name,role) VALUES(?,?,?,'member')").run(id,`${id}@example.com`,id)});
afterEach(()=>db.close());

describe('permanent friend codes and requests',()=>{
 it('assigns unique stable codes at creation and backfills existing accounts',async()=>{
  expect(new Set(['alice','bob','carol'].map(code)).size).toBe(3);
  const first=await (await call('alice','code'))!.json();expect(first).toEqual(await (await call('alice','code'))!.json());expect(first).toMatchObject({code:expect.stringMatching(/^[A-F0-9]{4}(-[A-F0-9]{4}){2}$/)});
  const legacy=new DatabaseSync(':memory:');
  try{legacy.exec("CREATE TABLE app_users(id TEXT PRIMARY KEY); CREATE TABLE friend_links(token_hash TEXT); INSERT INTO app_users VALUES('owner'),('existing'); INSERT INTO friend_links VALUES('old-link')");legacy.exec(readFileSync('src/lib/db/migrations/0053_friend_codes.sql','utf8'));expect(legacy.prepare('SELECT count(*) AS n FROM friend_codes').get()!.n).toBe(2);expect(legacy.prepare('SELECT count(*) AS n FROM friend_links').get()!.n).toBe(0)}finally{legacy.close()}
 });
 it('keeps pending requests private and grants mutual research access only after recipient acceptance',async()=>{
  const target=buildResearchTargets({producer:'Domaine Test',country:'France'}).find(t=>t.scope==='producer')!;
  await publishResearch(db.db,'alice',{target,payload:{producerDetails:'A documented Burgundy producer.',producerWinemakingPractices:'Practices vary by vintage; the cellar uses traditional barrels.'},sources:[{title:'Producer',url:'https://example.com/producer'}],model:'test',researchedAt:new Date().toISOString()});
  const {id}=await send();expect(edges()).toBe(0);expect((await loadResearchCache(db.db,'bob',[target],true)).size).toBe(0);
  expect(await (await call('bob','requests'))!.json()).toEqual({incoming:[{id,display_name:'alice'}],outgoing:[]});
  expect(await (await call('carol','requests'))!.json()).toEqual({incoming:[],outgoing:[]});
  await expect(call('alice',`requests/${id}/accept`,'POST',{})).rejects.toMatchObject({status:403});
  await expect(call('carol',`requests/${id}/accept`,'POST',{})).rejects.toMatchObject({status:404});
  await call('bob',`requests/${id}/accept`,'POST',{});expect(edges()).toBe(2);expect((await loadResearchCache(db.db,'bob',[target],true)).size).toBe(1);
  expect(db.sql.prepare('SELECT count(*) AS n FROM wine_shares').get()!.n).toBe(0);
 });
 it('normalizes pasted codes and rejects self, unknown, and already-connected accounts',async()=>{
  const formatted=code('bob').toLowerCase().match(/.{4}/g)!.join('-');const response=await call('alice','requests','POST',{code:` ${formatted} `});expect(response!.status).toBe(201);
  await expect(call('alice','requests','POST',{code:code('alice')})).rejects.toMatchObject({status:400});
  await expect(call('alice','requests','POST',{code:'missing'})).rejects.toMatchObject({status:400});
  await expect(call('alice','requests','POST',{code:'000000000000'})).rejects.toMatchObject({status:404});
  const {id}=await response!.json() as {id:string};await call('bob',`requests/${id}/accept`,'POST',{});
  await expect(send()).rejects.toMatchObject({status:409});
 });
 it('does not turn duplicate or reciprocal requests into automatic friendship',async()=>{
  const first=await send();expect(await send()).toEqual({...first,status:'pending'});
  await expect(send('bob','alice')).rejects.toMatchObject({status:409});expect(edges()).toBe(0);
  expect(db.sql.prepare('SELECT count(*) AS n FROM friend_requests').get()!.n).toBe(1);
 });
 it('supports declining and cancelling, and prevents acceptance of withdrawn requests',async()=>{
  const first=await send();await call('bob',`requests/${first.id}`,'DELETE');await expect(call('bob',`requests/${first.id}/accept`,'POST',{})).rejects.toMatchObject({status:409});
  const second=await send();await expect(call('carol',`requests/${second.id}`,'DELETE')).rejects.toMatchObject({status:404});await call('alice',`requests/${second.id}`,'DELETE');await expect(call('bob',`requests/${second.id}/accept`,'POST',{})).rejects.toMatchObject({status:409});expect(edges()).toBe(0);
 });
 it('handles concurrent sends and accepts atomically; replay cannot undo unfriend',async()=>{
  const sends=await Promise.allSettled([send(),send('bob','alice')]);expect(sends.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(edges()).toBe(0);
  const row=db.sql.prepare('SELECT id,recipient_id FROM friend_requests').get()!;
  await Promise.allSettled([call(String(row.recipient_id),`requests/${row.id}/accept`,'POST',{}),call(String(row.recipient_id),`requests/${row.id}/accept`,'POST',{})]);expect(edges()).toBe(2);
  await socialRoute(new Request('https://wine.example/api/friends/bob',{method:'DELETE'}),env(),member('alice'));
  await call(String(row.recipient_id),`requests/${row.id}/accept`,'POST',{});expect(edges()).toBe(0);
 });
 it('rejects suspended members and retires the link-based acceptance path',async()=>{
  const {id}=await send();db.sql.exec("UPDATE app_users SET status='suspended' WHERE id='alice'");
  await expect(call('bob',`requests/${id}/accept`,'POST',{})).rejects.toMatchObject({status:409});
  await expect(send('carol','alice')).rejects.toMatchObject({status:404});expect(edges()).toBe(0);
  expect((await call('bob','links','POST',{}))!.status).toBe(410);expect((await call('bob','accept','POST',{token:'old-link'}))!.status).toBe(410);
 });
});
