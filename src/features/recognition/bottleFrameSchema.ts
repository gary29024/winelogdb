import { z } from 'zod';
import { groupBoundingBoxSchema } from './groupSchema';
import type { BottleFrame } from '../../lib/images/bottleFrame';

/**
 * What the model is asked for when a card wants its bottles the same size.
 *
 * Not identity: this call reads no label text and returns no producer. It
 * answers one question - whereabouts in this photograph is the bottle, and
 * whereabouts on it is the front label - which is the one thing a collage needs
 * and the one thing pixel heuristics could not do (a tilted bottle over a white
 * tablecloth and the same bottle over a tan floor defeated thresholds, edges
 * and colour models alike).
 *
 * Both boxes are nullable, and a reply of two nulls is a valid answer meaning
 * "there is no bottle here". That is recorded, so a photograph of a cellar
 * shelf is measured once rather than on every card.
 *
 * The box shape is reused from the group scan, quirks and all: Gemini answers
 * with ymin/xmin arrays, box_2d wrappers and left/top keys depending on the
 * day, and that preprocessing has already been through them.
 */
// z.null() first, deliberately: the group box preprocesses anything that is
// not an object into the full frame, so a genuine null would otherwise come
// back as "the bottle fills the photograph" rather than "there is no bottle".
const nullableBox=z.union([z.null(),groupBoundingBoxSchema]).optional().default(null);

const axisPoint=z.number().min(0).max(1000);
const nullableAxis=z.union([z.null(),z.object({
  topX:axisPoint,topY:axisPoint,bottomX:axisPoint,bottomY:axisPoint
})]).optional().default(null);

export const bottleFrameSchema=z.object({
  bottle:nullableBox,
  label:nullableBox,
  // Two points down the middle of the glass. Cheaper to ask for than a rotated
  // box and it answers the only question the card has about the lean: how much
  // of the bottle's box is the bottle, and how much of it is the tilt.
  axis:nullableAxis,
  confidence:z.number().min(0).max(1).default(0)
}).strict();

export type BottleFrameResult=z.infer<typeof bottleFrameSchema>;

export function parseBottleFrameResult(raw:string):BottleFrameResult{
  const cleaned=raw.replace(/^```(?:json)?\s*|\s*```$/g,'').trim();
  const parsed=bottleFrameSchema.safeParse(JSON.parse(cleaned));
  if(!parsed.success)throw new Error(parsed.error.issues.map(issue=>`${issue.path.join('.')||'field'}: ${issue.message}`).join('; '));
  return parsed.data;
}

/** What gets stored, and what the card draws with. */
export const frameOf=(result:BottleFrameResult):BottleFrame=>({bottle:result.bottle??null,label:result.label??null,axis:result.axis??null});
