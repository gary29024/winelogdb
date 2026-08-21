import { describe,expect,it } from 'vitest';
import { catalogDefaultChunkKeys,catalogSubsliceKeysFor,shouldUseChunkedCatalogRecovery } from '../../src/lib/producers/batchResearch';

describe('producer catalogue bounded research',()=>{
  it('uses bounded alphabetical catalogue slices by default',()=>{
    expect(catalogDefaultChunkKeys).toEqual([
      'catalog_slice_a_e','catalog_slice_f_j','catalog_slice_k_o','catalog_slice_p_t','catalog_slice_u_z_other'
    ]);
    expect(new Set(catalogDefaultChunkKeys).size).toBe(catalogDefaultChunkKeys.length);
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
