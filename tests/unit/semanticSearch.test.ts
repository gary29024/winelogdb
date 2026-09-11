import { afterEach,describe,expect,it,vi } from 'vitest';
import { buildWineSemanticDocument,normalizedDot,rankSemanticCandidates,semanticWineIds,warmSemanticWineIndex } from '../../src/lib/journal/semanticSearch';
import { shouldUseSemanticQuery } from '../../src/lib/journal/semanticQuery';
import { listJournalPage } from '../../src/lib/journal/list';
import { migratedSqliteD1 } from './support/sqliteD1';

const databases:Array<ReturnType<typeof migratedSqliteD1>>=[];
afterEach(()=>{for(const state of databases.splice(0))state.sqlite.close();vi.restoreAllMocks()});

describe('Journal semantic search helpers',()=>{
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

  it('persists normalized BLOBs, ranks them, executes hybrid SQL, and cascades deletes on real SQLite',async()=>{
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
    const stored=sqlite.prepare('SELECT wine_id,dimensions,embedding FROM wine_semantic_embeddings ORDER BY wine_id').all() as Array<{wine_id:string;dimensions:number;embedding:Uint8Array}>;
    expect(stored).toHaveLength(3);
    expect(stored.every(row=>row.dimensions===1024&&row.embedding.byteLength===4096)).toBe(true);
    for(const row of stored){
      const vector=new Float32Array(row.embedding.buffer,row.embedding.byteOffset,row.embedding.byteLength/4);
      const norm=Math.sqrt(Array.from(vector).reduce((sum,value)=>sum+value*value,0));
      expect(norm).toBeCloseTo(1,5);
    }

    const semantic=await semanticWineIds(env,'owner','floral elegant Burgundy');
    expect(semantic?.ids.slice(0,3)).toEqual(['w1','w2','w3']);
    const page=await listJournalPage(db,'owner',{query:'floral elegant Burgundy'},semantic?.ids??[]);
    expect(page.items.map(item=>item.id)).toEqual(['w1','w2','w3']);

    sqlite.prepare("DELETE FROM wines WHERE id='w2'").run();
    expect(sqlite.prepare('SELECT count(*) AS n FROM wine_semantic_embeddings').get()).toMatchObject({n:2});
  });
});
