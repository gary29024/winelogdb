import { sparklingDetailsJsonSchema } from '../src/lib/recognition/geminiRequest';
import { champagneTextFields,type ChampagneFailureDiagnostics } from '../src/lib/wine/champagneExtraction';
import type { GeminiInlineResponse } from '../src/lib/research/geminiBatch';

// responseJsonSchema does not support maxLength. Descriptions guide generation;
// the existing Zod schema validates lengths after generation. Never claim that
// these hints enforce a hard generation bound.
const textLimits={dosageCategory:80,disgorgement:100,tirage:100,lotCode:120,assemblage:700,reserveWineDetail:500,malolactic:300,fermentationElevage:700,otherTechnicalDetails:1200};
const nullableText=(limit:number)=>({description:`One concise phrase, at most ${limit} characters. Null if absent. Do not repeat facts or add explanations.`,anyOf:[{type:'string'},{type:'null'}]});
const detailObject=sparklingDetailsJsonSchema.anyOf[0];
export const champagneResponseJsonSchema={
  type:'object',additionalProperties:false,required:['details','sourceText','reviewFields'],
  properties:{
    details:{anyOf:[{...detailObject,properties:{...detailObject.properties,...Object.fromEntries(Object.entries(textLimits).map(([key,max])=>[key,nullableText(max)]))}},{type:'null'}]},
    sourceText:{type:'object',additionalProperties:false,required:champagneTextFields,
      properties:Object.fromEntries(champagneTextFields.map(field=>[field,nullableText(textLimits[field])]))},
    reviewFields:{type:'array',maxItems:champagneTextFields.length,items:{type:'string',enum:champagneTextFields}}
  }
};

/** Keep only bounded answer excerpts in the owner's existing extraction record. */
export function champagneFailureDiagnostics(inline:GeminiInlineResponse):ChampagneFailureDiagnostics{
  const answer=(inline.response?.candidates?.[0]?.content?.parts??[])
    .filter(part=>!(part as {thought?:boolean}).thought).map(part=>part.text??'').join('');
  const count=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
  const usage=inline.response?.usageMetadata;
  return {finishReason:inline.response?.candidates?.[0]?.finishReason??'missing',
    outputTokens:count(usage?.candidatesTokenCount),thoughtTokens:count(usage?.thoughtsTokenCount),
    answerCharacters:answer.length,answerStart:answer.slice(0,2000),answerEnd:answer.length>2000?answer.slice(Math.max(2000,answer.length-2000)):'',
    excerptTruncated:answer.length>4000};
}

export class ChampagneResponseError extends Error{
  constructor(message:string,readonly diagnostics:ChampagneFailureDiagnostics){super(message)}
}
