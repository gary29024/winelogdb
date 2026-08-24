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

  it('keeps a grand cru as the appellation it legally is',()=>{
    // A Charmes-Chambertin is not a Gevrey-Chambertin: the grand cru is its own
    // AOC, so it sits beside the village rather than under it.
    expect(at('France','Burgundy','Charmes-Chambertin')).toEqual(['France','Burgundy','Charmes-Chambertin']);
    expect(at('France','Burgundy','Clos de la Roche')).toEqual(['France','Burgundy','Clos de la Roche']);
    expect(at('France','Burgundy','Corton-Charlemagne')).toEqual(['France','Burgundy','Corton-Charlemagne']);
    expect(placesCompatible('Gevrey-Chambertin','Charmes-Chambertin')).toBe(false);
  });

  it('never lets another field overwrite what the appellation field named',()=>{
    // Recognition sometimes puts the commune in region and the grand cru in
    // appellation. Reading the region field first would rewrite Charmes to
    // Gevrey and silently change which wine this is.
    expect(at('France','Gevrey-Chambertin','Charmes-Chambertin')).toEqual(['France','Burgundy','Charmes-Chambertin']);
  });

  it('reads a premier cru as its village appellation however it is written',()=>{
    // The climat belongs to the wine, not to the legal origin. Recognition
    // writes all of these, with and without the cru marker, so all of them have
    // to land on one appellation or the journal splits the same wine again.
    for(const spelling of ['Vosne-Romanée Premier Cru Les Suchots','Vosne-Romanée 1er Cru Les Suchots',
      'Vosne-Romanée Les Suchots','Vosne Romanee Suchots','Vosne-Romanée 1er Cru']){
      expect(at('France','Burgundy',spelling)).toEqual(['France','Burgundy','Vosne-Romanée']);
    }
    expect(at('France','Burgundy','Gevrey-Chambertin 1er Cru Les Cazetiers')).toEqual(['France','Burgundy','Gevrey-Chambertin']);
    expect(at('France','Bordeaux','Saint-Émilion Grand Cru Classé')).toEqual(['France','Bordeaux','Saint-Émilion']);
  });

  it('only reaches a specific place by dropping a suffix',()=>{
    // "Bourgogne Hautes Côtes de Nuits" starts with "Bourgogne". Reading a
    // region-level prefix would throw away which appellation the wine came from.
    expect(at('France','Burgundy','Bourgogne Hautes Côtes de Nuits')).toEqual(['France','Burgundy','Bourgogne Hautes Côtes de Nuits']);
    expect(at('United States','Napa Valley','Napa Valley Something Else')).toEqual(['United States','Napa Valley','Napa Valley Something Else']);
    // A climat on its own names no appellation the tree knows.
    expect(at('France','Burgundy','Les Suchots')).toEqual(['France','Burgundy','Les Suchots']);
  });

  it('keeps a cru appellation that is spelled out in full',()=>{
    // "Chablis Grand Cru" is an appellation in its own right, so the exact match
    // has to win before the premier-cru reading strips at the marker.
    expect(at('France','Burgundy','Chablis Grand Cru')).toEqual(['France','Burgundy','Chablis Grand Cru']);
    expect(at('France','Alsace','Alsace Grand Cru')).toEqual(['France','Alsace','Alsace Grand Cru']);
  });

  it('never drops an appellation the tree does not carry',()=>{
    // The regression this guards: the tree used to answer with the region alone
    // and the unknown appellation was written away as null.
    expect(at('France','Burgundy','Bourgogne Hautes Côtes de Nuits')).toEqual(['France','Burgundy','Bourgogne Hautes Côtes de Nuits']);
    expect(at('United States','Napa Valley','Some Unmapped Bench')).toEqual(['United States','Napa Valley','Some Unmapped Bench']);
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

  it('keeps an appellation the tree does not carry instead of clearing it',()=>{
    // Without this arm the UPDATE fired on the region match and wrote the
    // unknown appellation away as NULL.
    expect(sql).toContain('NOT EXISTS (SELECT 1 FROM place_backfill_map p WHERE p.spelling=trim(wines.appellation))');
    expect(sql).toContain('THEN wines.appellation END');
  });

  it('lets the appellation field settle its own column',()=>{
    expect(sql).toContain("WHERE p.spelling=trim(COALESCE(wines.appellation,'')) AND p.depth>2");
  });

  it('maps the bare cru forms the resolver reads as a village appellation',()=>{
    expect(mapped.find(row=>row.spelling==='Vosne-Romanée 1er Cru'))
      .toMatchObject({region:'Burgundy',appellation:'Vosne-Romanée'});
    // An appellation that is a cru in its own right keeps its own reading.
    expect(mapped.find(row=>row.spelling==='Chablis Grand Cru'))
      .toMatchObject({region:'Burgundy',appellation:'Chablis Grand Cru'});
  });

  it('carries the punctuation variants SQL cannot fold for itself',()=>{
    // The resolver normalises before matching; the migration compares literals,
    // so "Vosne Romanee Suchots" only settles if the de-hyphenated spelling is
    // in the map for the prefix match to find.
    expect(mapped.some(row=>row.spelling==='Vosne Romanee')).toBe(true);
    expect(mapped.some(row=>row.spelling==='Vosne-Romanée')).toBe(true);
  });

  it('reads the longest known appellation a value starts with',()=>{
    expect(sql).toContain("substr(trim(COALESCE(wines.appellation,'')),1,length(p.spelling)+1)=p.spelling||' '");
    expect(sql).toContain('ORDER BY length(p.spelling) DESC LIMIT 1');
    // Only below-region places, so a region prefix cannot swallow the rest.
    expect(sql).toContain('WHERE p.depth>2 AND length(p.spelling)<length');
  });

  it('cleans up the lookup table it creates',()=>{
    expect(sql).toContain('CREATE TABLE place_backfill_map');
    expect(sql).toContain('DROP TABLE place_backfill_map;');
  });
});
