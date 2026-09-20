import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';

const library=readFileSync('src/features/wines/LibraryPage.tsx','utf8');
const layout=readFileSync('src/components/Layout.tsx','utf8');
const styles=readFileSync('src/styles.css','utf8');

describe('the journal filter disclosure',()=>{
  it('leaves search out of the fold, being the control used every visit',()=>{
    const form=library.slice(library.indexOf('journal-filters'),library.indexOf('journal-attach-banner'));
    expect(form.indexOf('<JournalSearchInput')).toBeGreaterThan(-1);
    expect(form.indexOf('<JournalSearchInput')).toBeLessThan(form.indexOf('journal-filter-toggle'));
  });

  it('hides the fields rather than unmounting them, so a half-typed filter survives',()=>{
    expect(library).toContain('hidden={!filtersOpen}');
    expect(styles).toContain('.filter-pills[hidden]{display:none}');
  });

  it('opens on arrival when something is already narrowing the list',()=>{
    // A filtered journal whose filters are hidden looks like a journal that has
    // lost wines.
    expect(library).toMatch(/useState\(\(\)=>NARROWING_KEYS\.some/);
  });

  it('counts only the controls that actually cut wines out',()=>{
    // sort, favourite and offset change what you are looking at without
    // narrowing it, so counting them would badge an unfiltered journal.
    const keys=/const NARROWING_KEYS=\[([^\]]*)\]/.exec(library)?.[1]??'';
    expect(keys).toContain("'month'");
    expect(keys).not.toContain("'sort'");
    expect(keys).not.toContain("'favorite'");
    expect(keys).not.toContain("'offset'");
  });

  it('puts reset with the filters rather than among the layout controls',()=>{
    const bar=library.slice(library.indexOf('journal-filter-bar'),library.indexOf('filter-pills'));
    expect(bar).toContain('journal-filter-reset');
    const actions=library.slice(library.indexOf('journal-view-actions'));
    expect(actions.slice(0,400),'reset should have left the view bar').not.toContain('journal-filter-reset');
  });
});

describe('the top bar',()=>{
  it('reads brand, then navigation, then account and the one action',()=>{
    const bar=layout.slice(layout.indexOf('<header className="topbar">'),layout.indexOf('</header>'));
    expect(bar.indexOf('className="brand"')).toBeLessThan(bar.indexOf('className="desktop-nav"'));
    expect(bar.indexOf('className="desktop-nav"')).toBeLessThan(bar.indexOf('className="account-link"'));
  });

  it('keeps the scan action off a phone, where the tab bar already carries it',()=>{
    // It used to ride inside .desktop-nav and vanish with it. Out on its own it
    // has to be told, or it appears twice.
    expect(layout).toContain('topbar-end');
    expect(styles).toContain('.topbar-end .top-scan-trigger{display:none}');
  });
});
