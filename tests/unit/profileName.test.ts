import { afterEach,describe,expect,it } from 'vitest';
import { realD1 } from './support/realD1';
import { authRoute } from '../../worker/multiUser/auth';
import { hash,seconds } from '../../worker/multiUser/common';

const databases:Array<ReturnType<typeof realD1>>=[];
afterEach(()=>{for(const database of databases.splice(0))database.close()});

async function setup(){
 const database=realD1();databases.push(database);
 database.sql.prepare("INSERT INTO app_users(id,email,display_name,role) VALUES('alice','alice@example.com','Alice Google','member')").run();
 database.sql.prepare("INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").run(await hash('session'),'alice',seconds()+3600);
 return {database,env:{DB:database.db,AUTH_SECRET:'a'.repeat(48),APP_URL:'https://wine.example'}};
}
function rename(displayName:unknown){
 return new Request('https://wine.example/api/me',{method:'PATCH',headers:{Cookie:'__Host-winelog=session',Origin:'https://wine.example','Content-Type':'application/json'},body:JSON.stringify({displayName})});
}

describe('custom display name',()=>{
 it('lets a signed-in member change the name other members see',async()=>{
  const {database,env}=await setup();
  const response=await authRoute(rename('  Alice   Wine  '),env);
  expect(response?.status).toBe(200);
  expect(await response!.json()).toMatchObject({user:{id:'alice',display_name:'Alice Wine'}});
  expect(database.sql.prepare("SELECT display_name FROM app_users WHERE id='alice'").get()).toMatchObject({display_name:'Alice Wine'});
  const current=await authRoute(new Request('https://wine.example/api/me',{headers:{Cookie:'__Host-winelog=session'}}),env);
  expect(await current!.json()).toMatchObject({user:{display_name:'Alice Wine'}});
 });

 it('supports Unicode names and rejects blank or overlong names',async()=>{
  const {env}=await setup();
  expect((await authRoute(rename('陳小明'),env))?.status).toBe(200);
  await expect(authRoute(rename('   '),env)).rejects.toMatchObject({status:400});
  await expect(authRoute(rename('x'.repeat(61)),env)).rejects.toMatchObject({status:400});
 });

 it('requires the same-origin mutation check',async()=>{
  const {env}=await setup();
  const request=rename('Alice Wine');request.headers.set('Origin','https://attacker.example');
  await expect(authRoute(request,env)).rejects.toMatchObject({status:403});
 });
});
