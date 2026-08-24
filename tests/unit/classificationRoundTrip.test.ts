import { describe,expect,it } from 'vitest';
import { canonicalizeWineFields } from '../../src/lib/wine/canonicalize';

type Wine={producer:string;wineName:string;country:string;region:string;appellation:string;classification:string|null};

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
