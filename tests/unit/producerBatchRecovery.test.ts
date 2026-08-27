import { describe,expect,it } from 'vitest';
import { catalogDefaultChunkKeys,catalogRecoveryChunkKeys,catalogStageCoverageComplete,catalogSubsliceKeysFor,shouldUseChunkedCatalogRecovery } from '../../src/lib/producers/batchResearch';

describe('producer catalogue bounded research',()=>{
  it('asks for the whole range in one request by default',()=>{
    // Grounding is billed per search the model runs, and five lettered slices
    // were five grounded requests for a producer who makes eight wines.
    expect(catalogDefaultChunkKeys).toEqual(['catalog_slice_a_z_other']);
  });

  it('keeps the lettered slices for a run that has to start over',()=>{
    // A finalize failure means the one-request range was rejected as
    // incomplete, so the retry is the exhaustive one.
    expect(catalogRecoveryChunkKeys).toEqual([
      'catalog_slice_a_e','catalog_slice_f_j','catalog_slice_k_o','catalog_slice_p_t','catalog_slice_u_z_other'
    ]);
    expect(new Set(catalogRecoveryChunkKeys).size).toBe(catalogRecoveryChunkKeys.length);
    expect(catalogStageCoverageComplete(catalogRecoveryChunkKeys)).toBe(true);
  });

  it('splits the whole range into halves that still cover it',()=>{
    // The ladder a producer only climbs when one answer will not hold the
    // range: A-Z becomes A-M and N-Z, and either half can split again.
    const halves=catalogSubsliceKeysFor('catalog_slice_a_z_other');
    expect(halves).toEqual(['catalog_slice_a_m','catalog_slice_n_z_other']);
    expect(catalogStageCoverageComplete(halves)).toBe(true);
    expect(catalogStageCoverageComplete(catalogSubsliceKeysFor('catalog_slice_a_m'))).toBe(false);
  });

  it('treats any structured catalogue parsing failure as a slice-level retry condition',()=>{
    expect(shouldUseChunkedCatalogRecovery('catalog: Invalid structured JSON (MAX_TOKENS)')).toBe(true);
    expect(shouldUseChunkedCatalogRecovery('catalog: Invalid structured JSON (STOP)')).toBe(true);
    expect(shouldUseChunkedCatalogRecovery('catalog: Structured JSON contains an embedded record fragment at root.range[0].style (STOP)')).toBe(true);
  });

  it('does not hide a simultaneous profile failure behind catalogue-only recovery',()=>{
    expect(shouldUseChunkedCatalogRecovery('profile: Invalid structured JSON (STOP); catalog: Invalid structured JSON (STOP)')).toBe(false);
  });

  it('does not classify generic transport/no-result errors as deterministic JSON failures',()=>{
    expect(shouldUseChunkedCatalogRecovery('catalog: Gemini returned no result')).toBe(false);
    expect(shouldUseChunkedCatalogRecovery(null)).toBe(false);
  });

  it('recursively subdivides only the failed alphabetical slice',()=>{
    expect(catalogSubsliceKeysFor('catalog_slice_p_t')).toEqual(['catalog_slice_p_r','catalog_slice_s_t']);
    expect(catalogSubsliceKeysFor('catalog_slice_p_r')).toEqual(['catalog_slice_p_q','catalog_slice_r_r']);
    expect(catalogSubsliceKeysFor('catalog_slice_z_z_other')).toEqual(['catalog_slice_z_z','catalog_slice_other']);
    expect(catalogSubsliceKeysFor('catalog_slice_a_a')).toEqual([]);
  });
});
