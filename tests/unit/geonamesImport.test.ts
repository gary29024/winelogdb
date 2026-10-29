import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { buildPlaceNames,parseAdmin1Codes,parseCountryInfo,parseGeonamesCities,shardPlaces } from '../../src/lib/places/geonamesImport';
import { zipEntry } from '../../scripts/zipEntry';
import { GEONAMES_ADMIN1,GEONAMES_CITIES,GEONAMES_COUNTRIES,geonamesRow } from './support/placesFixture';

describe('the GeoNames place import',()=>{
  it('keeps populated places, to about eleven metres, and drops those no longer there',()=>{
    const cities=[GEONAMES_CITIES,geonamesRow(4,'Lumbala',-12.65,22.6,'PPLQ','AO','',19000),geonamesRow(5,'Pittwater',-33.6,151.3,'PPLH','AU','02',63482),'not\ta\tplace'].join('\n');
    const {places,updatedAt}=parseGeonamesCities(cities);
    expect(places).toHaveLength(9);
    expect(places).toContainEqual(['Jiyūgaoka',35.611,139.6678,'JP','40']);
    expect(places.map(place=>place[0])).not.toContain('Lumbala');
    expect(places.map(place=>place[0])).not.toContain('Pittwater');
    expect(updatedAt).toBe('2026-09-14');
  });

  it('names small countries’ places by country rather than district',()=>{
    const names=buildPlaceNames(parseCountryInfo(GEONAMES_COUNTRIES),parseAdmin1Codes(GEONAMES_ADMIN1));
    expect(names).toEqual({regions:{'JP.40':'Tokyo','JP.12':'Hokkaido'},countries:{JP:'Japan',HK:'Hong Kong'}});
  });

  it('files each place once, in its one-degree cell, identically on every build',()=>{
    const {places}=parseGeonamesCities(GEONAMES_CITIES),shards=shardPlaces(places);
    const cells=[...shards.values()].flat();
    expect(cells.flatMap(([,rows])=>rows)).toHaveLength(places.length);
    expect(cells.find(([key])=>key==='35:139')?.[1].map(place=>place[0])).toEqual(['Tokyo','Jiyūgaoka','Den’enchōfu','Ebisu','Chūō','Haneda']);
    expect(JSON.stringify([...shardPlaces(places)])).toBe(JSON.stringify([...shards]));
  });

  it('reads cities500.txt out of the GeoNames zip without an unzip command',()=>{
    // Written by Python's zipfile: one deflated entry and one stored.
    const archive=readFileSync('tests/unit/fixtures/geonames-cities500.zip');
    const {places}=parseGeonamesCities(new TextDecoder().decode(zipEntry(archive,'cities500.txt')));
    expect(places).toEqual([['Jiyūgaoka',35.611,139.6678,'JP','40'],['Tin Hau',22.2809,114.1924,'HK','HEA']]);
    expect(new TextDecoder().decode(zipEntry(archive,'readme.txt'))).toBe('Stored without compression.\n');
    expect(()=>zipEntry(archive,'cities1000.txt')).toThrow('cities1000.txt is not in the ZIP archive');
    expect(()=>zipEntry(new TextEncoder().encode('not a zip archive at all'),'cities500.txt')).toThrow('Not a ZIP archive');
  });
});
