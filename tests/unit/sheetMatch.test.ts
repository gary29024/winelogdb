import { describe,expect,it } from 'vitest';
import { matchSheetWines,readLineupForMatching,type LineupWine } from '../../src/lib/tastings/sheetMatch';
import { sheetWineSchema,type SheetWine } from '../../src/features/recognition/sheetSchema';
import { createD1Stub } from './support/d1Stub';

const row=(overrides:Record<string,unknown>={}):SheetWine=>sheetWineSchema.parse({
  producer:'Domaine Dujac',wineName:'Morey-Saint-Denis',vintage:2019,country:'France',
  region:'Burgundy',appellation:'Morey-Saint-Denis',grapes:[],grapeBlend:[],style:'red',
  alcoholPercentage:null,priceOptions:[{amount:1280,label:null}],section:null,lineNumber:1,confidence:.9,...overrides
});

const logged=(overrides:Partial<LineupWine>={}):LineupWine=>({
  wineId:'w1',producer:'Domaine Dujac',wineName:'Morey-Saint-Denis',vintage:2019,
  producerId:'p1',cuveeId:'c1',price:null,currency:null,...overrides
});

describe('matching a printed line to the evening',()=>{
  it('recognises a wine already logged at this tasting',()=>{
    const [match]=matchSheetWines([row()],[logged()]);
    expect(match.status).toBe('matched');
    expect(match.status==='matched'&&match.wineId).toBe('w1');
  });

  it('does not match another vintage of the same cuvée',()=>{
    // A good list prints 2019 and 2020 side by side. Collapsing them would put
    // one vintage's price onto the other.
    expect(matchSheetWines([row({vintage:2020})],[logged({vintage:2019})])[0].status).toBe('new');
  });

  it('matches when the sheet repeats the producer in the wine name',()=>{
    // Lists print "Domaine Dujac Morey-Saint-Denis" where the journal holds the
    // cuvée on its own under that producer.
    const [match]=matchSheetWines([row({wineName:'Domaine Dujac Morey-Saint-Denis'})],[logged()]);
    expect(match.status).toBe('matched');
  });

  it('matches a wine that has no cuvée identity yet',()=>{
    const [match]=matchSheetWines([row()],[logged({cuveeId:null,producerId:null})]);
    expect(match.status).toBe('matched');
  });

  it('ignores accents and punctuation the printer used',()=>{
    const [match]=matchSheetWines([row({producer:'Domaine  DUJAC.',wineName:'Morey Saint Denis'})],[logged()]);
    expect(match.status).toBe('matched');
  });

  it('reports a wine the evening does not have as new',()=>{
    expect(matchSheetWines([row({wineName:'Clos de la Roche'})],[logged()])[0].status).toBe('new');
  });

  it('says when a matched wine already has a price of its own',()=>{
    const [match]=matchSheetWines([row()],[logged({price:980,currency:'HKD'})]);
    expect(match.status==='matched'&&match.hasPrice).toBe(true);
    expect(match.status==='matched'&&match.currentPrice).toBe(980);
  });

  it('lets one logged wine claim only one printed line',()=>{
    // A list that prints the same cuvée in two flights would otherwise report
    // both as already logged and fill the same wine's price twice.
    const matches=matchSheetWines([row(),row({lineNumber:2})],[logged()]);
    expect(matches.map(match=>match.status)).toEqual(['matched','new']);
  });
});

describe('the cost of matching a real trade list',()=>{
  it('issues no database query per row',async()=>{
    // The whole reason matching is done in memory. Resolving producer and cuvée
    // per row would be five-plus statements each: over a thousand D1 operations
    // for one two-hundred-wine sheet.
    const stub=createD1Stub(()=>({all:[{wine_id:'w1',producer:'Domaine Dujac',wine_name:'Morey-Saint-Denis',
      vintage:2019,producer_id:'p1',cuvee_id:'c1',price:null,currency:null}]}));
    const lineup=await readLineupForMatching(stub.db,'owner','t1');
    expect(stub.calls).toHaveLength(1);

    const sheet=Array.from({length:200},(_,index)=>row({wineName:`Cuvée ${index}`,lineNumber:index+1}));
    const matches=matchSheetWines(sheet,lineup);
    expect(matches).toHaveLength(200);
    // Still one: the lineup read, and nothing since.
    expect(stub.calls).toHaveLength(1);
  });
});
