import { describe,expect,it } from 'vitest';
import { ensureWineIdentity,wineIdentityResolved } from '../../src/lib/wine/identity';
import { linkWineCuvee } from '../../src/lib/cuvees/entities';
import { createD1Stub } from './support/d1Stub';

const linkedWine={producer:'Domaine Dujac',producer_id:'producer-1',cuvee_id:'cuvee-1',country:'France'};

describe('D1 cost of reading a wine',()=>{
  it('treats a wine with both entity links as already resolved',()=>{
    expect(wineIdentityResolved(linkedWine)).toBe(true);
    expect(wineIdentityResolved({producer_id:'producer-1',cuvee_id:null})).toBe(false);
    expect(wineIdentityResolved({producer_id:null,cuvee_id:'cuvee-1'})).toBe(false);
  });

  it('costs one indexed read and no writes when the wine is already linked',async()=>{
    const stub=createD1Stub(sql=>/FROM wines WHERE owner_id=\? AND id=\?/.test(sql)?{first:linkedWine}:undefined);
    await ensureWineIdentity(stub.db,'owner','wine-1');
    expect(stub.calls).toHaveLength(1);
    expect(stub.writes()).toHaveLength(0);
  });

  it('still backfills a wine that has no cuvee identity yet',async()=>{
    const stub=createD1Stub(sql=>/FROM wines WHERE owner_id=\? AND id=\?/.test(sql)?{first:{...linkedWine,cuvee_id:null}}:undefined);
    await ensureWineIdentity(stub.db,'owner','wine-1');
    expect(stub.calls.length).toBeGreaterThan(1);
  });

  it('does not rewrite a wine whose cuvee link and name already match',async()=>{
    const stub=createD1Stub(sql=>{
      if(/SELECT id,producer_id,cuvee_id,wine_name/.test(sql))return {first:{id:'wine-1',producer_id:'producer-1',cuvee_id:'cuvee-1',wine_name:'Clos de la Roche',recognized_wine_name:'Clos de la Roche',appellation:'Morey-Saint-Denis',wine_style:'red'}};
      if(/FROM producers WHERE owner_id=\? AND id=\?/.test(sql))return {first:{canonical_name:'Domaine Dujac'}};
      if(/FROM producer_aliases/.test(sql))return {all:[{display_alias:'Domaine Dujac'}]};
      if(/FROM cuvee_aliases a JOIN cuvees c/.test(sql))return {first:{id:'cuvee-1',producer_id:'producer-1',canonical_name:'Clos de la Roche',signature_key:'clos de la roche morey saint denis::style:red',appellation:'Morey-Saint-Denis',wine_style:'red',catalog_backed:0}};
      return undefined;
    });
    const entity=await linkWineCuvee(stub.db,'owner','wine-1');
    expect(entity?.id).toBe('cuvee-1');
    expect(stub.matching(/^update wines/i)).toHaveLength(0);
  });
});
