import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe,expect,it } from 'vitest';

const read=(name:string)=>readFileSync(join(process.cwd(),'src',name),'utf8');
const producer=read('producer.css'),styles=read('styles.css');
/** Character ranges covered by a `prefers-color-scheme:dark` block. */
const darkBlocks=(css:string)=>[...css.matchAll(/@media[^{]*prefers-color-scheme\s*:\s*dark[^{]*\{/g)].map(match=>{
  let depth=1,index=match.index!+match[0].length;
  while(index<css.length&&depth>0){if(css[index]==='{')depth++;else if(css[index]==='}')depth--;index++}
  return [match.index!,index] as const;
});

describe('lettering laid over a photograph',()=>{
  /**
   * Reported as: the producer name was unreadable in dark mode. The hero took
   * its text colour from --paper, which is white in a light theme and #171f2e
   * in a dark one, so a bright picture of an estate carried near-black
   * lettering. A photograph is a photograph in both themes; only the theme's
   * own surfaces should swap.
   */
  it('takes its colour from a token the theme never redefines',()=>{
    const hero=[...producer.matchAll(/([^{}]*has-hero[^{}]*)\{([^{}]*)\}/g)]
      .filter(rule=>/(?:^|;)\s*color\s*:/.test(rule[2]));
    expect(hero.length,'the hero does colour its own lettering').toBeGreaterThan(0);
    for(const rule of hero){
      expect(rule[2],`${rule[1].trim()} must not read a theme surface`).not.toMatch(/color\s*:\s*var\(--paper\)/);
      expect(rule[2]).toMatch(/color\s*:\s*var\(--on-photo\)/);
    }
  });

  it('defines that token once, outside any dark block',()=>{
    const declarations=[...styles.matchAll(/--on-photo\s*:/g)].map(match=>match.index!);
    expect(declarations,'one definition, so it cannot swap ends').toHaveLength(1);
    expect(darkBlocks(styles).some(([start,end])=>declarations[0]>=start&&declarations[0]<end)).toBe(false);
  });

  it('keeps a scrim under the lettering that is dark at both ends of the picture',()=>{
    // The gradient used to start fully transparent, so a title sitting high on
    // a bright photograph had nothing behind it at all.
    const shade=producer.match(/\.producer-header\.has-hero \.producer-header-shade\{([^}]*)\}/);
    expect(shade,'the hero paints a scrim').toBeTruthy();
    expect(shade![1]).not.toMatch(/linear-gradient\(\s*180deg\s*,\s*transparent/);
    expect(shade![1]).toMatch(/#0d1320[0-9a-f]{2}/);
  });
});
