import { describe,expect,it } from 'vitest';
import { cellarInputSchema } from '../../src/lib/cellar/schema';

const entry=(overrides:Record<string,unknown>)=>cellarInputSchema.parse({
  producer:'Somebody',wineName:'A wine',vintage:2020,country:null,region:null,appellation:null,
  wineStyle:'red',classification:null,currency:null,bottles:1,bottleSizeMl:750,
  purchasePrice:null,purchasedAt:null,merchant:null,location:null,notes:'',...overrides
});

describe('filing a cellar entry by place',()=>{
  it('reads the country and region off an appellation the tree knows',()=>{
    expect(entry({appellation:'Etna'})).toMatchObject({country:'Italy',region:'Sicily',appellation:'Etna'});
    expect(entry({appellation:'Pauillac'})).toMatchObject({country:'France',region:'Bordeaux'});
  });

  it('reads them off a region, where that is as narrow as the wine gets',()=>{
    // Most of the New World and the smaller producing countries are carried at
    // region level rather than appellation, and that is enough to file a bottle.
    expect(entry({appellation:'Swartland'})).toMatchObject({country:'South Africa',region:'Swartland'});
    expect(entry({appellation:'Kakheti'})).toMatchObject({country:'Georgia'});
    expect(entry({appellation:'Ningxia'})).toMatchObject({country:'China'});
  });

  it('keeps a country given by hand when the tree has never heard of the place',()=>{
    // The gap the form now covers. Without this the bottle is filed under no
    // country at all: no country filter finds it, and it takes no stamp on the
    // Passport when it is opened.
    const filed=entry({appellation:'Cloudbreak Ridge',country:'New Zealand',region:'Backblock Hills'});
    expect(filed.country).toBe('New Zealand');
    expect(filed.region).toBe('Backblock Hills');
    // Not overwritten with "New Zealand", which is what the country column is for.
    expect(filed.appellation).toBe('Cloudbreak Ridge');
  });

  it('still lets the tree win where it does know better',()=>{
    // The same rule every wine save follows: a resolved appellation outranks a
    // country typed into the box, so one correction cannot fight the other.
    expect(entry({appellation:'Barolo',country:'France'})).toMatchObject({country:'Italy',region:'Piedmont'});
  });

  it('files a wine with no appellation under the country it was given',()=>{
    expect(entry({appellation:null,country:'Portugal',region:'Douro'})).toMatchObject({country:'Portugal',region:'Douro'});
  });
});

describe('a region the tree has never heard of',()=>{
  it('survives, instead of being overwritten with the country',()=>{
    // It used to be replaced by the country's own name, which threw away the
    // one thing the writer knew and the tree did not.
    expect(entry({appellation:null,country:'New Zealand',region:'Backblock Hills'}).region).toBe('Backblock Hills');
  });

  it('but a region that just repeats the country is canonicalised, not kept',()=>{
    // "Great Britain" in the region box is the country said twice.
    expect(entry({appellation:null,country:'United Kingdom',region:'Great Britain'}))
      .toMatchObject({country:'United Kingdom',region:'United Kingdom'});
  });

  it('and a region the tree does know still wins over the text',()=>{
    expect(entry({appellation:null,country:'Italy',region:'Piemonte'}).region).toBe('Piedmont');
  });
});

describe('a name that is a region and an appellation at once',()=>{
  // Napa Valley is an AVA, and it is also the region every sub-AVA sits in.
  // The tree files it at region tier, so the column it arrived in does not
  // decide the column it lands in - which is the whole point of resolvePlace.
  it('files the same whichever box it was typed into',()=>{
    const asAppellation=entry({appellation:'Napa Valley'});
    const asRegion=entry({appellation:null,region:'Napa Valley'});
    expect(asAppellation).toMatchObject({country:'United States',region:'Napa Valley',appellation:null});
    expect(asRegion).toMatchObject({country:'United States',region:'Napa Valley',appellation:null});
  });

  it('reads the alias and the spelt-out denomination the same way',()=>{
    expect(entry({appellation:'Napa'})).toMatchObject({region:'Napa Valley',appellation:null});
    expect(entry({appellation:'Napa Valley AVA'})).toMatchObject({region:'Napa Valley',appellation:null});
  });

  it('fills the parent in from a sub-AVA named on its own',()=>{
    expect(entry({appellation:'Oakville'})).toMatchObject({country:'United States',region:'Napa Valley',appellation:'Oakville'});
    expect(entry({appellation:'Rutherford'})).toMatchObject({region:'Napa Valley',appellation:'Rutherford'});
  });

  it('leaves the appellation empty rather than repeating the region in it',()=>{
    // A wine that names nothing narrower than Napa Valley has no appellation,
    // and saying "Napa Valley · Napa Valley" would be the region twice.
    expect(entry({appellation:'Napa Valley'}).appellation).toBeNull();
  });
});
