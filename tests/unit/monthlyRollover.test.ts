import { afterEach,beforeEach,describe,expect,it } from 'vitest';
import { realD1 } from './support/realD1';
import { settings,stamp,type Member } from '../../worker/multiUser/common';
import { adminRoute } from '../../worker/multiUser/admin';

let database:ReturnType<typeof realD1>;
const owner:Member={id:'owner',email:'owner@example.com',display_name:'Owner',role:'owner',status:'active'};
const stored=()=>JSON.parse(String(database.sql.prepare('SELECT value_json FROM pilot_settings WHERE id=1').get()!.value_json)) as Record<string,unknown>;
const month=()=>stamp().slice(0,7);
beforeEach(()=>{
 database=realD1();
 database.sql.prepare("UPDATE pilot_settings SET value_json=json_set(value_json,'$.cloudflareObservedMonth','2000-01','$.cloudflareObservedUsd',3.5,'$.aiMonthlyBudgetUsd',20) WHERE id=1").run();
});
afterEach(()=>database.close());

describe('the Cloudflare cost rolling into a new month',()=>{
 it('moves the month forward and starts the new month at $0 instead of pausing member AI',async()=>{
  const value=await settings(database.db);
  expect(value).toMatchObject({cloudflareObservedMonth:month(),cloudflareObservedUsd:0,cloudflareAutoRolled:true});
  // Saved, so Owner controls and every later request see the same month.
  expect(stored()).toMatchObject({cloudflareObservedMonth:month(),cloudflareObservedUsd:0,cloudflareAutoRolled:true});
  // The rest of the owner's settings are untouched.
  expect(stored().aiMonthlyBudgetUsd).toBe(20);
 });

 it('leaves a current month alone',async()=>{
  database.sql.prepare("UPDATE pilot_settings SET value_json=json_set(value_json,'$.cloudflareObservedMonth',?,'$.cloudflareObservedUsd',2.25) WHERE id=1").run(month());
  expect(await settings(database.db)).toMatchObject({cloudflareObservedMonth:month(),cloudflareObservedUsd:2.25});
  expect(stored().cloudflareAutoRolled).toBeUndefined();
 });

 it('clears the reminder once the owner saves this month’s cost',async()=>{
  const rolled=await settings(database.db);
  const {cloudflareAutoRolled:_flag,researchRunsPerWeek:_runs,...saved}=rolled;void _flag;void _runs;
  const response=await adminRoute(new Request('https://wine.example/api/admin/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...saved,cloudflareObservedUsd:1.75})}),{DB:database.db,AUTH_SECRET:'a'.repeat(48),APP_URL:'https://wine.example'} as never,owner);
  expect(response!.status).toBe(200);
  expect(stored()).toMatchObject({cloudflareObservedMonth:month(),cloudflareObservedUsd:1.75});
  expect(stored().cloudflareAutoRolled).toBeUndefined();
 });
});
