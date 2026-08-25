import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { applyCatalogDecisions,catalogDecisionKey,catalogDecisionLabel,normalizeCatalogDecision,resolveCatalogDecisionTarget,type CatalogDecision } from '../../src/lib/producers/catalogDecisions';
import { mergeCatalogRanges,suspiciousCatalogShrink } from '../../src/lib/producers/researchQuality';

const names=['Domaine Dujac'];
const decision=(over:Partial<CatalogDecision>&{sourceKey:string}):CatalogDecision=>({
  id:over.sourceKey,decision:over.decision??'hide',sourceKey:over.sourceKey,sourceName:over.sourceName??over.sourceKey,
  targetKey:over.targetKey??null,targetName:over.targetName??null,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'
});

describe('producer catalogue corrections',()=>{
  it('shares one identity key with the storage-time dedupe',()=>{
    const a={name:'Domaine Dujac Clos de la Roche',category:'red',appellation:'Clos de la Roche'};
    const b={name:'Clos de la Roche',category:'red',appellation:'Clos de la Roche'};
    expect(catalogDecisionKey(a,names)).toBe(catalogDecisionKey(b,names));
    expect(mergeCatalogRanges([],[a,b],150,names).range).toHaveLength(1);
  });

  it('collapses 1er and premier spellings but keeps a different cru apart',()=>{
    const first={name:'Morey-Saint-Denis 1er Cru Les Monts Luisants',category:'red'};
    const second={name:'Morey-Saint-Denis Premier Cru Les Monts Luisants',category:'red'};
    const village={name:'Morey-Saint-Denis',category:'red'};
    expect(catalogDecisionKey(first,names)).toBe(catalogDecisionKey(second,names));
    expect(catalogDecisionKey(first,names)).not.toBe(catalogDecisionKey(village,names));
  });

  it('never merges wines that differ only by style',()=>{
    const red={name:'Les Monts Luisants',category:'red'},white={name:'Les Monts Luisants',category:'white'};
    expect(catalogDecisionKey(red,names)).not.toBe(catalogDecisionKey(white,names));
    expect(mergeCatalogRanges([],[red,white],150,names).range).toHaveLength(2);
  });

  it('hides a wine and folds a merged duplicate into the wine that is kept',()=>{
    const keep={name:'Clos de la Roche',category:'red',appellation:'Clos de la Roche',notes:null,classification:null,style:null};
    const duplicate={name:'Clos de la Roche Grand Cru',category:'red',appellation:null,notes:null,classification:'Grand Cru',style:null};
    const junk={name:'Assorted bottles',category:'other',appellation:null,notes:null,classification:null,style:null};
    const decisions=[
      decision({sourceKey:catalogDecisionKey(duplicate,names),decision:'merge',targetKey:catalogDecisionKey(keep,names)}),
      decision({sourceKey:catalogDecisionKey(junk,names),decision:'hide'})
    ];
    const result=applyCatalogDecisions([keep,duplicate,junk],decisions,names);
    expect(result.range.map(item=>item.name)).toEqual(['Clos de la Roche']);
    expect(result.hiddenCount).toBe(1);
    expect(result.mergedCount).toBe(1);
    // The duplicate contributes what the surviving row left blank.
    expect(result.range[0].classification).toBe('Grand Cru');
  });

  it('drops a merged duplicate when its target is no longer in the range',()=>{
    const duplicate={name:'Clos de la Roche Grand Cru',category:'red'};
    const decisions=[decision({sourceKey:catalogDecisionKey(duplicate,names),decision:'merge',targetKey:'missing-target'})];
    const result=applyCatalogDecisions([duplicate],decisions,names);
    expect(result.range).toHaveLength(0);
    expect(result.hiddenCount).toBe(1);
  });

  it('follows a merge chain and refuses to hang on a cycle',()=>{
    const chain=[decision({sourceKey:'a',decision:'merge',targetKey:'b'}),decision({sourceKey:'b',decision:'merge',targetKey:'c'})];
    expect(resolveCatalogDecisionTarget('a',chain)).toEqual({key:'c',hidden:false});
    const cycle=[decision({sourceKey:'a',decision:'merge',targetKey:'b'}),decision({sourceKey:'b',decision:'merge',targetKey:'a'})];
    expect(resolveCatalogDecisionTarget('a',cycle).hidden).toBe(false);
  });

  it('leaves an untouched range exactly as it was',()=>{
    const range=[{name:'Clos de la Roche',category:'red'}];
    expect(applyCatalogDecisions(range,[],names).range).toBe(range);
  });

  it('rejects malformed corrections',()=>{
    expect(()=>normalizeCatalogDecision({decision:'delete',sourceKey:'a'})).toThrow(/merge or hide/i);
    expect(()=>normalizeCatalogDecision({decision:'hide',sourceKey:'  '})).toThrow(/could not be identified/i);
    expect(()=>normalizeCatalogDecision({decision:'merge',sourceKey:'a'})).toThrow(/wine to keep/i);
    expect(()=>normalizeCatalogDecision({decision:'merge',sourceKey:'a',targetKey:'a'})).toThrow(/into itself/i);
    expect(normalizeCatalogDecision({decision:'hide',sourceKey:'a',sourceName:'Clos A',targetKey:'b'})).toEqual({decision:'hide',sourceKey:'a',sourceName:'Clos A',targetKey:null,targetName:null});
  });

  it('labels a row by cuvee and appellation without repeating the same text',()=>{
    expect(catalogDecisionLabel({name:'Domaine Dujac Clos de la Roche',appellation:'Clos de la Roche'},names)).toBe('Clos de la Roche');
    expect(catalogDecisionLabel({name:'Les Monts Luisants',appellation:'Morey-Saint-Denis 1er Cru'},names)).toBe('Les Monts Luisants · Morey-Saint-Denis 1er Cru');
  });

  it('does not read resolved duplicates as a suspicious catalogue shrink',()=>{
    // A range of 20 where the owner has hidden 12 duplicates. Research returns
    // the same 20 wines; the completeness guard must compare both sides after
    // the corrections, or resolving duplicates would reject every future run.
    const range=Array.from({length:20},(_,index)=>({name:`Cuvee ${index}`,category:'red'}));
    const decisions=range.slice(8).map(wine=>decision({sourceKey:catalogDecisionKey(wine,names),decision:'hide'}));
    const corrected=applyCatalogDecisions(range,decisions,names).range.length;
    expect(corrected).toBe(8);
    expect(suspiciousCatalogShrink(corrected,corrected)).toBe(false);
    // Comparing the stored pre-correction count against the corrected one is
    // what used to trip the guard.
    expect(suspiciousCatalogShrink(range.length,corrected)).toBe(true);
  });

  it('stores corrections without touching researched producer data',()=>{
    const sql=readFileSync('src/lib/db/migrations/0035_producer_catalog_decisions.sql','utf8');
    expect(sql).toContain('CREATE TABLE producer_catalog_decisions');
    expect(sql).toContain("CHECK(decision IN ('merge','hide'))");
    expect(sql).toContain('idx_producer_catalog_decisions_source');
    expect(sql).not.toMatch(/UPDATE\s+producers/i);
    expect(sql).not.toMatch(/DELETE\s+FROM\s+producers/i);
  });
});
