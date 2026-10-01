import { describe,expect,it } from 'vitest';
import { describeGroundedResponse,parseGroundedResponseText } from '../../src/lib/research/groundedResponse';
import { buildDeepSearchProvenance } from '../../src/lib/research/provenance';
import { highRiskTechnicalScopePasses } from '../../src/lib/research/technicalClaimGate';
import { extractContactGrounding } from '../../src/lib/producers/research';

const schema={properties:{profile:{type:'STRING'},winemakingPractices:{type:'STRING'},contactEmail:{type:'STRING',nullable:true},rangeComplete:{type:'BOOLEAN'},range:{type:'ARRAY',items:{properties:{name:{type:'STRING'},category:{type:'STRING'},notes:{type:'STRING',nullable:true}}}}}};

describe('extracting grounded prose without buying a formatting request',()=>{
  it('keeps the cited sentences unchanged for precise-claim validation',()=>{
    const claim='For 2024, the wine was aged in barrel for 14 months.';
    const parsed=parseGroundedResponseText(`## winemakingTechniques\n${claim}`,{properties:{winemakingTechniques:{type:'STRING'}}});
    const payload={winemakingTechniques:String(parsed.winemakingTechniques)},metadata={groundingChunks:[{web:{title:'Estate',uri:'https://estate.example/technical'}}],groundingSupports:[{segment:{text:claim},groundingChunkIndices:[0]}]};
    expect(highRiskTechnicalScopePasses('wine_vintage',payload,buildDeepSearchProvenance(payload,metadata))).toBe(true);
    expect(highRiskTechnicalScopePasses('wine_vintage',payload,buildDeepSearchProvenance(payload))).toBe(false);
  });

  it('extracts a combined profile and table, including accented names and escaped pipes',()=>{
    const text='## profile\nAn estate based in Morey-Saint-Denis.\n\n## winemakingPractices\nPractices vary by cuvée.\n\n## contactEmail\nnull\n\n## rangeComplete\ntrue\n\n## range\n| name | category | notes |\n| --- | --- | --- |\n| Cuvée A \\| B | red | null |';
    expect(parseGroundedResponseText(text,schema)).toEqual({profile:'An estate based in Morey-Saint-Denis.',winemakingPractices:'Practices vary by cuvée.',contactEmail:null,rangeComplete:true,range:[{name:'Cuvée A | B',category:'red',notes:null}]});
  });

  it('validates a profile independently when the accompanying range table is broken',()=>{
    const text='## profile\nDocumented estate history.\n## range\n| name | category | notes |\n| --- | --- | --- |\n| Clos A | red';
    expect(parseGroundedResponseText(text,{properties:{profile:{type:'STRING'}}})).toEqual({profile:'Documented estate history.'});
    expect(()=>parseGroundedResponseText(text,schema)).toThrow('incomplete row');
  });

  it('never treats a missing completeness section as complete',()=>{
    expect(parseGroundedResponseText('## range\nnone',schema)).toMatchObject({range:[],rangeComplete:false,profile:''});
  });

  it('rejects duplicate sections and malformed tables rather than merging records',()=>{
    expect(()=>parseGroundedResponseText('## profile\nFirst estate.\n## profile\nDifferent estate.',schema)).toThrow('Duplicate');
    expect(()=>parseGroundedResponseText('## range\n| name | notes |\n| --- | --- |',schema)).toThrow('wrong columns');
    expect(()=>parseGroundedResponseText('## rangeComplete\nprobably',schema)).toThrow('boolean');
  });

  it('continues replaying JSON answers submitted by older deployments',()=>{
    expect(parseGroundedResponseText('Result:\n```json\n{"profile":"Existing sourced profile","range":[]}\n```',schema)).toEqual({profile:'Existing sourced profile',range:[]});
    expect(()=>parseGroundedResponseText('{"range":[{"name":"A"}]',schema)).toThrow('Invalid structured JSON');
  });

  it('checks public contacts against grounding on the new sections',()=>{
    const text='## officialWebsiteUrl\nhttps://estate.example/\n\n## contactEmail\ninfo@estate.example\n\n## contactPhone\nnull';
    const claim='## contactEmail\ninfo@estate.example';
    const evidence={groundingChunks:[{web:{uri:'https://estate.example/contact',title:'Contact'}}],groundingSupports:[{segment:{startIndex:text.indexOf(claim),endIndex:text.indexOf(claim)+claim.length,text:claim},groundingChunkIndices:[0]}]};
    expect(extractContactGrounding(text,evidence).fields).toEqual(['contactEmail']);
    expect(extractContactGrounding(text).fields).toEqual([]);
  });

  it('requests cited prose with deterministic headings instead of a JSON-only answer',()=>{
    const contract=describeGroundedResponse(schema);
    expect(contract).toContain('Do not return JSON');expect(contract).toContain('## profile');
    expect(contract).toContain('name | category | notes');
  });
});
