import { describe,expect,it } from 'vitest';
import { realD1 } from './support/realD1';
import { embeddingAllowed } from '../../src/lib/journal/semanticSearch';

const settings=(sql:ReturnType<typeof realD1>['sql'],cap:number|null)=>
  sql.prepare('INSERT INTO pilot_settings(id,value_json) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value_json=excluded.value_json')
    .run(JSON.stringify(cap===null?{}:{aiDailyEmbeddingRequests:cap}));
const seed=(sql:ReturnType<typeof realD1>['sql'],id:string,role:string)=>
  sql.exec(`INSERT INTO app_users(id,email,display_name,role) VALUES('${id}','${id}@e.com','${id}','${role}') ON CONFLICT(id) DO UPDATE SET role=excluded.role`);
const spend=(sql:ReturnType<typeof realD1>['sql'],owner:string,requests:number,at=new Date().toISOString())=>
  sql.prepare("INSERT INTO ai_usage_events(id,owner_id,kind,run_id,model,requests,created_at) VALUES(?,?,'search_embedding','run','m',?,?)")
    .run(crypto.randomUUID(),owner,requests,at);

describe('the daily embedding ceiling',()=>{
  it('stops a member at the configured cap',async()=>{
    const {sql,db,close}=realD1();
    try{
      seed(sql,'bob','member');settings(sql,10);
      const env={DB:db} as never;
      expect(await embeddingAllowed(env,'bob')).toBe(true);
      spend(sql,'bob',9);
      expect(await embeddingAllowed(env,'bob'),'still one left').toBe(true);
      spend(sql,'bob',1);
      expect(await embeddingAllowed(env,'bob'),'cap reached').toBe(false);
    }finally{close()}
  });

  // Embeddings are zero-credit, so this is the only ceiling they have. The owner
  // pays the provider directly and is not subject to it.
  it('never caps the owner',async()=>{
    const {sql,db,close}=realD1();
    try{
      seed(sql,'owner','owner');settings(sql,1);spend(sql,'owner',500);
      expect(await embeddingAllowed({DB:db} as never,'owner')).toBe(true);
    }finally{close()}
  });

  it('only counts the last day',async()=>{
    const {sql,db,close}=realD1();
    try{
      seed(sql,'bob','member');settings(sql,5);
      spend(sql,'bob',100,new Date(Date.now()-2*86400000).toISOString());
      expect(await embeddingAllowed({DB:db} as never,'bob'),'yesterday does not count against today').toBe(true);
    }finally{close()}
  });

  it('falls back to a default when the owner has not set one',async()=>{
    const {sql,db,close}=realD1();
    try{
      seed(sql,'bob','member');settings(sql,null);
      expect(await embeddingAllowed({DB:db} as never,'bob')).toBe(true);
      spend(sql,'bob',400);
      expect(await embeddingAllowed({DB:db} as never,'bob'),'the default is a real ceiling, not unlimited').toBe(false);
    }finally{close()}
  });

  // A deployment that predates the multi-user tables has one account and no cap.
  it('leaves a single-tenant deployment alone',async()=>{
    const db={prepare:()=>({bind:()=>({first:async()=>{throw new Error('D1_ERROR: no such table: app_users')}})})} as unknown as D1Database;
    expect(await embeddingAllowed({DB:db} as never,'owner')).toBe(true);
  });
});
