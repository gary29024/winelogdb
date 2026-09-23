import { describe,expect,it } from 'vitest';
import { sourceDisplayHost,sourceLinkLabel } from '../../src/features/wines/researchSections';

const redirect='https://vertexaisearch.cloud.google.com/grounding-api-redirect/AbC123xyz';

describe('research source hosts',()=>{
 it('attributes a Google grounding redirect to the publisher domain in its title',()=>{
  expect(sourceDisplayHost({title:'www.Wine-Searcher.com',url:redirect})).toBe('wine-searcher.com');
 });
 it('leaves a redirect unattributed when the title is not a bare domain',()=>{
  expect(sourceDisplayHost({title:'Egly-Ouriet tasting notes',url:redirect})).toBe('');
 });
 it('does not treat the redirect host filled in as a missing title as a publisher',()=>{
  // Producer research falls back to the URL hostname when grounding gives no title.
  const untitled={title:'vertexaisearch.cloud.google.com',url:redirect};
  expect(sourceDisplayHost(untitled)).toBe('');
  expect(sourceLinkLabel(untitled,'')).toBe('Source');
 });
 it('uses the URL host for ordinary links',()=>{
  expect(sourceDisplayHost({title:'anything.com',url:'https://www.jancisrobinson.com/articles/x'})).toBe('jancisrobinson.com');
 });
 it('never shows a redirect token as the link label',()=>{
  expect(sourceLinkLabel({title:'decanter.com',url:redirect},'decanter.com')).toBe('decanter.com');
 });
});
