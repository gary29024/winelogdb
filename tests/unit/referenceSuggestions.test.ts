import { describe,expect,it } from 'vitest';
import { appClassification,buildReferenceSuggestions,refreshPendingReferenceSuggestions } from '../../src/lib/wine/referenceSuggestions';
import { lwinDisplayWineName } from '../../src/lib/wine/lwinDisplayName';

describe('LWIN reference suggestions',()=>{
 const reference={displayName:'Guy Amiot et Fils, Chassagne-Montrachet Premier Cru, Clos Saint-Jean Rouge',wineName:'Rouge'};
 it('preserves appellation, vineyard, cru and colour in a suggested name',()=>{
  const input={wineName:'Chassagne-Montrachet 1er Cru Clos Saint Jean',referenceWineName:'Rouge',lwinReference:reference};
  expect(buildReferenceSuggestions(input)).toEqual([{field:'wineName',label:'Wine name',current:input.wineName,suggested:'Chassagne-Montrachet Premier Cru, Clos Saint-Jean Rouge'}]);
  expect(reference.wineName).toBe('Rouge');
  expect(refreshPendingReferenceSuggestions(input,JSON.stringify([{field:'wineName',suggested:'Rouge'}]))).toEqual(buildReferenceSuggestions(input));
  expect(refreshPendingReferenceSuggestions(input,'[]')).toEqual([]);
 });
 it('ignores cru abbreviations and punctuation but retains colour distinctions',()=>{
  expect(buildReferenceSuggestions({wineName:'Chassagne Montrachet 1er Cru Clos Saint Jean Rouge',lwinReference:reference})).toEqual([]);
  expect(buildReferenceSuggestions({wineName:'Chassagne Montrachet 1er Cru Clos Saint Jean Blanc',lwinReference:reference})).toHaveLength(1);
 });
 it('falls back to raw WINE when display has no separable wine portion',()=>{
  expect(lwinDisplayWineName({displayName:'Chateau Rieussec Premier Cru Classe, Sauternes',wineName:'Château Rieussec'})).toBe('Château Rieussec, Sauternes');
  expect(lwinDisplayWineName({wineName:'Les Cazetiers'})).toBe('Les Cazetiers');
  expect(lwinDisplayWineName({displayName:'Example',wineName:'Les Cazetiers'})).toBe('Les Cazetiers');
  expect(lwinDisplayWineName({displayName:'Example, ',wineName:'Les Cazetiers'})).toBe('Les Cazetiers');
 });
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
  expect(suggestions.map(item=>item.field)).toEqual(['wineName','classification']);
  expect(suggestions.find(item=>item.field==='classification')?.suggestedValue).toBe('grand_cru');
 });
 it('does not suggest a classification over an explicit user override',()=>{
  expect(buildReferenceSuggestions({classification:'premier_cru',classificationOverride:'none',referenceClassification:'Grand Cru'})).toEqual([]);
 });
});
