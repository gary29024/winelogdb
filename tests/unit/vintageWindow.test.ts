import { describe,expect,it } from 'vitest';
import { askableVintage,maturityPair,vintageCacheKey,vintageCell,vintageWindowSchema,windowShift } from '../../src/lib/maturity/vintageWindow';

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

  it('gives a named grand cru its own answer',()=>{
    // A few hectares with its own aspect and drainage, written up by name in
    // every vintage report. What 2011 did in Chambertin-Clos de Bèze is worth
    // its own search; what it did in the Charmes down the slope is a different
    // answer, and a reader of both would notice.
    const beze={appellation:'Chambertin-Clos de Bèze',vintage:2011,wineStyle:'red'};
    const charmes={appellation:'Charmes-Chambertin',vintage:2011,wineStyle:'red'};
    expect(vintageCacheKey(beze)).not.toBe(vintageCacheKey(charmes));
    expect(vintageCell(beze).scope).toBe('appellation');
    expect(vintageCell(beze).label).toBe('Chambertin-Clos de Bèze');
  });

  it('leaves village and premier cru on the region, where nobody would see the difference',()=>{
    // The exception is the grand cru, not the appellation. A village Gevrey and
    // a Morey-Saint-Denis share the region's story, and keying them apart would
    // buy a search per village for one year's weather.
    const gevrey={appellation:'Gevrey-Chambertin',vintage:2011,wineStyle:'red'};
    const morey={appellation:'Morey-Saint-Denis',vintage:2011,wineStyle:'red'};
    expect(vintageCacheKey(gevrey)).toBe(vintageCacheKey(morey));
    expect(vintageCell(gevrey).scope).toBe('region');
    expect(vintageCell(gevrey).label).toBe('Burgundy');
    // and a premier cru named on the label is still that village's wine
    expect(vintageCacheKey({...gevrey,classification:'premier_cru'})).toBe(vintageCacheKey(gevrey));
  });

  it('does not read a grand cru out of an appellation that is merely called one',()=>{
    // "Saint-Émilion Grand Cru" is the name of an appellation, not a cru tier,
    // and the tier comes from the tree rather than from the words.
    const cell=vintageCell({appellation:'Saint-Émilion Grand Cru',vintage:2016,wineStyle:'red'});
    expect(cell.scope).toBe('region');
  });

  it('keeps a grand cru apart from its own region, and from the other colour',()=>{
    const beze={appellation:'Chambertin-Clos de Bèze',vintage:2011,wineStyle:'red'};
    expect(vintageCacheKey(beze)).not.toBe(vintageCacheKey({region:'Burgundy',vintage:2011,wineStyle:'red'}));
    expect(vintageCacheKey(beze)).not.toBe(vintageCacheKey({...beze,wineStyle:'white'}));
    expect(vintageCacheKey(beze)).not.toBe(vintageCacheKey({...beze,vintage:2012}));
    // two producers of the same grand cru are still one question
    expect(vintageCacheKey(beze)).toBe(vintageCacheKey({...beze,region:'Burgundy',country:'France'}));
  });

  it('ignores the house and the bottling, which are the baseline and not the cell',()=>{
    // A Dom Perignon keeps far longer than the Champagne beside it, so its
    // usual window is its own - but 2008 in Champagne is one growing season for
    // every house in it, and paying per cuvee for that would be paying twice.
    const year={country:'France',region:'Champagne',vintage:2008,wineStyle:'sparkling'};
    expect(vintageCacheKey({...year,producer:'Dom Pérignon',wineName:'Vintage'}))
      .toBe(vintageCacheKey({...year,producer:'Pol Roger',wineName:'Brut Vintage'}));
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

describe('the usual window a source is measured against',()=>{
  it("is the bottling's own where the region cannot describe it",()=>{
    // The shift is regional and transfers to everything in the cell; the
    // baseline it moves is the wine's. A Salon and the Champagne beside it read
    // the same year and land in different places, which is the point.
    const year=new Date().getFullYear();
    const shift={country:'France',region:'Champagne',appellation:null,vintage:year-20,wineStyle:'sparkling',
      shiftFrom:2,shiftTo:3,note:'n',sources:[],model:'m',researchedAt:'x'};
    const salon=maturityPair({country:'France',region:'Champagne',vintage:year-20,wineStyle:'sparkling',
      producer:'Salon',wineName:'Le Mesnil'},shift);
    const other=maturityPair({country:'France',region:'Champagne',vintage:year-20,wineStyle:'sparkling',
      producer:'A Grower',wineName:'Brut'},shift);
    expect(salon.calculated).toEqual({from:year-8,to:year+25,label:'Salon'});
    expect(other.calculated).toEqual({from:year-17,to:year-5,label:'Champagne'});
    // and the year's shift lands on each of them from where they actually start
    expect(salon.researched?.from).toBe(year-6);
    expect(other.researched?.from).toBe(year-15);
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

describe('a second bottle from a place already looked up',()=>{
  it('is not a second question, whoever made it',()=>{
    // The producer is not part of the subject at all, so it cannot reach the
    // key: a new Barolo from a house you have never bought before reads the
    // answer already stored, and spends nothing.
    expect(vintageCacheKey({appellation:'Barolo',vintage:2019,wineStyle:'red'}))
      .toBe(vintageCacheKey({appellation:'Barolo',vintage:2019,wineStyle:'red'}));
  });

  it('and reads the same years, because the window is the appellation\'s',()=>{
    const one={country:'Italy',region:'Piedmont',appellation:'Barolo',vintage:2019,wineStyle:'red',classification:null};
    const another={...one};
    expect(maturityPair(another,found()).researched).toEqual(maturityPair(one,found()).researched);
  });

  it('reaches a neighbouring appellation too, at its own window',()=>{
    // The year is regional, so Barbaresco reads Barolo's lookup - but through
    // its own shorter window rather than Barolo's.
    const barbaresco={country:'Italy',region:'Piedmont',appellation:'Barbaresco',vintage:2019,wineStyle:'red',classification:null};
    expect(vintageCacheKey(barbaresco)).toBe(vintageCacheKey(barolo));
    expect(maturityPair(barbaresco,found()).researched).toMatchObject({from:2027,to:2044});
    expect(maturityPair(barolo,found()).researched).toMatchObject({from:2029,to:2049});
  });
});
