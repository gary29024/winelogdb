import { describe,expect,it } from 'vitest';
import { champagneResponseJsonSchema,champagneFailureDiagnostics } from '../../worker/champagneResponse';
import { prepareChampagneResult } from '../../src/lib/wine/champagneExtraction';

describe('bounded Champagne response contract',()=>{
  it('guides text length using supported descriptions and bounds arrays',()=>{
    const visit=(schema:Record<string,unknown>)=>{
      if(schema.type==='array')expect(schema.maxItems).toBeGreaterThan(0);
      expect(schema).not.toHaveProperty('maxLength');
      for(const value of Object.values(schema)){
        if(Array.isArray(value)){
          for(const child of value)if(child&&typeof child==='object')visit(child);
        }else if(value&&typeof value==='object')visit(value as Record<string,unknown>);
      }
    };
    visit(champagneResponseJsonSchema);
    expect(champagneResponseJsonSchema.properties.sourceText.required).toHaveLength(8);
    for(const field of Object.values(champagneResponseJsonSchema.properties.sourceText.properties))expect(field.description).toContain('at most');
  });
  it('accepts explicit null source fields and keeps real source phrases',()=>{
    expect(prepareChampagneResult({details:{malolactic:'Not encouraged'},sourceText:{malolactic:'NON RECHERCHÉE',tirage:null},reviewFields:[]})).toMatchObject({details:{malolactic:'Not encouraged'},sourceText:{malolactic:'NON RECHERCHÉE'}});
    expect(prepareChampagneResult({details:null,sourceText:{tirage:null},reviewFields:[]}).sourceText).toEqual({});
  });
  it('captures bounded answer excerpts without thought parts and distinguishes missing counts',()=>{
    const parts=[{text:'hidden reasoning',thought:true},{text:'A'.repeat(5000)+'END'}];
    const result=champagneFailureDiagnostics({response:{candidates:[{finishReason:'MAX_TOKENS',content:{parts}}],usageMetadata:{candidatesTokenCount:8176}}});
    expect(result).toMatchObject({answerCharacters:5003,outputTokens:8176,thoughtTokens:null,excerptTruncated:true});
    expect(result.answerStart).toHaveLength(2000);expect(result.answerEnd).toHaveLength(2000);
    expect(result.answerEnd.endsWith('END')).toBe(true);
    expect(JSON.stringify(result)).not.toContain('hidden reasoning');
  });
});
