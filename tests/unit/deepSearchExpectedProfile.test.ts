import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { deepSearchSchema } from '../../src/lib/db/schema';
import { assessResearchField,assessResearchScope,legacyOptionalFieldMissing } from '../../src/lib/research/qualityGate';
import { buildResearchTargets,fieldsForScope,scopeIsComplete,splitDeepSearchResult } from '../../src/lib/research/cache';

const sources=[{title:'decanter.com',url:'https://www.decanter.com/wine-reviews/example'}];
const subject={producer:'Domaine Test',wineName:'Clos Test',vintage:2021,appellation:'Volnay',region:'Burgundy',country:'France'};

describe('Deep Search expected profile',()=>{
  it('keeps legacy wine-vintage caches reusable while requiring the field when it is explicitly present',()=>{
    const legacy={summary:'A precise Volnay.',winemakingTechniques:'For 2021, exact-vintage élevage was verified.',drinkingWindow:'Drink from 2026 to 2038.'};
    expect(legacyOptionalFieldMissing('expectedProfile',legacy)).toBe(true);
    expect(scopeIsComplete('wine_vintage',legacy)).toBe(true);
    expect(assessResearchScope('wine_vintage',legacy,subject,sources).fields.expectedProfile).toBeUndefined();

    const current={...legacy,expectedProfile:''};
    expect(legacyOptionalFieldMissing('expectedProfile',current)).toBe(false);
    expect(scopeIsComplete('wine_vintage',current)).toBe(false);
    expect(assessResearchScope('wine_vintage',current,subject,sources).warnings).toContain('missing-field');
  });

  it('accepts forward drinking horizons in sensory prose but still rejects an older competing vintage',()=>{
    const horizon=assessResearchField('expectedProfile','Red cherry, violet and fine tannins. Best from 2026 to 2032.',subject,sources);
    expect(horizon.pass).toBe(true);
    expect(horizon.warnings).not.toContain('wrong-vintage-reference');

    const wrongVintage=assessResearchField('expectedProfile','The 2020 shows red cherry, violet and fine tannins.',subject,sources);
    expect(wrongVintage.pass).toBe(false);
    expect(wrongVintage.warnings).toContain('wrong-vintage-reference');
  });

  it('accepts old stored Deep Search JSON without inventing an expected profile',()=>{
    const parsed=deepSearchSchema.parse({
      summary:'A precise Volnay.',vintageQuality:'2021 was a cool Burgundy vintage.',producerDetails:'Small family domaine.',
      producerWinemakingPractices:'Parcel-led farming and cellar work.',winemakingTechniques:'For 2021, exact-vintage élevage was verified.',
      terroir:'Limestone and clay soils.',drinkingWindow:'Drink from 2026 to 2038.',sources,model:'legacy',researchedAt:'2026-09-11T00:00:00.000Z'
    });
    expect(parsed.expectedProfile).toBeUndefined();
  });

  it('stores the grounded sensory expectation inside the existing wine-vintage scope',()=>{
    expect(fieldsForScope('wine_vintage')).toEqual(['summary','expectedProfile','winemakingTechniques','drinkingWindow']);
    const result=deepSearchSchema.parse({
      summary:'A precise Volnay with fine structure.',
      expectedProfile:'Expect red cherry and violet aromas, bright acidity, fine tannins and a savoury, mineral finish. Best from 2026 to 2032.',
      vintageQuality:'2021 was a cool Burgundy vintage with a later harvest.',
      producerDetails:'Small family domaine focused on site expression.',
      producerWinemakingPractices:'Parcel-led farming and cellar work vary by cuvée.',
      winemakingTechniques:'For 2021, exact-vintage élevage was verified from published commentary.',
      terroir:'The site has limestone and clay soils.',
      drinkingWindow:'Drink from 2026 to 2038.',
      sources,model:'gemini-test',researchedAt:'2026-09-11T00:00:00.000Z'
    });
    const targets=buildResearchTargets(subject);
    const wineVintage=splitDeepSearchResult(result,targets).find(entry=>entry.target.scope==='wine_vintage');
    expect(wineVintage?.payload.expectedProfile).toContain('red cherry');
  });

  it('keeps source reuse in the same API request and surfaces the section before vintage quality',()=>{
    const batch=readFileSync('src/lib/research/batchWineResearch.ts','utf8');
    expect(batch).toContain('Reuse pages already retrieved for this exact-wine scope before issuing additional searches for expectedProfile');
    expect(batch).toContain('exactly these eight string fields: summary, expectedProfile');
    expect(batch).toContain("const exactPayload=payloadFor('wine_vintage')");
    expect(batch).toContain('const DEEP_SEARCH_OUTPUT_TOKENS=16384');
    expect(batch).toContain("finishReason==='MAX_TOKENS'");
    expect(batch).toContain('the previous answer hit the output limit');

    const detail=readFileSync('src/features/wines/DetailPage.tsx','utf8');
    const expected=detail.indexOf("['What to expect','expectedProfile'");
    const vintage=detail.indexOf("['Vintage quality','vintageQuality'");
    expect(expected).toBeGreaterThan(-1);
    expect(vintage).toBeGreaterThan(expected);
  });
});
