import { describe,expect,it } from 'vitest';
import { buildRecognitionPrompt } from '../../src/lib/recognition/geminiRequest';
import { groupRecognitionEscalationReasons,preferEscalatedRecognition,recognitionEscalationReasons,RECOGNITION_ESCALATION_CONFIDENCE,RECOGNITION_ESCALATION_MODEL } from '../../src/lib/recognition/escalation';

const primary=(overrides:Record<string,unknown>={})=>({
  producer:'Domaine Test',wineName:'Premier Cru',vintage:2020,country:'France',region:'Burgundy',appellation:'Volnay Premier Cru',classification:'premier_cru' as const,grapes:['Pinot Noir'],grapeBlend:[],style:'red' as const,alcoholPercentage:null,confidence:0.95,tastingDate:null,locationName:null,latitude:null,longitude:null,metadataSource:'none' as const,...overrides
});

describe('selective wine-label escalation',()=>{
  it('uses Gemini 3.7 only for uncertain identity results',()=>{
    expect(RECOGNITION_ESCALATION_MODEL).toBe('gemini-3.7-flash');
    expect(RECOGNITION_ESCALATION_CONFIDENCE).toBe(0.85);
    expect(recognitionEscalationReasons(primary())).toEqual([]);
    expect(recognitionEscalationReasons(primary({confidence:0.84}))).toContain('low-confidence');
    expect(recognitionEscalationReasons(primary({producer:null}))).toContain('missing-producer');
    expect(recognitionEscalationReasons(primary({wineName:null}))).toContain('missing-wine-name');
    expect(recognitionEscalationReasons(primary(),{schemaFallback:true})).toContain('schema-fallback');
  });

  it('keeps the primary result when an escalation loses the bottle identity',()=>{
    const first=primary(),weaker=primary({producer:null,wineName:null,confidence:0.4});
    expect(preferEscalatedRecognition(first,weaker)).toBe(first);
    const verified=primary({producer:'Verified Domaine',wineName:'Verified Cuvee',confidence:0.9});
    expect(preferEscalatedRecognition(first,verified)).toBe(verified);
  });

  it('escalates group photos when bottles remain unresolved or low-confidence',()=>{
    const clean={wines:[{producer:'A',wineName:'B',vintage:2020,country:null,region:null,appellation:null,grapes:[],grapeBlend:[],style:null,alcoholPercentage:null,locationName:null,confidence:0.9,boundingBox:{xMin:10,yMin:10,xMax:400,yMax:900}}],unresolvedCount:0};
    expect(groupRecognitionEscalationReasons(clean)).toEqual([]);
    expect(groupRecognitionEscalationReasons({...clean,unresolvedCount:1})).toContain('unresolved-wines');
    expect(groupRecognitionEscalationReasons({...clean,wines:[{...clean.wines[0],confidence:0.8}]})).toContain('low-confidence');
  });

  it('requires visible evidence for producer, cuvee and vintage identity',()=>{
    const {prompt}=buildRecognitionPrompt([]);
    expect(prompt).toContain('Producer, wineName and vintage are identity-critical');
    expect(prompt).toContain('Do not invent, complete, or substitute producer, cuvee/wine name, or vintage');
    expect(prompt).toContain('country, region, appellation, grape varieties, and broad wine style');
  });
});
