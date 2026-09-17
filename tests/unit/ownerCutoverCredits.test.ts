import { describe,expect,it } from 'vitest';
import { realD1 } from './support/realD1';
import { quote,reserve } from '../../worker/multiUser/credits';
import type { Member } from '../../worker/multiUser/common';

const owner:Member={id:'owner',email:'owner@example.com',display_name:'Owner',role:'owner',status:'active'};
const member:Member={id:'member',email:'member@example.com',display_name:'Member',role:'member',status:'active'};
const scan=(headers:Record<string,string>={})=>new Request('https://wine.example/api/recognition',{
  method:'POST',
  headers:{'Content-Type':'multipart/form-data; boundary=cutover',...headers},
  body:'--cutover\r\nContent-Disposition: form-data; name="images"; filename="label.jpg"\r\nContent-Type: image/jpeg\r\n\r\nlabel\r\n--cutover--\r\n'
});

describe('multi-user owner cutover',()=>{
  it('starts in the current budget month',()=>{
    const {sql,close}=realD1();
    try{
      const row=sql.prepare('SELECT value_json FROM pilot_settings WHERE id=1').get() as {value_json:string};
      const settings=JSON.parse(row.value_json) as {cloudflareObservedMonth:string};
      expect(settings.cloudflareObservedMonth).toBe(new Date().toISOString().slice(0,7));
    }finally{close()}
  });

  it('keeps owner AI usable with zero credits alongside zero member tariffs',async()=>{
    const {sql,db,close}=realD1();
    try{
      const tariffs=sql.prepare('SELECT count(*) AS n,max(credits) AS maxCredits FROM credit_prices').get() as {n:number;maxCredits:number};
      expect(tariffs.n).toBeGreaterThan(0);expect(tariffs.maxCredits).toBe(0);
      expect(sql.prepare("SELECT balance FROM credit_wallets WHERE user_id='owner'").get()).toMatchObject({balance:0});
      const q=await quote(scan(),{DB:db},owner);
      expect(q.total).toBe(0);
      expect(q.units).toHaveLength(1);
      expect(q.units[0]).toMatchObject({priceId:'owner-exempt',credits:0,action:'scan_single'});
      const result=await reserve(scan({'X-WineLog-Quote':q.id,'Idempotency-Key':'owner-cutover'}),{DB:db},owner);
      expect(result.operation).toMatchObject({user_id:'owner',reserved:0,status:'reserved'});
    }finally{close()}
  });

  it('allows a real Cloudflare cost below the seeded hard stop',async()=>{
    const {sql,db,close}=realD1();
    try{
      const row=sql.prepare('SELECT value_json FROM pilot_settings WHERE id=1').get() as {value_json:string};
      const settings=JSON.parse(row.value_json) as {allowOverages:boolean;cloudflareObservedUsd:number;cloudflareStopUsd:number};
      expect(settings.allowOverages).toBe(true);
      expect(settings.cloudflareStopUsd).toBeGreaterThan(0.42);
      settings.cloudflareObservedUsd=0.42;
      sql.prepare('UPDATE pilot_settings SET value_json=? WHERE id=1').run(JSON.stringify(settings));
      const q=await quote(scan(),{DB:db},owner);
      const result=await reserve(scan({'X-WineLog-Quote':q.id,'Idempotency-Key':'owner-observed-cost'}),{DB:db},owner);
      expect(result.operation).toMatchObject({user_id:'owner',status:'reserved'});
    }finally{close()}
  });

  it('keeps only the accepted action when quote units contain a stale sibling',async()=>{
    const {sql,db,close}=realD1();
    try{
      const q=await quote(scan(),{DB:db},owner);
      const correct=q.units[0];
      sql.prepare('UPDATE credit_quotes SET units_json=? WHERE id=?').run(JSON.stringify([correct,{...correct,action:'scan_group'}]),q.id);
      const result=await reserve(scan({'X-WineLog-Quote':q.id,'Idempotency-Key':'owner-action-binding'}),{DB:db},owner);
      const units=JSON.parse(result.operation.units_json) as Array<{action:string}>;
      expect(units.map(unit=>unit.action)).toEqual(['scan_single']);
    }finally{close()}
  });

  it('sponsors member scans without requiring wallet credits',async()=>{
    const {sql,db,close}=realD1();
    try{
      sql.exec("INSERT INTO app_users(id,email,display_name,role) VALUES('member','member@example.com','Member','member'); INSERT INTO credit_wallets(user_id) VALUES('member')");
      const q=await quote(scan(),{DB:db},member);
      expect(q.total).toBe(0);expect(q.available).toBe(0);
      expect(q.units).toHaveLength(1);expect(q.units[0]).toMatchObject({action:'scan_single',credits:0,priceId:'pilot-free-scan-single'});
      const result=await reserve(scan({'X-WineLog-Quote':q.id,'Idempotency-Key':'member-sponsored-scan'}),{DB:db},member);
      expect(result.operation).toMatchObject({user_id:'member',reserved:0,status:'reserved'});
    }finally{close()}
  });
});
