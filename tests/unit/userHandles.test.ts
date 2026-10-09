import { afterEach,beforeEach,describe,expect,it } from 'vitest';
import { realD1 } from './support/realD1';
import { authenticate,authRoute } from '../../worker/multiUser/auth';
import { friendRequestRoute } from '../../worker/multiUser/friendRequests';
import { socialRoute } from '../../worker/multiUser/social';
import { backfillHandles,handleProblem,suggestHandle } from '../../worker/multiUser/handles';
import { hash,seconds,type Member } from '../../worker/multiUser/common';

let db:ReturnType<typeof realD1>;
const env=()=>({DB:db.db,AUTH_SECRET:'a'.repeat(48),APP_URL:'https://wine.example',WINE_IMAGES:{} as R2Bucket});
const handleOf=(id:string)=>db.sql.prepare('SELECT handle FROM app_users WHERE id=?').get(id)!.handle as string|null;
const asMember=(id:string):Member=>{const row=db.sql.prepare('SELECT * FROM app_users WHERE id=?').get(id) as Member;return {...row}};
async function signIn(id:string){db.sql.prepare('INSERT OR IGNORE INTO auth_sessions VALUES(?,?,?)').run(await hash(`session-${id}`),id,seconds()+3600);return {Cookie:`__Host-winelog=session-${id}`}}
// The routes throw ApiError for refusals; the worker entry turns those into responses.
const status=(work:Promise<Response|null>)=>work.then(response=>response!.status,(error:{status:number})=>error.status);
async function patchMe(id:string,data:unknown){
 return authRoute(new Request('https://wine.example/api/me',{method:'PATCH',headers:{...await signIn(id),Origin:'https://wine.example','Content-Type':'application/json'},body:JSON.stringify(data)}),env());
}
const request=(sender:string,code:string)=>friendRequestRoute(new Request('https://wine.example/api/friends/requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})}),env(),asMember(sender));
beforeEach(()=>{
 db=realD1();
 for(const [id,name] of [['alice','Alice Martin'],['tom1','Tom Hart'],['tom2','Tom Hart'],['zoe','Zoë'],['al','Al']])db.sql.prepare("INSERT INTO app_users(id,email,display_name,role) VALUES(?,?,?,'member')").run(id,`${id}@example.com`,name);
});
afterEach(()=>db.close());

describe('user handles',()=>{
 it('derives a starting handle from the name and checks the format',()=>{
  expect(suggestHandle('Mei Lin')).toBe('meilin');
  expect(suggestHandle('Zoë')).toBe('zoe');
  expect(suggestHandle('Al')).toBe('memberal');
  expect(handleProblem('gary')).toBeNull();
  expect(handleProblem('priya.wine')).toBeNull();
  expect(handleProblem('ab')).toMatch(/3 to 20/);
  expect(handleProblem('.gary')).toMatch(/starting and ending/);
  expect(handleProblem('ga..ry')).toMatch(/next to each other/);
  expect(handleProblem('admin')).toMatch(/reserved/);
 });

 it('gives every existing account a unique handle, numbering repeated names',async()=>{
  await backfillHandles(db.db);
  expect(handleOf('alice')).toBe('alicemartin');
  expect(handleOf('zoe')).toBe('zoe');
  expect(new Set([handleOf('tom1'),handleOf('tom2')])).toEqual(new Set(['tomhart','tomhart2']));
  const all=db.sql.prepare('SELECT handle FROM app_users').all().map(row=>row.handle);
  expect(all.every(Boolean)).toBe(true);expect(new Set(all).size).toBe(all.length);
 });

 it('fills in handles the first time an account is seen',async()=>{
  const user=await authenticate(new Request('https://wine.example/api/me',{headers:await signIn('alice')}),env());
  expect(user.handle).toBe('alicemartin');
  expect(handleOf('tom1')).not.toBeNull();
 });

 it('lets people change their handle whenever they like, but never to a taken one',async()=>{
  await backfillHandles(db.db);
  expect(await status(patchMe('alice',{handle:'@AliceWine'}))).toBe(200);
  expect(handleOf('alice')).toBe('alicewine');
  expect(await status(patchMe('zoe',{handle:'alicewine'}))).toBe(409);
  expect(handleOf('zoe')).toBe('zoe');
  expect(await status(patchMe('zoe',{handle:'no'}))).toBe(400);
  expect(await status(patchMe('alice',{handle:'alice.m'}))).toBe(200);
  // The old handle is free again for someone else.
  expect(await status(patchMe('zoe',{handle:'alicewine'}))).toBe(200);
  const check=await authRoute(new Request('https://wine.example/api/me/handle-check?handle=alice.m',{headers:await signIn('tom1')}),env());
  expect(await check!.json()).toMatchObject({available:false,problem:'That user ID is taken'});
 });

 it('sends a friend request to a handle as well as a friend code',async()=>{
  await backfillHandles(db.db);
  expect(await status(request('alice','@zoe'))).toBe(201);
  expect(await status(request('tom1','zoe'))).toBe(201);
  expect(await status(request('alice','@nobody'))).toBe(404);
  expect(await status(request('alice','@alicemartin'))).toBe(400);
  const listed=await (await friendRequestRoute(new Request('https://wine.example/api/friends/requests'),env(),asMember('zoe')))!.json() as {incoming:Array<{display_name:string;handle:string}>};
  expect(listed.incoming.map(item=>item.handle).sort()).toEqual(['alicemartin','tomhart']);
 });

 it('keeps friendships and shared wines linked after a handle change',async()=>{
  await backfillHandles(db.db);
  db.sql.exec(`INSERT INTO friendships(user_id,friend_id) VALUES('alice','zoe'),('zoe','alice');
   INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at) VALUES('w1','alice','Domaine Test','Cuvée','now','now');
   INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('w1','alice','zoe');`);
  const before=await (await socialRoute(new Request('https://wine.example/api/shared/wines'),env(),asMember('zoe')))!.json() as {items:Array<{id:string;ownerHandle:string}>};
  expect(before.items.map(item=>[item.id,item.ownerHandle])).toEqual([['w1','alicemartin']]);
  expect(await status(patchMe('alice',{handle:'alice.new',displayName:'Alice M.'}))).toBe(200);
  const after=await (await socialRoute(new Request('https://wine.example/api/shared/wines'),env(),asMember('zoe')))!.json() as {items:Array<{id:string;ownerName:string;ownerHandle:string}>};
  expect(after.items.map(item=>[item.id,item.ownerName,item.ownerHandle])).toEqual([['w1','Alice M.','alice.new']]);
  const friends=await (await socialRoute(new Request('https://wine.example/api/friends'),env(),asMember('zoe')))!.json() as {items:Array<{id:string;handle:string}>};
  expect(friends.items).toEqual([expect.objectContaining({id:'alice',handle:'alice.new'})]);
 });
});
