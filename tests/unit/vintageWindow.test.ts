import { describe,expect,it } from 'vitest';
import { askableVintage,maturityPair,vintageCacheKey,vintageWindowSchema,windowShift } from '../../src/lib/maturity/vintageWindow';

const barolo={country:'Italy',region:'Piedmont',appellation:'Barolo',vintage:2019,wineStyle:'red',classification:null};
const found=(overrides:Record<string,unknown>={})=>({country:'Italy',region:'Piedmont',appellation:null,
  vintage:2019,wineStyle:'red',shiftFrom:2,shiftTo:5,note:'A warm, early year.',
  sources:[{title:'A wine paper',url:'https://example.com/2019'}],model:'m',researchedAt:'2026-09-02T00:00:00.000Z',...overrides});

describe('which vintage question is being asked',()=>{
  it('sends two wines from one growing season to one answer',()=>{
    // Oakville 2019 and Rutherford 2019 are the same year in the same valley,
    // and the tree already knows it. Paying twice would be paying for that
    // answer to be ignored.
    expect(vintageCacheKey({appellation:'Oakville',vintage:2019,wineStyle:'red'}))
      .toBe(vintageCacheKey({appellation:'Rutherford',vintage:2019,wineStyle:'red'}));
  });

  it('reads a spelling and an alias as the same question',()=>{
    expect(vintageCacheKey({appellation:'Napa Valley AVA',vintage:2019,wineStyle:'red'}))
      .toBe(vintageCacheKey({region:'Napa',vintage:2019,wineStyle:'red'}));
  });

  it('sends two appellations of one region to one answer too',()=>{
    // Barolo and Barbaresco had the same 2019, and a vintage report says so in
    // one piece. The appellation still decides the calculated window beside it.
    expect(vintageCacheKey({appellation:'Barolo',vintage:2019,wineStyle:'red'}))
      .toBe(vintageCacheKey({appellation:'Barbaresco',vintage:2019,wineStyle:'red'}));
  });

  it('but not two regions of one country',()=>{
    expect(vintageCacheKey({appellation:'Barolo',vintage:2019,wineStyle:'red'}))
      .not.toBe(vintageCacheKey({appellation:'Chianti Classico',vintage:2019,wineStyle:'red'}));
  });

  it('keeps the colours apart, because a year is not equally kind to both',()=>{
    // 2021 in Burgundy was a frost year for the reds and a fine one for whites.
    expect(vintageCacheKey({region:'Burgundy',vintage:2021,wineStyle:'red'}))
      .not.toBe(vintageCacheKey({region:'Burgundy',vintage:2021,wineStyle:'white'}));
  });

  it('keeps the years apart',()=>{
    expect(vintageCacheKey({appellation:'Barolo',vintage:2019,wineStyle:'red'}))
      .not.toBe(vintageCacheKey({appellation:'Barolo',vintage:2020,wineStyle:'red'}));
  });

  it('refuses to ask about a wine with no year, or nowhere',()=>{
    expect(askableVintage({appellation:'Barolo',vintage:null})).toBe(false);
    expect(askableVintage({vintage:2019})).toBe(false);
    expect(askableVintage({country:'Italy',vintage:2019})).toBe(true);
  });
});

describe('what a source is allowed to say',()=>{
  it('takes a window in calendar years',()=>{
    expect(vintageWindowSchema.parse({drinkFrom:2029,drinkTo:2049,note:'',sources:[]}).drinkFrom).toBe(2029);
  });

  it('refuses a window that ends before it opens',()=>{
    expect(vintageWindowSchema.safeParse({drinkFrom:2049,drinkTo:2029,note:'',sources:[]}).success).toBe(false);
  });

  it('accepts "could not be found" as an answer',()=>{
    // Better than a year invented to fill the field.
    const parsed=vintageWindowSchema.parse({drinkFrom:null,drinkTo:null,note:'No source discusses it.',sources:[]});
    expect(parsed.drinkFrom).toBeNull();
  });
});

describe('the two answers, side by side',()=>{
  it('keeps both, and neither stands in for the other',()=>{
    const pair=maturityPair(barolo,found());
    expect(pair.calculated).toEqual({from:2027,to:2044,label:'Barolo'});
    expect(pair.researched?.from).toBe(2029);
  });

  it('says how far the year moved the usual window',()=>{
    expect(windowShift(maturityPair(barolo,found()))).toEqual({from:2,to:5});
  });

  it('still shows the calculated one when nothing has been looked up',()=>{
    const pair=maturityPair(barolo,null);
    expect(pair.calculated).not.toBeNull();
    expect(pair.researched).toBeNull();
    expect(windowShift(pair)).toBeNull();
  });

  it('shows nothing researched when the search found no years to give',()=>{
    // A note with no window is not a window.
    expect(maturityPair(barolo,found({shiftFrom:null,shiftTo:null})).researched).toBeNull();
  });

  it('applies one region-wide answer correctly to two very different wines',()=>{
    // The reason a shift is stored rather than a window. Piedmont red 2019 is
    // Barolo and Dolcetto d'Alba alike, and their usual windows are eight-to-
    // twenty-five and two-to-ten. Storing the years a source gave for one and
    // showing them against the other would be badly wrong.
    const dolcetto={country:'Italy',region:'Piedmont',appellation:"Dolcetto d'Alba",vintage:2019,wineStyle:'red',classification:null};
    expect(maturityPair(barolo,found()).researched).toMatchObject({from:2029,to:2049});
    expect(maturityPair(dolcetto,found()).researched).toMatchObject({from:2023,to:2034});
  });

  it('says nothing researched for a wine it has no window of its own to move',()=>{
    // A shift needs something to shift. Without a calculated window there is
    // nothing to apply it to, and inventing one would be worse than silence.
    const unknown={country:null,region:null,appellation:null,vintage:2019,wineStyle:null,classification:null};
    expect(maturityPair(unknown,found()).researched).toBeNull();
  });

  it('still answers for a wine the ageing table has no entry for',()=>{
    const pair=maturityPair({country:'Georgia',region:'Kakheti',appellation:null,vintage:2019,wineStyle:'red',classification:null},null);
    expect(pair.calculated).toEqual({from:2021,to:2027,label:'a red wine'});
  });
});
