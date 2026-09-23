import { describe,expect,it } from 'vitest';
import { assembleDeepSearch,buildLegacyResearchTargets,buildResearchTargets,loadResearchCache,loadWineResearchCache,seedResolvedResearch,type ResearchScope,type ResearchTarget } from '../../src/lib/research/cache';
import { plannedUnits } from '../../worker/multiUser/credits';
import { realD1 } from './support/realD1';
import { mergeProducerEntities,unlinkProducerMerge } from '../../src/lib/producers/merge';

const wine={producer:'Domaine Albert Bichot (Long-Depaquit)',producerId:'producer-1',cuveeId:'cuvee-1',wineName:'Chablis Grand Cru Moutonne Monopole',vintage:2020,country:'France',region:'Burgundy',appellation:'Chablis Grand Cru',wineStyle:'white'};
const researchedAt='2026-09-13T16:41:03.840Z';
const technicalClaim='Maturation lasted 10 months in oak barrels.';
const technicalProvenance={version:1,fields:{winemakingTechniques:{claimCount:1,supportedCount:1,partialCount:0,unsupportedCount:0,uncertaintyCount:0,directSupportRatio:1,claims:[{claim:technicalClaim,supportStatus:'supported',sourceTier:'grounded',sources:[{title:'Estate',url:'https://example.com/wine'}]}]}}};
const payloads:Record<ResearchScope,Record<string,string>>={
  producer:{producerDetails:'The estate produces Chablis.',producerWinemakingPractices:'The estate focuses on purity of fruit.'},
  terroir:{terroir:'The vineyard has limestone soils.'},
  vintage_context:{vintageQuality:'The 2020 growing season was warm.'},
  wine_vintage:{summary:'The 2020 Moutonne has a mineral character.',expectedProfile:'Citrus fruit and mineral notes.',winemakingTechniques:'Exact 2020 vinification could not be verified.',drinkingWindow:'The wine can develop in the cellar.'}
};
function seed(database:ReturnType<typeof realD1>,targets:ResearchTarget[],owner='owner',contributor:string|null=null){
  for(const target of targets)database.sql.prepare(`INSERT INTO research_cache(owner_id,scope,cache_key,subject_json,result_json,sources_json,provenance_json,model,researched_at,source_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(owner,target.scope,target.cacheKey,JSON.stringify(target.subject),JSON.stringify(payloads[target.scope]),JSON.stringify([{title:'Estate',url:'https://example.com/wine'}]),'{}','original-model',researchedAt,contributor,researchedAt,researchedAt);
}

describe('research survives promotion from names to entity IDs',()=>{
  it.each([false,true])('recovers the reported Moutonne report before another run (producer already linked: %s)',async linked=>{
    const database=realD1(),targets=buildResearchTargets(wine);
    seed(database,buildResearchTargets({...wine,producerId:linked?wine.producerId:null,cuveeId:null}));
    const before=database.counts();
    const cache=await loadWineResearchCache(database.db,'owner',targets,true);
    expect(cache.size).toBe(4);
    expect(assembleDeepSearch(cache,targets)).toMatchObject({...payloads.wine_vintage,...payloads.terroir,model:'original-model',researchedAt});
    expect(cache.get('terroir')!.target).toEqual(targets.find(target=>target.scope==='terroir'));
    expect(database.counts()).toEqual({reads:before.reads+1,writes:before.writes});
  });

  it('does not plan paid work for research available under old keys',async()=>{
    const database=realD1();
    seed(database,buildResearchTargets({...wine,cuveeId:null}));
    database.sql.prepare(`INSERT INTO wines(id,owner_id,producer,producer_id,cuvee_id,wine_name,vintage,country,region,appellation,wine_style,created_at,updated_at) VALUES('wine-1','owner',?,?,?,?,?,?,?,?,?,'now','now')`)
      .run(wine.producer,wine.producerId,wine.cuveeId,wine.wineName,wine.vintage,wine.country,wine.region,wine.appellation,wine.wineStyle);
    const request=(refresh='none')=>new Request('https://wine.example/api/wines/wine-1/deep-search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({refresh})});
    expect(await plannedUnits(request(),database.db,'owner')).toEqual([]);
    expect((await plannedUnits(request('vintage'),database.db,'owner')).map(unit=>unit.scope)).toEqual(['vintage_context','wine_vintage']);
    expect(await plannedUnits(request('all'),database.db,'owner')).toHaveLength(4);
  });

  it('keeps prior cuvée-name keys reusable through a producer-wide rename with the same ID',async()=>{
    const database=realD1();
    seed(database,buildResearchTargets({...wine,producer:'Domaine Long-Depaquit',cuveeId:null}));
    expect((await loadWineResearchCache(database.db,'owner',buildResearchTargets(wine))).size).toBe(4);
  });

  it('prefers the current result and still applies quality gates to old rows',async()=>{
    const database=realD1(),targets=buildResearchTargets(wine);
    seed(database,buildResearchTargets({...wine,cuveeId:null}));
    seed(database,targets.filter(target=>target.scope==='terroir'));
    database.sql.prepare("UPDATE research_cache SET result_json=? WHERE cache_key=? AND scope='terroir'").run(JSON.stringify({terroir:'Current verified terroir.'}),targets.find(target=>target.scope==='terroir')!.cacheKey);
    database.sql.exec("UPDATE research_cache SET sources_json='[]' WHERE scope='wine_vintage'");
    const cache=await loadWineResearchCache(database.db,'owner',targets);
    expect(cache.get('terroir')!.payload.terroir).toBe('Current verified terroir.');
    expect(cache.has('wine_vintage')).toBe(false);
  });

  it('preserves adoption and provenance without republishing a friend’s work',async()=>{
    const database=realD1(),targets=buildResearchTargets(wine);
    seed(database,buildResearchTargets({...wine,cuveeId:null}),'owner','friend');
    const provenance={version:1,fields:{terroir:{claimCount:1,supportedCount:1,partialCount:0,unsupportedCount:0,uncertaintyCount:0,directSupportRatio:1,claims:[{claim:'Limestone soils.',supportStatus:'supported',sourceTier:'grounded',sources:[{title:'Estate',url:'https://example.com/wine'}]}]}}};
    database.sql.prepare("UPDATE research_cache SET provenance_json=? WHERE scope='terroir'").run(JSON.stringify(provenance));
    const cache=await loadWineResearchCache(database.db,'owner',targets);
    await seedResolvedResearch(database.db,'owner',cache);
    const restored=(await loadResearchCache(database.db,'owner',targets)).get('terroir')!;
    expect(restored).toMatchObject({contributorId:'friend',researchedAt,model:'original-model',provenance});
    expect(database.sql.prepare('SELECT count(*) AS n FROM reusable_research').get()!.n).toBe(0);
  });

  it('keeps execution strict after a requested refresh removes current keys',async()=>{
    const database=realD1(),targets=buildResearchTargets(wine);
    seed(database,buildResearchTargets({...wine,cuveeId:null}));
    await seedResolvedResearch(database.db,'owner',await loadWineResearchCache(database.db,'owner',targets));
    const target=targets.find(target=>target.scope==='wine_vintage')!;
    database.sql.prepare('DELETE FROM research_cache WHERE owner_id=? AND scope=? AND cache_key=?').run('owner',target.scope,target.cacheKey);
    expect((await loadResearchCache(database.db,'owner',targets)).has('wine_vintage')).toBe(false);
  });

  it('isolates owners, cuvées, geography and vintages',async()=>{
    const database=realD1();seed(database,buildResearchTargets({...wine,cuveeId:null}));
    expect((await loadWineResearchCache(database.db,'another-owner',buildResearchTargets(wine))).size).toBe(0);
    for(const changed of [{vintage:2021},{wineName:'Another cru'},{appellation:'Another appellation'}]){
      expect((await loadWineResearchCache(database.db,'owner',buildResearchTargets({...wine,...changed}))).has('wine_vintage')).toBe(false);
    }
  });

  it('recovers Unicode legacy keys only for the stored subject',async()=>{
    const database=realD1(),chinese={...wine,producer:'赤恋葡萄酒',producerId:null,cuveeId:null,wineName:'珍藏红'};
    seed(database,buildLegacyResearchTargets(chinese));
    expect((await loadWineResearchCache(database.db,'owner',buildResearchTargets(chinese))).size).toBe(4);
    const other=await loadWineResearchCache(database.db,'owner',buildResearchTargets({...chinese,producer:'联合丹麓酒庄',wineName:'另一款'}));
    expect([...other.keys()]).toEqual(['vintage_context']);
  });

  it('restores lost evidence from matching snapshot text while retaining the quality gate',async()=>{
    const database=realD1(),targets=buildResearchTargets(wine),payload={...payloads.wine_vintage,winemakingTechniques:technicalClaim};
    seed(database,buildResearchTargets({...wine,cuveeId:null}));
    database.sql.prepare("UPDATE research_cache SET result_json=? WHERE scope='wine_vintage'").run(JSON.stringify(payload));
    const snapshot={...payload,...payloads.producer,...payloads.terroir,...payloads.vintage_context,sources:[{title:'Estate',url:'https://example.com/wine'}],provenance:technicalProvenance,model:'original-model',researchedAt};
    expect((await loadWineResearchCache(database.db,'owner',targets)).has('wine_vintage')).toBe(false);
    expect((await loadWineResearchCache(database.db,'owner',targets,false,{...snapshot,summary:'A different wine report.'})).has('wine_vintage')).toBe(false);
    const recovered=await loadWineResearchCache(database.db,'owner',targets,false,JSON.stringify(snapshot));
    expect(recovered.get('wine_vintage')).toMatchObject({payload,provenance:technicalProvenance});
    // Also repairs an existing current-key row whose merge lost its evidence.
    seed(database,targets.filter(target=>target.scope==='wine_vintage'));
    database.sql.prepare("UPDATE research_cache SET result_json=? WHERE scope='wine_vintage'").run(JSON.stringify(payload));
    await seedResolvedResearch(database.db,'owner',recovered);
    expect((await loadResearchCache(database.db,'owner',targets)).get('wine_vintage')).toMatchObject({payload,provenance:technicalProvenance});
  });

  it('keeps the selected result’s provenance and contributor through a producer merge and undo',async()=>{
    const database=realD1();
    for(const id of ['source','destination'])database.sql.prepare("INSERT INTO producers(id,owner_id,canonical_name,match_key,created_at,updated_at) VALUES(?,'owner',?,?,?,?)").run(id,id,id,researchedAt,researchedAt);
    const before=buildResearchTargets({...wine,producer:'source',producerId:'source',cuveeId:null}).filter(target=>target.scope==='wine_vintage');
    seed(database,before,'owner','friend');
    database.sql.prepare("UPDATE research_cache SET result_json=?,provenance_json=? WHERE scope='wine_vintage'").run(JSON.stringify({...payloads.wine_vintage,winemakingTechniques:technicalClaim}),JSON.stringify(technicalProvenance));
    const merged=await mergeProducerEntities(database.db,'owner','destination','source');
    const after=buildResearchTargets({...wine,producer:'destination',producerId:'destination',cuveeId:null});
    expect((await loadResearchCache(database.db,'owner',after)).get('wine_vintage')).toMatchObject({contributorId:'friend',provenance:technicalProvenance,researchedAt});
    await unlinkProducerMerge(database.db,'owner','destination',merged.mergeId);
    expect((await loadResearchCache(database.db,'owner',before)).get('wine_vintage')).toMatchObject({contributorId:'friend',provenance:technicalProvenance,researchedAt});
  });
});
