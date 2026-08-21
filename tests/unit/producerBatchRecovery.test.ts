import { describe,expect,it } from 'vitest';
import { catalogRecoveryChunkKeys,shouldUseChunkedCatalogRecovery } from '../../src/lib/producers/batchResearch';

describe('producer catalogue batch recovery',()=>{
  it('switches deterministic oversized catalogue output to chunked recovery',()=>{
    expect(shouldUseChunkedCatalogRecovery('catalog: Invalid structured JSON (MAX_TOKENS)')).toBe(true);
  });

  it('switches strong embedded-record corruption to chunked recovery',()=>{
    expect(shouldUseChunkedCatalogRecovery('catalog: Structured JSON contains an embedded record fragment at root.range[0].style (STOP)')).toBe(true);
  });

  it('does not hide a simultaneous profile failure behind catalogue recovery',()=>{
    expect(shouldUseChunkedCatalogRecovery('profile: Invalid structured JSON (STOP); catalog: Invalid structured JSON (MAX_TOKENS)')).toBe(false);
  });

  it('does not chunk ordinary transient or generic catalogue failures',()=>{
    expect(shouldUseChunkedCatalogRecovery('catalog: Gemini returned no result')).toBe(false);
    expect(shouldUseChunkedCatalogRecovery(null)).toBe(false);
  });

  it('uses bounded non-overlapping recovery slices',()=>{
    expect(catalogRecoveryChunkKeys).toEqual([
      'catalog_chunk_a_e','catalog_chunk_f_j','catalog_chunk_k_o','catalog_chunk_p_t','catalog_chunk_u_z_other'
    ]);
    expect(new Set(catalogRecoveryChunkKeys).size).toBe(catalogRecoveryChunkKeys.length);
  });
});
