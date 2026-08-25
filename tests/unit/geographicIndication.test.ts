import { describe,expect,it } from 'vitest';
import { PLACES } from '../../src/lib/places/hierarchy';
import { labelDenomination,lookupPlace,resolvePlace } from '../../src/lib/places/resolve';
import { canonicalizeWineFields } from '../../src/lib/wine/canonicalize';
import { catalogHierarchyLabel } from '../../src/lib/cuvees/catalogPresentation';

const place=(country:string|null,region:string|null,appellation:string|null)=>resolvePlace({country,region,appellation});
const igtZones=PLACES.filter(node=>node.denomination==='IGT');

describe('IGT and IGP zones',()=>{
  it('reads a region-named IGT as its zone and keeps the name clean',()=>{
    // Every Super Tuscan is Toscana IGT. This used to null the appellation.
    const toscana=place('Italy','Tuscany','Toscana IGT');
    expect(toscana.appellation).toBe('Toscana');
    expect(toscana.denomination).toBe('IGT');
    expect(toscana.region).toBe('Tuscany');
  });

  it('leaves the bare region name to the region',()=>{
    // "Toscana" with no marker is the administrative region, and claiming IGT
    // for it would put a denomination on every Tuscan wine.
    const region=place('Italy','Tuscany','Toscana');
    expect(region.appellation).toBeNull();
    expect(region.denomination).toBeNull();
    expect(place('Italy','Veneto','Veneto').denomination).toBeNull();
  });

  it('resolves a zone with a name of its own with or without the marker',()=>{
    for(const value of ['Terre Siciliane IGT','Terre Siciliane']){
      const resolved=place('Italy','Sicily',value);
      expect(resolved.appellation).toBe('Terre Siciliane');
      expect(resolved.denomination).toBe('IGT');
    }
  });

  it('still prefers the tree where the tree knows the denomination',()=>{
    // A label that says "Barolo DOC" is wrong; Barolo is DOCG.
    expect(place('Italy','Piedmont','Barolo').denomination).toBe('DOCG');
    expect(place('Italy','Tuscany','Chianti Classico DOCG').denomination).toBe('DOCG');
    expect(place('Italy','Tuscany','Bolgheri').denomination).toBe('DOC');
    expect(place('Italy','Tuscany','Bolgheri Sassicaia').appellation).toBe('Bolgheri Sassicaia');
  });

  it('reads the marker off the label for a zone the tree does not carry',()=>{
    // The insurance against an incomplete list: the bottle said IGT.
    const invented=place('Italy','Tuscany','Poggio Inventato IGT');
    expect(invented.denomination).toBe('IGT');
    expect(invented.appellation).toBe('Poggio Inventato');
    // Nothing is silently dropped: the raw value is still reported unresolved.
    expect(invented.unresolved).toContain('Poggio Inventato IGT');
  });

  it('reads a marker even when no place resolves at all',()=>{
    const nowhere=resolvePlace({country:null,region:null,appellation:'Somewhere Unknown IGP'});
    expect(nowhere.denomination).toBe('IGP');
    expect(nowhere.appellation).toBe('Somewhere Unknown');
  });

  it('treats France’s multi-region IGPs as denominations in their own right',()=>{
    expect(place('France',null,'Pays d’Oc').denomination).toBe('IGP');
    expect(place('France',null,'Pays d’Oc IGP').denomination).toBe('IGP');
    expect(place('France',null,'Val de Loire IGP').denomination).toBe('IGP');
  });

  it('does not read DOC or DOCG off a label',()=>{
    expect(labelDenomination('Toscana IGT')).toBe('IGT');
    expect(labelDenomination('Pays d’Oc IGP')).toBe('IGP');
    expect(labelDenomination('Barolo DOCG')).toBeNull();
    expect(labelDenomination('Bolgheri DOC')).toBeNull();
    expect(labelDenomination(null)).toBeNull();
  });

  it('keeps a region-named zone out of the wine’s appellation column when unmarked',()=>{
    const marked=canonicalizeWineFields({producer:'X',wineName:'Y',country:'Italy',region:'Tuscany',appellation:'Toscana IGT',grapes:[],grapeBlend:[]});
    expect(marked.appellation).toBe('Toscana');
    const bare=canonicalizeWineFields({producer:'X',wineName:'Y',country:'Italy',region:'Tuscany',appellation:'Toscana',grapes:[],grapeBlend:[]});
    expect(bare.appellation).toBeNull();
  });

  it('sorts an IGT catalogue entry as regional, beside IGP',()=>{
    expect(catalogHierarchyLabel({name:'Rosso',appellation:'Toscana IGT'})).toBe('Regional');
    expect(catalogHierarchyLabel({name:'Rouge',appellation:'Pays d’Oc IGP'})).toBe('Regional');
  });
});

describe('the zone list',()=>{
  it('covers every Italian region that registers an IGT',()=>{
    const regions=new Set(igtZones.map(zone=>zone.id.split('/')[1]));
    for(const region of ['tuscany','veneto','friuli-venezia-giulia','trentino-alto-adige','lombardy','sicily',
      'campania','abruzzo','marche','umbria','puglia','sardinia','emilia-romagna','lazio','calabria',
      'basilicata','liguria','molise'])expect([...regions]).toContain(region);
  });

  it('registers no IGT for the two regions that have none',()=>{
    // Piedmont and Valle d'Aosta are entirely DOC/DOCG.
    const ids=igtZones.map(zone=>zone.id);
    expect(ids.some(id=>id.startsWith('italy/piedmont/'))).toBe(false);
    expect(ids.some(id=>id.includes('valle-d-aosta/'))).toBe(false);
  });

  it('carries the whole national list rather than a sample',()=>{
    // Italy registers 118 IGT zones. Shared zones are filed once, so the tree
    // holds slightly fewer; a sharp drop means entries were lost.
    expect(igtZones.length).toBeGreaterThanOrEqual(100);
  });

  it('gives every zone a marked alias so the label always resolves it',()=>{
    for(const zone of igtZones)expect(zone.aliases).toContain(`${zone.name} IGT`);
  });

  it('requires the marker only where the zone shares a name with its region',()=>{
    const required=igtZones.filter(zone=>zone.denominationRequired).map(zone=>zone.name).sort();
    expect(required).toEqual(['Basilicata','Calabria','Campania','Lazio','Marche','Puglia','Toscana','Umbria','Veneto']);
    // Each of those really is reachable only through the marked form.
    for(const name of required)expect(lookupPlace(name).some(node=>node.denomination==='IGT')).toBe(false);
  });

  it('does not let a zone shadow an appellation of the same name',()=>{
    for(const zone of igtZones){
      const bare=lookupPlace(zone.name).filter(node=>node.id!==zone.id);
      for(const other of bare)expect(other.denomination).not.toBe('IGT');
    }
  });
});
