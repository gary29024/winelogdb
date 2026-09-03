import { describe,expect,it } from 'vitest';
import type { CountryStat,RegionStat } from '../../src/features/journey/api';
import { buildMapMarkers,countryAnchor,countryIsSpread,landDotPaths,mapCaption,MAP_HEIGHT,MAP_WIDTH,MARKER_MAX_DRIFT,projectPoint,regionAnchor,regionSpread } from '../../src/features/journey/worldMap';
import { COUNTRY_ANCHORS,LAND_MASK,MAP_CELL,MAP_COLUMNS,MAP_ROWS,REGION_ANCHORS } from '../../src/features/journey/worldMapData';

const country=(name:string,wines:number):CountryStat=>({country:name,wines,producers:0,appellations:0,averageRating:null});
const region=(inCountry:string,name:string,wines:number):RegionStat=>
  ({country:inCountry,region:name,wines,producers:0,appellations:0,averageRating:null,favorites:0});

function maskAt(x:number,y:number){
  const row=Math.floor(y/MAP_CELL),column=Math.floor(x/MAP_CELL);
  return LAND_MASK[row]?.[column];
}

describe('country anchors',()=>{
  it('resolves the spellings a journal is likely to hold',()=>{
    expect(countryAnchor('France')).toEqual(countryAnchor('france'));
    expect(countryAnchor('USA')).toEqual(countryAnchor('United States of America'));
    expect(countryAnchor('United States')).toEqual(countryAnchor('United States of America'));
    expect(countryAnchor("Côte d'Ivoire")).toEqual(countryAnchor('Ivory Coast'));
    expect(countryAnchor('Czech Republic')).toEqual(countryAnchor('Czechia'));
  });

  it('has no anchor for an unknown or empty name',()=>{
    expect(countryAnchor('Atlantis')).toBeNull();
    expect(countryAnchor('   ')).toBeNull();
  });

  it('puts every anchor on a land cell, so no marker floats in open water',()=>{
    const afloat=Object.entries(COUNTRY_ANCHORS).filter(([,[latitude,longitude]])=>{
      const {x,y}=projectPoint(latitude,longitude);
      return maskAt(x,y)!=='#';
    });
    expect(afloat).toEqual([]);
  });

  it('anchors the big wine countries in their wine regions, not their geographic middle',()=>{
    // Kansas is the middle of the United States; the wine is in California.
    const [latitude,longitude]=countryAnchor('United States')!;
    expect(longitude).toBeLessThan(-115);
    expect(latitude).toBeGreaterThan(32);
    expect(latitude).toBeLessThan(43);
  });
});

describe('map projection',()=>{
  it('spans the whole grid',()=>{
    expect(MAP_WIDTH).toBe(MAP_COLUMNS*MAP_CELL);
    expect(MAP_HEIGHT).toBe(MAP_ROWS*MAP_CELL);
  });

  it('places longitude left to right and latitude top to bottom',()=>{
    expect(projectPoint(0,-180)).toEqual({x:0,y:80});
    expect(projectPoint(0,180).x).toBe(MAP_WIDTH);
    expect(projectPoint(50,0).y).toBeLessThan(projectPoint(-20,0).y);
  });
});

describe('markers',()=>{
  const journal=[country('France',34),country('Italy',21),country('Spain',12),country('Portugal',7),
    country('Germany',6),country('Austria',3),country('Switzerland',2),country('Hungary',1),
    country('United States',9),country('Argentina',4),country('Chile',2),country('Australia',3),
    country('New Zealand',2),country('South Africa',2)];

  it('sizes markers by how much of the journal comes from the country',()=>{
    const {markers}=buildMapMarkers(journal);
    const byCountry=new Map(markers.map(marker=>[marker.country,marker]));
    expect(byCountry.get('France')!.radius).toBeGreaterThan(byCountry.get('Italy')!.radius);
    expect(byCountry.get('Italy')!.radius).toBeGreaterThan(byCountry.get('Hungary')!.radius);
  });

  it('draws the busiest countries last so they are not painted over',()=>{
    const {markers}=buildMapMarkers(journal);
    expect(markers.at(-1)!.country).toBe('France');
  });

  it('separates crowded markers without letting one leave its country behind',()=>{
    const {markers}=buildMapMarkers(journal);
    for(let i=0;i<markers.length;i+=1){
      const marker=markers[i];
      expect(Math.hypot(marker.x-marker.anchorX,marker.y-marker.anchorY)).toBeLessThanOrEqual(MARKER_MAX_DRIFT+1e-6);
      for(let j=i+1;j<markers.length;j+=1){
        const other=markers[j];
        expect(Math.hypot(marker.x-other.x,marker.y-other.y)).toBeGreaterThan(marker.radius+other.radius-1e-6);
      }
    }
  });

  it('is stable across renders',()=>{
    expect(buildMapMarkers(journal).markers).toEqual(buildMapMarkers(journal).markers);
  });

  it('counts countries it cannot place instead of dropping them',()=>{
    const {markers,unplaced}=buildMapMarkers([country('France',3),country('Atlantis',1)]);
    expect(markers).toHaveLength(1);
    expect(unplaced).toBe(1);
  });

  it('merges names that share an anchor',()=>{
    const {markers,unplaced}=buildMapMarkers([country('United States',5),country('USA',4)]);
    expect(markers).toHaveLength(1);
    expect(markers[0].wines).toBe(9);
    expect(unplaced).toBe(0);
  });
});

describe('countries too wide for one dot',()=>{
  it('measures how far apart a country\'s regions are rather than keeping a list',()=>{
    // The rule is the halo: past it the lit patch around one region no longer
    // reaches the next, which is where a single dot starts telling lies.
    expect(countryIsSpread('United States')).toBe(true);
    expect(countryIsSpread('Australia')).toBe(true);
    expect(countryIsSpread('Canada')).toBe(true);
    expect(countryIsSpread('Argentina')).toBe(true);
    expect(countryIsSpread('New Zealand')).toBe(true);
    // South Africa's regions are all within an hour of Cape Town, and it is in
    // the anchor table precisely so the rule can be seen excluding it.
    expect(regionSpread('South Africa')).toBeLessThan(3);
    expect(countryIsSpread('South Africa')).toBe(false);
    // France has no region anchors at all, so it is one dot by having nothing
    // to say otherwise.
    expect(countryIsSpread('France')).toBe(false);
  });

  it('puts every region anchor on a land cell, so no dot floats in open water',()=>{
    const afloat=Object.entries(REGION_ANCHORS).flatMap(([inCountry,regions])=>
      Object.entries(regions).filter(([,[latitude,longitude]])=>{
        const {x,y}=projectPoint(latitude,longitude);
        return maskAt(x,y)!=='#';
      }).map(([name])=>`${inCountry}/${name}`));
    expect(afloat).toEqual([]);
  });

  it('gives a spread country a dot per region instead of one for the lot',()=>{
    // The report: a Willamette Valley and a Finger Lakes both showing as
    // California, three thousand miles from where the wine is.
    const {markers}=buildMapMarkers([country('United States',30)],[
      region('United States','Napa Valley',12),
      region('United States','Willamette Valley',10),
      region('United States','Finger Lakes',8)
    ]);
    expect(markers).toHaveLength(3);
    expect(markers.map(m=>m.region).sort()).toEqual(['Finger Lakes','Napa Valley','Willamette Valley']);
    const finger=markers.find(m=>m.region==='Finger Lakes')!;
    const napa=markers.find(m=>m.region==='Napa Valley')!;
    expect(finger.anchorX).toBeGreaterThan(napa.anchorX+30);
    expect(finger.wines).toBe(8);
    expect(markers.every(m=>m.country==='United States')).toBe(true);
  });

  it('leaves a country whose regions sit together as the single dot it is',()=>{
    const {markers}=buildMapMarkers([country('South Africa',9)],[
      region('South Africa','Stellenbosch',5),region('South Africa','Swartland',4)
    ]);
    expect(markers).toHaveLength(1);
    expect(markers[0].region).toBeNull();
    expect(markers[0].wines).toBe(9);
  });

  it('falls back to the country where no region of it resolved',()=>{
    // Wines filed under the country alone, or a region the anchors do not
    // carry. A journal never loses a stamp it has earned.
    const {markers}=buildMapMarkers([country('United States',6)],[region('United States','Ozark Mountain',6)]);
    expect(markers).toHaveLength(1);
    expect(markers[0].region).toBeNull();
    expect(markers[0].wines).toBe(6);
  });

  it('ignores regions of countries that are not drawn that way',()=>{
    const {markers}=buildMapMarkers([country('France',40)],[region('France','Burgundy',40)]);
    expect(markers).toHaveLength(1);
    expect(markers[0].region).toBeNull();
  });

  it('keeps every marker separately addressable',()=>{
    const {markers}=buildMapMarkers([country('United States',20),country('Australia',9)],[
      region('United States','Napa Valley',12),region('United States','Columbia Valley',8),
      region('Australia','Barossa Valley',5),region('Australia','Margaret River',4)
    ]);
    expect(new Set(markers.map(m=>m.id)).size).toBe(markers.length);
    expect(markers).toHaveLength(4);
  });

  it('reads the region names the place tree stores, accents and all',()=>{
    expect(regionAnchor('New Zealand','Hawke\u2019s Bay')).not.toBeNull();
    expect(regionAnchor('New Zealand',"Hawke's Bay")).toEqual(regionAnchor('New Zealand','Hawke\u2019s Bay'));
    expect(regionAnchor('Argentina','Lujan de Cuyo')).toEqual(regionAnchor('Argentina','Luj\u00e1n de Cuyo'));
    expect(regionAnchor('France','Burgundy')).toBeNull();
  });

  it('still counts countries in the caption, not dots',()=>{
    // A passport counts countries. Twelve American dots are one stamp.
    expect(mapCaption([country('United States',30),country('France',10)]))
      .toBe('2 countries stamped · United States leads with 30');
  });
});

describe('land dots',()=>{
  it('splits every land dot into exactly one of the two paths',()=>{
    const landCells=LAND_MASK.reduce((total,row)=>total+[...row].filter(cell=>cell==='#').length,0);
    const count=(path:string)=>path.split('M').length-1;
    const {visited,quiet}=landDotPaths(buildMapMarkers([country('France',3)]).markers);
    expect(count(visited)+count(quiet)).toBe(landCells);
    expect(count(visited)).toBeGreaterThan(0);
  });

  it('lights nothing when the journal is empty',()=>{
    const {visited,quiet}=landDotPaths([]);
    expect(visited).toBe('');
    expect(quiet).not.toBe('');
  });
});

describe('caption',()=>{
  it('invites a first stamp when there is nothing to show',()=>{
    expect(mapCaption([])).toBe('Your first stamp lands here.');
  });

  it('names the leading country',()=>{
    expect(mapCaption([country('France',34),country('Italy',21)])).toBe('2 countries stamped · France leads with 34');
  });

  it('counts a country it cannot place',()=>{
    expect(mapCaption([country('Atlantis',2)])).toBe('1 country stamped');
  });
});
