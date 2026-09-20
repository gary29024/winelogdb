import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';

const owner=readFileSync('src/features/wines/DetailPage.tsx','utf8');
const shared=readFileSync('src/features/wines/SharedWinesPage.tsx','utf8');
const styles=readFileSync('src/styles.css','utf8');
const pages:[string,string][]=[['owner',owner],['shared',shared]];

/** Where a marker first appears, so two markers can be compared by position. */
const at=(source:string,marker:string)=>{
  const index=source.indexOf(marker);
  expect(index,`expected to find ${marker}`).toBeGreaterThan(-1);
  return index;
};

describe('the order a wine reads in',()=>{
  it.each(pages)('puts your own experience above the derived facts on the %s page',(_name,source)=>{
    // The tasting is the reason the record exists. Wine details led the page
    // only because it was written first.
    expect(at(source,'experience-panel')).toBeLessThan(at(source,'<WineDetailsSection'));
  });

  it.each(pages)('keeps identifiers in Wine details without a separate reference panel on the %s page',(_name,source)=>{
    expect(source).not.toContain('WineReferenceSection');
  });

  it.each(pages)('leaves Deep Search last, being the longest and the least asked for, on the %s page',(_name,source)=>{
    const deep=at(source,'deep-search-panel');
    for(const earlier of ['experience-panel','<WineDetailsSection'])
      expect(at(source,earlier),`${earlier} should come before Deep Search`).toBeLessThan(deep);
  });

  it.each(pages)('reaches the actions before the research on the %s page',(_name,source)=>{
    // Edit and Favourite used to sit underneath the longest panel on the page,
    // so the two things pressed most often were the two furthest away.
    expect(at(source,'wine-actions')).toBeLessThan(at(source,'deep-search-panel'));
  });

  it('keeps photo management out of the block whose job is to be read',()=>{
    // Add and remove are edits. They belong to the Photos panel, which is below
    // the fold, not to the identity card at the top.
    expect(at(owner,'wine-identity')).toBeLessThan(at(owner,'detail-photos-panel'));
    expect(at(owner,'detail-photos-panel')).toBeLessThan(at(owner,'detail-photo-add'));
    const identity=owner.slice(at(owner,'wine-identity'),at(owner,'wine-actions'));
    expect(identity,'the identity card should not carry the remove control').not.toContain('detail-photo-remove');
  });

  it('marks who is answerable for each section rather than drawing them all alike',()=>{
    for(const [name,source] of pages){
      expect(source,`${name} should mark the tasting as the owner's`).toContain('<SectionLabel origin="yours">Your experience</SectionLabel>');
    }
    // The owner's page also shows partial reused scopes. Only a complete report
    // earns the badge; deepSearchLayout tests the rendered complete/partial states.
    expect(owner).toContain("origin={deepComplete?'researched':undefined}");
    expect(shared).toContain('origin="researched"');
    // Derived stays unmarked: a badge on every section marks nothing.
    const facts=readFileSync('src/features/wines/WineFacts.tsx','utf8');
    expect(facts).toContain('<SectionLabel>Wine details</SectionLabel>');
    expect(facts).not.toContain('Official reference');
  });

  it('lays the identity card out along a left edge rather than down a centre line',()=>{
    const rule=/\.wine-identity\{([^}]*)\}/.exec(styles)?.[1]??'';
    expect(rule,'.wine-identity should exist in styles.css').toBeTruthy();
    expect(/text-align:\s*center/.test(rule),'a centred card gives the eye no left edge to return to').toBe(false);
  });

  it('does not pin a second bar to an edge the navigation already owns',()=>{
    // The mobile nav is fixed at bottom:0 with the home-indicator inset beneath
    // it. A sticky action bar would have to stack on that for no gain at all on
    // a desktop, so the actions are an ordinary row under the title instead.
    const rule=/\.wine-actions\{([^}]*)\}/.exec(styles)?.[1]??'';
    expect(rule,'.wine-actions should exist in styles.css').toBeTruthy();
    expect(/position:\s*(fixed|sticky)/.test(rule)).toBe(false);
  });
});
