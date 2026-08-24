import { describe,expect,it } from 'vitest';
import { canonicalizeWineFields } from '../../src/lib/wine/canonicalize';

type Wine={producer:string;wineName:string;country:string;region:string;appellation:string;classification:string|null;classificationOverride?:string|null};

const save=(wine:Wine)=>canonicalizeWineFields(wine);
const burgundy=(over:Partial<Wine>):Wine=>
  ({producer:'Domaine Dujac',wineName:'',appellation:'',country:'France',region:'Burgundy',classification:null,...over});

describe('The cru tier surviving an edit',()=>{
  it('does not downgrade a premier cru when the wine is saved again',()=>{
    // Normalising the place consumes the "1er Cru" marker, so on the second save
    // nothing says premier cru any more and the tree's village reading took over.
    const first=save(burgundy({wineName:'Les Suchots',appellation:'Vosne-Romanée 1er Cru Les Suchots'}));
    expect(first).toMatchObject({appellation:'Vosne-Romanée',classification:'premier_cru'});
    expect(save({...first}).classification).toBe('premier_cru');
    expect(save({...save({...first})}).classification).toBe('premier_cru');
  });

  it('holds a grand cru and a village across a re-save too',()=>{
    const grand=save(burgundy({wineName:'Charmes-Chambertin',appellation:'Charmes-Chambertin'}));
    expect(save({...grand}).classification).toBe('grand_cru');
    const village=save(burgundy({wineName:'Vosne-Romanée',appellation:'Vosne-Romanée'}));
    expect(save({...village}).classification).toBe('village');
  });

  it('lets a corrected appellation correct the tier with it',()=>{
    // A stored tier must not outlive the place it described, in either direction.
    expect(save(burgundy({wineName:'x',appellation:'Charmes-Chambertin',classification:'village'})).classification).toBe('grand_cru');
    expect(save(burgundy({wineName:'x',appellation:'Vosne-Romanée',classification:'grand_cru'})).classification).toBe('village');
  });

  it('still lets the label text override what was stored',()=>{
    expect(save(burgundy({wineName:'Les Suchots 1er Cru',appellation:'Vosne-Romanée',classification:'village'})).classification).toBe('premier_cru');
  });

  it('reports no tier where the country has no such system',()=>{
    expect(save({producer:'Ridge',wineName:'Monte Bello',country:'United States',region:'Napa Valley',appellation:'Oakville',classification:null}).classification).toBeNull();
  });
});

describe('A cru tier set by hand',()=>{
  it('sticks where the derivation cannot read the label',()=>{
    // "Vosne Romanee Suchots" names no cru marker, so nothing can say premier
    // cru - the case the select exists for.
    expect(save(burgundy({wineName:'Suchots',appellation:'Vosne Romanee Suchots'})).classification).toBeNull();
    expect(save(burgundy({wineName:'Suchots',appellation:'Vosne Romanee Suchots',classificationOverride:'premier_cru'})).classification).toBe('premier_cru');
  });

  it('outranks the tree and the label text alike',()=>{
    expect(save(burgundy({wineName:'x',appellation:'Charmes-Chambertin',classificationOverride:'premier_cru'})).classification).toBe('premier_cru');
    expect(save(burgundy({wineName:'Les Suchots 1er Cru',appellation:'Vosne-Romanée',classificationOverride:'village'})).classification).toBe('village');
  });

  it('can clear a tier the tree insists on',()=>{
    // Without a "none" the village reading could never be removed by hand.
    expect(save(burgundy({wineName:'x',appellation:'Vosne-Romanée'})).classification).toBe('village');
    expect(save(burgundy({wineName:'x',appellation:'Vosne-Romanée',classificationOverride:'none'})).classification).toBeNull();
  });

  it('survives a re-save, and releases the field when set back to auto',()=>{
    const held=burgundy({wineName:'x',appellation:'Charmes-Chambertin',classificationOverride:'premier_cru',classification:'premier_cru'});
    expect(save(held).classification).toBe('premier_cru');
    expect(save({...held,classificationOverride:null}).classification).toBe('grand_cru');
  });
});
