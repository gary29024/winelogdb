import { expect,it } from 'vitest';
import { mkdirSync,writeFileSync } from 'node:fs';
import { realD1 } from './support/realD1';
import { socialRoute } from '../../worker/multiUser/social';
import type { Member } from '../../worker/multiUser/common';
it('bounds shared reads for a 25-member pilot and records local workload measurements',async()=>{
 const d=realD1();try{
  const members:Member[]=Array.from({length:25},(_,i)=>({id:`member-${i}`,email:`${i}@example.com`,display_name:`Member ${i}`,role:i?'member':'owner',status:'active'}));
  for(const u of members)d.sql.prepare('INSERT INTO app_users(id,email,display_name,role) VALUES(?,?,?,?)').run(u.id,u.email,u.display_name,u.role);
  for(let i=0;i<25;i++){const owner=members[i],friend=members[(i+1)%25];d.sql.prepare('INSERT OR IGNORE INTO friendships(user_id,friend_id) VALUES(?,?),(?,?)').run(owner.id,friend.id,friend.id,owner.id);
   for(let j=0;j<100;j++){const id=`wine-${i}-${j}`;d.sql.prepare('INSERT INTO wines(id,owner_id,producer,wine_name,tasting_notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(id,owner.id,'Producer',`Wine ${j}`,'Tasting note. '.repeat(80),'2026-09-01','2026-09-01');d.sql.prepare('INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES(?,?,?)').run(id,owner.id,friend.id)}
  }
  const started=performance.now();let returned=0;
  for(const member of members){const result=await socialRoute(new Request('https://wine.example/api/shared/wines'),{DB:d.db,AUTH_SECRET:'test',APP_URL:'https://wine.example',WINE_IMAGES:{} as R2Bucket},member);const value=await result!.json() as {items:unknown[]};expect(value.items).toHaveLength(25);returned+=value.items.length}
  const plan=d.sql.prepare('EXPLAIN QUERY PLAN SELECT wine_id FROM wine_shares WHERE recipient_id=? ORDER BY created_at DESC,wine_id LIMIT 25').all(members[0].id);expect(JSON.stringify(plan)).toContain('idx_wine_shares_recipient');
  const pageCount=Number(d.sql.prepare('PRAGMA page_count').get()!.page_count),pageSize=Number(d.sql.prepare('PRAGMA page_size').get()!.page_size);
  mkdirSync('.cache',{recursive:true});writeFileSync('.cache/pilot-workload.json',JSON.stringify({members:25,wines:2500,sharingGrants:2500,listRequests:25,returnedRows:returned,sqlStatements:d.counts(),localSqliteElapsedMs:Math.round(performance.now()-started),sqliteBytes:pageCount*pageSize,indexPlan:plan,photoScenario:{photosPerWine:2,originalBytes:1048576,sharingCopyBytes:262144,totalBytes:2500*2*(1048576+262144)},limitations:'Local SQLite measurements. Returned rows are not Cloudflare billed rows. R2 scenario is an estimate. Worker CPU, live D1 billing and queue operations still require deployment metrics.'},null,2));
 }finally{d.close()}
});
