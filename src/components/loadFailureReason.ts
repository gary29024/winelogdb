/**
 * Turns whatever a failed page load threw into a sentence a member can act on.
 *
 * A dropped connection reaches the app as a bare browser error ("Failed to
 * fetch", "Load failed"), which says nothing useful to someone standing in a
 * cellar with one bar of signal. Server messages that already read as plain
 * sentences are kept as they are.
 */
export function loadFailureReason(error:unknown,fallback:string):string{
  const message=typeof error==='string'?error:error instanceof Error?error.message:'';
  const offline=typeof navigator!=='undefined'&&navigator.onLine===false;
  if(offline||/failed to fetch|load failed|networkerror|network request failed/i.test(message))return 'You appear to be offline or the connection dropped. Check your signal and try again.';
  return message.trim()||fallback;
}
