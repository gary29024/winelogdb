import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { describe,expect,it } from 'vitest';
import { PLACES } from '../../src/lib/places/hierarchy';
import { ancestry,lookupPlace,placeRollup,placesCompatible,resolvePlace } from '../../src/lib/places/resolve';
import { canonicalizeWineFields } from '../../src/lib/wine/canonicalize';
import { cuveeIdentityCandidateCompatible,cuveeIdentitySignature,cuveeSignature } from '../../src/lib/cuvees/entities';

const at=(country:string|null,region:string|null,appellation:string|null)=>{
  const place=resolvePlace({country,region,appellation});
  return [place.country,place.region,place.appellation];
};

describe('place tree integrity',()=>{
  it('has unique ids and a parent that exists',()=>{
    const ids=new Set(PLACES.map(place=>place.id));
    expect(ids.size).toBe(PLACES.length);
    const orphans=PLACES.filter(place=>place.parent!==null&&!ids.has(place.parent));
    expect(orphans).toEqual([]);
  });

  it('never puts a child at a broader tier than its parent',()=>{
    // Same-tier nesting is deliberate - North Coast is an area inside the
    // California area - but a child may never be broader than its parent.
    const depth={country:0,area:1,region:2,subregion:3,appellation:4} as const;
    const inverted=PLACES.filter(place=>{
      const parent=ancestry(place).at(-2);
      return parent&&depth[place.tier]<depth[parent.tier];
    }).map(place=>place.id);
    expect(inverted).toEqual([]);
  });

  it('reaches a country from every node',()=>{
    const stranded=PLACES.filter(place=>ancestry(place)[0].tier!=='country').map(place=>place.id);
    expect(stranded).toEqual([]);
  });
});

describe('resolving which field a place belongs in',()=>{
  it('settles the two ways a Napa wine arrives on the same answer',()=>{
    expect(at('United States','Napa Valley','Oakville')).toEqual(['United States','Napa Valley','Oakville']);
    expect(at('United States','California','Oakville')).toEqual(['United States','Napa Valley','Oakville']);
    expect(at('United States','California','Napa Valley')).toEqual(['United States','Napa Valley',null]);
  });

  it('does not promote a broad designation to a growing region',()=>{
    // California is an area: it stays put only because nothing narrower is known.
    expect(at('United States','California',null)).toEqual(['United States','California',null]);
    expect(at('Australia','South Australia','Barossa Valley')).toEqual(['Australia','Barossa Valley',null]);
  });

  it('leaves the Old World shape the journal already records alone',()=>{
    expect(at('France','Burgundy','Gevrey-Chambertin')).toEqual(['France','Burgundy','Gevrey-Chambertin']);
    expect(at('France','Bourgogne','Côte de Nuits')).toEqual(['France','Burgundy','Côte de Nuits']);
    expect(at('France','Bordeaux','Pauillac')).toEqual(['France','Bordeaux','Pauillac']);
    expect(at('Italy','Piedmont','Barolo')).toEqual(['Italy','Piedmont','Barolo']);
  });

  it('fills the country from the tree when recognition left it out',()=>{
    expect(at(null,null,'Oakville')).toEqual(['United States','Napa Valley','Oakville']);
    expect(at(null,'Marlborough',null)).toEqual(['New Zealand','Marlborough',null]);
  });

  it('matches aliases and unaccented spellings',()=>{
    expect(lookupPlace('Bourgogne')).toEqual(lookupPlace('Burgundy'));
    expect(lookupPlace('Cote de Nuits')).toEqual(lookupPlace('Côte de Nuits'));
    expect(lookupPlace('napa')).toEqual(lookupPlace('Napa Valley'));
  });

  it('keeps a place it does not know rather than dropping it',()=>{
    const place=resolvePlace({country:'Ruritania',region:'Nowhere Valley',appellation:'Tiny Hill'});
    expect([place.country,place.region,place.appellation]).toEqual(['Ruritania','Nowhere Valley','Tiny Hill']);
    expect(place.unresolved).toEqual(['Tiny Hill','Nowhere Valley','Ruritania']);
    expect(place.placeId).toBeNull();
  });

  it('reports nothing to resolve for an empty wine',()=>{
    expect(resolvePlace({})).toMatchObject({country:null,region:null,appellation:null,path:[],placeId:null,unresolved:[]});
  });
});

describe('roll-up counting',()=>{
  it('lists every place an Oakville wine sits inside, narrowest first',()=>{
    expect(placeRollup({country:'United States',region:'Napa Valley',appellation:'Oakville'})).toEqual([
      'united-states/california/north-coast/napa-valley/oakville',
      'united-states/california/north-coast/napa-valley',
      'united-states/california/north-coast',
      'united-states/california',
      'united-states'
    ]);
  });

  it('puts both slottings of one wine under the same region, so the Passport counts it once',()=>{
    const asOakville=placeRollup({country:'United States',region:'Napa Valley',appellation:'Oakville'});
    const asNapa=placeRollup({country:'United States',region:'California',appellation:'Napa Valley'});
    expect(asOakville).toContain('united-states/california/north-coast/napa-valley');
    expect(asNapa).toContain('united-states/california/north-coast/napa-valley');
  });
});

describe('place compatibility',()=>{
  it('treats one place named at two depths as the same origin',()=>{
    expect(placesCompatible('Napa Valley','Oakville')).toBe(true);
    expect(placesCompatible('Burgundy','Gevrey-Chambertin')).toBe(true);
  });

  it('keeps siblings and unrelated places apart',()=>{
    expect(placesCompatible('Oakville','Rutherford')).toBe(false);
    expect(placesCompatible('Burgundy','Pauillac')).toBe(false);
  });

  it('says nothing about a place it cannot resolve',()=>{
    expect(placesCompatible('Oakville','Tiny Hill')).toBe(false);
    expect(placesCompatible(null,'Oakville')).toBe(true);
  });

  it('lets a legacy cuvee row match across place depths',()=>{
    // The appellation is folded into the signature, so a row stored under the
    // base signature used to need the appellation to agree verbatim. Rows whose
    // signature already diverged are not reachable here - that fork is now
    // prevented upstream, where both slottings normalise to the same value.
    // A row stored under the bare base signature, matched against a style-aware
    // identity: the one path where the appellations still have to agree.
    const base=cuveeSignature('Cabernet Sauvignon','Oakville',['Screaming Eagle']);
    const identity=cuveeIdentitySignature('Cabernet Sauvignon','Oakville','red',['Screaming Eagle']);
    expect(base).not.toBe(identity);
    expect(cuveeIdentityCandidateCompatible(base,base,identity,'Napa Valley','Oakville','red','red')).toBe(true);
    expect(cuveeIdentityCandidateCompatible(base,base,identity,'Rutherford','Oakville','red','red')).toBe(false);
  });

  it('gives both slottings of one wine the same cuvee signature once canonicalised',()=>{
    const asOakville=canonicalizeWineFields({country:'United States',region:'Napa Valley',appellation:'Oakville'});
    const asNapaFirst=canonicalizeWineFields({country:'United States',region:'California',appellation:'Oakville'});
    expect(cuveeIdentitySignature('Cabernet Sauvignon',asOakville.appellation,'red',['Screaming Eagle']))
      .toBe(cuveeIdentitySignature('Cabernet Sauvignon',asNapaFirst.appellation,'red',['Screaming Eagle']));
  });
});

describe('canonicalizeWineFields',()=>{
  it('re-slots places on every write path, not just recognition',()=>{
    expect(canonicalizeWineFields({country:'USA',region:'California',appellation:'Oakville'}))
      .toMatchObject({country:'United States',region:'Napa Valley',appellation:'Oakville'});
  });

  it('still normalises spelling before asking the tree',()=>{
    expect(canonicalizeWineFields({country:'france',region:'bourgogne',appellation:'vosne romanee'}))
      .toMatchObject({country:'France',region:'Burgundy',appellation:'Vosne-Romanée'});
  });

  it('leaves the other fields alone',()=>{
    expect(canonicalizeWineFields({producer:'Ridge',wineName:'Ridge Monte Bello',region:'Santa Cruz Mountains',grapes:['cabernet sauvignon']}))
      .toMatchObject({wineName:'Monte Bello',region:'Santa Cruz Mountains',grapes:['Cabernet Sauvignon']});
  });
});

describe('the generated backfill migration',()=>{
  const sql=readFileSync(resolvePath(process.cwd(),'src/lib/db/migrations/0032_place_hierarchy.sql'),'utf8');
  const unquote=(value:string)=>value==='NULL'?null:value.slice(1,-1).replace(/''/g,"'");
  const mapped=[...sql.matchAll(/^ {2}\('((?:[^']|'')*)',(\d+),((?:NULL|'(?:[^']|'')*')),((?:NULL|'(?:[^']|'')*')),((?:NULL|'(?:[^']|'')*'))\),?$/gm)]
    .map(match=>({spelling:unquote(`'${match[1]}'`),region:unquote(match[3]),appellation:unquote(match[4]),country:unquote(match[5])}));

  it('carries a row for every spelling the resolver knows',()=>{
    expect(mapped.length).toBeGreaterThan(500);
  });

  it('preserves the recognised values before rewriting anything',()=>{
    expect(sql).toContain('ALTER TABLE wines ADD COLUMN recognized_region TEXT;');
    expect(sql).toContain('UPDATE wines SET recognized_region=region');
    expect(sql.indexOf('recognized_region=region')).toBeLessThan(sql.indexOf('DROP TABLE place_backfill_map'));
  });

  it('agrees with the runtime resolver on every spelling it maps',()=>{
    const drifted=mapped.filter(row=>{
      const place=resolvePlace({country:null,region:row.spelling,appellation:null});
      return place.region!==row.region||place.appellation!==row.appellation||place.country!==row.country;
    });
    expect(drifted).toEqual([]);
  });

  it('cleans up the lookup table it creates',()=>{
    expect(sql).toContain('CREATE TABLE place_backfill_map');
    expect(sql.trimEnd().endsWith('-- 814 spellings across 635 tree nodes.')||sql.includes('DROP TABLE place_backfill_map;')).toBe(true);
  });
});
