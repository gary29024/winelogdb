import { describe,expect,it } from 'vitest';
import { realD1 } from './support/realD1';
import { bindGoogleAccount } from '../../worker/multiUser/auth';

const base=(db:D1Database)=>({DB:db,AUTH_SECRET:'a'.repeat(48),APP_URL:'https://wine.example'});
const claims=(sub:string,email:string)=>({sub,email,name:'Owner'});

describe('claiming the owner account',()=>{
  // The migration seeds the owner row because the existing journal already
  // belongs to it, so a claim fills in an identity rather than creating one.
  it('is seeded by the migration with a usable, bounded settings row',()=>{
    const {sql,close}=realD1();
    try{
      expect(sql.prepare("SELECT role FROM app_users WHERE id='owner'").get()!.role).toBe('owner');
      const settings=JSON.parse(String(sql.prepare('SELECT value_json FROM pilot_settings WHERE id=1').get()!.value_json)) as {
        allowOverages:boolean;cloudflareObservedUsd:number;cloudflareWarningUsd:number;cloudflareStopUsd:number;researchRunsPerWeek:number
      };
      // The owner must be able to continue the existing AI workflow after cutover,
      // including once a small real Cloudflare cost has been recorded. Safety is
      // provided by the explicit finite hard stop; pilot member AI is sponsored
      // through zero internal tariffs and bounded research allowances.
      expect(settings.allowOverages,'small recorded cost must not lock out the owner').toBe(true);
      expect(settings.cloudflareObservedUsd,'fresh deployment starts with no recorded Cloudflare spend').toBe(0);
      expect(settings.cloudflareWarningUsd).toBeGreaterThan(0);
      expect(settings.cloudflareStopUsd).toBeGreaterThan(settings.cloudflareWarningUsd);
      expect(settings.researchRunsPerWeek).toBe(2);
      const tariffs=sql.prepare('SELECT count(*) AS n,max(credits) AS maxCredits FROM credit_prices').get() as {n:number;maxCredits:number};
      expect(tariffs.n,'pilot actions have explicit internal tariffs for quote/audit machinery').toBeGreaterThan(0);
      expect(tariffs.maxCredits,'pilot member tariffs never charge WineLog credits').toBe(0);
    }finally{close()}
  });

  // OWNER_GOOGLE_SUB cannot be read anywhere until you have signed in once,
  // which you cannot do until it is set. OWNER_EMAIL is the way out of that.
  it('accepts a verified email when no subject is configured',async()=>{
    const {sql,db,close}=realD1();
    try{
      const user=await bindGoogleAccount({...base(db),OWNER_EMAIL:'Me@Example.com'},claims('sub-1','me@example.com'),null);
      expect(user.id).toBe('owner');
      expect(sql.prepare("SELECT email FROM app_users WHERE id='owner'").get()!.email).toBe('me@example.com');
    }finally{close()}
  });

  // One-time: once an identity is bound, the address is no longer a way in.
  it('stops honouring the email once the owner has an identity',async()=>{
    const {db,close}=realD1();
    try{
      await bindGoogleAccount({...base(db),OWNER_EMAIL:'me@example.com'},claims('sub-1','me@example.com'),null);
      await expect(bindGoogleAccount({...base(db),OWNER_EMAIL:'me@example.com'},claims('sub-2','me@example.com'),null))
        .rejects.toMatchObject({status:403});
    }finally{close()}
  });

  it('ignores the email entirely when a subject is configured',async()=>{
    const {db,close}=realD1();
    try{
      const env={...base(db),OWNER_GOOGLE_SUB:'exact-sub',OWNER_EMAIL:'me@example.com'};
      await expect(bindGoogleAccount(env,claims('sub-1','me@example.com'),null)).rejects.toMatchObject({status:403});
      expect((await bindGoogleAccount(env,claims('exact-sub','me@example.com'),null)).id).toBe('owner');
    }finally{close()}
  });

  it('never lets a stranger claim it',async()=>{
    const {db,close}=realD1();
    try{
      await expect(bindGoogleAccount({...base(db),OWNER_EMAIL:'me@example.com'},claims('sub-9','someone@else.com'),null))
        .rejects.toMatchObject({status:403});
    }finally{close()}
  });
});
