import { describe,expect,it } from 'vitest';
import { elidParts,heading,htmlLinks,producerKeyFromName,retryAfterMs,robotsAllows,validRegistryElid } from '../../src/lib/wine/elidRegistry';
describe('ELID registry parser',()=>{
 it('extracts only structure needed for registry crawling',()=>{
  const html='<h1>Domaine Dujac</h1><a href="/wine/FR-CBM-DUJA01">base</a><a href="/wine/FR-CBM-DUJA01-2022">2022</a>';
  expect(heading(html)).toBe('Domaine Dujac');expect(htmlLinks(html).map(x=>x.href)).toEqual(['/wine/FR-CBM-DUJA01','/wine/FR-CBM-DUJA01-2022']);
 });
 it('splits base registry routes from full registered vintage/release identifiers',()=>{
  expect(elidParts('/wine/FR-CMP-KRUG01-N171')).toEqual({baseElid:'FR-CMP-KRUG01',vintageCode:'N171',elid:'FR-CMP-KRUG01-N171'});
  expect(elidParts('/wine/FR-CBM-DUJA01-2022')?.vintageCode).toBe('2022');
  expect(elidParts('/wine/FR-CBM-DUJA01')?.vintageCode).toBe('');
  expect(validRegistryElid('FR-CMP-KRUG01-N171')).toBe(true);
 });
 it('normalizes producer names used by the explicit producer index',()=>expect(producerKeyFromName('Domaine Dujac')).toBe('domaine dujac'));
 it('honours the most-specific crawler block and path-specific disallows',()=>{
  const robots=`User-agent: *\nDisallow: /private\n\nUser-agent: WineLogDB-ELID-Registry-Sync\nDisallow: /wine/FR-\nAllow: /wine/FR-CMP-KRUG01-N171\n`;
  expect(robotsAllows(robots,'/wine/FR-CBM-DUJA01-2022','WineLogDB-ELID-Registry-Sync')).toBe(false);
  expect(robotsAllows(robots,'/wine/FR-CMP-KRUG01-N171','WineLogDB-ELID-Registry-Sync')).toBe(true);
  expect(robotsAllows(robots,'/producer/FR-KRUG','WineLogDB-ELID-Registry-Sync')).toBe(true);
 });
 it('parses both Retry-After seconds and dates',()=>{
  expect(retryAfterMs('3',0)).toBe(3000);
  expect(retryAfterMs('Thu, 01 Jan 1970 00:00:05 GMT',0)).toBe(5000);
 });
});
