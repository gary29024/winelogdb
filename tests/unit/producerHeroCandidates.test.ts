import { describe,expect,it } from 'vitest';
import { heroImageCandidates } from '../../src/lib/producers/heroCandidates';

const page=(body:string)=>`<!doctype html><html><head>${body}</head><body>${body}</body></html>`;

describe('finding a producer hero photograph',()=>{
  // Reported as: a research run rarely comes back with a picture. One meta tag
  // on one page was the whole of the reading.

  it('takes the estate’s own choice first',()=>{
    expect(heroImageCandidates(page(`<meta property="og:image" content="https://estate.test/chateau.jpg">
      <meta name="twitter:image" content="https://estate.test/other.jpg">`))[0]).toBe('https://estate.test/chateau.jpg');
  });

  it('falls through to the places a template puts it when there is no og:image',()=>{
    const html=page(`<link rel="image_src" href="https://estate.test/link.jpg">
      <script type="application/ld+json">{"@type":"Winery","image":{"url":"https://estate.test/ld.jpg"}}</script>`);
    expect(heroImageCandidates(html)).toEqual(['https://estate.test/link.jpg','https://estate.test/ld.jpg']);
  });

  it('reads JSON-LD however the template nests it',()=>{
    const graph=page(`<script type="application/ld+json">{"@graph":[{"@type":"WebSite"},{"@type":"Organization","image":["https://estate.test/one.jpg","https://estate.test/two.jpg"]}]}</script>`);
    expect(heroImageCandidates(graph)).toEqual(['https://estate.test/one.jpg','https://estate.test/two.jpg']);
    expect(heroImageCandidates(page('<script type="application/ld+json">{ not json </script>')),'a template that ships broken JSON-LD is common').toEqual([]);
  });

  it('will not offer the furniture',()=>{
    const html=page(`<meta property="og:image" content="https://estate.test/site-logo.png">
      <img src="https://estate.test/favicon-192.png"><img src="https://estate.test/vineyard.jpg">`);
    expect(heroImageCandidates(html)).toEqual(['https://estate.test/vineyard.jpg']);
  });

  it('skips an image the page itself calls small',()=>{
    const html=page('<img src="https://estate.test/thumb.jpg" width="80" height="80"><img src="https://estate.test/hero.jpg" width="1600">');
    expect(heroImageCandidates(html)).toEqual(['https://estate.test/hero.jpg']);
  });

  it('takes the lazy-loaded file rather than its placeholder',()=>{
    // The norm on estate sites: src holds a grey placeholder until it scrolls.
    const html=page('<img src="data:image/gif;base64,R0lGOD" data-src="https://estate.test/real.jpg">');
    expect(heroImageCandidates(html)).toEqual(['https://estate.test/real.jpg']);
  });

  it('unescapes a URL as the page wrote it, and never repeats one',()=>{
    const html=page(`<meta property="og:image" content="https://estate.test/a.jpg?w=1&amp;h=2">
      <link rel="image_src" href="https://estate.test/a.jpg?w=1&h=2">`);
    expect(heroImageCandidates(html)).toEqual(['https://estate.test/a.jpg?w=1&h=2']);
  });

  it('stops at four, because a fifth candidate is guesswork',()=>{
    const html=page([1,2,3,4,5,6].map(n=>`<img src="https://estate.test/${n}.jpg">`).join(''));
    expect(heroImageCandidates(html)).toHaveLength(4);
    expect(heroImageCandidates(html,2)).toHaveLength(2);
  });

  it('offers nothing at all for a page with no pictures in it',()=>{
    expect(heroImageCandidates(page('<title>Estate</title>'))).toEqual([]);
  });
});
