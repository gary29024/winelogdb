/**
 * Which bottle to review next, once one is saved.
 *
 * Its own module, and pure, because the rule is the whole feature: saving used
 * to clear the selection, so the panel closed and the next wine meant scrolling
 * back up the photograph to find its Review button - eight times for a lineup
 * of eight.
 */
export type ReviewQueueItem={key:string;savedId:string|null;removed:boolean;recognition:unknown};

/**
 * The next unsaved bottle after this one, wrapping once to the start.
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
