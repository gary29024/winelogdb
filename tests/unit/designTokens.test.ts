import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe,expect,it } from 'vitest';

const dir=join(process.cwd(),'src');
const sheets=readdirSync(dir).filter(name=>name.endsWith('.css')).map(name=>({name,css:readFileSync(join(dir,name),'utf8')}));
const styles=sheets.find(sheet=>sheet.name==='styles.css')!.css;
const root=styles.slice(styles.indexOf(':root{'),styles.indexOf('}',styles.indexOf(':root{')));

const declaredIn=(css:string)=>new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(match=>match[1]));
const tokens=declaredIn(root);
const declaredAnywhere=new Set(sheets.flatMap(sheet=>[...declaredIn(sheet.css)]));
const references=sheets.flatMap(sheet=>[...sheet.css.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map(match=>({sheet:sheet.name,token:match[1]})));

// Declared ahead of the component work that will use them; every other token
// has to earn its place by being referenced somewhere.
const RESERVED=['--s1','--s2','--s3','--s4','--s5','--s6','--s7'];

describe('design tokens',()=>{
  it('resolves every var() a stylesheet references',()=>{
    // A var() naming a token that does not exist does not raise anything - the
    // declaration is simply dropped and the element renders unstyled, which is
    // easy to miss and hard to trace back. A typo has to fail here instead.
    const unresolved=references.filter(ref=>!declaredAnywhere.has(ref.token));
    expect(unresolved).toEqual([]);
  });

  it('keeps no token nobody uses',()=>{
    const used=new Set(references.map(ref=>ref.token));
    expect([...tokens].filter(token=>!used.has(token)&&!RESERVED.includes(token))).toEqual([]);
  });

  it('orders the ink ramp from darkest to lightest',()=>{
    // The steps are referenced by number across 29 stylesheets, so a value
    // edited out of order would silently invert contrast wherever two adjacent
    // steps meet.
    const steps=['--ink','--ink-2','--ink-3','--ink-4','--ink-5','--ink-6','--ink-7','--ink-8'];
    const luminance=(token:string)=>{
      const hex=new RegExp(`${token}:#([0-9a-f]{6})`).exec(root)?.[1];
      expect(hex,`${token} should be a six-digit hex in :root`).toBeTruthy();
      return [0,2,4].reduce((sum,at)=>sum+parseInt(hex!.slice(at,at+2),16),0);
    };
    const ramp=steps.map(luminance);
    expect(ramp).toEqual([...ramp].sort((a,b)=>a-b));
  });

  it('gives the accent a text-safe sibling',()=>{
    // --wine is the brand red at 4.0:1 on white, below the 4.5:1 small-text
    // threshold; --wine-ink exists so accent text has somewhere legible to go.
    const contrast=(hex:string)=>{
      const channel=(at:number)=>{
        const value=parseInt(hex.slice(at,at+2),16)/255;
        return value<=.03928?value/12.92:((value+.055)/1.055)**2.4;
      };
      const l=.2126*channel(0)+.7152*channel(2)+.0722*channel(4);
      return 1.05/(l+.05);
    };
    const wineInk=/--wine-ink:#([0-9a-f]{6})/.exec(root)![1];
    expect(contrast(wineInk)).toBeGreaterThanOrEqual(4.5);
  });

  it('leaves no raw hex inside the token block itself beyond the declarations',()=>{
    // Guards the substitution pass: a colour written into :root as part of a
    // rule rather than a token would be invisible to every other stylesheet.
    const notADeclaration=root.replace(/--[a-z0-9-]+:\s*#[0-9a-f]{3,8}/g,'');
    expect(notADeclaration.match(/#[0-9a-f]{3,8}/g)??[]).toEqual(['#10182d','#f7f8fa']);
  });
});
