import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { describe,expect,it } from 'vitest';
import { placeRollup,resolvePlace } from '../../src/lib/places/resolve';

const au=(appellation:string,region:string|null=null)=>resolvePlace({country:'Australia',region,appellation});

describe('Australian zones',()=>{
  it('keeps Barossa and Barossa Valley apart',()=>{
    // Different GIs. A wine labelled Barossa is usually a blend across the
    // Barossa Valley and Eden Valley, and reading it as the valley both renames
    // the wine and counts a region on the Passport it never came from.
    expect(au('Barossa').region).toBe('Barossa');
    expect(au('Barossa Valley').region).toBe('Barossa Valley');
    expect(au('Eden Valley').region).toBe('Eden Valley');
  });

  it('rolls both valleys up into the zone',()=>{
    // The zone is the reason to model it rather than just drop the alias: a
    // Barossa Valley wine is still a Barossa wine.
    for(const valley of ['Barossa Valley','Eden Valley'])
      expect(placeRollup({country:'Australia',region:valley}),valley).toContain('australia/south-australia/barossa');
    expect(placeRollup({country:'Australia',region:'Barossa'})).not.toContain('australia/south-australia/barossa/barossa-valley');
  });

  it('reads a zone and a state as the GIs they are',()=>{
    // Australia registers its states and zones as GIs, unlike California, which
    // is a state appellation rather than an AVA.
    for(const name of ['Barossa','Limestone Coast','Port Phillip','South Australia','Victoria'])
      expect(au(name).denomination,name).toBe('GI');
  });

  it('places the other zones above the regions we already carried',()=>{
    for(const [zone,region] of [['Limestone Coast','Coonawarra'],['Fleurieu','McLaren Vale'],
      ['Mount Lofty Ranges','Adelaide Hills'],['Port Phillip','Yarra Valley'],
      ['North East Victoria','Rutherglen'],['Central Ranges','Orange'],['South West Australia','Margaret River']])
      expect(placeRollup({country:'Australia',region}),`${region} in ${zone}`)
        .toContain(placeRollup({country:'Australia',region:zone})[0]);
  });

  it('nests Frankland River inside Great Southern',()=>{
    // It was a sibling, so it rolled up to Western Australia and skipped the
    // region it actually sits in.
    expect(au('Frankland River')).toMatchObject({region:'Great Southern',appellation:'Frankland River'});
    expect(placeRollup({country:'Australia',appellation:'Frankland River'}))
      .toContain('australia/western-australia/south-west-australia/great-southern');
  });

  it('leaves Hunter Valley as one name',()=>{
    // The register calls the zone Hunter Valley and the single region inside it
    // Hunter. Splitting them would fork the name every label uses and change
    // nothing about what it rolls up to.
    expect(au('Hunter Valley').region).toBe('Hunter Valley');
    expect(au('Hunter').region).toBe('Hunter Valley');
  });
});

describe('the Barossa remap for wines already logged',()=>{
  const sql=readFileSync(resolvePath(process.cwd(),'src/lib/db/migrations/0035_barossa_zone.sql'),'utf8');

  it('moves a row only where the label said Barossa and not Barossa Valley',()=>{
    expect(sql).toContain("lower(trim(COALESCE(recognized_region,'')))='barossa'");
    expect(sql).toContain("NOT LIKE '%barossa valley%'");
  });

  it('leaves a Barossa Valley row that names something narrower alone',()=>{
    expect(sql.match(/region='Barossa Valley' AND trim\(COALESCE\(appellation,''\)\)=''/g)).toHaveLength(2);
  });

  it('moves a Frankland River row whether or not it already names a vineyard',()=>{
    // 0032 kept an appellation it could not resolve, so some of these rows carry
    // a vineyard name. Both shapes have to leave the stale region behind.
    expect(sql).toContain("UPDATE wines SET region='Great Southern' WHERE region='Frankland River';");
    expect(sql.indexOf("SET appellation='Frankland River'"))
      .toBeLessThan(sql.indexOf("SET region='Great Southern' WHERE"));
  });
});
