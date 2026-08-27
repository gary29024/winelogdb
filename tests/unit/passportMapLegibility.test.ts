import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe,expect,it } from 'vitest';

const read=(name:string)=>readFileSync(join(process.cwd(),'src',name),'utf8');
const styles=read('styles.css'),passport=read('passport.css');

/** The two palettes: bare :root is light, the dark-scheme block overrides it. */
const darkBlock=styles.slice(styles.search(/@media\s*\(prefers-color-scheme\s*:\s*dark\)/));
const tokenIn=(css:string,name:string)=>{
  const found=[...css.matchAll(new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{3,6})`,'g'))];
  return found.length?found[found.length-1][1]:null;
};
const token=(name:string,scheme:'light'|'dark')=>{
  if(scheme==='dark'){const dark=tokenIn(darkBlock,name);if(dark)return dark}
  return tokenIn(styles.slice(0,styles.search(/@media\s*\(prefers-color-scheme\s*:\s*dark\)/)),name)
    ??tokenIn(passport,name);
};

const rgb=(hex:string)=>{
  const value=hex.length===4?[...hex.slice(1)].map(character=>character+character).join(''):hex.slice(1);
  return [0,2,4].map(index=>parseInt(value.slice(index,index+2),16));
};
const relative=(hex:string)=>{
  const channel=(decimal:number)=>decimal<=0.04045?decimal/12.92:((decimal+0.055)/1.055)**2.4;
  const [red,green,blue]=rgb(hex).map(value=>value/255);
  return 0.2126*channel(red)+0.7152*channel(green)+0.0722*channel(blue);
};
const contrast=(a:string,b:string)=>{
  const first=relative(a),second=relative(b);
  return (Math.max(first,second)+0.05)/(Math.min(first,second)+0.05);
};

/** What the two dot classes actually resolve to, per theme. */
const fillOf=(className:string)=>passport.match(new RegExp(`\\.${className}\\{fill:var\\(--([a-z0-9-]+)\\)\\}`))?.[1]??null;

/**
 * The world map is a field of dots, and the whole point of the quiet ones is
 * that you can see the landmass they draw. Tokenising them for dark mode
 * dropped them to --sunken, which against a white card is 1.09:1 - the map
 * effectively disappeared in light mode, which is how it was reported.
 */
const GROUND={light:'#fffaf0',dark:'#2a2317'};
const READABLE=1.8;

describe('the passport world map',()=>{
  it('draws its landmass from tokens rather than fixed colours',()=>{
    expect(fillOf('passport-map-quiet'),'the unvisited dots').toBeTruthy();
    expect(fillOf('passport-map-visited'),'the visited dots').toBeTruthy();
  });

  it.each(['light','dark'] as const)('keeps the unvisited dots visible in %s',scheme=>{
    const quiet=token(fillOf('passport-map-quiet')!,scheme);
    expect(quiet,`--${fillOf('passport-map-quiet')} should resolve in ${scheme}`).toBeTruthy();
    expect(contrast(quiet!,GROUND[scheme])).toBeGreaterThan(READABLE);
  });

  it('would have caught the wash-out it exists for',()=>{
    // --sunken is what the dots were tokenised to, and against a white card it
    // is 1.09:1 - below anything a person can pick out.
    expect(contrast('#eef1f5',GROUND.light)).toBeLessThan(READABLE);
    expect(contrast('#212a3b',GROUND.dark)).toBeLessThan(READABLE);
  });

  it.each(['light','dark'] as const)('keeps a stamped country ahead of the rest in %s',scheme=>{
    // The map has one job beyond decoration: showing where you have been. The
    // visited dots have to lead, or the landmass competes with them.
    const quiet=token(fillOf('passport-map-quiet')!,scheme);
    const visited=token(fillOf('passport-map-visited')!,scheme);
    expect(contrast(visited!,GROUND[scheme])).toBeGreaterThan(contrast(quiet!,GROUND[scheme]));
  });
});
