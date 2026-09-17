import { afterEach,describe,expect,it,vi } from 'vitest';
import { warmSemanticWineIndex } from '../../src/lib/journal/semanticSearch';
import { migratedSqliteD1 } from './support/sqliteD1';

const databases:Array<ReturnType<typeof migratedSqliteD1>>=[];
afterEach(()=>{for(const state of databases.splice(0))state.sqlite.close();vi.restoreAllMocks()});

describe('Smart Search index embedding ceiling',()=>{
  it('re-checks the rolling cap before each provider batch',async()=>{
    const state=migratedSqliteD1();databases.push(state);const {db,sqlite}=state;
    sqlite.exec("INSERT INTO app_users(id,email,display_name,role,status) VALUES('bob','bob@example.com','Bob','member','active')");
    sqlite.prepare("UPDATE pilot_settings SET value_json=json_set(value_json,'$.aiDailyEmbeddingRequests',1) WHERE id=1").run();

    const insert=sqlite.prepare("INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at) VALUES(?,?,?,?,?,?)");
    for(let i=0;i<30;i++)insert.run(`w${i}`,'bob','Producer',`Wine ${i}`,'2026-01-01','2026-09-17');

    const vector=[1,...Array.from({length:1023},()=>0)];
    const run=vi.fn(async(_model:string,input:unknown)=>({
      data:(input as {text:string[]}).text.map(()=>vector)
    }));

    await warmSemanticWineIndex({DB:db,AI:{run}} as never,'bob');

    // One request may embed a batch of up to 24 documents. Once that provider
    // request is metered, the next batch must see the cap and stop rather than
    // consuming the rest of the 30-wine refresh under the earlier check.
    expect(run).toHaveBeenCalledTimes(1);
    expect(sqlite.prepare("SELECT coalesce(sum(requests),0) AS n FROM ai_usage_events WHERE owner_id='bob' AND kind='search_embedding'").get()).toMatchObject({n:1});
    expect(sqlite.prepare("SELECT count(*) AS n FROM wine_semantic_embeddings WHERE owner_id='bob'").get()).toMatchObject({n:24});
  });
});
