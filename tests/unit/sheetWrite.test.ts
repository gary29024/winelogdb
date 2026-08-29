import { describe,expect,it } from 'vitest';
import { applySheetPrices,createSheetWines,sheetPricesSchema,sheetWinesSchema } from '../../src/lib/tastings/sheetWrite';
import { createD1Stub } from './support/d1Stub';

const WINE=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;

const lineupStub=(ids:string[])=>createD1Stub((sql,args)=>{
  if(/SELECT w\.id FROM wine_experiences/.test(sql))return {all:ids.map(id=>({id}))};
  if(/SELECT id FROM tastings/.test(sql))return {first:{id:'t1'}};
  // The attach ownership guard counts the ids it was handed, so the double has
  // to answer for those rather than for the lineup it started with.
  if(/count\(\*\) AS count FROM wines/.test(sql))
    return {first:{count:(JSON.parse(String(args[0]??'[]')) as string[]).length}};
  return undefined;
});

/** How many round trips the writes actually cost, as opposed to statements. */
function countBatches(stub:ReturnType<typeof createD1Stub>){
  const db=stub.db as unknown as {batch:(statements:unknown[])=>Promise<unknown>};
  const original=db.batch.bind(db);
  const sizes:number[]=[];
  db.batch=async(statements:unknown[])=>{sizes.push(statements.length);return original(statements)};
  return sizes;
}

describe('filling prices from a sheet',()=>{
  it('writes only wines that are actually in this tasting',async()=>{
    const stub=lineupStub([WINE(1)]);
    const result=await applySheetPrices(stub.db,'owner','t1',
      {currency:'HKD',prices:[{wineId:WINE(1),price:1280},{wineId:WINE(2),price:900}]});
    expect(result).toEqual({filled:1,skipped:1});
  });

  it('never overwrites a price that is already there',async()=>{
    // The UI unticks those rows, but the guard belongs in SQL too: a second
    // device working the same sheet still has to hit it.
    const stub=lineupStub([WINE(1)]);
    await applySheetPrices(stub.db,'owner','t1',{currency:'HKD',prices:[{wineId:WINE(1),price:1280}]});
    const update=stub.calls.find(call=>/^UPDATE wines SET price=/.test(call.sql));
    expect(String(update?.sql).replace(/\s+/g,' ')).toContain('AND price IS NULL');
  });

  it('batches a hundred prices instead of writing them one at a time',async()=>{
    // Writing wines fires the 0030 revision triggers, so a hundred separate
    // updates would be a hundred Passport cache invalidations for one sheet.
    const ids=Array.from({length:100},(_,index)=>WINE(index+1));
    const stub=lineupStub(ids);
    const batches=countBatches(stub);
    await applySheetPrices(stub.db,'owner','t1',{currency:'HKD',prices:ids.map(id=>({wineId:id,price:100}))});
    // Two chunks of fifty, not a hundred round trips.
    expect(batches).toEqual([50,50]);
    expect(stub.calls.filter(call=>/^UPDATE wines SET price=/.test(call.sql))).toHaveLength(100);
  });

  it('refuses a currency that is not a three-letter code, and a negative price',()=>{
    expect(sheetPricesSchema.safeParse({currency:'HK$',prices:[{wineId:WINE(1),price:1}]}).success).toBe(false);
    expect(sheetPricesSchema.safeParse({currency:'HKD',prices:[{wineId:WINE(1),price:-1}]}).success).toBe(false);
    expect(sheetPricesSchema.safeParse({currency:'hkd',prices:[{wineId:WINE(1),price:1}]}).data?.currency).toBe('HKD');
  });

  it('refuses more rows than one sheet could sanely carry',()=>{
    const prices=Array.from({length:501},(_,index)=>({wineId:WINE(index+1),price:1}));
    expect(sheetPricesSchema.safeParse({currency:'HKD',prices}).success).toBe(false);
  });

  it('says so rather than writing nothing silently when no wine matches',async()=>{
    const stub=lineupStub([]);
    await expect(applySheetPrices(stub.db,'owner','t1',{currency:'HKD',prices:[{wineId:WINE(1),price:1}]}))
      .rejects.toThrow(/in this tasting/);
  });
});

describe('creating the wines a sheet lists',()=>{
  const input=(count:number)=>sheetWinesSchema.parse({
    currency:'HKD',tastingDate:'2026-08-28',venue:'Clubhouse',
    wines:Array.from({length:count},(_,index)=>({producer:'Domaine Dujac',wineName:`Cuvée ${index}`,vintage:2019,price:1280}))
  });

  it('creates and attaches them in the same request',async()=>{
    // A half-run that created wines without attaching them would leave a
    // sheet's worth of bottles floating outside the evening they were poured at.
    const stub=lineupStub([WINE(1)]);
    const result=await createSheetWines(stub.db,'owner','t1',input(3));
    expect(result.created).toBe(3);
    expect(stub.calls.filter(call=>/INSERT INTO wines/.test(call.sql))).toHaveLength(3);
    expect(stub.calls.some(call=>/INSERT INTO wine_experiences/.test(call.sql))).toBe(true);
    expect(stub.calls.some(call=>/UPDATE wine_experiences AS we SET tasting_id=/.test(call.sql))).toBe(true);
  });

  it('gives every wine its own id',async()=>{
    // One bound uuid reused across a batch collides on the primary key.
    const stub=lineupStub([WINE(1)]);
    const result=await createSheetWines(stub.db,'owner','t1',input(5));
    expect(new Set(result.wineIds).size).toBe(5);
  });

  it('records no currency on a wine that had no price printed',async()=>{
    const stub=lineupStub([WINE(1)]);
    await createSheetWines(stub.db,'owner','t1',sheetWinesSchema.parse({
      currency:'HKD',wines:[{producer:'Dujac',wineName:'Morey',price:null}]}));
    const insert=stub.calls.find(call=>/INSERT INTO wines/.test(call.sql));
    expect(insert?.args.slice(-4,-2)).toEqual([null,null]);
  });

  it('refuses to create against a tasting that is gone',async()=>{
    const stub=createD1Stub();
    await expect(createSheetWines(stub.db,'owner','t1',input(1))).rejects.toThrow(/no longer exists/);
  });
});
