import { describe,expect,it } from 'vitest';
import { catalogDefaultChunkKeys,catalogStageCoverageComplete,catalogSubsliceKeysFor } from '../../src/lib/producers/batchResearch';
import { catalogTextQualityIssue,suspiciousCatalogShrink } from '../../src/lib/producers/researchQuality';

describe('producer catalog atomic refresh',()=>{
  it('requires full A-Z plus non-letter coverage before commit',()=>{
    expect(catalogStageCoverageComplete(catalogDefaultChunkKeys)).toBe(true);
    expect(catalogStageCoverageComplete(catalogDefaultChunkKeys.slice(0,-1))).toBe(false);
  });

  it('accepts recursively split slices as equivalent coverage',()=>{
    const split=catalogSubsliceKeysFor('catalog_slice_p_t');
    const keys=catalogDefaultChunkKeys.filter(key=>key!=='catalog_slice_p_t').concat(split);
    expect(split).toEqual(['catalog_slice_p_r','catalog_slice_s_t']);
    expect(catalogStageCoverageComplete(keys)).toBe(true);
  });

  it('rejects repeated-character degeneration before staging',()=>{
    expect(catalogTextQualityIssue('Sparkling brut natureOOOOOOOOOOOOOOOOOOOO','style',80)).toMatch(/repeated-character/i);
    expect(catalogTextQualityIssue('Still dry red','style',80)).toBeNull();
  });

  it('guards against implausible range collapse while allowing normal changes',()=>{
    expect(suspiciousCatalogShrink(43,16)).toBe(true);
    expect(suspiciousCatalogShrink(43,30)).toBe(false);
    expect(suspiciousCatalogShrink(6,2)).toBe(false);
  });
});
