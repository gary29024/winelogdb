import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe,expect,it } from 'vitest';

const src=join(process.cwd(),'src');
const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const path=join(dir,entry.name);
  return entry.isDirectory()?walk(path):[path];
});
const files=walk(src);
const read=(path:string)=>readFileSync(join(src,path),'utf8');
const strip=(text:string)=>text.replace(/\/\*[\s\S]*?\*\//g,'');
const sheets=files.filter(path=>path.endsWith('.css'))
  .map(path=>({name:path.slice(src.length+1),text:strip(readFileSync(path,'utf8'))}));
// Every stylesheet that declares a class, by a selector that actually targets it
// rather than merely mentioning it inside a longer descendant chain. A class can
// be styled in several sheets, so the question is whether ANY of them is loaded.
const declaredIn=(selector:string)=>sheets.filter(sheet=>
  [...sheet.text.matchAll(/([^{}]+)\{[^{}]*\}/g)]
    .some(match=>match[1].split(',').some(part=>part.trim().split(/\s+/).pop()===selector)));

const sharedPage=read('features/wines/SharedWinesPage.tsx');
const library=read('features/wines/LibraryPage.tsx');
const passport=read('features/journey/PassportPage.tsx');
const imported=(source:string)=>[...source.matchAll(/import\s+'[./]*?([^'/]+\.css)'/g)].map(match=>match[1]);
// main.tsx loads these for every route, so they are nobody's to ask for.
const global=imported(read('main.tsx'));

describe('the shared wine page carries the styles it borrows',()=>{
  // The page reuses the wine detail gallery and lightbox markup but never
  // renders <WineImage>, which is the only other importer of the stylesheet
  // those rules live in. It is also a static import in App.tsx while every
  // WineImage importer is behind lazy(), so the rules are in a route chunk the
  // entry bundle never pulls: a cold /shared/:id had an unstyled photo strip
  // and a lightbox with no backdrop, while arriving from the Journal worked.
  it('imports a stylesheet for every wine-detail class it renders',()=>{
    const own=imported(sharedPage);
    expect(own.length,'the page should import its own stylesheets').toBeGreaterThan(0);
    const rendered=[...sharedPage.matchAll(/className="([^"{}]+)"/g)]
      .flatMap(match=>match[1].split(/\s+/)).filter(Boolean);
    expect(rendered).toContain('image-lightbox');
    expect(rendered).toContain('detail-gallery');
    const missing=[...new Set(rendered)].filter(name=>{
      const styled=declaredIn(`.${name}`);
      // A class nothing styles is not this test's business; one that is styled
      // only by a stylesheet neither this page nor main.tsx loads is the bug.
      return styled.length>0&&!styled.some(sheet=>own.includes(sheet.name)||global.includes(sheet.name));
    });
    expect(missing,'classes styled by a stylesheet this page never imports').toEqual([]);
  });
});

describe('a shared bottle says so without relying on colour',()=>{
  // --shared-line against --paper is roughly 1.2:1, so the tint and the 3px
  // inset bar are not a signal on their own, and a screen reader gets nothing
  // from either. Every surface that tints a shared card also has to name it.
  it('gives the journal card a mark carrying the sharer, not just a tint',()=>{
    // The mark has to name the sharer, not merely exist: the tint alone was the
    // problem. A fallback for a missing name is fine, an absent name is not.
    expect(library).toMatch(/journal-shared-mark[\s\S]{0,200}w\.sharedBy/);
    expect(library).toMatch(/journal-shared-mark[\s\S]{0,200}kind="shared"/);
    expect(declaredIn('.journal-shared-mark'),'.journal-shared-mark should be styled').not.toEqual([]);
    expect(library.includes("w.shared?' shared':''"),'the tint stays as the quiet half').toBe(true);
  });

  it('gives the passport row an icon and a label a screen reader reaches',()=>{
    expect(passport).toContain('passport-recent-shared');
    expect(passport).toContain('visually-hidden');
    expect(passport).toMatch(/Shared by \$\{item\.sharedBy\}/);
  });
});

describe('the owner view and the shared view are one layout',()=>{
  const owner=read('features/wines/DetailPage.tsx');
  // The two pages show the same wine to two people. Where they show the same
  // thing they have to show it the same way, or the app reads as two apps: the
  // score was a pill on one and a row on the other, the notes were a section of
  // their own on one and part of the experience on the other, and each page had
  // grown its own formatPrice.
  const sections=(source:string)=>[...source.matchAll(/section-label">([A-Za-z][A-Za-z /]*)</g)].map(match=>match[1]);
  const rows=(source:string)=>[...source.matchAll(/\['((?:Your rating|Drinking date|Tasting \/ event|Venue|Location|Price))'/g)].map(match=>match[1]);

  it('orders the shared page as a subset of the owner page',()=>{
    const shared=sections(sharedPage),full=sections(owner);
    expect(shared).toEqual(['Wine details','Your experience']);
    // Same relative order, with the owner's extra panels sitting after them.
    expect(full.filter(name=>shared.includes(name))).toEqual(shared);
    expect(full.indexOf('Your experience')).toBeLessThan(full.indexOf('Deep Search'));
  });

  it('lists the same experience rows in the same order on both',()=>{
    expect(rows(sharedPage)).toEqual(['Your rating','Drinking date','Tasting / event','Venue','Location','Price']);
    expect(rows(owner)).toEqual(rows(sharedPage));
  });

  it('keeps the score out of the wine facts on both',()=>{
    for(const [name,source] of [['shared',sharedPage],['owner',owner]] as const){
      const pills=source.slice(source.indexOf('className="detail-pills"'));
      expect(pills.slice(0,pills.indexOf('</div>')),`${name} pills should not carry a rating`).not.toContain('.rating');
    }
  });

  it('shows the notes inside the panel that owns them, under one class',()=>{
    for(const [name,source] of [['shared',sharedPage],['owner',owner]] as const){
      const panel=source.indexOf('experience-panel');
      expect(panel,`${name} should have an experience panel`).toBeGreaterThan(-1);
      expect(source.indexOf('detail-experience-notes'),`${name} notes belong in the panel`).toBeGreaterThan(panel);
    }
  });

  it('formats through one shared module rather than a copy each',()=>{
    for(const [name,source] of [['shared',sharedPage],['owner',owner]] as const){
      expect(source,`${name} should import the shared formatters`).toContain("from '../../lib/wine/detailFormat'");
      expect(/function formatPrice|const formatPrice=/.test(source),`${name} should not redefine formatPrice`).toBe(false);
    }
  });

  it('gives both pages the dense one-line fact rows',()=>{
    expect(sharedPage).toContain('detail-facts');
    expect(owner).toContain('detail-facts');
    const declared=declaredIn('.detail-facts').concat(sheets.filter(sheet=>/\.detail-facts\b/.test(sheet.text)));
    expect(declared.length,'.detail-facts should be styled').toBeGreaterThan(0);
  });
});
