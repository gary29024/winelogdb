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
      <link rel="image_src" href="https://estate.test/chateau.jpg">`);
    expect(heroImageCandidates(html)).toEqual(['https://estate.test/chateau.jpg']);
  });

  it('reads only what the site declares as the page\u2019s own picture',()=>{
    // Reported back as meaningless photographs. The page's own <img> tags were
    // read for a while and it was a mistake: the largest picture on a homepage
    // is as often a stock close-up of grapes as it is the estate. A site that
    // declares nothing has said nothing, and no picture beats that one.
    const html=page('<img src="https://estate.test/stock-grapes.jpg" width="2000" height="1200">');
    expect(heroImageCandidates(html)).toEqual([]);
  });

  it('unescapes a URL as the page wrote it, and never repeats one',()=>{
    const html=page(`<meta property="og:image" content="https://estate.test/a.jpg?w=1&amp;h=2">
      <link rel="image_src" href="https://estate.test/a.jpg?w=1&h=2">`);
    expect(heroImageCandidates(html)).toEqual(['https://estate.test/a.jpg?w=1&h=2']);
  });

  it('stops at four, because a fifth candidate is guesswork',()=>{
    const html=page(`<script type="application/ld+json">{"image":${JSON.stringify([1,2,3,4,5,6].map(n=>`https://estate.test/${n}.jpg`))}}</script>`);
    expect(heroImageCandidates(html)).toHaveLength(4);
    expect(heroImageCandidates(html,2)).toHaveLength(2);
  });

  it('offers nothing at all for a page with no pictures in it',()=>{
    expect(heroImageCandidates(page('<title>Estate</title>'))).toEqual([]);
  });
});
