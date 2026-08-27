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

const channel=(decimal:number)=>decimal<=0.04045?decimal/12.92:((decimal+0.055)/1.055)**2.4;
const relative=([red,green,blue]:number[])=>0.2126*channel(red/255)+0.7152*channel(green/255)+0.0722*channel(blue/255);

/**
 * Perceived lightness of any colour a stylesheet can name literally, so "light"
 * means light to an eye rather than to a regex.
 *
 * Hex was the whole of this check until a literal rgba(255,255,255,.96) walked
 * past it and put a white save bar over a dark form.
 */
/**
 * Below this, a colour is a tint over whatever is underneath rather than a
 * surface of its own - a 7% white lift reads as light on a light ground and
 * dark on a dark one, which is exactly the behaviour wanted.
 */
const OPAQUE_ENOUGH=0.5;
const alphaOf=(part:string|undefined)=>{
  if(part===undefined)return 1;
  const value=part.endsWith('%')?Number(part.slice(0,-1))/100:Number(part);
  return Number.isFinite(value)?value:1;
};

export function luminance(colour:string):number|null{
  const value=colour.trim().toLowerCase();
  if(value.startsWith('#')){
    let digits=value.slice(1);
    if(digits.length===3||digits.length===4)digits=[...digits].map(character=>character+character).join('');
    if(digits.length!==6&&digits.length!==8)return null;
    if(digits.length===8&&parseInt(digits.slice(6,8),16)/255<OPAQUE_ENOUGH)return null;
    return relative([0,2,4].map(index=>parseInt(digits.slice(index,index+2),16)));
  }
  const rgb=value.match(/^rgba?\(([^)]+)\)$/);
  if(rgb){
    const parts=rgb[1].split(/[\s,/]+/).filter(Boolean);
    if(alphaOf(parts[3])<OPAQUE_ENOUGH)return null;
    const channels=parts.slice(0,3).map(part=>part.endsWith('%')?Number(part.slice(0,-1))*2.55:Number(part));
    return channels.length===3&&channels.every(Number.isFinite)?relative(channels):null;
  }
  const hsl=value.match(/^hsla?\(([^)]+)\)$/);
  if(hsl){
    const parts=hsl[1].split(/[\s,/]+/).filter(Boolean);
    if(alphaOf(parts[3])<OPAQUE_ENOUGH)return null;
    const lightness=Number(String(parts[2]??'').replace('%',''));
    // Lightness is not luminance, but it orders colours the same way, which is
    // all this check needs.
    return Number.isFinite(lightness)?lightness/100:null;
  }
  return null;
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
const surfaces=/(?:background|background-color|fill)\s*:\s*(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\))/g;
const LIGHT=0.75;

/**
 * Surfaces whose ground is a photograph rather than the theme, so white is
 * right in both themes: the badges and the favourite pill that sit on a wine
 * label in the journal grid.
 */
const overPhotograph=new Set([
  'favorites.css .journal-favorite-button #ffffffed',
  'journalBatch.css .journal-select-mark #ffffffde',
  'journalMonths.css .journal-grid-vintage #ffffffe8'
]);

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
          .filter(match=>{const light=luminance(match[1]);return light!=null&&light>LIGHT})
          .map(match=>`${sheet.name} ${rule.selector.split(',')[0]} ${match[1]}`));
    }).filter(entry=>!overPhotograph.has(entry));
    // A token keeps its meaning across themes; a hex keeps its lightness.
    expect([...new Set(offenders)]).toEqual([]);
  });

  it('recognises a light colour when it sees one, in any notation',()=>{
    // The guard is only worth having if it can tell the two apart.
    for(const light of ['#f4f1ed','#fff','#ffffffee','rgb(255,255,255)','rgba(255,255,255,.96)',
      'rgb(255 255 255 / 96%)','hsl(0,0%,97%)'])
      expect(luminance(light),light).toBeGreaterThan(LIGHT);
    for(const dark of ['#212a3b','#2b211b','rgba(23,31,46,.96)','hsl(220,30%,12%)'])
      expect(luminance(dark),dark).toBeLessThan(LIGHT);
    // Anything it cannot read is not guessed at.
    for(const unknown of ['transparent','currentColor','var(--paper)','color-mix(in srgb,var(--paper) 96%,transparent)'])
      expect(luminance(unknown),unknown).toBeNull();
    // A barely-there white is a tint over whatever is underneath, not a
    // surface, and behaves correctly in both themes already.
    for(const tint of ['#ffffff12','rgba(255,255,255,.07)','#ffffff1c'])
      expect(luminance(tint),tint).toBeNull();
  });

  it('catches the notations that walked past it before',()=>{
    // The save bar on the wine form was a literal rgba(255,255,255,.96) and the
    // check only read hex, so a white panel shipped over a dark form.
    const sample='.bar{background:rgba(255,255,255,.96)}.badge{background:#ffffffee}.tint{background:#ffffff12}';
    const flagged=[...sample.matchAll(surfaces)]
      .map(match=>match[1]).filter(colour=>{const light=luminance(colour);return light!=null&&light>LIGHT});
    expect(flagged).toEqual(['rgba(255,255,255,.96)','#ffffffee']);
  });

  it('does not count what a dark-mode block deliberately paints',()=>{
    const sample='.a{background:rgba(255,255,255,.96)}@media(prefers-color-scheme:dark){.a{background:#eceff6}}';
    const dark=darkRanges(sample);
    const found=[...sample.matchAll(surfaces)].filter(match=>!dark.some(([start,end])=>(match.index??0)>=start&&(match.index??0)<end));
    expect(found).toHaveLength(1);
    expect(found[0][1]).toBe('rgba(255,255,255,.96)');
  });
});
