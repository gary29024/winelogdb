import { describe,expect,it } from 'vitest';
import { derivedTags,reconcileTags } from '../../src/features/wines/wineTags';

const scanned={country:'France',region:'Champagne',appellation:'Champagne',grapes:['Chardonnay'],style:'sparkling'};
const corrected={country:'France',region:'Burgundy',appellation:'Chablis',grapes:['Chardonnay'],style:'white'};

describe('the tags a wine puts on itself',()=>{
  it('reads the place, the grapes and the style, once each',()=>{
    expect(derivedTags(scanned)).toEqual(['France','Champagne','Chardonnay','sparkling']);
  });

  it('stops before it fills the field',()=>{
    const many=derivedTags({country:'France',region:'Burgundy',appellation:'Meursault',
      grapes:['A','B','C','D','E','F','G'],style:'white'});
    expect(many).toHaveLength(8);
  });
});

describe('correcting a wine after it was scanned',()=>{
  it('drops the tag the correction made wrong and adds the one it made right',()=>{
    // Reported as: hashtags are not corrected when you fix the wine. A
    // Champagne that turns out to be a Chablis carried a Champagne tag for the
    // rest of its life.
    const next=reconcileTags(derivedTags(scanned),derivedTags(scanned),derivedTags(corrected));
    expect(next).toEqual(['France','Chardonnay','Burgundy','Chablis','white']);
    expect(next).not.toContain('Champagne');
    expect(next).not.toContain('sparkling');
  });

  it('leaves a tag typed by hand alone, whatever the correction',()=>{
    // Indistinguishable from a derived one except by never having been derived,
    // which is exactly what the three-way comparison knows and a recompute
    // would not.
    const typed=[...derivedTags(scanned),'birthday','blind'];
    const next=reconcileTags(typed,derivedTags(scanned),derivedTags(corrected));
    expect(next).toContain('birthday');
    expect(next).toContain('blind');
  });

  it('does not resurrect a suggested tag that was deliberately deleted',()=>{
    // Delete "sparkling", then change the vintage: a recompute would put it
    // back, and the deletion would be impossible to make stick.
    const kept=derivedTags(scanned).filter(tag=>tag!=='sparkling');
    const next=reconcileTags(kept,derivedTags(scanned),derivedTags(scanned));
    expect(next).not.toContain('sparkling');
    expect(next).toEqual(kept);
  });

  it('changes nothing at all when the wine did not change',()=>{
    const typed=[...derivedTags(scanned),'gift'];
    expect(reconcileTags(typed,derivedTags(scanned),derivedTags(scanned))).toEqual(typed);
  });

  it('keeps a hand-typed tag that happens to match a field it never came from',()=>{
    // "France" typed on a wine that had no country recorded is the reader's,
    // and stays even when the country is later filled in as something else.
    const next=reconcileTags(['France'],[],derivedTags({country:'Italy'}));
    expect(next).toEqual(['France','Italy']);
  });

  it('never grows past what the field will hold',()=>{
    const many=Array.from({length:60},(_,index)=>`tag-${index}`);
    expect(reconcileTags(many,[],['extra'])).toHaveLength(50);
  });
});
