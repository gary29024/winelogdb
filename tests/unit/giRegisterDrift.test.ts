import { describe,expect,it } from 'vitest';
import { PLACES } from '../../src/lib/places/hierarchy';
import register from '../../src/lib/places/giRegister.json';

/**
 * The register owns the names; the tree owns where each zone sits, because
 * eAmbrosia does not say which administrative region a zone belongs to. This
 * test is the seam between them: after `npm run gi:sync` replaces the file with
 * the Commission's own list, every name the two disagree on shows up here.
 *
 * Until that first sync the file is seeded from the tree, so the comparison is
 * circular and proves only that the two stay in step. `source` says which state
 * the file is in, and the drift assertions do the real work from the sync on.
 */
const treeZones=PLACES.filter(place=>place.denomination==='IGT'||place.denomination==='IGP');
const registered=new Map(register.entries.map(entry=>[`${entry.country}:${entry.name}`,entry]));
const countryOf=(id:string)=>id.startsWith('italy/')?'IT':'FR';

describe('geographical indication register',()=>{
  it('records where its list came from',()=>{
    expect(['eambrosia','hand-transcribed']).toContain(register.source);
    if(register.source==='eambrosia')expect(register.fetchedAt).toBeTruthy();
  });

  it('carries no zone the register does not list',()=>{
    const unknown=treeZones
      .filter(zone=>!registered.has(`${countryOf(zone.id)}:${zone.name}`))
      .map(zone=>`${countryOf(zone.id)}:${zone.name}`);
    expect(unknown).toEqual([]);
  });

  it('is missing no zone the register lists',()=>{
    const present=new Set(treeZones.map(zone=>`${countryOf(zone.id)}:${zone.name}`));
    const missing=[...registered.keys()].filter(key=>!present.has(key));
    expect(missing).toEqual([]);
  });

  it('agrees with the register on which term each zone uses',()=>{
    const wrong=treeZones.flatMap(zone=>{
      const entry=registered.get(`${countryOf(zone.id)}:${zone.name}`);
      return entry&&entry.denomination!==zone.denomination?[`${zone.name}: tree ${zone.denomination}, register ${entry.denomination}`]:[];
    });
    expect(wrong).toEqual([]);
  });

  it('holds a plausible national list rather than a sample',()=>{
    expect(register.counts.IT).toBeGreaterThanOrEqual(100);
  });
});
