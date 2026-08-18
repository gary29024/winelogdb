import { describe,expect,it } from 'vitest';
import { applyJournalVintageSearch } from '../../src/lib/journal/searchQuery';

describe('Journal search routing',()=>{
  it('routes a four-digit vintage search through the vintage filter',()=>{
    const url=new URL('https://example.test/api/wines?query=2011&sort=newest');
    expect(applyJournalVintageSearch(url)).toBe(true);
    expect(url.searchParams.get('vintage')).toBe('2011');
    expect(url.searchParams.has('query')).toBe(false);
    expect(url.searchParams.get('sort')).toBe('newest');
  });

  it('leaves normal text searches on full-text search',()=>{
    const url=new URL('https://example.test/api/wines?query=Dujac');
    expect(applyJournalVintageSearch(url)).toBe(false);
    expect(url.searchParams.get('query')).toBe('Dujac');
    expect(url.searchParams.has('vintage')).toBe(false);
  });

  it('does not override an explicit vintage filter',()=>{
    const url=new URL('https://example.test/api/wines?vintage=2010&query=2011');
    expect(applyJournalVintageSearch(url)).toBe(false);
    expect(url.searchParams.get('vintage')).toBe('2010');
    expect(url.searchParams.get('query')).toBe('2011');
  });

  it('rejects implausible four-digit years',()=>{
    const url=new URL('https://example.test/api/wines?query=9999');
    expect(applyJournalVintageSearch(url)).toBe(false);
    expect(url.searchParams.get('query')).toBe('9999');
  });
});
