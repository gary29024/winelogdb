import { describe,expect,it } from 'vitest';
import { catalogVillageLabel } from '../../src/lib/cuvees/catalogPresentation';

const village=(appellation:string|null)=>catalogVillageLabel({name:'x',appellation});

describe('the village a catalogue entry belongs to',()=>{
  it('puts a village wine and its premier cru in the same place',()=>{
    // They are one village seen at two tiers. Grouping a range by place has to
    // say so, or Gevrey-Chambertin appears three times in the same list.
    expect(village('Gevrey-Chambertin')).toBe('Gevrey-Chambertin');
    expect(village('Gevrey-Chambertin Premier Cru')).toBe('Gevrey-Chambertin');
    expect(village('Gevrey-Chambertin 1er Cru')).toBe('Gevrey-Chambertin');
  });

  it('strips doubled-up catalogue wording rather than one layer of it',()=>{
    expect(village('Chablis Premier Cru Village')).toBe('Chablis');
  });

  it('leaves a grand cru standing as its own place',()=>{
    // Clos de la Roche is an appellation in its own right, and the reference
    // data does not say which commune a grand cru sits in - the same gap that
    // stops anyone saying a wine comes from the Pernand side of Corton.
    // Inventing the parent here would be a guess, and wrong exactly at the
    // boundaries people care about.
    expect(village('Clos de la Roche')).toBe('Clos de la Roche');
    expect(village('Corton')).toBe('Corton');
  });

  it('says the appellation is unstated rather than inventing a blank group',()=>{
    expect(village(null)).toBe('Appellation not stated');
    expect(village('   ')).toBe('Appellation not stated');
  });

  it('never strips a name down to nothing',()=>{
    // An entry recorded only as its tier would otherwise come back empty.
    expect(village('Grand Cru')).toBe('Grand Cru');
    expect(village('Premier Cru')).toBe('Premier Cru');
  });

  it('does not mistake a village whose name contains the word',()=>{
    expect(village('Premier Cru Les Amoureuses')).toBe('Premier Cru Les Amoureuses');
  });
});
