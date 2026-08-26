/**
 * Where a cover thumbnail should sit vertically, for an image of this shape.
 *
 * A group photo crop is the bottle and nothing else, so it comes out around one
 * part wide to four tall. Shown with object-fit:cover in a portrait thumbnail,
 * only about a third of its height is visible, and centred that third lands on
 * the shoulder - the widest part of the glass and the part with nothing written
 * on it. Nudging the window down puts the label in the frame instead.
 *
 * There is no rule for where a label sits: Burgundy carries it low on the body,
 * Bordeaux nearer the middle, and some cuvees print almost nothing below the
 * shoulder. So this is deliberately a small nudge that widens the odds rather
 * than a guess at one bottle's geometry, and it only applies to shapes no
 * camera produces - past 2.2:1, taller than a 16:9 phone portrait. Anything a
 * person framed themselves stays centred, because they framed it.
 */
const BOTTLE_CROP_RATIO=2.2;
const LABEL_POSITION='center 72%';

export function labelFocusPosition(width:number|undefined,height:number|undefined):string|undefined{
  if(!width||!height||width<=0||height<=0)return undefined;
  return height/width>=BOTTLE_CROP_RATIO?LABEL_POSITION:undefined;
}
