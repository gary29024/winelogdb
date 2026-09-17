import { missingTable } from '../db/ownerRevision';

/**
 * Whether this account may research a producer's wine range.
 *
 * The range is by far the most expensive part of producer research: the profile
 * is one grounded request, while the range asks for a producer's entire current
 * catalogue and re-asks it in halves whenever an answer runs out of output
 * budget. Members get the profile, general winemaking practices and contacts -
 * the cheap, stable, widely reusable parts. Only the owner runs the range.
 *
 * Read from the database rather than threaded through as a flag, so every entry
 * point agrees: the HTTP route, a queue delivery replayed days later, and the
 * batch campaign all ask the same question and get the same answer. A forged
 * queue message cannot grant itself the range.
 */
export async function producerRangeAllowed(db:D1Database,owner:string){
  try{
    const row=await db.prepare('SELECT role FROM app_users WHERE id=?').bind(owner).first<{role:string}>();
    // Table present but no row is an account that should not be spending at all.
    return row?.role==='owner';
  }catch(error){
    // Before the multi-user migration there is one tenant and it is the owner.
    if(missingTable(error))return true;
    throw error;
  }
}
