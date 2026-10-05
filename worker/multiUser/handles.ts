import { ApiError } from './common';

// 3-20 characters: lowercase letters, numbers, dots and underscores, starting
// and ending with a letter or number. Stored without the leading "@".
const HANDLE=/^[a-z0-9](?:[a-z0-9._]{1,18})[a-z0-9]$/;
const RESERVED=new Set(['admin','administrator','owner','support','help','winelog','system','root','me','null','undefined','api','account','friends','settings']);

export function normalizeHandle(value:unknown){
 return typeof value==='string'?value.trim().replace(/^@/,'').toLowerCase():'';
}
/** Why a handle cannot be used, or null when it can. Uniqueness is checked separately. */
export function handleProblem(handle:string){
 if(handle.length<3||handle.length>20)return 'Handles are 3 to 20 characters';
 if(!HANDLE.test(handle))return 'Use lowercase letters, numbers, dots or underscores, starting and ending with a letter or number';
 if(/[._]{2}/.test(handle))return 'Dots and underscores cannot sit next to each other';
 if(RESERVED.has(handle))return 'That handle is reserved';
 return null;
}
export function validHandle(value:unknown){
 const handle=normalizeHandle(value),problem=handleProblem(handle);
 if(problem)throw new ApiError(400,problem);
 return handle;
}
/** A starting handle from a display name: "Mei Lin" → "meilin", "Zoë" → "zoe". */
export function suggestHandle(name:string){
 const base=name.normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,16);
 return base.length>=3&&!RESERVED.has(base)?base:`member${base}`.slice(0,16);
}
export async function handleTaken(db:D1Database,handle:string,exceptUserId:string){
 return Boolean(await db.prepare('SELECT 1 FROM app_users WHERE handle=? AND id<>?').bind(handle,exceptUserId).first());
}
/**
 * Gives one account a handle if it has none. Tries the name-based handle, then
 * numbered variants, then a random suffix. The WHERE clause and the unique index
 * keep two concurrent requests from handing out the same one.
 */
export async function assignHandle(db:D1Database,userId:string,displayName:string){
 const base=suggestHandle(displayName);
 const candidates=[base,...Array.from({length:30},(_,index)=>`${base.slice(0,17)}${index+2}`),...Array.from({length:3},()=>`${base.slice(0,12)}${crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0,6)}`)];
 for(const handle of candidates){
  try{
   const result=await db.prepare('UPDATE app_users SET handle=? WHERE id=? AND handle IS NULL AND NOT EXISTS(SELECT 1 FROM app_users WHERE handle=?)').bind(handle,userId,handle).run();
   if(result.meta.changes)return handle;
  }catch{/* Lost a race for this handle to another account; try the next one. */}
  const current=await db.prepare('SELECT handle FROM app_users WHERE id=?').bind(userId).first<{handle:string|null}>();
  if(current?.handle)return current.handle;
 }
 throw new ApiError(503,'Could not create a handle for this account');
}
/** Fills in handles for every account still without one (a one-off per account). */
export async function backfillHandles(db:D1Database){
 const rows=await db.prepare('SELECT id,display_name FROM app_users WHERE handle IS NULL ORDER BY created_at,id LIMIT 200').all<{id:string;display_name:string}>();
 for(const row of rows.results)await assignHandle(db,row.id,row.display_name);
}
