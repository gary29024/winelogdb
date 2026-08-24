// achievement_cache_state is the single monotonic revision for everything an owner
// stores. Migration 0030 introduced it for achievement progress; migration 0031
// extends its triggers to tasting structures, wine photos and wine experiences so
// any owner-scoped read cache can be validated against the same counter.
export const missingTable=(error:unknown)=>String(error).toLowerCase().includes('no such table');

export async function currentOwnerRevision(db:D1Database,owner:string):Promise<number|null>{
  try{
    const row=await db.prepare('SELECT revision FROM achievement_cache_state WHERE owner_id=?').bind(owner).first<{revision:number}>();
    return Number(row?.revision??0);
  }catch(error){if(missingTable(error))return null;throw error}
}

// A revision-tagged ETag lets the browser revalidate a cached payload for the cost of
// one indexed lookup instead of a full recompute.
export const revisionETag=(scope:string,version:number,revision:number)=>`"${scope}-v${version}-r${revision}"`;

export function etagMatches(header:string|null|undefined,etag:string){
  if(!header)return false;
  return header.split(',').some(candidate=>{const value=candidate.trim();return value===etag||value===`W/${etag}`||value==='*'});
}
