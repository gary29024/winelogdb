import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { hasTastingStructure,tastingStructureSchema } from '../../src/lib/wine/tastingStructure';

describe('tasting structure',()=>{
  it('never hides or replaces a summary label based on its position',()=>{
    // Unset measures are filtered out, so the first card may be Acidity,
    // Finish or any other recorded measure rather than Flavour intensity.
    const css=readFileSync('src/wineFormCompact.css','utf8').replace(/\/\*[\s\S]*?\*\//g,'');
    const positionalLabel=/\.tasting-structure-summary[^{}]*:(?:first|last|nth)-(?:child|of-type)[^{}]*\{[^{}]*(?:\bcontent\s*:|\bfont-size\s*:\s*0(?:\D|$))/;
    expect(positionalLabel.test(css)).toBe(false);
  });

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
