import { describe,expect,it } from 'vitest';
import { reconcileProducerCuvees } from '../../src/lib/cuvees/entities';
import { buildResearchTargets,loadResearchCache,type ResearchScope } from '../../src/lib/research/cache';
import { realD1 } from './support/realD1';

const wine={producer:'Estate',producerId:'producer',wineName:'Clos Test',vintage:2020,country:'France',region:'Burgundy',appellation:'Test AOC',wineStyle:'white'};
const targetFor=(cuveeId:string,scope:ResearchScope)=>buildResearchTargets({...wine,cuveeId,wineName:cuveeId==='source'?'Clos Test Monopole':wine.wineName}).find(target=>target.scope===scope)!;
const earlier='2026-09-01T00:00:00.000Z',later='2026-09-02T00:00:00.000Z';

function setup(){
  const database=realD1();
  database.sql.prepare("INSERT INTO producers(id,owner_id,canonical_name,match_key,created_at,updated_at) VALUES('producer','owner','Estate','estate',?,?)").run(earlier,earlier);
  for(const id of ['source','survivor'])database.sql.prepare(`INSERT INTO cuvees(id,owner_id,producer_id,canonical_name,signature_key,appellation,wine_style,catalog_backed,created_at,updated_at) VALUES(?,'owner','producer',?,?,'Test AOC','white',?,?,?)`)
    .run(id,id==='source'?'Clos Test Monopole':'Clos Test',`old-${id}`,id==='survivor'?1:0,earlier,earlier);
  return database;
}

function seed(database:ReturnType<typeof realD1>,cuveeId:string,scope:ResearchScope,date:string,contributor:string|null,owner='owner'){
  const target=targetFor(cuveeId,scope),claim=`Aged for ${cuveeId==='source'?10:16} months in oak barrels.`,sources=[{title:cuveeId,url:`https://example.com/${cuveeId}`}];
  const payload=scope==='terroir'?{terroir:`Limestone soils documented by ${cuveeId}.`}:{summary:`The 2020 wine described by ${cuveeId}.`,expectedProfile:'Citrus and mineral notes.',winemakingTechniques:claim,drinkingWindow:'Suitable for cellaring.'};
  const field=scope==='terroir'?'terroir':'winemakingTechniques';
  const provenance={version:1,fields:{[field]:{claimCount:1,supportedCount:1,partialCount:0,unsupportedCount:0,uncertaintyCount:0,directSupportRatio:1,claims:[{claim:scope==='terroir'?payload.terroir:claim,supportStatus:'supported',sourceTier:'grounded',sources}]}}};
  database.sql.prepare(`INSERT INTO research_cache(owner_id,scope,cache_key,subject_json,result_json,sources_json,provenance_json,model,researched_at,source_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(owner,scope,target.cacheKey,JSON.stringify(target.subject),JSON.stringify(payload),JSON.stringify(sources),JSON.stringify(provenance),`model-${cuveeId}`,date,contributor,date,date);
  return {payload,provenance,model:`model-${cuveeId}`,researchedAt:date,contributorId:contributor??undefined};
}

describe('research metadata follows the winning result during cuvée reconciliation',()=>{
  it.each(['terroir','wine_vintage'] as const)('preserves evidence and friend attribution when moving %s into an empty destination',async scope=>{
    const database=setup(),saved=seed(database,'source',scope,earlier,'friend');
    seed(database,'source',scope,earlier,'another-friend','other-owner');
    await reconcileProducerCuvees(database.db,'owner','producer');
    const cache=await loadResearchCache(database.db,'owner',[targetFor('survivor',scope)]);
    expect(cache.get(scope)).toMatchObject(saved);
    expect(database.sql.prepare("SELECT count(*) AS n FROM research_cache WHERE owner_id='owner'").get()!.n).toBe(1);
    expect((await loadResearchCache(database.db,'other-owner',[targetFor('source',scope)])).get(scope)?.contributorId).toBe('another-friend');
    expect(database.sql.prepare('SELECT count(*) AS n FROM reusable_research').get()!.n).toBe(0);
  });

  it.each([
    {newer:'source',sourceContributor:'source-friend',survivorContributor:'survivor-friend'},
    {newer:'survivor',sourceContributor:'source-friend',survivorContributor:'survivor-friend'},
    {newer:'source',sourceContributor:null,survivorContributor:'survivor-friend'},
    {newer:'survivor',sourceContributor:'source-friend',survivorContributor:null}
  ])('keeps $newer text, evidence, author, model and date together on a key conflict',async({newer,sourceContributor,survivorContributor})=>{
    const database=setup(),scope='wine_vintage';
    const source=seed(database,'source',scope,newer==='source'?later:earlier,sourceContributor);
    const survivor=seed(database,'survivor',scope,newer==='survivor'?later:earlier,survivorContributor);
    await reconcileProducerCuvees(database.db,'owner','producer');
    const result=(await loadResearchCache(database.db,'owner',[targetFor('survivor',scope)])).get(scope)!;
    const winner=newer==='source'?source:survivor;
    expect(result).toBeDefined();
    expect(result.payload).toEqual(winner.payload);
    expect(result.provenance).toMatchObject(winner.provenance);
    expect(result.contributorId).toBe(winner.contributorId);
    expect(result.model).toBe(winner.model);
    expect(result.researchedAt).toBe(winner.researchedAt);
    expect(result.sources).toHaveLength(2);
  });
});
