import {
  isCancelledError,
  notifyManager,
  QueryClient,
  useQuery,
  type Query,
  type QueryKey,
} from '@tanstack/react-query';

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
export type ReadPolicy = { summary?: boolean };

const SUMMARY_FRESH_MS = 30_000;
const isSummary = (query: Query) => query.meta?.summary === true;

function readOptions<T>(key: QueryKey, load: () => Promise<T>, policy: ReadPolicy) {
  return {
    queryKey: key,
    queryFn: load,
    ...(policy.summary ? { staleTime: SUMMARY_FRESH_MS, meta: { summary: true } } : {}),
  };
}

export type Loaded<T> = {
  /** The latest answer, or `undefined` until the first one arrives. */
  data: T | undefined;
  /** True while there is nothing to show yet, including during "Try again". */
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
export function useLoad<T>(key: QueryKey, load: () => Promise<T>, policy: ReadPolicy = {}): Loaded<T> {
  const query = useQuery(readOptions(key, load, policy), queryClient);
  const empty = query.data === undefined;
  const failed = empty && query.isError && !query.isFetching;
  return {
    data: query.data,
    loading: query.isPending || (empty && query.isFetching),
    failed,
    error: failed ? query.error.message : '',
    retry: () => void query.refetch(),
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
export async function readShared<T>(key: QueryKey, load: () => Promise<T>, policy: ReadPolicy = {}): Promise<T> {
  const options = readOptions(key, load, policy);
  try {
    return await queryClient.fetchQuery(options);
  } catch (error) {
    if (isCancelledError(error)) return queryClient.fetchQuery(options);
    throw error;
  }
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
 * loading state instead of the answer from before the write. Summaries are left
 * to `discard`, for the reason given on `ReadPolicy`.
 */
export function dataChanged() {
  const predicate = (query: Query) => !isSummary(query);
  queryClient.removeQueries({ type: 'inactive', predicate });
  void queryClient.invalidateQueries({ type: 'active', predicate });
}

/** The account changed. Nothing read for the previous one may be shown. */
export function forgetLoadedData() {
  queryClient.clear();
}
