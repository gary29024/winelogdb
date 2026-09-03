/**
 * Where the drinking window is offered, and where it is not.
 *
 * The question the window answers is "should I open this?", which only has an
 * answer for a bottle you still hold. On a wine in the Journal the bottle is
 * already drunk, so the box was taking room on the page - and its cache read on
 * every wine opened - to answer a question that had been settled by drinking it.
 *
 * A switch rather than a deletion, because the feature is not wrong, only
 * misplaced: turning it back on is this one boolean, and everything behind it -
 * the ageing table, the lookup, the shift, the cache - is untouched and still
 * running for the cellar.
 */
export const VINTAGE_WINDOW_SURFACES={
  /**
   * The wine page reached from the Journal. Off: the bottle has been drunk, and
   * a window around a date in the past is not a decision anybody is making.
   */
  wineDetail:false,
  /**
   * Adding or correcting a bottle you hold. On: this is the screen you are on
   * while deciding whether tonight is the night, and the only one that exists
   * for a wine you have not drunk.
   */
  cellarSheet:true
} as const;
