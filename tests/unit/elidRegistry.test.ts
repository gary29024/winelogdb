import { describe,expect,it } from 'vitest';
import { elidParts,heading,htmlLinks,producerKeyFromName,validRegistryElid } from '../../src/lib/wine/elidRegistry';
describe('ELID registry parser',()=>{
 it('extracts only structure needed for registry crawling',()=>{
  const html='<h1>Domaine Dujac</h1><a href="/wine/FR-CBM-DUJA01">base</a><a href="/wine/FR-CBM-DUJA01-2022">2022</a>';
  expect(heading(html)).toBe('Domaine Dujac');expect(htmlLinks(html).map(x=>x.href)).toEqual(['/wine/FR-CBM-DUJA01','/wine/FR-CBM-DUJA01-2022']);
 });
 it('splits base identifiers from registered vintage/release identifiers',()=>{
  expect(elidParts('/wine/FR-CMP-KRUG01-N171')).toEqual({baseElid:'FR-CMP-KRUG01',vintageCode:'N171',elid:'FR-CMP-KRUG01-N171'});
  expect(elidParts('/wine/FR-CBM-DUJA01-2022')?.vintageCode).toBe('2022');
  expect(validRegistryElid('FR-CMP-KRUG01-N171')).toBe(true);
 });
 it('normalizes producer names for the same R2 shard key as LWIN',()=>expect(producerKeyFromName('Domaine Dujac')).toBe('domaine dujac'));
});
