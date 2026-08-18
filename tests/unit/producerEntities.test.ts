import { describe,expect,it } from 'vitest';
import { normalizeProducerAlias,producerMatchKey,shouldSeedProducerCountry } from '../../src/lib/producers/entities';
import { mergeSources,pickNewestResearch,shouldRestorePreMerge } from '../../src/lib/producers/merge';
import { extractContactGrounding,normalizeProducerEmail,normalizeProducerPhone,safeInstagramUrl } from '../../src/lib/producers/research';
import { buildResearchTargets } from '../../src/lib/research/cache';

describe('producer entity normalization',()=>{
  it('normalizes punctuation, accents and ampersands deterministically',()=>{
    expect(normalizeProducerAlias("Domaine Test Père & Fils")).toBe('domaine test pere and fils');
  });

  it('keeps potentially distinguishing producer words in automatic match keys',()=>{
    expect(producerMatchKey('Domaine Dujac')).toBe('domaine dujac');
    expect(producerMatchKey('Dujac')).toBe('dujac');
    expect(producerMatchKey('Domaine Test Père et Fils')).toBe('domaine test pere et fils');
    expect(producerMatchKey('Domaine Test')).not.toBe(producerMatchKey('Domaine Test Père et Fils'));
  });

  it('keys producer research by stable producer id instead of display spelling',()=>{
    const a=buildResearchTargets({producer:'Domaine Dujac',producerId:'producer-1',wineName:'Clos de la Roche',vintage:2022,region:'Burgundy',appellation:'Clos de la Roche'});
    const b=buildResearchTargets({producer:'Dujac',producerId:'producer-1',wineName:'Clos de la Roche',vintage:2022,region:'Burgundy',appellation:'Clos de la Roche'});
    expect(a.find(x=>x.scope==='producer')?.cacheKey).toBe(b.find(x=>x.scope==='producer')?.cacheKey);
    expect(a.find(x=>x.scope==='wine_vintage')?.cacheKey).toBe(b.find(x=>x.scope==='wine_vintage')?.cacheKey);
  });

  it('uses identified wine country only as provisional producer-home metadata',()=>{
    expect(shouldSeedProducerCountry(null,null,'France')).toBe(true);
    expect(shouldSeedProducerCountry('',null,' France ')).toBe(true);
    expect(shouldSeedProducerCountry('France',null,'United States')).toBe(false);
    expect(shouldSeedProducerCountry(null,'2026-08-18T00:00:00.000Z','France')).toBe(false);
    expect(shouldSeedProducerCountry(null,null,'')).toBe(false);
  });
});

describe('producer contact validation',()=>{
  it('accepts public business contact formats and rejects malformed values',()=>{
    expect(normalizeProducerEmail(' contact@domaine.example ')).toBe('contact@domaine.example');
    expect(normalizeProducerEmail('not-an-email')).toBeNull();
    expect(normalizeProducerPhone(' +33 3 80 00 00 00 ')).toBe('+33 3 80 00 00 00');
    expect(normalizeProducerPhone('call us now')).toBeNull();
  });

  it('only accepts HTTPS Instagram profile URLs',()=>{
    expect(safeInstagramUrl('https://www.instagram.com/domaine_example/')).toBe('https://www.instagram.com/domaine_example/');
    expect(safeInstagramUrl('https://example.com/domaine_example')).toBeNull();
    expect(safeInstagramUrl('http://instagram.com/domaine_example')).toBeNull();
  });

  it('uses only Gemini grounding chunks attached to contact fields',()=>{
    const text='{"officialWebsiteUrl":"https://domaine.example","instagramUrl":null,"contactEmail":"contact@domaine.example","contactPhone":"+33 3 80 00 00 00","profile":"Profile"}';
    const emailStart=text.indexOf('"contactEmail"'),emailEnd=text.indexOf(',',emailStart);
    const phoneStart=text.indexOf('"contactPhone"'),phoneEnd=text.indexOf(',',phoneStart);
    const profileStart=text.indexOf('"profile"');
    const result=extractContactGrounding(text,{
      groundingChunks:[
        {web:{title:'Official contact page',uri:'https://domaine.example/contact'}},
        {web:{title:'La RVF',uri:'https://www.larvf.com/example'}},
        {web:{title:'Unrelated profile source',uri:'https://example.org/profile'}}
      ],
      groundingSupports:[
        {segment:{startIndex:emailStart,endIndex:emailEnd,text:text.slice(emailStart,emailEnd)},groundingChunkIndices:[0]},
        {segment:{startIndex:phoneStart,endIndex:phoneEnd,text:text.slice(phoneStart,phoneEnd)},groundingChunkIndices:[1]},
        {segment:{startIndex:profileStart,endIndex:text.length,text:text.slice(profileStart)},groundingChunkIndices:[2]}
      ]
    });
    expect(result.fields.sort()).toEqual(['contactEmail','contactPhone']);
    expect(result.sources).toEqual([
      {title:'Official contact page',url:'https://domaine.example/contact'},
      {title:'La RVF',url:'https://www.larvf.com/example'}
    ]);
  });
});

describe('producer research merge policy',()=>{
  it('keeps the newest researched result active',()=>{
    const newest=pickNewestResearch([{researched_at:'2026-01-01T00:00:00.000Z',value:'old'},{researched_at:'2026-08-01T00:00:00.000Z',value:'new'}]);
    expect(newest?.value).toBe('new');
  });

  it('combines sources without duplicating the same URL',()=>{
    expect(mergeSources([{title:'A',url:'https://a.test'}],[{title:'A again',url:'https://a.test'},{title:'B',url:'https://b.test'}])).toEqual([{title:'A',url:'https://a.test'},{title:'B',url:'https://b.test'}]);
  });

  it('restores pre-merge research only when the surviving record was not changed afterwards',()=>{
    const mergedAt='2026-08-18T02:00:00.000Z';
    expect(shouldRestorePreMerge('2026-08-18T02:00:00.000Z',mergedAt)).toBe(true);
    expect(shouldRestorePreMerge('2026-08-18T02:00:01.000Z',mergedAt)).toBe(false);
  });
});
