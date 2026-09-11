import { afterEach,describe,expect,it } from 'vitest';
import app from '../../worker/structureEntry';
import { createSession } from '../../src/lib/auth/session';
import { migratedSqliteD1 } from './support/sqliteD1';

const SECRET='test-secret-value-long-enough-for-hmac';
const databases:Array<ReturnType<typeof migratedSqliteD1>>=[];
afterEach(()=>{for(const state of databases.splice(0))state.sqlite.close()});

describe('semantic Journal forwarding boundary',()=>{
  it('ignores caller-supplied internal semantic candidate ids',async()=>{
    const state=migratedSqliteD1();databases.push(state);const {sqlite}=state;
    const insert=sqlite.prepare(`INSERT INTO wines(id,owner_id,producer,wine_name,grapes_json,tasting_notes,tags_json,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?)`);
    insert.run('w1','owner','Producer One','First Wine','[]','','[]','2026-01-01','2026-01-01');
    insert.run('w2','owner','Producer Two','Second Wine','[]','','[]','2026-01-02','2026-01-02');
    const token=await createSession('owner',SECRET);
    const response=await app.fetch(new Request('https://x/api/journal?query=notpresent&semantic=0&__semanticIds=w2',{
      headers:{authorization:`Bearer ${token}`}
    }),{DB:state.db,AUTH_SECRET:SECRET,APP_PASSWORD:'p',APP_URL:'https://x',ASSETS:{fetch:async()=>new Response('spa')}} as never,
    {waitUntil:()=>{},passThroughOnException:()=>{}} as never);
    expect(response.status,await response.clone().text()).toBe(200);
    const body=await response.json() as {items:Array<{id:string}>;total:number};
    expect(body.total).toBe(0);
    expect(body.items).toEqual([]);
  });
});
