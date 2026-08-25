import { describe,expect,it } from 'vitest';
import { resolvePlace,placesCompatible } from '../../src/lib/places/resolve';
import { canonicalizeWineFields } from '../../src/lib/wine/canonicalize';

describe('Bolgheri Sassicaia DOC',()=>{
  it('keeps the autonomous DOC distinct from Bolgheri DOC',()=>{
    const place=resolvePlace({country:'Italy',region:'Tuscany',appellation:'Bolgheri Sassicaia'});
    expect(place).toMatchObject({
      country:'Italy',
      region:'Tuscany',
      appellation:'Bolgheri Sassicaia',
      denomination:'DOC',
      placeId:'italy/tuscany/bolgheri-sassicaia',
      unresolved:[]
    });
    expect(placesCompatible('Bolgheri','Bolgheri Sassicaia')).toBe(false);
  });

  it('recognizes the same DOC when the denomination is written on the label',()=>{
    const place=resolvePlace({country:'Italy',region:'Tuscany',appellation:'Bolgheri Sassicaia DOC'});
    expect(place.appellation).toBe('Bolgheri Sassicaia');
    expect(place.denomination).toBe('DOC');
  });

  it('does not collapse the appellation during wine canonicalization',()=>{
    const wine=canonicalizeWineFields({
      producer:'Tenuta San Guido',
      wineName:'Sassicaia',
      country:'Italy',
      region:'Tuscany',
      appellation:'Bolgheri Sassicaia'
    });
    expect(wine.region).toBe('Tuscany');
    expect(wine.appellation).toBe('Bolgheri Sassicaia');
  });
});
