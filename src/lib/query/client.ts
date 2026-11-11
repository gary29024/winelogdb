import { notifyManager, QueryClient, useQuery, type QueryKey } from '@tanstack/react-query';

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

export type Loaded<T> = {
  /** The latest answer, or `undefined` until the first one arrives. */
  data: T | undefined;
  /** True while there is nothing to show yet, including during "Try again". */
  loading: boolean;
  /** Why there is nothing to show. Empty while an earlier answer is on screen. */
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
export function useLoad<T>(key: QueryKey, load: () => Promise<T>): Loaded<T> {
  const query = useQuery({ queryKey: key, queryFn: load }, queryClient);
  const empty = query.data === undefined;
  return {
    data: query.data,
    loading: query.isPending || (empty && query.isFetching),
    error: empty && query.error ? query.error.message : '',
    retry: () => void query.refetch(),
  };
}

/**
 * A write landed, so anything read before it may no longer be true.
 *
 * Called from the one function every request goes through, so that a write
 * added later cannot forget to say so. Screens that are open ask again; answers
 * kept for screens that are closed are dropped, so reopening one shows its
 * loading state instead of the answer from before the write.
 */
export function dataChanged() {
  queryClient.removeQueries({ type: 'inactive' });
  void queryClient.invalidateQueries({ type: 'active' });
}

/** The account changed. Nothing read for the previous one may be shown. */
export function forgetLoadedData() {
  queryClient.clear();
}
