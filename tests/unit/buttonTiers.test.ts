import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe,expect,it } from 'vitest';

const src=join(process.cwd(),'src');
const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const path=join(dir,entry.name);
  return entry.isDirectory()?walk(path):[path];
});
const files=walk(src);
const sheets=files.filter(path=>path.endsWith('.css')).map(path=>({name:path.split('/').pop()!,css:readFileSync(path,'utf8')}));
const markup=files.filter(path=>path.endsWith('.tsx')).map(path=>({name:path.split('/').pop()!,jsx:readFileSync(path,'utf8')}));

/** Every class that appears on a <button> anywhere in the app. */
const buttonClasses=new Set(markup.flatMap(file=>
  [...file.jsx.matchAll(/<button\b[^>]*/g)].flatMap(tag=>
    [...tag[0].matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].flatMap(attr=>
      (attr[1]??attr[2]??'').split(/[\s`${}?:'"]+/).filter(token=>/^[a-z][a-z0-9-]+$/.test(token))))));

// Comments sit between rules, so they land in the selector capture unless they
// are stripped first.
const rules=sheets.flatMap(sheet=>[...sheet.css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^}]*)\}/g)].map(rule=>({
  sheet:sheet.name,selector:rule[1].trim(),body:rule[2]
})));
// A state inherits colour and border from the rule it is a state of, and these
// helper elements are spans and pseudo-elements rather than the button itself.
const isState=(selector:string)=>/:hover|:active|:focus|::|\.active\b|scan-plus|select-mark|wine-image|-card\b|>img|\bspan\b/.test(selector);
const stylesAButton=(selector:string)=>/\bbutton\b/.test(selector)||[...buttonClasses].some(name=>selector.includes(`.${name}`));
const declares=(body:string,property:string)=>new RegExp(`(?:^|;)\\s*${property}\\s*:`).test(body);

describe('button tiers',()=>{
  it('gives every button on a filled background an explicit text colour',()=>{
    // The base button used to be a solid dark pill, so anything that painted its
    // own dark background inherited white text for free. Now the base is the
    // outlined tier with ink text, and a rule that forgets to say otherwise
    // renders dark-on-dark. That is how .scan-sheet-action lost its label.
    const unreadable=rules
      .filter(rule=>stylesAButton(rule.selector))
      .filter(rule=>/background(?:-color)?:\s*(?:var\(--(?:ink|wine|danger|bad|good)\b[^)]*\)|linear-gradient)/.test(rule.body))
      .filter(rule=>!declares(rule.body,'color'))
      .filter(rule=>!isState(rule.selector))
      .map(rule=>`${rule.sheet} ${rule.selector}`);
    expect(unreadable).toEqual([]);
  });

  it('makes every button rule say what its border is',()=>{
    // Same trap in the other direction: the old base set border:0, so a rule
    // that repainted the background but stayed quiet about the border now
    // inherits the secondary tier's outline and grows a stray hairline.
    const strayOutline=rules
      .filter(rule=>stylesAButton(rule.selector))
      .filter(rule=>/(?:^|;)\s*background(?:-color)?\s*:/.test(rule.body))
      .filter(rule=>!/(?:^|;)\s*border(?!-[a-z-]*radius)(?:-[a-z]+)*\s*:/.test(rule.body))
      .filter(rule=>!isState(rule.selector))
      .map(rule=>`${rule.sheet} ${rule.selector}`);
    expect(strayOutline).toEqual([]);
  });

  it('keeps the filled tier something a screen opts into',()=>{
    // The point of the change: a filled button has to be asked for by name. If
    // the bare element ever goes back to painting itself dark, every Remove and
    // Open on every page shouts as loudly as the one action that matters.
    const base=rules.find(rule=>rule.selector==='.button,button');
    expect(base,'.button,button base rule should exist in styles.css').toBeTruthy();
    expect(base!.body).toContain('background:var(--paper)');
    expect(base!.body).toContain('color:var(--ink)');
  });
});

describe('section labels',()=>{
  it('writes them as words rather than shouting',()=>{
    // The page kicker keeps the tracked-out uppercase treatment. A second tier
    // of the same device marks nothing, so section labels are sentence case and
    // carry a rule instead - which only works if the text is not already caps.
    const shouting=markup.flatMap(file=>
      [...file.jsx.matchAll(/className="section-label"[^>]*>([^<{]{2,})</g)]
        .filter(match=>match[1]===match[1].toUpperCase()&&/[A-Z]{2}/.test(match[1]))
        .map(match=>`${file.name}: ${match[1]}`));
    expect(shouting).toEqual([]);
  });
});

describe('chips',()=>{
  it('lets a chip wrap wherever something constrains its width',()=>{
    // The chip primitive sets white-space:nowrap, which is right for a status
    // pill and wrong for a two-word category label in an 80px column: the
    // collection card's "REGIONAL EXPLORER" could no longer wrap and spilled
    // 39px past the card. A chip that is given a max-width has to be allowed to
    // use a second line.
    const base=rules.find(rule=>rule.selector.startsWith('.chip,'));
    expect(base,'the chip primitive should exist in styles.css').toBeTruthy();
    expect(base!.body).toContain('white-space:nowrap');
    const aliases=base!.selector.split(',').map(part=>part.trim());

    const constrained=aliases.filter(alias=>rules.some(rule=>
      rule.selector.split(',').map(part=>part.trim()).includes(alias)&&/(?:^|;)\s*max-width\s*:/.test(rule.body)));
    const cannotWrap=constrained.filter(alias=>!rules.some(rule=>
      rule.selector.split(',').map(part=>part.trim()).includes(alias)&&/white-space:\s*normal/.test(rule.body)));
    expect(cannotWrap).toEqual([]);
  });
});
