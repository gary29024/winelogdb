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

describe('the viewer\'s own score sits with their own experience',()=>{
  // wine.rating is the recipient's, not the wine's. In .detail-pills it read as
  // a property of the bottle, next to appellation and grapes, while the summary
  // the user had just edited did not show the number they typed.
  it('lists the rating in the experience rows and keeps it out of the pills',()=>{
    expect(sharedPage).toContain("'Your rating'");
    const pills=sharedPage.slice(sharedPage.indexOf('className="detail-pills"'));
    expect(pills.slice(0,pills.indexOf('</div>'))).not.toContain('wine.rating');
  });

  it('shows the notes inside the panel that edits them',()=>{
    const panel=sharedPage.indexOf('experience-panel');
    expect(panel).toBeGreaterThan(-1);
    expect(sharedPage.indexOf('shared-experience-notes')).toBeGreaterThan(panel);
  });
});
