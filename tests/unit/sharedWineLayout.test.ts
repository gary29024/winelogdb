import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe,expect,it } from 'vitest';

const src=join(process.cwd(),'src');
const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const path=join(dir,entry.name);
  return entry.isDirectory()?walk(path):[path];
});
const files=walk(src).map(path=>path.slice(src.length+1).replace(/\\/g,'/'));
const read=(path:string)=>readFileSync(join(src,path),'utf8');
const strip=(text:string)=>text.replace(/\/\*[\s\S]*?\*\//g,'');
const sheets=files.filter(path=>path.endsWith('.css'))
  .map(name=>({name,text:strip(read(name))}));
// Every stylesheet that declares a class, by a selector that actually targets it
// rather than merely mentioning it inside a longer descendant chain. A class can
// be styled in several sheets, so the question is whether ANY of them is loaded.
const declaredIn=(selector:string)=>sheets.filter(sheet=>
  [...sheet.text.matchAll(/([^{}]+)\{[^{}]*\}/g)]
    .some(match=>match[1].split(',').some(part=>part.trim().split(/\s+/).pop()===selector)));

const SHARED_PAGE='features/wines/SharedWinesPage.tsx';
const OWNER_PAGE='features/wines/DetailPage.tsx';
const library=read('features/wines/LibraryPage.tsx');
const passport=read('features/journey/PassportPage.tsx');
const fieldDefs=read('lib/wine/detailFields.ts');
// main.tsx loads these for every route, so they are nobody's to ask for.
const global=[...read('main.tsx').matchAll(/import\s+'[./]*?([^'/]+\.css)'/g)].map(match=>match[1]);

/** Resolve a relative import against a module path, the way the bundler does. */
function resolveImport(from:string,spec:string){
  const parts=from.split('/').slice(0,-1);
  for(const segment of spec.split('/')){
    if(segment==='.')continue;
    if(segment==='..')parts.pop();
    else parts.push(segment);
  }
  const base=parts.join('/');
  return [base,`${base}.ts`,`${base}.tsx`,`${base}/index.ts`,`${base}/index.tsx`].find(candidate=>files.includes(candidate))??'';
}

/**
 * Everything a page pulls in: its own module and every local module it imports,
 * transitively. A page renders through its components, so both the classes that
 * reach the screen and the stylesheets that reach the browser are facts about
 * the whole closure, not about one file.
 */
function closure(entry:string){
  const seen=new Set<string>(),queue=[entry];
  while(queue.length){
    const current=queue.shift();
    if(!current||seen.has(current))continue;
    seen.add(current);
    for(const match of read(current).matchAll(/from\s+'(\.[^']+)'/g)){
      const next=resolveImport(current,match[1]);
      if(next&&!next.endsWith('.css'))queue.push(next);
    }
  }
  return [...seen];
}
const cssOf=(modules:string[])=>modules.flatMap(module=>
  [...read(module).matchAll(/import\s+'[^']*?([^'/]+\.css)'/g)].map(match=>match[1]));

/**
 * Every class a module can put on an element: static className="a b", and
 * template literals, whose ${...} holes are resolved against the values they can
 * actually take. A class reachable only through a template literal is still a
 * class that needs rules, which is exactly how .detail-classification-village
 * shipped unstyled while an earlier version of this guard, reading static
 * strings only, stayed green.
 */
const CLASS_SUFFIXES:Record<string,string[]>={'detail-classification-':['grand_cru','premier_cru','village']};
function renderedClasses(source:string){
  const names=new Set<string>();
  for(const match of source.matchAll(/className="([^"{}]+)"/g))
    for(const name of match[1].split(/\s+/))if(name)names.add(name);
  const HOLE='�hole�';
  for(const match of source.matchAll(/className=\{`([^`]*)`\}/g))
    for(const token of match[1].replace(/\$\{[^}]*\}/g,HOLE).split(/\s+/)){
      if(!token)continue;
      const base=token.split(HOLE).join('');
      if(base)names.add(base);
      const prefix=token.endsWith(HOLE)?base:'';
      for(const suffix of CLASS_SUFFIXES[prefix]??[])names.add(`${prefix}${suffix}`);
    }
  return [...names];
}

describe('a wine detail page carries the styles it renders',()=>{
  // A cold /shared/:id once had an unstyled photo strip, a lightbox with no
  // backdrop and a classification pill with no rules at all, because the page
  // rendered wine-detail markup whose stylesheets only the other page imported.
  it.each([['shared',SHARED_PAGE],['owner',OWNER_PAGE]])('%s page styles every class in its import closure',(_name,entry)=>{
    const modules=closure(entry),loaded=[...cssOf(modules),...global];
    const rendered=[...new Set(modules.flatMap(module=>renderedClasses(read(module))))];
    expect(rendered).toContain('detail-classification');
    expect(rendered).toContain('detail-classification-village');
    expect(rendered).toContain('image-lightbox');
    const missing=rendered.filter(name=>{
      const styled=declaredIn(`.${name}`);
      // A class nothing styles is not this test's business; one styled only by a
      // stylesheet nothing in the closure loads is the bug.
      return styled.length>0&&!styled.some(sheet=>loaded.includes(sheet.name));
    });
    expect(missing,'classes styled by a stylesheet this page never loads').toEqual([]);
  });

  it('keeps the classification pill and its stylesheet in one module',()=>{
    // The structural fix for that bug class: a page cannot render the pill while
    // forgetting its rules, because the component that renders it owns them.
    const facts=read('features/wines/WineFacts.tsx');
    expect(facts).toContain('detail-classification');
    expect(facts).toContain('wineClassification.css');
    for(const page of [SHARED_PAGE,OWNER_PAGE])
      expect(read(page),`${page} should not hand-roll the pills`).not.toContain('className="detail-pills"');
  });
});

describe('both wine detail pages read from one field definition',()=>{
  // Adding or removing a row updates both wine detail pages together.
  it('defines the Wine details and experience rows in a single module',()=>{
    for(const label of ['Region','Appellation','Grapes / blend','Alcohol'])
      expect(fieldDefs,`Wine details should define ${label}`).toContain(`'${label}'`);
    for(const label of ['Your rating','Drinking date','Tasting / event','Venue','Location','Price'])
      expect(fieldDefs,`the experience rows should define ${label}`).toContain(`'${label}'`);
  });

  it('has neither page build those rows itself',()=>{
    for(const page of [SHARED_PAGE,OWNER_PAGE]){
      const source=read(page);
      expect(source,`${page} should import the shared builders`).toContain("from '../../lib/wine/detailFields'");
      // A literal row label in a page is a row that would exist on that page only.
      for(const label of ['Region','As recorded','Your rating','Drinking date'])
        expect(source,`${page} should not hand-roll the ${label} row`).not.toContain(`['${label}'`);
    }
  });

  it('keeps the score out of the wine facts',()=>{
    const facts=read('features/wines/WineFacts.tsx');
    expect(facts.slice(facts.indexOf('detail-pills'))).not.toContain('rating');
  });

  it('shows the notes inside the panel that owns them, under one class',()=>{
    for(const page of [SHARED_PAGE,OWNER_PAGE]){
      const source=read(page),panel=source.indexOf('experience-panel');
      expect(panel,`${page} should have an experience panel`).toBeGreaterThan(-1);
      expect(source.indexOf('detail-experience-notes'),`${page} notes belong in the panel`).toBeGreaterThan(panel);
    }
  });

  it('formats through one shared module rather than a copy each',()=>{
    for(const page of [SHARED_PAGE,OWNER_PAGE])
      expect(/function formatPrice|const formatPrice=/.test(read(page)),`${page} should not redefine formatPrice`).toBe(false);
  });
});

describe('shared cards keep attribution out of the visible card',()=>{
  it('uses the shared surface and puts provenance in the Journal accessible label',()=>{
    expect(library.includes("w.shared?' shared':''")).toBe(true);
    expect(library).not.toContain('journal-shared-mark');
    expect(library).toContain("shared by ${w.sharedBy||'a friend'}");
  });

  it('keeps Passport provenance screen-reader-only',()=>{
    expect(passport).not.toContain('passport-recent-shared');
    expect(passport).toContain('visually-hidden');
    expect(passport).toContain('Shared by ${item.sharedBy}');
  });
});
