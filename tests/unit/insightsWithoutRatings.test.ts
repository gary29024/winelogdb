import { describe,expect,it } from 'vitest';
import type { DrinkingAgeStat,GrapeStat,MonthStat } from '../../src/features/journey/api';
import type { JourneySummary } from '../../src/features/journey/model';
import { buildCadence,buildCruMix,buildDrinkingAge,buildMix,coverage,favoriteRates,readDiscovery,showsRatingInsights,showsStructureInsights } from '../../src/features/journey/insights';

const summary=(over:Partial<JourneySummary>={}):JourneySummary=>({
  totalWines:100,producers:40,countries:8,regions:20,appellations:30,vintages:12,favorites:14,
  averageRating:null,ratedWines:0,pricedWines:10,structuredTastings:0,...over
});
const grape=(name:string,wines:number,favorites:number):GrapeStat=>({grape:name,wines,favorites});
const month=(value:string,wines:number):MonthStat=>({month:value,wines,favorites:0});
const age=(value:number,wines:number):DrinkingAgeStat=>({age:value,wines});

describe('coverage gates',()=>{
  it('hides rating and structure insights for a journal that rarely uses them',()=>{
    const journal=summary({ratedWines:4,structuredTastings:2});
    expect(showsRatingInsights(journal)).toBe(false);
    expect(showsStructureInsights(journal)).toBe(false);
  });

  it('shows them once they cover enough of the journal',()=>{
    expect(showsRatingInsights(summary({ratedWines:15}))).toBe(true);
    expect(showsStructureInsights(summary({structuredTastings:40}))).toBe(true);
  });

  it('treats an empty journal as uncovered rather than dividing by zero',()=>{
    expect(coverage(0,0)).toBe(0);
    expect(showsRatingInsights(summary({totalWines:0,ratedWines:0}))).toBe(false);
  });
});

describe('favorite rates',()=>{
  const grapes=[grape('Riesling',9,6),grape('Malbec',12,1),grape('Nebbiolo',4,3),grape('Gamay',2,2),grape('Merlot',8,0)];

  it('ranks by how often something earns a heart, not by how often it is logged',()=>{
    const ranked=favoriteRates(grapes,item=>item);
    expect(ranked.map(entry=>entry.item.grape)).toEqual(['Nebbiolo','Riesling','Malbec']);
  });

  it('leaves out anything with too small a sample to mean anything',()=>{
    // Gamay is 2 of 2 - a perfect rate off two bottles, which is noise.
    expect(favoriteRates(grapes,item=>item).map(entry=>entry.item.grape)).not.toContain('Gamay');
  });

  it('leaves out anything never favourited',()=>{
    expect(favoriteRates(grapes,item=>item).map(entry=>entry.item.grape)).not.toContain('Merlot');
  });

  it('reports the rate alongside the counts',()=>{
    const [top]=favoriteRates(grapes,item=>item);
    expect(top).toMatchObject({wines:4,favorites:3,rate:.75});
  });
});

describe('discovery',()=>{
  it('reads the share of recent tastings that were a first',()=>{
    const reading=readDiscovery({tastings:20,newProducers:13,newRegions:6,newCountries:2})!;
    expect(reading.percent).toBe(65);
    expect(reading.phrase).toBe('Deep in exploring mode');
    expect(reading.facets).toEqual([
      {label:'new producers',count:13},
      {label:'new regions',count:6},
      {label:'new countries',count:2}
    ]);
  });

  it('describes a journal that is settling in',()=>{
    expect(readDiscovery({tastings:20,newProducers:2,newRegions:0,newCountries:0})!.phrase)
      .toBe('Settling in with producers you know');
    expect(readDiscovery({tastings:20,newProducers:0,newRegions:0,newCountries:0})!.phrase)
      .toBe('Every recent bottle came from a producer you already knew');
  });

  it('has nothing to say about an empty journal',()=>{
    expect(readDiscovery({tastings:0,newProducers:0,newRegions:0,newCountries:0})).toBeNull();
  });
});

describe('cadence',()=>{
  const rows=[month('2026-08',5),month('2026-07',3),month('2026-06',1),month('2026-03',4)];

  it('fills the quiet months so the gaps are visible',()=>{
    const cadence=buildCadence(rows);
    expect(cadence.months).toHaveLength(12);
    expect(cadence.months.at(-1)).toMatchObject({month:'2026-08',wines:5});
    expect(cadence.months.find(entry=>entry.month==='2026-05')).toMatchObject({wines:0});
    expect(cadence.months[0].month).toBe('2025-09');
  });

  it('counts the run of consecutive months back from the latest',()=>{
    expect(buildCadence(rows).streak).toBe(3);
    expect(buildCadence([month('2026-08',2),month('2026-06',9)]).streak).toBe(1);
  });

  it('names the busiest month and averages over the window',()=>{
    const cadence=buildCadence(rows);
    expect(cadence.busiest).toMatchObject({month:'2026-08',wines:5});
    expect(cadence.perMonth).toBeCloseTo(13/12);
  });

  it('crosses a year boundary correctly',()=>{
    const cadence=buildCadence([month('2026-01',2)],3);
    expect(cadence.months.map(entry=>entry.month)).toEqual(['2025-11','2025-12','2026-01']);
  });

  it('returns an empty window when nothing is dated',()=>{
    expect(buildCadence([])).toEqual({months:[],busiest:null,streak:0,perMonth:0});
  });
});

describe('drinking age',()=>{
  const rows=[age(1,4),age(2,6),age(3,10),age(5,8),age(9,5),age(20,2)];

  it('reports the median and the middle half',()=>{
    const profile=buildDrinkingAge(rows)!;
    expect(profile.wines).toBe(35);
    expect(profile.median).toBe(3);
    expect(profile.typicalFrom).toBe(2);
    expect(profile.typicalTo).toBe(5);
  });

  it('buckets the histogram without losing a wine',()=>{
    const profile=buildDrinkingAge(rows)!;
    expect(profile.bands.reduce((total,band)=>total+band.wines,0)).toBe(35);
    expect(profile.bands.find(band=>band.label==='25+')!.wines).toBe(0);
    expect(profile.bands.find(band=>band.label==='15–24')!.wines).toBe(2);
  });

  it('has nothing to show without vintages',()=>{
    expect(buildDrinkingAge([])).toBeNull();
    expect(buildDrinkingAge([age(3,0)])).toBeNull();
  });
});

describe('mix',()=>{
  const grapes=[grape('Pinot Noir',20,0),grape('Chardonnay',14,0),grape('Riesling',6,0),grape('Gamay',4,0),grape('Syrah',3,0),grape('Nebbiolo',2,0),grape('Merlot',1,0)];

  it('folds the tail into Other so the shares still add to one',()=>{
    const slices=buildMix(grapes,item=>({label:item.grape,wines:item.wines}),4);
    expect(slices.map(slice=>slice.label)).toEqual(['Pinot Noir','Chardonnay','Riesling','Gamay','Other']);
    expect(slices.at(-1)!.wines).toBe(6);
    expect(slices.reduce((total,slice)=>total+slice.share,0)).toBeCloseTo(1);
  });

  it('adds no Other when everything fits',()=>{
    const slices=buildMix(grapes.slice(0,2),item=>({label:item.grape,wines:item.wines}),6);
    expect(slices.map(slice=>slice.label)).toEqual(['Pinot Noir','Chardonnay']);
  });

  it('is empty when nothing has been identified',()=>{
    expect(buildMix([],()=>({label:'',wines:0}))).toEqual([]);
  });
});

describe('cru mix',()=>{
  const rows=[{classification:'village',wines:18,favorites:5},
    {classification:'grand_cru',wines:4,favorites:3},
    {classification:'premier_cru',wines:9,favorites:4}];

  it('reads down the hierarchy, not by how many you drink',()=>{
    // The point of the card is the shape of the pyramid, so village leading on
    // volume must not put it at the top.
    expect(buildCruMix(rows).map(tier=>tier.key)).toEqual(['grand_cru','premier_cru','village']);
  });

  it('shares out of the classified wines only',()=>{
    const mix=buildCruMix(rows);
    expect(mix.find(tier=>tier.key==='grand_cru')).toMatchObject({wines:4,favorites:3});
    expect(mix.reduce((total,tier)=>total+tier.share,0)).toBeCloseTo(1);
  });

  it('drops a tier the journal has none of rather than showing an empty band',()=>{
    expect(buildCruMix([{classification:'village',wines:3,favorites:0}]).map(tier=>tier.key)).toEqual(['village']);
  });

  it('has nothing to show for a journal with no classified wines',()=>{
    expect(buildCruMix([])).toEqual([]);
    expect(buildCruMix([{classification:'village',wines:0,favorites:0}])).toEqual([]);
  });

  it('ignores a tier it does not know',()=>{
    expect(buildCruMix([{classification:'grosses_gewachs',wines:5,favorites:1}])).toEqual([]);
  });
});
