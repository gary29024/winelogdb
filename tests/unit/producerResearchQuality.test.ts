import { describe,expect,it } from 'vitest';
import { extractOfficialContactCandidates,mergeCatalogRanges } from '../../src/lib/producers/researchQuality';

describe('producer research quality',()=>{
  it('preserves older catalogue entries that a refresh omits while preferring refreshed data',()=>{
    const previous=[
      {name:'Clos A',category:'red',appellation:'AOC A',notes:'old'},
      {name:'Clos B',category:'white',appellation:'AOC B'}
    ];
    const researched=[
      {name:'Clos A',category:'red',appellation:'AOC A',notes:'current'},
      {name:'Clos C',category:'red',appellation:'AOC C'}
    ];
    const merged=mergeCatalogRanges(previous,researched);
    expect(merged.range.map(item=>item.name)).toEqual(['Clos A','Clos C','Clos B']);
    expect(merged.range[0].notes).toBe('current');
    expect(merged.researchedCount).toBe(2);
    expect(merged.retainedCount).toBe(1);
  });

  it('keeps same-name wines separate when their style differs',()=>{
    const merged=mergeCatalogRanges([{name:'Tradition',category:'white'}],[{name:'Tradition',category:'red'}]);
    expect(merged.range).toHaveLength(2);
  });

  it('extracts public contact links and contact pages from an official site',()=>{
    const html=`<a href="mailto:info@domaine.example">Email</a>
      <a href="tel:+33 3 80 00 00 00">Call</a>
      <a href="https://www.instagram.com/domaine.example/">Instagram</a>
      <a href="/contact-us">Contact</a>
      <a href="https://retailer.example/wine">Retailer</a>`;
    expect(extractOfficialContactCandidates(html,'https://domaine.example/')).toEqual({
      emails:['info@domaine.example'],
      phones:['+33 3 80 00 00 00'],
      instagramUrls:['https://www.instagram.com/domaine.example/'],
      contactLinks:['https://domaine.example/contact-us']
    });
  });
});
