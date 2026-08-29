import { describe,expect,it } from 'vitest';
import { mergeSheetWines,parseSheetPage,sheetPageWasCutShort,sheetResumeLine,sheetWineSchema,
  type SheetWine } from '../../src/features/recognition/sheetSchema';

const line=(overrides:Record<string,unknown>={}):SheetWine=>sheetWineSchema.parse({
  producer:'Domaine Dujac',wineName:'Morey-Saint-Denis',vintage:2019,country:'France',
  region:'Burgundy',appellation:'Morey-Saint-Denis',grapes:[],grapeBlend:[],style:'red',
  alcoholPercentage:null,priceOptions:[{amount:1280,label:null}],section:'FLIGHT 1',
  lineNumber:1,confidence:.9,...overrides
});

const page=(wines:unknown[],overrides:Record<string,unknown>={})=>JSON.stringify({
  wines,currency:'HKD',unresolvedCount:0,truncated:false,lastLineNumber:wines.length,...overrides
});

describe('reading a printed wine list',()=>{
  it('keeps every price the sheet prints against a line, with its label',()=>{
    // Bottle-vs-glass and member-vs-list are common. Picking one silently is
    // how a glass price ends up recorded as what the bottle cost.
    const wine=line({priceOptions:[{amount:1280,label:'bottle'},{amount:180,label:'glass'}]});
    expect(wine.priceOptions.map(option=>option.label)).toEqual(['bottle','glass']);
  });

  it('accepts a list with no prices on it at all',()=>{
    // A lineup without prices is an ordinary handout, not a failed read.
    expect(line({priceOptions:[]}).priceOptions).toEqual([]);
  });

  it('carries the flight a wine is printed under without treating it as a wine',()=>{
    const parsed=parseSheetPage(page([line({section:'FLIGHT 2 — CÔTE DE NUITS'})]));
    expect(parsed.wines).toHaveLength(1);
    expect(parsed.wines[0].section).toBe('FLIGHT 2 — CÔTE DE NUITS');
  });

  it('reads one currency for the page rather than one per wine',()=>{
    const parsed=parseSheetPage(page([line(),line({wineName:'Clos de la Roche',lineNumber:2})]));
    expect(parsed.currency).toBe('HKD');
    expect('currency' in parsed.wines[0]).toBe(false);
  });

  it('rejects a currency that is not a three-letter code',()=>{
    expect(()=>parseSheetPage(page([line()],{currency:'HK$'}))).toThrow();
  });

  it('survives the canonicalisation it performs on the way through',()=>{
    // Same trap the group schema hit: canonicalizeWineFields fills fields the
    // model was never asked for, and a strict schema with no home for them
    // would reject the whole page.
    const parsed=parseSheetPage(page([line({appellation:'Chambertin Grand Cru',wineName:'Chambertin'})]));
    expect(parsed.wines[0].classification).toBe('grand_cru');
  });
});

describe('a page that ran out of room',()=>{
  it('is detected from the model flag or from the finish reason',()=>{
    const short=parseSheetPage(page([line()],{truncated:true,lastLineNumber:40}));
    expect(sheetPageWasCutShort(short,'STOP')).toBe(true);
    const whole=parseSheetPage(page([line()]));
    expect(sheetPageWasCutShort(whole,'MAX_TOKENS')).toBe(true);
    expect(sheetPageWasCutShort(whole,'STOP')).toBe(false);
  });

  it('says where a continuation should resume from',()=>{
    const short=parseSheetPage(page([line({lineNumber:39}),line({wineName:'Clos',lineNumber:40})],{truncated:true,lastLineNumber:40}));
    expect(sheetResumeLine(short)).toBe(40);
  });
});

describe('merging the pages of one sheet',()=>{
  it('counts a wine reprinted at a page break once',()=>{
    const merged=mergeSheetWines([[line()],[line()]]);
    expect(merged).toHaveLength(1);
  });

  it('keeps two vintages of one cuvée apart',()=>{
    const merged=mergeSheetWines([[line({vintage:2019}),line({vintage:2020,lineNumber:2})]]);
    expect(merged.map(wine=>wine.vintage)).toEqual([2019,2020]);
  });

  it('prefers the printing that carried a price',()=>{
    // A continuation overlaps by a row or two, and the overlapping row is
    // sometimes the one that got cut off mid-line.
    const merged=mergeSheetWines([[line({priceOptions:[]})],[line({priceOptions:[{amount:1280,label:null}]})]]);
    expect(merged[0].priceOptions).toHaveLength(1);
  });

  it('holds a long sheet without collapsing distinct wines',()=>{
    const pages=[0,1,2].map(pageIndex=>Array.from({length:60},(_,row)=>
      line({wineName:`Cuvée ${pageIndex}-${row}`,lineNumber:row+1})));
    expect(mergeSheetWines(pages)).toHaveLength(180);
  });
});
