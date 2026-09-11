import { describe,expect,it } from 'vitest';
import { buildWineSemanticDocument,cosineSimilarity,rankSemanticCandidates,shouldUseSemanticQuery } from '../../src/lib/journal/semanticSearch';

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

  it('ranks exact cosine similarity without changing the vectors',()=>{
    const query=[1,0,0];
    expect(cosineSimilarity(query,[1,0,0])).toBeCloseTo(1);
    expect(cosineSimilarity(query,[0,1,0])).toBeCloseTo(0);
    expect(cosineSimilarity(query,[1,0])).toBe(-1);
    expect(rankSemanticCandidates(query,[
      {id:'orthogonal',vector:[0,1,0]},
      {id:'close',vector:[0.9,0.1,0]},
      {id:'exact',vector:[1,0,0]}
    ]).map(item=>item.id)).toEqual(['exact','close','orthogonal']);
  });
});
