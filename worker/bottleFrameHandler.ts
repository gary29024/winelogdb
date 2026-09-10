import { frameOf,parseBottleFrameResult,type BottleFrameResult } from '../src/features/recognition/bottleFrameSchema';
import { bottleFrameResponseJsonSchema,RECOGNITION_MODEL } from '../src/lib/recognition/geminiRequest';
import { runVisionRecognition,type RecognitionModeSpec,type VisionBindings } from './visionRecognition';
import { writeBottleFrame } from '../src/lib/images/bottleFrame';

/** A thumbnail is all this needs; the browser sends one well under the cap. */
const MAX_FRAME_IMAGE_BYTES=1024*1024;

/**
 * One bottle photograph in, the rectangle it occupies out.
 *
 * The cheapest call in the app and the narrowest: no label text is read, no
 * wine is identified, nothing is written to the journal. It exists because a
 * collage of an evening looks like sixteen unrelated snapshots unless the
 * bottles are the same size, and how big a bottle is in a photograph is
 * something only a look at the photograph can answer.
 *
 * No escalation. A stronger model would cost more to answer a question the
 * first one either got right or has no bottle to get right, and a photograph
 * that comes back empty is recorded as empty rather than retried.
 */
export const bottleFrameSpec:RecognitionModeSpec<BottleFrameResult>={
  kind:'bottle_frame',
  mode:'bottle-frame',
  label:'Bottle framing',
  model:RECOGNITION_MODEL,
  maxBytes:MAX_FRAME_IMAGE_BYTES,
  maxOutputTokens:512,
  oneFileError:'Send exactly one photograph to measure',
  jsonSchema:bottleFrameResponseJsonSchema,
  parse:parseBottleFrameResult,
  escalationReasons:()=>[],
  preferEscalated:primary=>primary,
  wineCount:result=>result.bottle?1:0,
  logFields:result=>({hasBottle:Boolean(result.bottle),hasLabel:Boolean(result.label)}),
  prompt:()=>`This photograph shows a wine bottle, usually held up by hand. Return only where things are, using normalized image coordinates from 0 to 1000 (xMin,yMin,xMax,yMax). "bottle": a tight box around the visible glass of the single main bottle - the one held up or nearest the camera - from the top of its neck or capsule to the base, or to the bottom edge of the photo where the base is out of shot. Bottles are usually held at an angle: the box is still the upright rectangle that contains the whole slanted bottle. "axis": two points down the middle of that same bottle - "top" at the centre of the neck or capsule where the box starts, "bottom" at the centre of the base - which is how the lean is reported. "label": a tight box around that bottle's main front paper label only, not the neck label and not the capsule. Ignore other bottles, glasses, hands, plates and anything in the background. If there is no wine bottle in this photograph, or the main bottle cannot be told apart from what is behind it, return null for the boxes and the axis rather than guessing. "confidence" is 0 to 1 for how sure you are of the bottle box. Return ONLY valid JSON: {"bottle":{"xMin":0,"yMin":0,"xMax":1000,"yMax":1000},"axis":{"topX":500,"topY":100,"bottomX":500,"bottomY":900},"label":null,"confidence":0.0}. Do not use Markdown fences.`
};

/**
 * Measures one photograph and remembers the answer.
 *
 * The write is what makes this affordable to offer: measuring is a vision call,
 * but a photograph only changes when it is replaced, so the second card made
 * from the same evening costs nothing at all.
 */
export async function measureBottleFrame(request:Request,env:VisionBindings,imageId:string){
  const outcome=await runVisionRecognition(request,env,bottleFrameSpec);
  if(!outcome.ok)return {ok:false as const,response:outcome.response};
  const frame=frameOf(outcome.result);
  await writeBottleFrame(env.DB,outcome.owner,imageId,frame);
  return {ok:true as const,frame,requestId:outcome.requestId};
}
