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

describe('filtering the journal by one grape',()=>{
  it('finds every name that grape is stored under',async()=>{
    // The label keeps its own spelling, so a filter that matched one name
    // returned fewer wines than the insight it was clicked from claimed.
    const {listJournalPage}=await import('../../src/lib/journal/list');
    const {createD1Stub}=await import('./support/d1Stub');
    const stub=createD1Stub(sql=>/count\(\*\)/.test(sql)?{all:[{total:0}]}:{all:[]});
    await listJournalPage(stub.db,'owner',{grape:'Pinot Noir'});
    const [call]=stub.matching(/json_each\(w\.grapes_json\)/);
    expect(call.sql).toMatch(/lower\(trim\(CAST\(value AS TEXT\)\)\) IN \(\?/);
    expect(call.args).toContain('pinot nero');
    expect(call.args).toContain('spätburgunder');
  });

  it('asks for just the one name where the table knows no others',async()=>{
    const {listJournalPage}=await import('../../src/lib/journal/list');
    const {createD1Stub}=await import('./support/d1Stub');
    const stub=createD1Stub(sql=>/count\(\*\)/.test(sql)?{all:[{total:0}]}:{all:[]});
    await listJournalPage(stub.db,'owner',{grape:'Rossese'});
    const [call]=stub.matching(/json_each\(w\.grapes_json\)/);
    expect(call.args.filter(arg=>String(arg).includes('rossese'))).toEqual(['rossese']);
  });
});
