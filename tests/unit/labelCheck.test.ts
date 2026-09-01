import { describe,expect,it } from 'vitest';
import { applyLabelDifferences,compareToLabel,type CheckField } from '../../src/features/cellar/labelCheck';

const held={producer:'Cusumano',wineName:'Feudo di Mezzo',vintage:2020,country:'Italy',
  region:'Sicily',appellation:'Etna',wineStyle:'red',alcoholPercentage:13.5};

describe('checking a cellar entry against the bottle',()=>{
  it('says nothing when the label agrees',()=>{
    expect(compareToLabel(held,{producer:'Cusumano',wineName:'Feudo di Mezzo',vintage:2020,
      country:'Italy',region:'Sicily',appellation:'Etna',style:'red',alcoholPercentage:13.5})).toEqual([]);
  });

  it('reports the vintage the label actually carries',()=>{
    const [difference]=compareToLabel(held,{vintage:2017});
    expect(difference).toMatchObject({field:'vintage',held:'2020',read:'2017',value:2017});
  });

  it('does not offer a correction that is only a difference in spelling',()=>{
    // A cellar line typed without accents must not be "corrected" into the same
    // producer, and the identity system already knows they are one name.
    expect(compareToLabel({producer:'Chateau Leoville Barton'},{producer:'Château Léoville-Barton'})).toEqual([]);
    expect(compareToLabel({appellation:'Cotes du Rhone'},{appellation:'Côtes du Rhône'})).toEqual([]);
  });

  it('treats a field the label could not read as no evidence, not as empty',()=>{
    // Otherwise one tap would delete a good appellation because the photo
    // happened to show the back of the bottle.
    expect(compareToLabel(held,{producer:null,appellation:null,vintage:null})).toEqual([]);
  });

  it('reports a field the entry never had',()=>{
    const [difference]=compareToLabel({...held,alcoholPercentage:null},{alcoholPercentage:14});
    expect(difference).toMatchObject({field:'alcoholPercentage',held:'—',read:'14'});
  });

  it('allows a tenth on the alcohol, so a float is not a disagreement',()=>{
    expect(compareToLabel(held,{alcoholPercentage:13.5})).toEqual([]);
    expect(compareToLabel(held,{alcoholPercentage:14})).toHaveLength(1);
  });

  it('changes nothing on its own',()=>{
    const differences=compareToLabel(held,{vintage:2017,appellation:'Etna Rosso'});
    expect(applyLabelDifferences(held,differences,new Set())).toEqual(held);
  });

  it('takes only the corrections that were accepted',()=>{
    const differences=compareToLabel(held,{vintage:2017,appellation:'Etna Rosso'});
    const next=applyLabelDifferences(held,differences,new Set<CheckField>(['vintage']));
    expect(next.vintage).toBe(2017);
    expect(next.appellation).toBe('Etna');
  });

  it('keeps a vintage a number, so the form does not receive a string',()=>{
    const differences=compareToLabel(held,{vintage:2017});
    expect(applyLabelDifferences(held,differences,new Set<CheckField>(['vintage'])).vintage).toBe(2017);
  });
});
