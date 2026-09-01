import { describe,expect,it } from 'vitest';
import { addHolding,cellarMatchKey,takeBottleFromHolding,updateHolding } from '../../src/lib/cellar/holdings';
import { cellarInputSchema } from '../../src/lib/cellar/schema';
import { listCellarPage } from '../../src/lib/cellar/list';
import { createD1Stub,type StubReply } from './support/d1Stub';

const input=(overrides:Record<string,unknown>={})=>cellarInputSchema.parse({
  producer:'Cusumano',wineName:'Feudo di Mezzo',vintage:2020,country:null,region:null,
  appellation:'Etna',wineStyle:'red',classification:null,currency:'HKD',
  bottles:6,bottleSizeMl:750,purchasePrice:280,purchasedAt:'2026-08-01',
  merchant:'Watson',location:'Rack 3',notes:'',...overrides
});

const holdingRow=(overrides:Record<string,unknown>={})=>({
  id:'h1',producer_id:'p1',cuvee_id:'c1',producer:'Cusumano',wine_name:'Feudo di Mezzo',vintage:2020,
  country:'Italy',region:'Sicily',appellation:'Etna',wine_style:'red',classification:null,
  bottles:6,bottle_size_ml:750,purchase_price:280,currency:'HKD',purchased_at:'2026-08-01',
  merchant:'Watson',location:'Rack 3',notes:'',created_at:'2026-08-01T00:00:00.000Z',updated_at:'2026-08-01T00:00:00.000Z',...overrides
});

function stub(reply:(sql:string)=>StubReply|undefined=()=>undefined){
  return createD1Stub(sql=>reply(sql));
}

describe('the identity a holding is filed under',()=>{
  it('reads a producer prefix on the wine name as the same wine',()=>{
    expect(cellarMatchKey('Cusumano','Cusumano Feudo di Mezzo',2020,750))
      .toBe(cellarMatchKey('Cusumano','Feudo di Mezzo',2020,750));
  });

  it('keeps two vintages of one wine apart',()=>{
    expect(cellarMatchKey('Cusumano','Feudo di Mezzo',2020,750))
      .not.toBe(cellarMatchKey('Cusumano','Feudo di Mezzo',2017,750));
  });

  it('keeps a magnum apart from three more bottles',()=>{
    expect(cellarMatchKey('Cusumano','Feudo di Mezzo',2020,1500))
      .not.toBe(cellarMatchKey('Cusumano','Feudo di Mezzo',2020,750));
  });

  it('files a wine with no vintage under NV rather than under nothing',()=>{
    expect(cellarMatchKey('Krug','Grande Cuvée',null,750)).toContain('NV');
  });
});

describe('putting bottles away',()=>{
  it('matches an existing producer and cuvée without creating either',async()=>{
    const db=stub(sql=>{
      if(/FROM cellar_holdings WHERE owner_id=\? AND match_key=\?/.test(sql))return {first:null};
      if(/FROM producer_aliases a JOIN producers p/.test(sql))return {first:{id:'p1',canonical_name:'Cusumano',researched_at:null,display_alias:'Cusumano',catalog_count:0,tasted_count:3}};
      if(/FROM cuvee_aliases a JOIN cuvees c/.test(sql))return {first:{id:'c1',producer_id:'p1',canonical_name:'Feudo di Mezzo',signature_key:'k',appellation:'Etna',wine_style:'red',catalog_backed:0,created_at:'x'}};
      if(/SELECT DISTINCT vintage FROM wines/.test(sql))return {all:[]};
      if(/count\(\*\) AS count FROM wines/.test(sql))return {first:{count:1}};
      return undefined;
    });
    const holding=await addHolding(db.db,'owner',input());
    expect(holding.producerId).toBe('p1');
    expect(holding.cuveeId).toBe('c1');
    expect(db.writes().some(call=>/INSERT INTO producers|INSERT INTO cuvees/.test(call.sql))).toBe(false);
  });

  it('leaves the identity unresolved for a producer never drunk, rather than inventing one',async()=>{
    const db=stub(sql=>/FROM cellar_holdings/.test(sql)?{first:null}:undefined);
    const holding=await addHolding(db.db,'owner',input({producer:'Somewhere New'}));
    expect(holding.producerId).toBeNull();
    expect(holding.cuveeId).toBeNull();
    expect(db.writes().filter(call=>/INSERT INTO/.test(call.sql)).map(call=>call.sql.match(/INSERT INTO (\w+)/)?.[1]))
      .toEqual(['cellar_holdings']);
  });

  it('adds to the line you already hold instead of opening a second one',async()=>{
    const db=stub(sql=>/FROM cellar_holdings WHERE owner_id=\? AND match_key=\?/.test(sql)?{first:holdingRow()}:undefined);
    const holding=await addHolding(db.db,'owner',input({bottles:6}));
    expect(holding.bottles).toBe(12);
    const [write]=db.writes();
    expect(write.sql).toMatch(/UPDATE cellar_holdings SET bottles=bottles\+\?/);
    expect(db.writes().some(call=>/INSERT INTO cellar_holdings/.test(call.sql))).toBe(false);
  });

  it('fills the region and country from the appellation, the way a wine save does',()=>{
    const parsed=input({appellation:'Barolo',country:null,region:null});
    expect(parsed.country).toBe('Italy');
    expect(parsed.region).toBe('Piedmont');
  });

  it('refuses nought bottles: putting nothing away is not an entry',()=>{
    expect(cellarInputSchema.safeParse({...input(),bottles:0}).success).toBe(false);
  });
});

describe('taking a bottle out',()=>{
  it('drops the count by one',async()=>{
    const db=stub(()=>({changes:1}));
    expect(await takeBottleFromHolding(db.db,'owner','h1')).toBe(true);
    const [take]=db.writes();
    expect(take.sql).toMatch(/SET bottles=bottles-1.*bottles>0/s);
  });

  it('clears the line once the last bottle is gone',async()=>{
    const db=stub(()=>({changes:1}));
    await takeBottleFromHolding(db.db,'owner','h1');
    expect(db.writes().some(call=>/DELETE FROM cellar_holdings WHERE owner_id=\? AND id=\? AND bottles<=0/.test(call.sql))).toBe(true);
  });

  it('does nothing to a holding that is already empty or gone',async()=>{
    const db=stub(()=>({changes:0}));
    expect(await takeBottleFromHolding(db.db,'owner','h1')).toBe(false);
    expect(db.writes()).toHaveLength(1);
  });

  it('reads an edit down to nought bottles as the line being gone',async()=>{
    const db=stub(sql=>/SELECT id,producer_id/.test(sql)||/FROM cellar_holdings WHERE owner_id=\? AND id=\?/.test(sql)?{first:holdingRow()}:undefined);
    const result=await updateHolding(db.db,'owner','h1',{bottles:0});
    expect(result?.bottles).toBe(0);
    expect(db.writes().some(call=>/DELETE FROM cellar_holdings/.test(call.sql))).toBe(true);
  });
});

describe('the cellar list',()=>{
  const page=(rows:Array<Record<string,unknown>>,total=rows.length,bottles=0)=>createD1Stub(sql=>
    /count\(\*\) AS total/.test(sql)?{all:[{total,bottles}]}:{all:rows});

  it('counts wines and bottles as different facts',async()=>{
    const db=page([holdingRow()],1,6);
    const result=await listCellarPage(db.db,'owner',{});
    expect(result.total).toBe(1);
    expect(result.bottles).toBe(6);
  });

  it('orders by vintage by default, because a holding has no drinking date',async()=>{
    const db=page([holdingRow()]);
    await listCellarPage(db.db,'owner',{});
    expect(db.matching(/ORDER BY c.vintage DESC/)).toHaveLength(1);
  });

  it('never reads a wines row',async()=>{
    const db=page([holdingRow()]);
    await listCellarPage(db.db,'owner',{query:'cusumano',style:'red'});
    expect(db.sql().some(sql=>/from wines/i.test(sql))).toBe(false);
  });

  it('reads a four-digit search as a vintage',async()=>{
    const db=page([holdingRow()]);
    await listCellarPage(db.db,'owner',{query:'2020'});
    const [call]=db.matching(/SELECT c.id/);
    expect(call.sql).toMatch(/c\.vintage=\?/);
    expect(call.args).toContain('2020');
  });
});
