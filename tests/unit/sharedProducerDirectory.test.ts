import { describe,expect,it } from 'vitest';
import { migratedSqliteD1 } from './support/sqliteD1';
import app from '../../worker/cuveeEntry';
import { createSession } from '../../src/lib/auth/session';

const AUTH_SECRET='shared-producer-test-secret-long-enough';

describe('shared producers in the recipient library',()=>{
  it('shows a source producer without copying a producer row into the recipient account',async()=>{
    const {db,sqlite}=migratedSqliteD1();
    try{
      const stamp='2026-09-18T00:00:00.000Z';
      sqlite.exec(`
        INSERT INTO app_users(id,email,display_name,role) VALUES
          ('alice','alice@example.com','Alice','member'),
          ('bob','bob@example.com','Bob','member');
        INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice');
        INSERT INTO producers(id,owner_id,canonical_name,match_key,home_country,home_region,home_locality,profile,created_at,updated_at)
          VALUES('producer-alice','alice','Domaine Test','domaine test','France','Burgundy','Vosne-Romanée','A shared producer profile','${stamp}','${stamp}');
        INSERT INTO wines(id,owner_id,producer,producer_id,wine_name,vintage,country,region,appellation,wine_style,tasting_date,created_at,updated_at)
          VALUES('wine-alice','alice','Domaine Test','producer-alice','Clos Test',2020,'France','Burgundy','Vosne-Romanée','red','2026-09-01','${stamp}','${stamp}');
        INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('wine-alice','alice','bob');
      `);
      const env={DB:db,AUTH_SECRET,APP_URL:'https://x',APP_PASSWORD:'p',GEMINI_API_KEY:'k',
        WINE_IMAGES:{get:async()=>null,put:async()=>({}),delete:async()=>undefined},
        ASSETS:{fetch:async()=>new Response('spa')}} as never;
      const context={waitUntil:()=>undefined,passThroughOnException:()=>undefined} as never;
      const auth={authorization:`Bearer ${await createSession('bob',AUTH_SECRET)}`};

      const list=await app.fetch(new Request('https://x/api/producers',{headers:auth}),env,context);
      expect(list.status).toBe(200);
      const payload=await list.json() as {items:Array<{id:string;canonicalName:string;tastedCount:number;sharedOnly?:boolean}>};
      expect(payload.items).toHaveLength(1);
      expect(payload.items[0]).toMatchObject({canonicalName:'Domaine Test',tastedCount:1,sharedOnly:true});
      expect(payload.items[0].id).toMatch(/^shared::alice::producer-alice$/);
      expect(Number(sqlite.prepare("SELECT count(*) AS n FROM producers WHERE owner_id='bob'").get()!.n)).toBe(0);

      const detail=await app.fetch(new Request(`https://x/api/producers/${payload.items[0].id}`,{headers:auth}),env,context);
      expect(detail.status).toBe(200);
      const producer=await detail.json() as {sharedOnly?:boolean;canonicalName:string;tastedWines:Array<{id:string;shared?:boolean}>};
      expect(producer).toMatchObject({sharedOnly:true,canonicalName:'Domaine Test'});
      expect(producer.tastedWines).toEqual([expect.objectContaining({id:'wine-alice',shared:true})]);
      expect(Number(sqlite.prepare("SELECT count(*) AS n FROM producers WHERE owner_id='bob'").get()!.n)).toBe(0);
    }finally{sqlite.close()}
  });

  it('folds shared wines into an existing recipient producer with the same identity key',async()=>{
    const {db,sqlite}=migratedSqliteD1();
    try{
      const stamp='2026-09-18T00:00:00.000Z';
      sqlite.exec(`
        INSERT INTO app_users(id,email,display_name,role) VALUES
          ('alice','alice@example.com','Alice','member'),
          ('bob','bob@example.com','Bob','member');
        INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice');
        INSERT INTO producers(id,owner_id,canonical_name,match_key,home_country,created_at,updated_at) VALUES
          ('producer-alice','alice','Domaine Test','domaine test','France','${stamp}','${stamp}'),
          ('producer-bob','bob','Domaine Test','domaine test','France','${stamp}','${stamp}');
        INSERT INTO wines(id,owner_id,producer,producer_id,wine_name,vintage,country,region,wine_style,created_at,updated_at) VALUES
          ('wine-owned','bob','Domaine Test','producer-bob','Own Cuvée',2021,'France','Burgundy','red','${stamp}','${stamp}'),
          ('wine-shared','alice','Domaine Test','producer-alice','Shared Cuvée',2020,'France','Burgundy','red','${stamp}','${stamp}');
        INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('wine-shared','alice','bob');
      `);
      const env={DB:db,AUTH_SECRET,APP_URL:'https://x',APP_PASSWORD:'p',GEMINI_API_KEY:'k',
        WINE_IMAGES:{get:async()=>null,put:async()=>({}),delete:async()=>undefined},
        ASSETS:{fetch:async()=>new Response('spa')}} as never;
      const context={waitUntil:()=>undefined,passThroughOnException:()=>undefined} as never;
      const auth={authorization:`Bearer ${await createSession('bob',AUTH_SECRET)}`};

      const list=await app.fetch(new Request('https://x/api/producers',{headers:auth}),env,context);
      const payload=await list.json() as {items:Array<{id:string;tastedCount:number;sharedOnly?:boolean}>};
      expect(payload.items).toEqual([expect.objectContaining({id:'producer-bob',tastedCount:2,sharedOnly:false})]);

      const detail=await app.fetch(new Request('https://x/api/producers/producer-bob',{headers:auth}),env,context);
      const producer=await detail.json() as {tastedWines:Array<{id:string;shared?:boolean}>};
      expect(new Set(producer.tastedWines.map(wine=>wine.id))).toEqual(new Set(['wine-owned','wine-shared']));
      expect(producer.tastedWines.find(wine=>wine.id==='wine-shared')?.shared).toBe(true);
    }finally{sqlite.close()}
  });
});
