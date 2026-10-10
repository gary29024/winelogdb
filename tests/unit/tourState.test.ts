import { afterEach,describe,expect,it } from 'vitest';
import { realD1 } from './support/realD1';
import { authRoute } from '../../worker/multiUser/auth';
import { hash,seconds } from '../../worker/multiUser/common';

const databases:Array<ReturnType<typeof realD1>>=[];
afterEach(()=>{for(const database of databases.splice(0))database.close()});

async function setup(){
 const database=realD1();databases.push(database);
 database.sql.prepare("INSERT INTO app_users(id,email,display_name,role) VALUES('alice','alice@example.com','Alice','member')").run();
 database.sql.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await hash('session'),'alice',seconds()+3600);
 return {database,env:{DB:database.db,AUTH_SECRET:'a'.repeat(48),APP_URL:'https://wine.example'}};
}
const save=(value:unknown)=>new Request('https://wine.example/api/me/tour',{method:'PATCH',headers:{Cookie:'__Host-winelog=session',Origin:'https://wine.example','Content-Type':'application/json'},body:JSON.stringify(value)});
const stored=(database:ReturnType<typeof realD1>)=>(database.sql.prepare("SELECT tour_state FROM app_users WHERE id='alice'").get() as {tour_state:string}).tour_state;

describe('onboarding progress',()=>{
 it('starts empty, so a new member is offered the tour',async()=>{
  const {database,env}=await setup();
  expect(stored(database)).toBe('{}');
  const me=await authRoute(new Request('https://wine.example/api/me',{headers:{Cookie:'__Host-winelog=session'}}),env);
  expect(await me!.json()).toMatchObject({user:{tour_state:'{}'}});
 });

 it('records a finished tour and hands it back on the next sign-in',async()=>{
  const {database,env}=await setup();
  const response=await authRoute(save({completed:['first-run'],skipped:false}),env);
  expect(response?.status).toBe(200);
  expect(JSON.parse(stored(database))).toEqual({completed:['first-run'],skipped:false});
  const me=await authRoute(new Request('https://wine.example/api/me',{headers:{Cookie:'__Host-winelog=session'}}),env);
  expect(await me!.json()).toMatchObject({user:{tour_state:'{"completed":["first-run"],"skipped":false}'}});
 });

 it('records a skip, which is what suppresses every tour',async()=>{
  const {database,env}=await setup();
  await authRoute(save({completed:[],skipped:true}),env);
  expect(JSON.parse(stored(database))).toEqual({completed:[],skipped:true});
 });

 /**
  * The column is read straight back out as part of /api/me, so whatever lands
  * here becomes part of every account payload for the life of the account.
  * Nothing is stored that the app could not have sent.
  */
 it('stores only step ids the app could have issued',async()=>{
  const {database,env}=await setup();
  await authRoute(save({completed:['first-run','../../etc/passwd','<script>',42,null,'A'.repeat(80),'first-run'],skipped:'yes'}),env);
  expect(JSON.parse(stored(database))).toEqual({completed:['first-run'],skipped:false});
 });

 it('caps the list rather than letting it grow without bound',async()=>{
  const {database,env}=await setup();
  await authRoute(save({completed:Array.from({length:200},(_,i)=>`step-${i}`)}),env);
  expect(JSON.parse(stored(database)).completed).toHaveLength(40);
 });

 it('ignores a body that is not the expected shape',async()=>{
  const {database,env}=await setup();
  await authRoute(save({completed:'first-run'}),env);
  expect(JSON.parse(stored(database))).toEqual({completed:[],skipped:false});
 });

 it('requires the same-origin mutation check',async()=>{
  const {env}=await setup();
  const request=save({completed:['first-run']});request.headers.set('Origin','https://attacker.example');
  await expect(authRoute(request,env)).rejects.toMatchObject({status:403});
 });

 it('requires a session',async()=>{
  const {env}=await setup();
  const request=new Request('https://wine.example/api/me/tour',{method:'PATCH',headers:{Origin:'https://wine.example','Content-Type':'application/json'},body:'{}'});
  await expect(authRoute(request,env)).rejects.toMatchObject({status:401});
 });
});
