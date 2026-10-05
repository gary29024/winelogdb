import { apiJson } from '../../lib/auth/api';
import { bootstrapAccount,getAccount } from '../../lib/auth/client';

export type TourState={completed:string[];skipped:boolean};
const EMPTY:TourState={completed:[],skipped:false};

/**
 * The account's stored progress. A column that has never been written holds
 * '{}', and a malformed one is treated as untouched rather than throwing: the
 * cost of being wrong is one extra tour, and the alternative is a parse error
 * taking down the whole layout.
 */
export function tourState(raw:string|undefined):TourState{
 if(!raw)return EMPTY;
 try{
  const value=JSON.parse(raw) as Partial<TourState>;
  return {completed:Array.isArray(value.completed)?value.completed.filter(id=>typeof id==='string'):[],skipped:value.skipped===true};
 }catch{return EMPTY}
}

export const currentTourState=()=>tourState(getAccount()?.tour_state);
export const hasSeen=(state:TourState,tour:string)=>state.skipped||state.completed.includes(tour);

/**
 * Saved once, when the tour ends or is skipped - not per step. That is one write
 * per account instead of seven, and the worst case of a browser closed midway is
 * that the tour offers itself again, which is a kinder failure than six writes
 * on every first run.
 *
 * The account is refetched afterwards so the in-memory copy agrees with the
 * column; a failure here is swallowed because an unsaved tour is a nuisance and
 * an error banner over a first run is worse.
 */
export async function saveTourState(state:TourState){
 try{await apiJson<{user:unknown}>('/api/me/tour','PATCH',state);await bootstrapAccount()}catch{}
}
