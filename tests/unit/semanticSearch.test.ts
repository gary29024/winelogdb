import { afterEach,describe,expect,it,vi } from 'vitest';
import { buildWineSemanticDocument,decodeStoredEmbedding,normalizedDot,rankSemanticCandidates,semanticWineIds,warmSemanticWineIndex } from '../../src/lib/journal/semanticSearch';
import { shouldUseSemanticQuery } from '../../src/lib/journal/semanticQuery';
import { listJournalPage } from '../../src/lib/journal/list';
import { migratedSqliteD1 } from './support/sqliteD1';

const databases:Array<ReturnType<typeof migratedSqliteD1>>=[];
afterEach(()=>{for(const state of databases.splice(0))state.sqlite.close();vi.restoreAllMocks()});

describe('Journal semantic search helpers',()=>{
  it('indexes only the recipient-visible shared experience and removes revoked cached candidates',async()=>{
    const state=migratedSqliteD1();databases.push(state);const {db,sqlite}=state;
    sqlite.exec(`INSERT INTO app_users(id,email,display_name,role) VALUES('recipient','r@example.test','Recipient','member');
      INSERT INTO friendships(user_id,friend_id) VALUES('recipient','owner'),('owner','recipient');
      INSERT INTO wines(id,owner_id,producer,wine_name,tasting_notes,event,venue,tags_json,created_at,updated_at)
        VALUES('shared-semantic','owner','Domaine Test','Shared bottle','SOURCE_PRIVATE','SOURCE_EVENT','SOURCE_VENUE','["SOURCE_TAG"]','2026-09-01','2026-09-01');
      INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('shared-semantic','owner','recipient');
      INSERT INTO shared_wine_preferences(recipient_id,owner_id,wine_id,tasting_notes,venue,tasting_name,updated_at)
        VALUES('recipient','owner','shared-semantic','Reader violets','Reader venue','Reader dinner','2026-09-02');`);
    const texts:string[]=[];
    const run=vi.fn(async(_model:string,input:{text:string[]})=>{texts.push(...input.text);return {data:input.text.map(()=>[1,...Array(1023).fill(0)])}});
    const env={DB:db,AI:{run}} as never;
    await warmSemanticWineIndex(env,'recipient');
    expect(texts.join('\n')).toContain('Wine: Shared bottle');
    expect(texts.join('\n')).toContain('Reader violets');
    expect(texts.join('\n')).toContain('Reader dinner');
    expect(texts.join('\n')).not.toContain('SOURCE_');
    expect((await semanticWineIds(env,'recipient','silky evening wine'))?.ids).toEqual(['shared-semantic']);
    sqlite.exec("UPDATE shared_wine_preferences SET tasting_notes='Reader changed',updated_at='2026-09-03' WHERE recipient_id='recipient'");
    await warmSemanticWineIndex(env,'recipient');
    expect(texts.join('\n')).toContain('Reader changed');
    sqlite.exec("UPDATE wines SET wine_name='Corrected bottle',updated_at='2026-09-04' WHERE id='shared-semantic'");
    await warmSemanticWineIndex(env,'recipient');
    expect(texts.join('\n')).toContain('Wine: Corrected bottle');
    expect((await semanticWineIds(env,'recipient','silky evening wine'))?.ids).toEqual(['shared-semantic']);
    const callsBeforeRevocation=run.mock.calls.length;
    sqlite.exec("DELETE FROM wine_shares WHERE wine_id='shared-semantic'");
    expect((await semanticWineIds(env,'recipient','silky evening wine'))?.ids).toEqual([]);
    expect(run).toHaveBeenCalledTimes(callsBeforeRevocation);
    await warmSemanticWineIndex(env,'recipient');
    expect(sqlite.prepare("SELECT count(*) AS n FROM wine_semantic_embeddings WHERE owner_id='recipient'").get()).toMatchObject({n:0});
  });

  it('keeps short identity searches on FTS and enables descriptive searches',()=>{
    expect(shouldUseSemanticQuery('Lamarche')).toBe(false);
    expect(shouldUseSemanticQuery('Nicole Lamarche')).toBe(false);
    expect(shouldUseSemanticQuery('2019')).toBe(false);
    expect(shouldUseSemanticQuery('floral elegant Burgundy')).toBe(true);
    expect(shouldUseSemanticQuery('優雅花香勃艮第')).toBe(true);
  });

  it('builds retrieval text only from wine meaning, not operational fields',()=>{
    const text=buildWineSemanticDocument({
      id:'internal-id',producer:'Domaine Example',wine_name:'Les Fleurs',vintage:2019,
      country:'France',region:'Burgundy',appellation:'Chambolle-Musigny',classification:'Premier Cru',
      grapes_json:'["Pinot Noir"]',wine_style:'Red',tasting_notes:'Floral, silky and fine tannins.',
      rating:93,event:'Burgundy tasting',venue:'Home',tags_json:'["elegant","perfumed"]',updated_at:'2026-09-11'
    });
    expect(text).toContain('Producer: Domaine Example');
    expect(text).toContain('Grapes: Pinot Noir');
    expect(text).toContain('Tasting notes: Floral, silky and fine tannins.');
    expect(text).toContain('Tags: elegant, perfumed');
    expect(text).not.toContain('internal-id');
    expect(text).not.toContain('2026-09-11');
  });

  it('ranks the unit vectors production actually stores with dot product',()=>{
    const query=[1,0,0],close=[0.8,0.6,0],orthogonal=[0,1,0];
    expect(normalizedDot(query,query)).toBeCloseTo(1);
    expect(normalizedDot(query,close)).toBeCloseTo(0.8);
    expect(normalizedDot(query,orthogonal)).toBeCloseTo(0);
    expect(normalizedDot(query,[1,0])).toBe(-1);
    expect(rankSemanticCandidates(query,[
      {id:'orthogonal',vector:orthogonal},
      {id:'close',vector:close},
      {id:'exact',vector:query}
    ]).map(item=>item.id)).toEqual(['exact','close','orthogonal']);
  });

  it('decodes the plain number[] BLOB shape D1 returns in production',()=>{
    const source=Float32Array.from([0.6,0.8,0,-0.25]),bytes=new Uint8Array(source.buffer);
    expect(Array.from(decodeStoredEmbedding(Array.from(bytes)))).toEqual(Array.from(source));
    // Keep local/node SQLite's typed-array shape working too.
    expect(Array.from(decodeStoredEmbedding(bytes))).toEqual(Array.from(source));
    expect(()=>decodeStoredEmbedding([1,2,3])).toThrow('invalid byte length');
    expect(()=>decodeStoredEmbedding([0,256,0,0])).toThrow('invalid byte');
  });

  it('persists normalized BLOBs, reuses query rankings, invalidates on index changes, and cascades deletes on real SQLite',async()=>{
    const state=migratedSqliteD1();databases.push(state);const {db,sqlite}=state;
    const insert=sqlite.prepare(`INSERT INTO wines(id,owner_id,producer,wine_name,vintage,country,region,appellation,grapes_json,wine_style,tasting_notes,rating,event,venue,tags_json,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    insert.run('w1','owner','Domaine Fleur','Fleur',2019,'France','Burgundy','Chambolle-Musigny','["Pinot Noir"]','red','floral silky fine tannins',93,'Dinner','Home','["elegant"]','2026-01-01','2026-09-03');
    insert.run('w2','owner','Domaine Silk','Silk',2020,'France','Burgundy','Volnay','["Pinot Noir"]','red','silky perfumed red fruit',91,'Dinner','Home','[]','2026-01-02','2026-09-02');
    insert.run('w3','owner','Domaine Earth','Earth',2018,'France','Burgundy','Gevrey-Chambertin','["Pinot Noir"]','red','earthy savoury structured',90,'Dinner','Home','[]','2026-01-03','2026-09-01');

    const basis=(x:number,y:number)=>[x,y,...Array.from({length:1022},()=>0)];
    const run=vi.fn(async(_model:string,input:unknown)=>{
      const texts=(input as {text:string[]}).text;
      return {data:texts.map(text=>{
        if(text==='floral elegant Burgundy')return basis(1,0);
        if(text.includes('Wine: Fleur'))return basis(3,0);
        if(text.includes('Wine: Silk'))return basis(4,3);
        return basis(0,2);
      })};
    });
    const env={DB:db,AI:{run}} as never;

    const cold=await semanticWineIds(env,'owner','floral elegant Burgundy');
    expect(cold?.ids).toEqual([]);
    expect(run).not.toHaveBeenCalled();

    await warmSemanticWineIndex(env,'owner');
    expect(run).toHaveBeenCalledTimes(1);
    const stored=sqlite.prepare('SELECT wine_id,dimensions,embedding FROM wine_semantic_embeddings ORDER BY wine_id').all() as Array<{wine_id:string;dimensions:number;embedding:Uint8Array}>;
    expect(stored).toHaveLength(3);
    expect(stored.every(row=>row.dimensions===1024&&row.embedding.byteLength===4096)).toBe(true);
    for(const row of stored){
      const vector=new Float32Array(row.embedding.buffer,row.embedding.byteOffset,row.embedding.byteLength/4);
      const norm=Math.sqrt(Array.from(vector).reduce((sum,value)=>sum+value*value,0));
      expect(norm).toBeCloseTo(1,5);
    }

    const semantic=await semanticWineIds(env,'owner','  ｆｌｏｒａｌ   elegant Burgundy  ');
    expect(run.mock.calls[1][1]).toMatchObject({text:['floral elegant Burgundy']});
    expect(semantic?.ids.slice(0,3)).toEqual(['w1','w2','w3']);
    expect(run).toHaveBeenCalledTimes(2);
    const page=await listJournalPage(db,'owner',{query:'floral elegant Burgundy'},semantic?.ids??[]);
    expect(page.items.map(item=>item.id)).toEqual(['w1','w2','w3']);

    // Back-navigation keeps the same semantic query in the Journal URL. A
    // whitespace-equivalent query must reuse the ranked IDs rather than paying
    // for another provider request or scanning every stored vector again.
    const cached=await semanticWineIds(env,'owner','  floral   elegant Burgundy  ');
    expect(cached?.ids.slice(0,3)).toEqual(['w1','w2','w3']);
    expect(run).toHaveBeenCalledTimes(2);
    expect(sqlite.prepare('SELECT count(*) AS n FROM wine_semantic_query_cache').get()).toMatchObject({n:1});

    // A refreshed document vector advances the semantic-index revision. The old
    // ranking stays in D1 but can no longer be read as current, so the next query
    // is embedded once and then becomes the new reusable cache entry.
    sqlite.prepare("UPDATE wines SET tasting_notes='earthy savoury structured floral',updated_at='2026-09-12' WHERE id='w3'").run();
    await warmSemanticWineIndex(env,'owner');
    expect(run).toHaveBeenCalledTimes(3);
    const refreshed=await semanticWineIds(env,'owner','floral elegant Burgundy');
    expect(refreshed?.ids.slice(0,3)).toEqual(['w1','w2','w3']);
    expect(run).toHaveBeenCalledTimes(4);

    // Deleting a wine cascades its vector and the migration trigger advances the
    // same revision, preventing a cached candidate list from surviving deletion.
    sqlite.prepare("DELETE FROM wines WHERE id='w2'").run();
    expect(sqlite.prepare('SELECT count(*) AS n FROM wine_semantic_embeddings').get()).toMatchObject({n:2});
    const afterDelete=await semanticWineIds(env,'owner','floral elegant Burgundy');
    expect(afterDelete?.ids.slice(0,2)).toEqual(['w1','w3']);
    expect(afterDelete?.ids).not.toContain('w2');
    expect(run).toHaveBeenCalledTimes(5);
  });

  it('indexes wines friends shared with a member, using only what the member can see',async()=>{
    const state=migratedSqliteD1();databases.push(state);const {db,sqlite}=state;
    sqlite.exec(`
      INSERT INTO app_users(id,email,display_name,role) VALUES('alice','a@example.com','Alice','owner'),('bob','b@example.com','Bob','member');
      INSERT INTO friendships(user_id,friend_id) VALUES('alice','bob'),('bob','alice');
      INSERT INTO wines(id,owner_id,producer,wine_name,vintage,country,region,grapes_json,wine_style,tasting_notes,rating,tags_json,created_at,updated_at)
        VALUES('shared-fleur','alice','Domaine Fleur','Fleur',2019,'France','Burgundy','["Pinot Noir"]','red','alice private notes',95,'[]','2026-01-01','2026-09-03');
      INSERT INTO wine_shares(wine_id,owner_id,recipient_id) VALUES('shared-fleur','alice','bob');
    `);
    const basis=(x:number,y:number)=>[x,y,...Array.from({length:1022},()=>0)];
    const run=vi.fn(async(_model:string,input:unknown)=>({data:(input as {text:string[]}).text.map(text=>text.includes('Wine: Fleur')||text==='floral elegant Burgundy'?basis(1,0):basis(0,1))}));
    const env={DB:db,AI:{run}} as never;

    await warmSemanticWineIndex(env,'bob');
    const documents=run.mock.calls.flatMap(call=>(call[1] as {text:string[]}).text);
    expect(documents).toHaveLength(1);
    expect(documents[0]).toContain('Wine: Fleur');
    // The friend's private notes and score never reach the member's index.
    expect(documents[0]).not.toContain('alice private notes');
    expect(documents[0]).not.toContain('95');

    const semantic=await semanticWineIds(env,'bob','floral elegant Burgundy');
    expect(semantic?.ids).toEqual(['shared-fleur']);
    const page=await listJournalPage(db,'bob',{query:'floral elegant Burgundy'},semantic?.ids??[],true);
    expect(page.items.map(item=>item.id)).toEqual(['shared-fleur']);

    // Withdrawing the share leaves the cached ranking in place and the index
    // revision unchanged. The cache read must notice the revoked wine and rank
    // again, or the Journal filters the stale IDs out and shows nothing even
    // though the member's own wine still matches.
    sqlite.exec(`INSERT INTO wines(id,owner_id,producer,wine_name,vintage,grapes_json,tags_json,created_at,updated_at)
      VALUES('bob-own','bob','Bob Estate','Own Fleur',2020,'[]','[]','2026-01-02','2026-09-04');`);
    await warmSemanticWineIndex(env,'bob');
    const both=await semanticWineIds(env,'bob','floral elegant Burgundy');
    expect(both?.ids).toEqual(expect.arrayContaining(['shared-fleur','bob-own']));
    sqlite.prepare("DELETE FROM wine_shares WHERE wine_id='shared-fleur'").run();
    const afterWithdraw=await semanticWineIds(env,'bob','floral elegant Burgundy');
    expect(afterWithdraw?.ids).toEqual(['bob-own']);
    const withdrawnPage=await listJournalPage(db,'bob',{query:'floral elegant Burgundy'},afterWithdraw?.ids??[],true);
    expect(withdrawnPage.items.map(item=>item.id)).toEqual(['bob-own']);
  });

  it('does not purge or overwrite newer rankings when an older query finishes late',async()=>{
    const state=migratedSqliteD1();databases.push(state);const {db,sqlite}=state;
    sqlite.exec("INSERT INTO wines(id,owner_id,producer,wine_name,created_at,updated_at) VALUES('w','owner','Producer','Wine','2026-01-01','2026-01-01')");
    const vector=[1,...Array.from({length:1023},()=>0)];
    const run=vi.fn(async()=>({data:[vector]}));
    const env={DB:db,AI:{run}} as never;
    await warmSemanticWineIndex(env,'owner');
    let release!:()=>void,started!:()=>void;
    const blocked=new Promise<void>(resolve=>{release=resolve});
    const entered=new Promise<void>(resolve=>{started=resolve});
    run.mockImplementationOnce(async()=>{started();await blocked;return {data:[vector]}});
    const oldSearch=semanticWineIds(env,'owner','floral elegant Burgundy');
    await entered;
    sqlite.exec('UPDATE wine_semantic_index_state SET revision=revision+1');
    await semanticWineIds(env,'owner','floral elegant Burgundy');
    await semanticWineIds(env,'owner','silky elegant Burgundy');
    const fresh=sqlite.prepare('SELECT query_key,index_revision,result_ids_json FROM wine_semantic_query_cache ORDER BY query_key').all();
    expect(fresh).toHaveLength(2);
    release();await oldSearch;
    expect(sqlite.prepare('SELECT query_key,index_revision,result_ids_json FROM wine_semantic_query_cache ORDER BY query_key').all()).toEqual(fresh);
    const calls=run.mock.calls.length;
    await semanticWineIds(env,'owner','floral elegant Burgundy');
    await semanticWineIds(env,'owner','silky elegant Burgundy');
    expect(run).toHaveBeenCalledTimes(calls);
  });
});
