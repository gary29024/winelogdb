import { describe,it,expect } from 'vitest';
import { preferEscalatedGroup,preferEscalatedSheet } from '../../src/lib/recognition/escalation';
import { parseGroupRecognition } from '../../src/features/recognition/groupSchema';
import { parseSheetPage } from '../../src/features/recognition/sheetSchema';
const identity={producer:'Krug',wineName:'Vintage',vintage:2013,confidence:0.9};
const wine={...identity,priceOptions:[{amount:1200,label:'Bottle'}],lineNumber:1};
const group=(wines:unknown[],unresolvedCount=1)=>parseGroupRecognition(JSON.stringify({wines,unresolvedCount}));
const sheet=(overrides:Record<string,unknown>={})=>parseSheetPage(JSON.stringify({wines:[wine],currency:'HKD',unresolvedCount:1,truncated:false,lastLineNumber:1,...overrides}));
describe('whole-list escalation selection',()=>{
  it('rejects fewer wines, replaced identities and worse confidence',()=>{
    const first=group([identity,{...identity,wineName:'Grande Cuvée'}]);
    expect(preferEscalatedGroup(first,group([identity],0))).toBe(first);
    expect(preferEscalatedGroup(first,group([identity,{...identity,wineName:'Other'}],0))).toBe(first);
    expect(preferEscalatedGroup(first,group([{...identity,confidence:0.5},{...identity,wineName:'Grande Cuvée'}],0))).toBe(first);
  });
  it('accepts additional wines while preserving established identities',()=>{
    const first=group([identity]),candidate=group([identity,{...identity,wineName:'Grande Cuvée'}],0);
    expect(preferEscalatedGroup(first,candidate)).toBe(candidate);
  });
  it('preserves sheet prices, currency, continuation and line associations',()=>{
    const first=sheet();
    for(const changes of [{wines:[{...wine,priceOptions:[]}]},{currency:'USD'},{truncated:true},{lastLineNumber:0},{wines:[{...wine,lineNumber:2}]}]){
      expect(preferEscalatedSheet(first,sheet({...changes,unresolvedCount:0}))).toBe(first);
    }
    const candidate=sheet({unresolvedCount:0});
    expect(preferEscalatedSheet(first,candidate)).toBe(candidate);
  });
});
