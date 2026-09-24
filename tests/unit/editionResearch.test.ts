import { describe,expect,it } from 'vitest';
import { buildResearchTargets,loadResearchCache,loadWineResearchCache,wineRowResearchTargets,type ResearchScope,type ResearchTarget } from '../../src/lib/research/cache';
import { releaseResearchContext } from '../../src/lib/research/batchWineResearch';
import { researchInputFingerprint } from '../../src/lib/credits/provider';
import { plannedUnits } from '../../worker/multiUser/credits';
import { realD1 } from './support/realD1';

const nv={producer:'Krug',producerId:'krug',cuveeId:'grande-cuvee',wineName:'Grande Cuvée',vintage:null,country:'France',region:'Champagne',appellation:'Champagne',wineStyle:'sparkling'};
const key=(targets:ResearchTarget[],scope:ResearchScope)=>targets.find(target=>target.scope===scope)?.cacheKey;
const researchedAt='2026-09-13T16:41:03.840Z';
const exactPayload={summary:'Grande Cuvée is Krug’s multi-vintage prestige blend.',expectedProfile:'Toasted brioche, citrus and hazelnut.',winemakingTechniques:'The blend composition of this release could not be verified.',drinkingWindow:'Drinks well on release and can age.'};
function seedExact(database:ReturnType<typeof realD1>,target:ResearchTarget){
  database.sql.prepare(`INSERT INTO research_cache(owner_id,scope,cache_key,subject_json,result_json,sources_json,provenance_json,model,researched_at,source_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run('owner',target.scope,target.cacheKey,JSON.stringify(target.subject),JSON.stringify(exactPayload),JSON.stringify([{title:'Krug',url:'https://www.krug.com/'}]),'{}','original-model',researchedAt,null,researchedAt,researchedAt);
}

describe('non-vintage releases are researched as their edition',()=>{
  it('keeps one generic key for a non-vintage wine with no release recorded',()=>{
    expect(key(buildResearchTargets(nv),'wine_vintage')).toBe(key(buildResearchTargets({...nv,releaseDesignation:'',baseVintage:null,disgorgement:''}),'wine_vintage'));
  });

  it('gives each edition its own exact-wine research, and nothing else changes',()=>{
    const a=buildResearchTargets({...nv,releaseDesignation:'169ème Édition'}),b=buildResearchTargets({...nv,releaseDesignation:'171ème Édition'}),generic=buildResearchTargets(nv);
    expect(key(a,'wine_vintage')).not.toBe(key(b,'wine_vintage'));
    expect(key(a,'wine_vintage')).not.toBe(key(generic,'wine_vintage'));
    expect(key(a,'producer')).toBe(key(generic,'producer'));
    expect(key(a,'terroir')).toBe(key(generic,'terroir'));
    expect(a.find(target=>target.scope==='wine_vintage')?.subject).toMatchObject({releaseDesignation:'169ème Édition'});
  });

  it('ignores edition details on a vintage wine, which its year already identifies',()=>{
    const vintage={...nv,vintage:2008};
    expect(buildResearchTargets({...vintage,releaseDesignation:'Clos du Mesnil',disgorgement:'2021'})).toEqual(buildResearchTargets(vintage));
  });

  it('researches a base year’s vintage context under that year’s shared key',()=>{
    const release=buildResearchTargets({...nv,releaseDesignation:'171ème Édition',baseVintage:2015}),vintage2015=buildResearchTargets({...nv,vintage:2015});
    expect(key(release,'vintage_context')).toBe(key(vintage2015,'vintage_context'));
    expect(release.find(target=>target.scope==='vintage_context')?.identity?.vintage).toBe(2015);
  });

  it('asks for no vintage section for a blend with no base year',()=>{
    expect(buildResearchTargets({...nv,releaseDesignation:'Iteration 25'}).map(target=>target.scope)).not.toContain('vintage_context');
  });

  it('reads edition details from a wine row and its sparkling details',()=>{
    const row={producer:nv.producer,producer_id:nv.producerId,cuvee_id:nv.cuveeId,wine_name:nv.wineName,vintage:null,country:nv.country,region:nv.region,appellation:nv.appellation,wine_style:nv.wineStyle,
      release_designation:'171ème Édition',sparkling_details_json:JSON.stringify({baseVintage:2015,disgorgement:'Winter 2023'})};
    expect(wineRowResearchTargets(row)).toEqual(buildResearchTargets({...nv,releaseDesignation:'171ème Édition',baseVintage:2015,disgorgement:'Winter 2023'}));
  });
});

describe('research saved before editions were keyed',()=>{
  const edition={...nv,releaseDesignation:'171ème Édition'};
  it('stays on the page and free until refreshed',async()=>{
    const database=realD1();
    seedExact(database,buildResearchTargets(nv).find(target=>target.scope==='wine_vintage')!);
    const targets=buildResearchTargets(edition);
    // Views and quotes read the generic key; strict execution reads after a refresh do not.
    expect((await loadWineResearchCache(database.db,'owner',targets)).get('wine_vintage')?.payload).toMatchObject(exactPayload);
    expect((await loadResearchCache(database.db,'owner',targets)).has('wine_vintage')).toBe(false);
    database.sql.prepare(`INSERT INTO wines(id,owner_id,producer,producer_id,cuvee_id,wine_name,vintage,country,region,appellation,wine_style,release_designation,created_at,updated_at) VALUES('nv','owner',?,?,?,?,NULL,?,?,?,?,?,'now','now')`)
      .run(nv.producer,nv.producerId,nv.cuveeId,nv.wineName,nv.country,nv.region,nv.appellation,nv.wineStyle,edition.releaseDesignation);
    const request=(refresh='none')=>new Request('https://wine.example/api/wines/nv/deep-search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({refresh})});
    expect((await plannedUnits(request(),database.db,'owner')).map(unit=>unit.scope)).not.toContain('wine_vintage');
    expect((await plannedUnits(request('vintage'),database.db,'owner')).map(unit=>unit.scope)).toContain('wine_vintage');
  });
});

describe('what the research is told about a release',()=>{
  const base={vintage:null,release_designation:null,sparkling_details_json:null,vintage_kind:null};
  it('says nothing for a vintage wine',()=>{
    expect(releaseResearchContext({...base,vintage:2015,release_designation:'Ignored'})).toBe('');
  });
  it('names the edition, base year and disgorgement, and researches the base year as such',()=>{
    const text=releaseResearchContext({...base,release_designation:'171ème Édition',sparkling_details_json:JSON.stringify({baseVintage:2015,disgorgement:'Winter 2023'})});
    expect(text).toContain('edition/release "171ème Édition", base vintage 2015, disgorged Winter 2023');
    expect(text).toContain('never attribute another edition');
    expect(text).toContain('research the 2015 growing season as the base year');
  });
  it('asks a multi-vintage blend for its harvest years without inventing any',()=>{
    const text=releaseResearchContext({...base,vintage_kind:'multi_vintage'});
    expect(text).toContain('a multi-vintage blend');
    expect(text).toContain('No edition, base vintage or disgorgement is recorded');
    expect(text).toContain('Do not invent years');
    expect(text).not.toContain('growing season');
  });
});

describe('the credit fingerprint',()=>{
  it('is unchanged for a wine with no edition, so queued runs survive the deploy',async()=>{
    const row={producer:'Krug',wine_name:'Grande Cuvée',vintage:null,country:'France',region:'Champagne',appellation:'Champagne',wine_style:'sparkling',grapes_json:'[]',grape_blend_json:'[]'};
    expect(await researchInputFingerprint('wine',{...row,release_designation:null})).toBe(await researchInputFingerprint('wine',row));
    expect(await researchInputFingerprint('wine',{...row,release_designation:'171ème Édition'})).not.toBe(await researchInputFingerprint('wine',row));
  });
});
