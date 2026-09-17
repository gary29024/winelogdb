import { describe,expect,it } from 'vitest';
import { realD1 } from './support/realD1';
import { producerRangeAllowed } from '../../src/lib/producers/rangeAccess';

const seed=(sql:ReturnType<typeof realD1>['sql'],id:string,role:string)=>
  sql.exec(`INSERT INTO app_users(id,email,display_name,role) VALUES('${id}','${id}@example.com','${id}','${role}') ON CONFLICT(id) DO UPDATE SET role=excluded.role`);

describe('who may research a producer wine range',()=>{
  it('allows the owner and refuses a member',async()=>{
    const {sql,db,close}=realD1();
    try{
      seed(sql,'owner','owner');seed(sql,'friend','member');
      expect(await producerRangeAllowed(db,'owner')).toBe(true);
      expect(await producerRangeAllowed(db,'friend')).toBe(false);
    }finally{close()}
  });

  // An account with no row is not a tenant that predates multi-user; it is an
  // account that should not be spending, so it is refused rather than allowed.
  it('refuses an account that has no row',async()=>{
    const {db,close}=realD1();
    try{expect(await producerRangeAllowed(db,'nobody')).toBe(false)}finally{close()}
  });

  // Before the multi-user migration there is exactly one tenant and it is the
  // owner, so the absence of the table must not disable the range.
  it('allows everything when the multi-user tables do not exist yet',async()=>{
    const db={prepare:()=>({bind:()=>({first:async()=>{throw new Error('D1_ERROR: no such table: app_users')}})})} as unknown as D1Database;
    expect(await producerRangeAllowed(db,'owner')).toBe(true);
  });
});
