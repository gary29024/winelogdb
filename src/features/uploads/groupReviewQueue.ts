import type { SavedWineIdentity } from '../wines/WineForm';

/**
 * What the Group Photo review list does when a bottle is saved: which one to
 * open next, and what the card it leaves behind should say.
 *
 * Its own module, and pure, because these rules are the whole of that feature
 * and each of them was reported as a fault before it was written.
 */

/**
 * What a review card says once the wine behind it is saved.
 *
 * Reported as: a correction typed into the form - the label read as "Dom
 * Perignon", saved as "Dom Perignon Vintage 2004" - appeared on the wine's own
 * page and nowhere else, so the review list went on showing the model's reading
 * of a wine you had already fixed.
 *
 * Written back into the recognition, because that object is the one part of a
 * review item the server keeps: a session resumed tomorrow, or on another
 * device, then carries the corrected name rather than the read one. The box and
 * the confidence are left alone - they describe the detection, and the crop
 * they produced is still the crop on the card.
 */
export function savedRecognition<T extends {producer:string;wineName:string;vintage?:number|null}>(recognition:T|null,saved:SavedWineIdentity|null|undefined):T|null{
  if(!recognition||!saved)return recognition;
  return {...recognition,producer:saved.producer,wineName:saved.wineName,vintage:saved.vintage};
}

export type ReviewQueueItem={key:string;savedId:string|null;removed:boolean;recognition:unknown};

/**
 * The next unsaved bottle after this one, wrapping once to the start.
 *
 * Reported as: saving cleared the selection, so the panel closed and the next
 * wine meant scrolling back up the photograph to find its Review button - eight
 * times for a lineup of eight.
 *
 * Wrapping matters: a bottle skipped earlier is come back to at the end rather
 * than stranded behind the one you happened to save last. Null when nothing is
 * left, which closes the panel exactly as finishing should.
 */
export function nextPendingKey<T extends ReviewQueueItem>(items:T[],savedKey:string):string|null{
  const pending=items.filter(item=>!item.removed&&!item.savedId&&item.recognition);
  if(!pending.length)return null;
  const from=items.findIndex(item=>item.key===savedKey);
  return (pending.find(item=>items.indexOf(item)>from)??pending[0]).key;
}
