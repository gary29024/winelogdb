import { describe,expect,it } from 'vitest';
import { maturityFor,maturityVerdict,windowLabel } from '../../src/lib/maturity/ageing';

const wine=(overrides:Record<string,unknown>={})=>({
  country:null,region:null,appellation:null,classification:null,wineStyle:'red',...overrides
});

describe('a bottling the region cannot describe',()=>{
  // A vintage Champagne is filed under one window for the whole region, and a
  // prestige cuvee is not that wine: a Salon is only starting at fifteen years
  // where the region's figure has already called it past its peak. The
  // difference is the house and the cuvee, which no place data will ever carry.
  const champagne=(overrides:Record<string,unknown>={})=>wine({
    country:'France',region:'Champagne',wineStyle:'sparkling',...overrides
  });

  it('keeps a prestige cuvee for as long as it actually keeps',()=>{
    expect(maturityFor(champagne())?.window).toEqual({from:3,to:15});
    expect(maturityFor(champagne({producer:'Salon',wineName:'Le Mesnil'}))?.window).toEqual({from:12,to:45});
    expect(maturityFor(champagne({producer:'Krug',wineName:'Vintage'}))?.window).toEqual({from:10,to:40});
    expect(maturityFor(champagne({producer:'Dom Pérignon',wineName:'Vintage'}))?.window).toEqual({from:8,to:35});
  });

  it('says which bottling answered, not which region',()=>{
    expect(maturityFor(champagne({producer:'Louis Roederer',wineName:'Cristal'}))?.basis.label).toBe('Cristal');
  });

  it('reads the house and the cuvee together, whichever box they landed in',()=>{
    // Dom Perignon is a producer on one bottle and a cuvee under Moet on the
    // next, and a scan can put the house in front of the wine name as well.
    const asProducer=maturityFor(champagne({producer:'Dom Pérignon',wineName:'P2'}));
    const asCuvee=maturityFor(champagne({producer:'Moët & Chandon',wineName:'Dom Pérignon'}));
    expect(asCuvee?.window).toEqual(asProducer?.window);
    // and accents and full stops are not what decides it
    expect(maturityFor(champagne({producer:'Perrier-Jouët',wineName:'Belle Epoque'}))?.window).toEqual({from:6,to:25});
    expect(maturityFor(champagne({producer:'Bollinger',wineName:'R.D.'}))?.window).toEqual({from:8,to:35});
  });

  it('claims nothing about a house it does not name',()=>{
    // The list is the exception, not a rule. An unlisted Champagne falls
    // through to the region, which is the right answer for most of them.
    expect(maturityFor(champagne({producer:'Pol Roger',wineName:'Brut Vintage'}))?.window).toEqual({from:3,to:15});
    // and Bollinger's shorter wines are not its long ones
    expect(maturityFor(champagne({producer:'Bollinger',wineName:'Special Cuvée'}))?.window).toEqual({from:3,to:15});
  });

  it('does not let a name travel to another region',()=>{
    // A grower somewhere else who happens to share a name inherits nothing.
    expect(maturityFor(wine({country:'Italy',region:'Piedmont',appellation:'Barolo',
      producer:'Krug',wineName:'Something'}))?.window).toEqual({from:8,to:25});
  });

  it('turns a Salon that read as past its peak into one that is ready',()=>{
    // The report that prompted this: thirty years on, the region's window has
    // long closed and the wine is only just arriving.
    const year=new Date().getFullYear();
    const bottle=champagne({producer:'Salon',wineName:'Cuvée S',vintage:year-30});
    expect(maturityVerdict(bottle)?.readiness).toBe('ready');
    expect(maturityVerdict(champagne({...bottle,producer:'A Grower'}))?.readiness).toBe('past-peak');
  });
});

describe('how long a wine is worth keeping',()=>{
  it('answers from the narrowest place named',()=>{
    // Barolo before Piedmont: the appellation is the whole reason the answer
    // differs from the region around it.
    expect(maturityFor(wine({appellation:'Barolo'}))?.window).toEqual({from:8,to:25});
    expect(maturityFor(wine({appellation:'Langhe'}))?.window).toEqual({from:2,to:10});
  });

  it('walks up to the region where the appellation has no entry of its own',()=>{
    expect(maturityFor(wine({appellation:'Pommard'}))?.window).toEqual({from:4,to:12});
    expect(maturityFor(wine({appellation:'Pommard'}))?.basis.placeId).toBe('france/burgundy');
  });

  it('reads a cru tier as the different wine it is',()=>{
    const village=maturityFor(wine({appellation:'Gevrey-Chambertin',classification:'village'}));
    const grand=maturityFor(wine({appellation:'Chambertin',classification:'grand_cru'}));
    expect(village?.window).toEqual({from:3,to:10});
    expect(grand?.window).toEqual({from:8,to:25});
  });

  it('separates the styles a place makes',()=>{
    expect(maturityFor(wine({appellation:'Etna',wineStyle:'red'}))?.window).toEqual({from:3,to:12});
    expect(maturityFor(wine({appellation:'Etna',wineStyle:'white'}))?.window).toEqual({from:2,to:8});
  });

  it('falls back to the style where the tree knows the place but the table does not',()=>{
    const answer=maturityFor(wine({appellation:'Kakheti',wineStyle:'red'}));
    expect(answer?.window).toEqual({from:2,to:8});
    expect(answer?.basis).toEqual({placeId:null,label:'a red wine'});
  });

  it('says nothing at all for a wine with neither a place nor a style',()=>{
    // Better than treating an unknown wine as red, which is what a default
    // style would quietly do.
    expect(maturityFor(wine({wineStyle:null}))).toBeNull();
  });

  it('names what it answered from, so the screen can say so',()=>{
    expect(maturityFor(wine({appellation:'Barolo'}))?.basis.label).toBe('Barolo');
    expect(maturityFor(wine({appellation:'Sauternes'}))?.basis.placeId).toBe('france/bordeaux/graves/sauternes');
  });
});

describe('where a bottle sits in its window',()=>{
  const barolo=(vintage:number)=>maturityVerdict({...wine({appellation:'Barolo'}),vintage},2026);

  it('holds a wine that has not opened yet, and says how long',()=>{
    const verdict=barolo(2022);
    expect(verdict?.readiness).toBe('hold');
    expect(verdict?.opensIn).toBe(4);
    expect(windowLabel(verdict!)).toBe('2030–2047');
  });

  it('calls it ready inside the window',()=>{
    expect(barolo(2016)?.readiness).toBe('ready');
    expect(barolo(2016)?.opensIn).toBe(0);
  });

  it('says drink up in the last third rather than waiting for a cliff',()=>{
    // 2026 is 22 years on from 2004, and the window runs 8 to 25.
    expect(barolo(2004)?.readiness).toBe('mature');
  });

  it('and past its window after that',()=>{
    expect(barolo(1995)?.readiness).toBe('past-peak');
  });

  it('says nothing for a wine with no vintage',()=>{
    // Non-vintage is not a young wine, it is a wine with no clock.
    expect(maturityVerdict({...wine({appellation:'Champagne',wineStyle:'sparkling'}),vintage:null},2026)).toBeNull();
  });

  it('reads the boundary years as inside the window',()=>{
    expect(barolo(2018)?.readiness).toBe('ready');
    expect(barolo(2001)?.readiness).toBe('mature');
    expect(barolo(2000)?.readiness).toBe('past-peak');
  });
});
