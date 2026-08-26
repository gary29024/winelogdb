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

describe('focus indicator',()=>{
  it('draws exactly one, for the whole app',()=>{
    // There were three: a global wine ring declared identically in two
    // stylesheets, plus a button-only override in a neutral grey that quietly
    // won on specificity. A grey rounded rectangle around a control reads as a
    // border rather than as "the browser is here", which is how it was
    // reported.
    const rings=rules
      .filter(rule=>/:focus-visible/.test(rule.selector)&&/outline\s*:/.test(rule.body))
      .filter(rule=>!/outline:\s*none/.test(rule.body))
      .map(rule=>`${rule.sheet} ${rule.selector}`).sort();
    expect(rings).toEqual([
      'styles.css :focus-visible',
      // the only exceptions: both sit on a photo or a dark overlay, where the
      // wine accent would disappear
      'imageLightbox.css .photo-lightbox-trigger:focus-visible',
      'imageLightbox.css .photo-lightbox-close:focus-visible'
    ].sort());
  });

  it('leaves the scan sheet without one',()=>{
    // The sheet is focused on open so keyboard and screen-reader context moves
    // into it, but it is a tabindex=-1 container rather than something you can
    // act on, so a ring around it says nothing. Being bottom-anchored, only its
    // top edge showed - a stray red line across the sheet.
    const suppressed=rules.find(rule=>/^\.scan-sheet:focus\b/.test(rule.selector));
    expect(suppressed,'.scan-sheet should suppress its focus ring').toBeTruthy();
    expect(suppressed!.body).toContain('outline:none');
  });

  it('gives the scan trigger a radius of its own',()=>{
    // It sets border:0 but still inherits the generic button radius, and the
    // ring follows that - so the shape has to be chosen rather than left over.
    const trigger=rules.find(rule=>rule.selector==='.mobile-nav button.scan-nav'&&/appearance/.test(rule.body));
    expect(trigger!.body).toContain('border-radius:');
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
