import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe,expect,it } from 'vitest';

const src=join(process.cwd(),'src');
const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const path=join(dir,entry.name);
  return entry.isDirectory()?walk(path):[path];
});
// Comments are stripped first: a comment sitting between a block's brace and
// its first selector would otherwise be read as part of that selector.
const sheets=walk(src).filter(path=>path.endsWith('.css'))
  .map(path=>({name:path.split('/').pop()!,css:readFileSync(path,'utf8').replace(/\/\*[\s\S]*?\*\//g,'')}));

/** Perceived lightness, so "light" means light to an eye rather than to a regex. */
function luminance(hex:string){
  let value=hex.replace('#','');
  if(value.length===3)value=[...value].map(character=>character+character).join('');
  const channel=(pair:string)=>{
    const decimal=parseInt(pair,16)/255;
    return decimal<=0.04045?decimal/12.92:((decimal+0.055)/1.055)**2.4;
  };
  return 0.2126*channel(value.slice(0,2))+0.7152*channel(value.slice(2,4))+0.0722*channel(value.slice(4,6));
}

/** Character ranges covered by a `prefers-color-scheme:dark` block. */
function darkRanges(css:string){
  const ranges:Array<[number,number]>=[];
  const opener=/@media[^{]*prefers-color-scheme\s*:\s*dark[^{]*\{/g;
  for(let match=opener.exec(css);match;match=opener.exec(css)){
    let depth=1,index=match.index+match[0].length;
    while(index<css.length&&depth>0){
      if(css[index]==='{')depth++;else if(css[index]==='}')depth--;
      index++;
    }
    ranges.push([match.index,index]);
  }
  return ranges;
}

/**
 * Surfaces a light theme paints and a dark theme forgets.
 *
 * Reported as the Passport summary icons vanishing in dark mode: the circle
 * was a hardcoded #f4f1ed while the icon inside it was var(--ink), which
 * inverts to near-white. Light on light is invisible, and the same pairing was
 * sitting in the producer search field, where it would have swallowed what you
 * typed.
 */
const surfaces=/(?:background|background-color|fill)\s*:\s*(#[0-9a-fA-F]{3,8})\b/g;
const LIGHT=0.75;

/** Every innermost rule in a sheet, with where it sits. */
function rules(css:string){
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(match=>({
    selector:match[1].trim(),body:match[2],index:match.index??0
  }));
}

describe('surfaces that survive a dark theme',()=>{
  it('paints no hardcoded light background outside a dark-mode block',()=>{
    const offenders=sheets.flatMap(sheet=>{
      const dark=darkRanges(sheet.css);
      const inDark=(index:number)=>dark.some(([start,end])=>index>=start&&index<end);
      const all=rules(sheet.css);
      // A selector the sheet also paints inside a dark block has been thought
      // about: the collection tints keep their hue and swap ends there rather
      // than flattening into one neutral token.
      const overridden=new Set(all.filter(rule=>inDark(rule.index)).map(rule=>rule.selector));
      return all
        .filter(rule=>!inDark(rule.index)&&!overridden.has(rule.selector))
        .flatMap(rule=>[...rule.body.matchAll(surfaces)]
          .filter(match=>{const hex=match[1];return (hex.length===4||hex.length===7)&&luminance(hex)>LIGHT})
          .map(match=>`${sheet.name} ${rule.selector.split(',')[0]} ${match[1]}`));
    });
    // A token keeps its meaning across themes; a hex keeps its lightness.
    expect([...new Set(offenders)]).toEqual([]);
  });

  it('recognises a light colour when it sees one',()=>{
    // The guard is only worth having if it can tell the two apart.
    expect(luminance('#f4f1ed')).toBeGreaterThan(LIGHT);
    expect(luminance('#fff')).toBeGreaterThan(LIGHT);
    expect(luminance('#212a3b')).toBeLessThan(LIGHT);
    expect(luminance('#2b211b')).toBeLessThan(LIGHT);
  });

  it('does not count what a dark-mode block deliberately paints',()=>{
    const sample='.a{background:#fff}@media(prefers-color-scheme:dark){.a{background:#eceff6}}';
    const dark=darkRanges(sample);
    const found=[...sample.matchAll(surfaces)].filter(match=>!dark.some(([start,end])=>(match.index??0)>=start&&(match.index??0)<end));
    expect(found).toHaveLength(1);
    expect(found[0][1]).toBe('#fff');
  });
});
