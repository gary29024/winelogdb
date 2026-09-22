import { afterEach,describe,expect,it,vi } from 'vitest';
import { realD1 } from './support/realD1';
import worker from '../../worker/multiUserEntry';
import { ApiError,hash,seconds } from '../../worker/multiUser/common';

const databases:Array<ReturnType<typeof realD1>>=[];
afterEach(()=>{databases.splice(0).forEach(db=>db.close());vi.restoreAllMocks()});
async function setup(){
 const database=realD1();databases.push(database);
 database.sql.exec("INSERT INTO wines(id,owner_id,producer,wine_name,lwin7,identity_match_status,created_at,updated_at) VALUES('w1','owner','Domaine Jean François','Sanford & Benedict The Twelve Rows Chardonnay','2232788','conflict','now','now')");
 database.sql.prepare('INSERT INTO auth_sessions VALUES(?,?,?)').run(await hash('owner-session'),'owner',seconds()+3600);
 const env={DB:database.db,AUTH_SECRET:'a'.repeat(48),APP_URL:'https://wine.example',WINE_IMAGES:{get:async()=>null},REFERENCE_DATA:{get:async()=>null},RESEARCH_QUEUE:{send:async()=>{}}} as unknown as Parameters<typeof worker.fetch>[1];
 const tasks:Promise<unknown>[]=[],ctx={waitUntil:(task:Promise<unknown>)=>tasks.push(task)} as unknown as ExecutionContext;
 async function request(path:string,body?:unknown,cookie='owner-session'){
  const response=await worker.fetch(new Request(`https://wine.example${path}`,{method:body?'POST':'GET',headers:{Cookie:`__Host-winelog=${cookie}`,Origin:env.APP_URL,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env,ctx);
  await Promise.all(tasks.splice(0));return response;
 }
 const confirm=()=>request('/api/wines/w1/reference-review',{action:'confirm',lwin7:'2232788',updatedAt:'now'});
 const row=()=>database.sql.prepare('SELECT identity_match_status,updated_at FROM wines WHERE id=?').get('w1');
 return {database,request,confirm,row};
}
describe('LWIN confirmation session boundary',()=>{
 it.each([new Error('D1 write failed'),new ApiError(503,'Please retry confirmation')])('keeps a valid session when confirmation fails: %s',async failure=>{
  const {database,request,confirm,row}=await setup(),before=row(),prepare=database.db.prepare.bind(database.db);
  vi.spyOn(console,'error').mockImplementation(()=>{});
  const fault=vi.spyOn(database.db,'prepare').mockImplementation(query=>{
   if(query.startsWith("UPDATE wines SET identity_match_status='manual'"))throw failure;
   return prepare(query);
  });
  const response=await confirm();expect(response.status).toBe(failure instanceof ApiError?503:500);
  expect(await response.json()).toEqual({error:failure instanceof ApiError?failure.message:'Request could not be completed'});
  expect(row()).toEqual(before);fault.mockRestore();
  expect((await request('/api/me')).status).toBe(200);
  expect((await confirm()).status).toBe(200);expect(row()).toMatchObject({identity_match_status:'manual'});
  expect((await confirm()).status).toBe(409);
 });
 it('keeps confirmation saved when the following wine reload fails',async()=>{
  const {database,request,confirm,row}=await setup(),prepare=database.db.prepare.bind(database.db);
  expect((await confirm()).status).toBe(200);
  vi.spyOn(console,'error').mockImplementation(()=>{});
  const fault=vi.spyOn(database.db,'prepare').mockImplementation(query=>{
   if(query.includes('SELECT w.*'))throw new Error('D1 read failed');
   return prepare(query);
  });
  expect((await request('/api/wines/w1')).status).toBe(500);
  expect(row()).toMatchObject({identity_match_status:'manual'});fault.mockRestore();
  expect((await request('/api/wines/w1')).status).toBe(200);
  expect((await request('/api/me')).status).toBe(200);
 });
 it('still rejects expired sessions without confirming the wine',async()=>{
  const {database,request,row}=await setup(),before=row();database.sql.exec('UPDATE auth_sessions SET expires_at=0');
  const response=await request('/api/wines/w1/reference-review',{action:'confirm',lwin7:'2232788',updatedAt:'now'});
  expect(response.status).toBe(401);expect(row()).toEqual(before);
 });
});
