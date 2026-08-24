import { describe,expect,it } from 'vitest';
import { htmlAttribute } from '../../src/lib/producers/batchResearch';

// The pattern is assembled in a template literal, where "\b" is a backspace character and "\s" is a
// plain "s" unless the backslash is doubled. Getting that wrong makes every lookup return null and
// silently disables og:image discovery for producer hero images.
describe('meta tag attribute matching',()=>{
  it('reads double-quoted, single-quoted and unquoted attributes',()=>{
    expect(htmlAttribute('<meta property="og:image" content="https://x.test/a.jpg">','content')).toBe('https://x.test/a.jpg');
    expect(htmlAttribute("<meta property='og:image' content='https://x.test/b.jpg'>",'property')).toBe('og:image');
    expect(htmlAttribute('<meta name=viewport content=width>','content')).toBe('width');
  });

  it('tolerates whitespace around the equals sign and matches case-insensitively',()=>{
    expect(htmlAttribute('<meta Property = "og:image">','property')).toBe('og:image');
  });

  it('returns null when the attribute is absent',()=>{
    expect(htmlAttribute('<meta charset="utf-8">','content')).toBeNull();
  });

  it('finds the image on a realistic tag set',()=>{
    const html='<meta charset="utf-8"><meta property="og:title" content="Domaine"><meta property="og:image" content="https://x.test/hero.jpg">';
    const tags=html.match(/<meta\b[^>]*>/gi)??[];
    const found=tags.filter(tag=>htmlAttribute(tag,'property')==='og:image').map(tag=>htmlAttribute(tag,'content'));
    expect(found).toEqual(['https://x.test/hero.jpg']);
  });
});
