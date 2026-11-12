import {
  isCancelledError,
  keepPreviousData,
  notifyManager,
  QueryClient,
  useQuery,
  type Query,
  type QueryKey,
} from '@tanstack/react-query';
import {
  clearSavedCopyMarks,
  markSavedCopy,
  readKeepingCopy,
  savedCopyMarks,
  subscribeSavedCopies,
} from '../offline/savedReads';

// Tell screens about an answer as soon as it arrives, not one timer tick later.
// The library's default waits for a timer, which leaves a screen on its loading
// state for one more frame than the hand-written loaders it replaces did.
notifyManager.setScheduler(queueMicrotask);

/**
 * The one place a screen's data is kept once it has been read.
 *
 * Screens used to each hold their own copy in component state: a `loading`
 * flag, an `error` string, an `attempt` counter to ask again, and an `active`
 * guard so an answer arriving after the screen had gone was dropped. Every
 * screen wrote those four by hand, slightly differently, and none of them could
 * tell another that what it held had stopped being true.
 *
 * The settings keep the behaviour those screens already had:
 * - no automatic retry, because every screen offers its own "Try again";
 * - no refetch on focus or reconnect, because nothing asked again before;
 * - `networkMode: 'always'`, so a request made without a connection fails and
 *   says so instead of waiting silently for the connection to return.
 *
 * What is new is that an answer is kept for five minutes after its screen
 * closes. Coming back shows it at once and asks again in the background.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      networkMode: 'always',
      staleTime: 0,
      gcTime: 5 * 60_000,
    },
  },
});

/**
 * How long an answer stays good, and what makes it stale.
 *
 * Most answers are asked for again every time their screen opens, and are
 * thrown away by any write. A `summary` is different: the Passport and the
 * collections are expensive to work out and change only when what has been
 * drunk changes. They stay good for thirty seconds, and only `discard` - which
 * `summariesChanged` calls - makes them stale. A cellar write or a favourite
 * that was already set must not throw away an answer that is still true.
 */
export type ReadPolicy = {
  summary?: boolean;
  /**
   * Good until this device says otherwise. The open tasting changes only when
   * this device starts, ends or reopens one, and each of those says so itself,
   * so it is read once and never thrown away by an unrelated write.
   */
  pinned?: boolean;
  /** Do not ask yet - there is no id to ask about. The screen stays loading. */
  skip?: boolean;
  /**
   * While the next page or search is on its way, keep showing the last one. A
   * list that empties and refills on every keystroke is harder to read than one
   * that changes once.
   */
  keepPrevious?: boolean;
};

/** Reads something. Given the signal only if it asks for it, so it can be abandoned. */
export type Loader<T> = (signal: AbortSignal) => Promise<T>;

const SUMMARY_FRESH_MS = 30_000;
const keptThroughWrites = (query: Query) => query.meta?.keep === true;

/**
 * Run a read, keeping a copy of its answer on the device, and fall back to that
 * copy when the server cannot be reached at all.
 *
 * A saved copy is handed back as an ordinary answer, so no screen needs to know
 * about it. It is marked stale straight away, which makes the next visit ask
 * the server again, and it is named in the list the offline bar reads.
 */
function withSavedCopy<T>(key: QueryKey, read: () => Promise<T>): Promise<T> {
  return readKeepingCopy(key, read, (at) => {
    markSavedCopy(key, at);
    queueMicrotask(() => void queryClient.invalidateQueries({ queryKey: key, exact: true, refetchType: 'none' }));
  });
}

function readOptions<T>(key: QueryKey, load: Loader<T>, policy: ReadPolicy) {
  return {
    queryKey: key,
    // Asking for the signal tells the library the request may be abandoned when
    // its screen closes, so only a loader that takes one is treated that way.
    queryFn: load.length
      ? ({ signal }: { signal: AbortSignal }) => withSavedCopy(key, () => load(signal))
      : () => withSavedCopy(key, load as () => Promise<T>),
    ...(policy.summary ? { staleTime: SUMMARY_FRESH_MS, meta: { keep: true } } : {}),
    ...(policy.pinned ? { staleTime: Infinity, meta: { keep: true, pinned: true } } : {}),
    ...(policy.skip ? { enabled: false } : {}),
    ...(policy.keepPrevious ? { placeholderData: keepPreviousData } : {}),
  };
}

export type Loaded<T> = {
  /** The latest answer, or `undefined` until the first one arrives. */
  data: T | undefined;
  /**
   * True while there is nothing current to show: before the first answer,
   * during "Try again", and while a kept earlier page stands in for the next.
   */
  loading: boolean;
  /** True when the read failed and there is no earlier answer to show. */
  failed: boolean;
  /** What the failure said, which may be nothing. Empty unless `failed`. */
  error: string;
  /** Ask again. */
  retry: () => void;
};

/**
 * Read something for a screen.
 *
 * `key` names the answer, so two screens asking for the same thing share one
 * request and one copy. It is handed the client directly rather than through a
 * provider, so a component renders the same way in the app and alone in a test.
 */
export function useLoad<T>(key: QueryKey, load: Loader<T>, policy: ReadPolicy = {}): Loaded<T> {
  const query = useQuery(readOptions(key, load, policy), queryClient);
  const empty = query.data === undefined;
  const failed = empty && query.isError && !query.isFetching;
  return {
    data: query.data,
    loading: query.isPending || (empty && query.isFetching) || query.isPlaceholderData,
    failed,
    error: failed ? query.error.message : '',
    // Joins a request already on its way - a write has usually just started
    // one - so asking again after a save is one read, not two.
    retry: () => void query.refetch({ cancelRefetch: false }),
  };
}

/**
 * Read the same answer outside a component - a form filling itself in once, or
 * a handler waiting for the refreshed answer after its own write.
 *
 * It shares the request and the copy with any screen using `useLoad` on the
 * same key. If the answer is thrown away while the request is in flight, the
 * caller is given the one asked for afterwards rather than a cancellation.
 */
export async function readShared<T>(key: QueryKey, load: Loader<T>, policy: ReadPolicy = {}): Promise<T> {
  const options = readOptions(key, load, policy);
  try {
    return await queryClient.fetchQuery(options);
  } catch (error) {
    if (isCancelledError(error)) return queryClient.fetchQuery(options);
    throw error;
  }
}

/**
 * Put a newer answer in place of the one a screen is showing.
 *
 * For a screen that edits what it loaded: the server's reply to a save is the
 * record as it now stands, and showing it should not wait for another read. An
 * updater that is given nothing - the record has not been read - changes nothing.
 */
export function setLoaded<T>(key: QueryKey, next: T | ((previous: T) => T)) {
  queryClient.setQueryData<T>(key, (previous) => {
    if (typeof next !== 'function') return next;
    return previous === undefined ? previous : (next as (previous: T) => T)(previous);
  });
}

/**
 * One named answer stopped being true.
 *
 * An open screen asks again, and its request in flight is abandoned so that an
 * answer from before the change cannot land after it. A copy kept for a closed
 * screen is dropped.
 */
export function discard(key: QueryKey) {
  queryClient.removeQueries({ queryKey: key, type: 'inactive' });
  void queryClient.invalidateQueries({ queryKey: key, type: 'active' });
}

/**
 * A write landed, so anything read before it may no longer be true.
 *
 * Called from the one function every request goes through, so that a write
 * added later cannot forget to say so. Screens that are open ask again; answers
 * kept for screens that are closed are dropped, so reopening one shows its
 * loading state instead of the answer from before the write. Summaries and pinned
 * answers are left to `discard`, for the reasons given on `ReadPolicy`.
 */
export function dataChanged() {
  const predicate = (query: Query) => !keptThroughWrites(query);
  queryClient.removeQueries({ type: 'inactive', predicate });
  void queryClient.invalidateQueries({ type: 'active', predicate });
}

/**
 * The connection came back. Everything on screen is asked for again, summaries
 * and pinned answers included, because any of it may be a saved copy.
 */
export function connectionReturned() {
  clearSavedCopyMarks();
  queryClient.removeQueries({ type: 'inactive' });
  void queryClient.invalidateQueries({ type: 'active' });
}

/**
 * The date of the oldest saved copy a screen is showing right now, or 0 when
 * everything on screen came from the server.
 */
export function oldestSavedCopyOnScreen() {
  let oldest = 0;
  for (const [name, at] of savedCopyMarks()) {
    const query = queryClient.getQueryCache().find({ queryKey: JSON.parse(name) as QueryKey, exact: true });
    // A pinned answer (the open tasting) is on every screen, so it says nothing
    // about whether the screen in front of you is a saved copy.
    if (query?.getObserversCount() && !query.meta?.pinned && (!oldest || at < oldest)) oldest = at;
  }
  return oldest;
}

/** Tell a listener whenever what is on screen, or which of it is a saved copy, changes. */
export function subscribeSavedCopiesOnScreen(listener: () => void) {
  const stopMarks = subscribeSavedCopies(listener);
  const stopCache = queryClient.getQueryCache().subscribe(listener);
  return () => {
    stopMarks();
    stopCache();
  };
}

/** The account changed. Nothing read for the previous one may be shown. */
export function forgetLoadedData() {
  queryClient.clear();
}
