import { describe,expect,it } from 'vitest';
import { cellarPatchSchema } from '../../src/lib/cellar/schema';
import { mapHolding,updateHolding } from '../../src/lib/cellar/holdings';
import { maturityFor } from '../../src/lib/maturity/ageing';
import { createD1Stub } from './support/d1Stub';

/** What the edit sheet actually sends: no classification, because it has no field for one. */
const sent={producer:'Domaine Dujac',wineName:'Charmes-Chambertin Grand Cru',vintage:2013,
  country:'France',region:'Burgundy',appellation:'Charmes-Chambertin',wineStyle:'red',
  bottles:1,bottleSizeMl:750,purchasePrice:null,currency:null,purchasedAt:null,
  merchant:null,location:'Rack 1',notes:''};

const stored=(overrides:Record<string,unknown>={})=>({
  id:'h1',producer_id:null,cuvee_id:null,producer:'Domaine Dujac',wine_name:'Charmes-Chambertin Grand Cru',
  vintage:2013,country:'France',region:'Burgundy',appellation:'Charmes-Chambertin',wine_style:'red',
  classification:'grand_cru',bottles:1,bottle_size_ml:750,purchase_price:null,currency:null,
  purchased_at:null,merchant:null,location:'Rack 1',notes:'',
  created_at:'2026-09-01T00:00:00.000Z',updated_at:'2026-09-01T00:00:00.000Z',...overrides});

describe('a correction must not forget the cru tier',()=>{
  it('does not invent a classification the form never sent',()=>{
    // The bug: the patch shape was the insert shape made partial, and
    // classification defaults to null there - so a form with no field for it
    // was telling the row to forget its own tier.
    const parsed=cellarPatchSchema.parse(sent) as Record<string,unknown>;
    expect('classification' in parsed).toBe(false);
  });

  it('leaves a grand cru a grand cru after an ordinary edit',async()=>{
    const db=createD1Stub(sql=>/FROM cellar_holdings/.test(sql)?{first:stored()}:undefined);
    await updateHolding(db.db,'owner','h1',cellarPatchSchema.parse({...sent,location:'Rack 4'}));
    const [write]=db.writes();
    // classification is the eighth column in the UPDATE
    expect(write.args[7]).toBe('grand_cru');
  });

  it('moves the tier when the appellation is corrected',async()=>{
    // The other half: promoting a village wine to the grand cru it actually is
    // has to move the window with it.
    const db=createD1Stub(sql=>/FROM cellar_holdings/.test(sql)
      ?{first:stored({appellation:'Gevrey-Chambertin',classification:'village'})}:undefined);
    await updateHolding(db.db,'owner','h1',cellarPatchSchema.parse({...sent,appellation:'Charmes-Chambertin'}));
    expect(db.writes()[0].args[7]).toBe('grand_cru');
  });

  it('is what stands between eight-to-twenty-five years and four-to-twelve',()=>{
    const wine={appellation:'Charmes-Chambertin',wineStyle:'red'};
    expect(maturityFor({...wine,classification:'grand_cru'})?.window).toEqual({from:8,to:25});
    expect(maturityFor({...wine,classification:null})?.window).toEqual({from:4,to:12});
  });
});

describe('a tier already forgotten',()=>{
  it('comes back on the next read, without waiting for an edit',()=>{
    // The rows the bug had already reached. Deriving is a place-tree lookup,
    // so it costs nothing and cannot be wrong about a wine whose appellation
    // says what it is.
    expect(mapHolding(stored({classification:null})).classification).toBe('grand_cru');
  });

  it('still invents nothing for a place that carries no tier',()=>{
    expect(mapHolding(stored({appellation:'Etna',region:'Sicily',country:'Italy',classification:null})).classification).toBeNull();
  });

  it('does not overrule a tier that is stored',()=>{
    expect(mapHolding(stored({classification:'premier_cru'})).classification).toBe('premier_cru');
  });
});
