import { describe,expect,it } from 'vitest';
import { hasTastingStructure,tastingStructureSchema } from '../../src/lib/wine/tastingStructure';

describe('tasting structure',()=>{
  it('accepts the six quick-tap structural scales',()=>{
    const result=tastingStructureSchema.parse({flavourIntensity:'medium_plus',acidity:'high',tannin:'medium_minus',body:'medium',finish:'long',alcohol:'medium'});
    expect(result).toEqual({flavourIntensity:'medium_plus',acidity:'high',tannin:'medium_minus',body:'medium',finish:'long',alcohol:'medium'});
    expect(hasTastingStructure(result)).toBe(true);
  });

  it('rejects values outside the defined scales',()=>{
    expect(tastingStructureSchema.safeParse({acidity:'very_high'}).success).toBe(false);
    expect(tastingStructureSchema.safeParse({alcohol:'medium_plus'}).success).toBe(false);
  });

  it('treats blank/null selections as no structure',()=>{
    expect(hasTastingStructure({})).toBe(false);
    expect(hasTastingStructure({acidity:null,finish:null})).toBe(false);
  });
});
