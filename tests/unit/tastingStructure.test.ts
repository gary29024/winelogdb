import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe,expect,it } from 'vitest';
import { hasTastingStructure,tastingStructureSchema } from '../../src/lib/wine/tastingStructure';

const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const path=join(dir,entry.name);
  return entry.isDirectory()?walk(path):[path];
});

describe('tasting structure',()=>{
  it('never hides or replaces a summary label based on its position',()=>{
    // Unset measures are filtered out, so the first card may be Acidity,
    // Finish or any other recorded measure rather than Flavour intensity.
    const positionalLabel=/\.tasting-structure-summary[^{}]*:(?:first|last|nth)-(?:child|of-type)[^{}]*\{[^{}]*(?:\bcontent\s*:|\bfont-size\s*:\s*0(?:\D|$))/;
    for(const path of walk('src').filter(path=>path.endsWith('.css'))){
      const css=readFileSync(path,'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
      expect(positionalLabel.test(css),path).toBe(false);
    }
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
