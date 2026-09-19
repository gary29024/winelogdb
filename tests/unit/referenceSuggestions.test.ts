import { describe,expect,it } from 'vitest';
import { appClassification,buildReferenceSuggestions } from '../../src/lib/wine/referenceSuggestions';

describe('LWIN reference suggestions',()=>{
 it('maps supported LWIN classifications into WineLog values',()=>{
  expect(appClassification('Grand Cru')).toBe('grand_cru');
  expect(appClassification('Premier Cru')).toBe('premier_cru');
  expect(appClassification('AOP')).toBeNull();
 });
 it('ignores formatting-only differences but records meaningful populated-field differences',()=>{
  const suggestions=buildReferenceSuggestions({
   producer:'Marchand Tawse',referenceProducer:'Marchand-Tawse',
   wineName:'Clos Saint-Denis',referenceWineName:'Clos Saint-Denis Grand Cru',
   country:'France',referenceCountry:'France',region:'Burgundy',referenceRegion:'Bourgogne',
   classification:'premier_cru',referenceClassification:'Grand Cru'
  });
  expect(suggestions.map(item=>item.field)).toEqual(['wineName','region','classification']);
  expect(suggestions.find(item=>item.field==='classification')?.suggestedValue).toBe('grand_cru');
 });
 it('does not suggest a classification over an explicit user override',()=>{
  expect(buildReferenceSuggestions({classification:'premier_cru',classificationOverride:'none',referenceClassification:'Grand Cru'})).toEqual([]);
 });
});
