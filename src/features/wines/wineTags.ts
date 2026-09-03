/**
 * The tags a wine gets from what it is, and how they survive a correction.
 *
 * Recognition suggests a tag for each of the country, region, appellation,
 * grapes and style it read off the label, and those went into the form frozen.
 * Correct the wine afterwards - a Champagne that turns out to be a Burgundy,
 * a Merlot that was a Malbec - and the tags stayed as the scan first wrote
 * them, so the bottle carried a Champagne tag for the rest of its life.
 *
 * Three-way, not a recompute. A tag that was derived and no longer is gets
 * dropped; a newly derived one gets added; everything else is left exactly as
 * it is - which is what keeps a tag typed by hand, and a suggested tag
 * deliberately deleted, from being resurrected by an unrelated edit.
 */
export type TagSource={
  country?:string|null;region?:string|null;appellation?:string|null;
  grapes?:readonly string[]|null;style?:string|null;
};

const MAX_DERIVED=8;
/** Case and surrounding space are not what makes two tags different. */
const tagKey=(value:string)=>value.trim().toLowerCase();

/** What this wine says about itself, in the order a reader would want it. */
export function derivedTags(source:TagSource){
  const seen=new Set<string>();
  return [source.country,source.region,source.appellation,...(source.grapes??[]),source.style]
    .filter((value):value is string=>Boolean(value))
    .map(value=>value.trim())
    .filter(value=>{
      const key=tagKey(value);
      if(!value||seen.has(key))return false;
      seen.add(key);return true;
    })
    .slice(0,MAX_DERIVED);
}

export function reconcileTags(current:readonly string[],was:readonly string[],now:readonly string[],limit=50){
  const wasKeys=new Set(was.map(tagKey)),nowKeys=new Set(now.map(tagKey));
  // Gone from the wine, so gone from the tags - but only where this is the tag
  // the wine put there. A "Champagne" typed by hand is not the app's to remove,
  // and it is indistinguishable from a derived one except by having never been
  // derived in the first place.
  const kept=current.filter(tag=>!(wasKeys.has(tagKey(tag))&&!nowKeys.has(tagKey(tag))));
  const have=new Set(kept.map(tagKey));
  const added=now.filter(tag=>!wasKeys.has(tagKey(tag))&&!have.has(tagKey(tag)));
  return [...kept,...added].slice(0,limit);
}
