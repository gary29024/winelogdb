import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {migratedSqliteD1} from './support/sqliteD1';
import {createSession} from '../../src/lib/auth/session';
import {sharedProducerId} from '../../src/lib/producers/sharedRef';
import {parcelProducerLinksRoute} from '../../worker/parcelProducerLinks';
import manifest from '../../src/lib/places/grandCruParcels/flagey-echezeaux.manifest.json';
import holders from '../../src/lib/places/grandCruParcels/flagey-echezeaux.holders.json';
import type {Parcels} from '../../src/features/vineyards/GrandCruParcels';

const secret='parcel-producer-tests-secret-long-enough',parent='inao-denom-565',holder=holders[parent][0];
async function fixture(){
 const {db,sqlite}=migratedSqliteD1();
 sqlite.exec(`INSERT INTO app_users(id,email,display_name,role) VALUES('alice','alice@test','Alice','member'),('bob','bob@test','Bob','member');
  INSERT INTO producers(id,owner_id,canonical_name,match_key,created_at,updated_at) VALUES
  ('p1','alice','Nicole Lamarche','nicole lamarche','2026','2026'),('p2','alice','Anne Gros','anne gros','2026','2026'),
  ('p1','bob','Private producer','private producer','2026','2026');`);
 const tokens={alice:await createSession('alice',secret),bob:await createSession('bob',secret)};
 const call=(user:keyof typeof tokens,method='GET',body?:unknown,snapshot=manifest.rightsAsOf)=>parcelProducerLinksRoute(new Request(
  `https://test/api/parcel-producer-links?parent=${parent}&snapshot=${snapshot}`,
  {method,headers:{Authorization:`Bearer ${tokens[user]}`,'Content-Type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{})}),{DB:db,AUTH_SECRET:secret}).then(r=>r!);
 return {db,sqlite,call};
}
describe('personal parcel producer links',()=>{
 it('reproduces the server holder allowlist from exact snapshot geometry',()=>{
  const data=JSON.parse(readFileSync('public'+manifest.dataUrl,'utf8')) as Parcels;
  for(const parent of manifest.parentFeatureIds)expect((holders as Record<string,string[]>)[parent]).toEqual([...new Set(data.features.filter(f=>f.properties.overlaps.some(o=>o.parentFeatureId===parent)).flatMap(f=>f.properties.recordedRights.map(r=>r.holderId)))].sort());
 });
 it('persists, changes and removes a manual link without affecting another account or source data',async()=>{
  const f=await fixture();try{
   const saved=await f.call('alice','PUT',{holderId:holder,producerId:'p1'});
   expect(saved.status).toBe(200);expect(await saved.json()).toMatchObject({status:'manual',producerName:'Nicole Lamarche'});
   expect(await (await f.call('bob')).json()).toEqual({items:[]});
   await f.call('bob','DELETE',{holderId:holder});
   expect((await (await f.call('alice')).json() as {items:unknown[]}).items).toHaveLength(1);
   await f.call('alice','PUT',{holderId:holder,producerId:'p2'});
   expect(await (await f.call('alice')).json()).toMatchObject({items:[{producerName:'Anne Gros',status:'manual'}]});
   await f.call('alice','DELETE',{holderId:holder});
   expect(await (await f.call('alice')).json()).toEqual({items:[]});
  }finally{f.sqlite.close()}
 });
 it('rejects unavailable producers, arbitrary holders, old snapshots and fabricated verification',async()=>{
  const f=await fixture();try{
   expect((await f.call('alice','PUT',{holderId:holder,producerId:sharedProducerId('bob','p1')})).status).toBe(404);
   expect((await f.call('alice','PUT',{holderId:'invented',producerId:'p1'})).status).toBe(400);
   expect((await f.call('alice','PUT',{holderId:holder,producerId:'p1',status:'verified'})).status).toBe(400);
   expect((await f.call('alice','PUT',{holderId:holder,producerId:'p1'},'2024-01-01')).status).toBe(400);
   expect(await (await f.call('alice')).json()).toEqual({items:[]});
   expect((await parcelProducerLinksRoute(new Request('https://test/api/parcel-producer-links'),{DB:f.db,AUTH_SECRET:secret}))?.status).toBe(401);
  }finally{f.sqlite.close()}
 });
 it('allows a visible shared producer and hides it immediately when sharing is revoked',async()=>{
  const f=await fixture();try{
   f.sqlite.exec(`INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice');
    INSERT INTO wines(id,owner_id,producer,producer_id,wine_name,created_at,updated_at) VALUES('w','bob','Private producer','p1','Wine','2026','2026');
    INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('w','bob','alice');`);
   const id=sharedProducerId('bob','p1');
   expect((await f.call('alice','PUT',{holderId:holder,producerId:id})).status).toBe(200);
   expect(await (await f.call('alice')).json()).toMatchObject({items:[{producerId:id,producerName:'Private producer'}]});
   f.sqlite.exec('DELETE FROM wine_shares');
   expect(await (await f.call('alice')).json()).toEqual({items:[]});
   expect((await f.call('alice','PUT',{holderId:holder,producerId:id})).status).toBe(404);
  }finally{f.sqlite.close()}
 });
 it('removes dangling catalogue associations on producer deletion',async()=>{
  const f=await fixture();try{
   await f.call('alice','PUT',{holderId:holder,producerId:'p1'});
   f.sqlite.exec("DELETE FROM producers WHERE owner_id='alice' AND id='p1'");
   expect(f.sqlite.prepare('SELECT count(*) AS n FROM parcel_producer_links').get()?.n).toBe(0);
  }finally{f.sqlite.close()}
 });
});
