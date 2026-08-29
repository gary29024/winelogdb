import { parseGroupRecognition,type GroupRecognitionResult } from '../src/features/recognition/groupSchema';
import { groupRecognitionResponseJsonSchema,PLACE_LEVEL_RULE,RECOGNITION_MODEL } from '../src/lib/recognition/geminiRequest';
import { groupRecognitionEscalationReasons } from '../src/lib/recognition/escalation';
import { handleVisionRecognitionRequest,type RecognitionModeSpec,type VisionBindings } from './visionRecognition';

const MAX_GROUP_IMAGE_BYTES=3*1024*1024;

/**
 * One photo of a table, several different bottles on it.
 *
 * Everything that is not this prompt and this schema - retry, schema fallback,
 * escalation, metering - lives in visionRecognition, which the tasting sheet
 * mode shares.
 */
export const groupRecognitionSpec:RecognitionModeSpec<GroupRecognitionResult>={
  kind:'scan_group',
  mode:'group',
  label:'Group recognition',
  model:RECOGNITION_MODEL,
  maxBytes:MAX_GROUP_IMAGE_BYTES,
  maxOutputTokens:8192,
  oneFileError:'Choose exactly one group photo',
  jsonSchema:groupRecognitionResponseJsonSchema,
  parse:parseGroupRecognition,
  escalationReasons:groupRecognitionEscalationReasons,
  wineCount:result=>result.wines.length,
  logFields:result=>({unresolvedCount:result.unresolvedCount}),
  prompt:context=>`This is ONE group photograph containing MULTIPLE wine bottles or labels. Identify each DISTINCT wine that can be reasonably identified. Do not treat the whole photo as one wine. Do not return the same wine twice merely because two bottles of it are visible. Order results left-to-right by the bottle/label position. For every returned wine, give a bounding box around the visible bottle or most useful label using normalized image coordinates from 0 to 1000: xMin,yMin,xMax,yMax. Keep the box tight enough to make a useful wine thumbnail but include the complete visible bottle/label when possible. Producer, wineName and vintage are identity-critical and must be supported by visible label or bottle evidence in this photo; never fill or substitute those identity fields from general wine knowledge. If a visible bottle cannot be identified with producer and wine name, omit it from wines and increment unresolvedCount instead of guessing. Vintage must be a JSON integer such as 2019, never a quoted string. Use null when non-vintage, multi-vintage, an edition/release code, or unreadable; MV20, 173ème Édition and 90-21 are release identifiers, not vintages. After the visible identity is established, high-confidence canonical country, region, appellation, grapes and broad style may be filled from general wine knowledge. ${PLACE_LEVEL_RULE} Style must be one of red, white, rose, sparkling, dessert, fortified, orange, other. Blend percentages only when explicitly visible. Do not return tasting notes, scores, producer history, terroir or deep research. Confidence is 0 to 1 for the specific visible wine identity, especially producer and wineName. Return ONLY valid JSON with this exact top-level shape: {"wines":[{"producer":"...","wineName":"...","vintage":null,"country":null,"region":null,"appellation":null,"grapes":[],"grapeBlend":[],"style":null,"alcoholPercentage":null,"locationName":null,"confidence":0.0,"boundingBox":{"xMin":0,"yMin":0,"xMax":1000,"yMax":1000}}],"unresolvedCount":0}. Do not use Markdown fences. Do not return a top-level array. ${context}`
};

export const handleGroupRecognitionRequest=(request:Request,env:VisionBindings)=>
  handleVisionRecognitionRequest(request,env,groupRecognitionSpec);
