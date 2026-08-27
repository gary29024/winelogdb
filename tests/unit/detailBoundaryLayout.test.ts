import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe,expect,it } from 'vitest';

const src=join(process.cwd(),'src');
const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const path=join(dir,entry.name);
  return entry.isDirectory()?walk(path):[path];
});
const files=walk(src);
// Comments are stripped: one sitting above a rule would otherwise be read as
// part of that rule's selector.
const css=files.filter(path=>path.endsWith('.css'))
  .map(path=>readFileSync(path,'utf8').replace(/\/\*[\s\S]*?\*\//g,'')).join('\n');
const rule=(selector:string)=>[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter(match=>match[1].split(',').some(part=>part.trim()===selector))
  .map(match=>match[2]).join(';');

describe('the tag row on a wine',()=>{
  it('is a wrapping row, because the tags give a line nowhere to break',()=>{
    // The tags render as adjacent spans with no whitespace text node between
    // them - the visible gap was margin-right, not a space - so the line could
    // not break and six of them pushed the page 33px wider than the phone.
    // Everything then looked shifted at the right edge, which is what was
    // reported. A flex row breaks between items.
    const declared=rule('.detail-tags');
    expect(declared,'.detail-tags should be styled by a selector of its own').toBeTruthy();
    expect(declared).toContain('display:flex');
    expect(declared).toContain('flex-wrap:wrap');
    expect(/gap:/.test(declared),'the gap the margin was faking').toBe(true);
  });

  it('is the class the wine detail page actually renders',()=>{
    const markup=readFileSync(join(src,'features/wines/DetailPage.tsx'),'utf8');
    expect(markup).toContain('className="detail-tags"');
  });
});

describe('the save bar on the wine form',()=>{
  it('clears the navigation instead of guessing a height',()=>{
    // It was pinned at a flat bottom:84px. The bar is 64px plus the device's
    // home-indicator inset, so on a phone with one the save button sat inside
    // the tab bar with the scan button punched through it.
    const declared=rule('.wine-form-actions:has(.wine-edit-cancel)');
    expect(declared).toContain('position:fixed');
    expect(declared,'the offset should follow the nav, not a magic number').toContain('--app-nav-height');
    expect(/bottom:\s*\d+px/.test(declared),'no hardcoded bottom offset').toBe(false);
  });

  it('takes its surface from the theme, so it is not a white panel at night',()=>{
    const declared=rule('.wine-form-actions:has(.wine-edit-cancel)');
    expect(declared).toContain('--paper');
    expect(/background:\s*rgba?\(/.test(declared),'a literal colour cannot follow the theme').toBe(false);
  });
});
