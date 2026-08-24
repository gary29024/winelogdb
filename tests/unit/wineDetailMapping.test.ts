import { describe,expect,it } from 'vitest';
import { mapWine } from '../../worker/index';

const row=(over:Record<string,unknown>={})=>({
  id:'w1',owner_id:'o',producer:'Domaine Dujac',wine_name:'Charmes-Chambertin',vintage:2018,
  country:'France',region:'Burgundy',appellation:'Charmes-Chambertin',classification:'grand_cru',
  grapes_json:'["Pinot Noir"]',grape_blend_json:'[]',wine_style:'red',tasting_notes:'',
  tags_json:'[]',recognition_status:'complete',created_at:'2026-01-01',updated_at:'2026-01-01',...over
});

describe('Wine detail row mapping',()=>{
  it('carries the cru tier through to the response',()=>{
    // The detail route selects w.*, so the column was always in the row - it just
    // never got copied into the response, and the field was write-only.
    expect(mapWine(row())).toMatchObject({classification:'grand_cru',appellation:'Charmes-Chambertin'});
  });

  it('reports no tier as null rather than undefined',()=>{
    expect(mapWine(row({classification:null})).classification).toBeNull();
    expect(mapWine(row({classification:undefined})).classification).toBeNull();
  });

  it('still carries the place fields beside it',()=>{
    expect(mapWine(row())).toMatchObject({country:'France',region:'Burgundy'});
  });
});
