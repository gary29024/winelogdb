# D1 and loading performance review

Reviewed against main commit `1788c1d1e3bef1022d01c1d618c57efffe3cf7c0`.

The review covered the Journal query and maintenance path, wine reads and writes,
producer/catalog reads, Journey/Insights and achievement summaries, browser
summary caches, authentication, and existing migrations/indexes. The existing
search debounce, paginated Journal, route splitting and revision caches already
address several common bottlenecks.

## Implemented

| Path | Previous work | New behaviour |
| --- | --- | --- |
| Non-search wine updates | Every UPDATE deleted and reinserted the FTS entry, including favourites, ratings, research metadata and unchanged form values. | Migration 0049 updates FTS only when the values actually indexed change. Inserts and deletes retain their existing triggers. |
| Changed favourite | An existence read followed by an unconditional UPDATE. | One conditional UPDATE. Missing wines retain their 404 response through a fallback existence read. |
| Repeated favourite value | Rewrote the wine, bumped the owner revision and invalidated browser summaries. | Zero row changes; the browser retains its valid summaries. Older Worker responses still invalidate as before. |
| Unchanged summary with matching ETag | Read the revision, loaded and parsed the cached JSON, then returned 304. | One revision lookup; no cached-payload read, aggregate rebuild or cache write. Changed responses reuse the initial revision lookup. |
| Journal maintenance | Awaited claim checks before the page query; retried the one-shot repair claim on every first-page search/filter request. | Checks run via `waitUntil`; same-isolate repair checks share a promise and a 60-second memo. D1 keeps the durable cross-isolate claim. Capped/failed passes release their claim for retry. |
| Overlapping browser summaries | A request from before a save could refill the invalidated cache or clear a newer pending request. | Generation and session checks prevent stale cache refills; concurrent callers still share a request. The existing 30-second TTL is unchanged. |
| Achievement rebuild during writes | A second racing rebuild could be stored under a newer revision than its data. | A result that still races a write is returned without being stored or tagged as current. |

## Evidence and limits

- Route tests verify that matching summary ETags execute exactly one D1 statement,
  without loading a payload, and that authentication precedes the shortcut.
- Real SQLite tests apply every migration, then exercise FTS edits, NULL handling,
  owner/wine identities, deletes and favourite requests.
- In a one-wine local fixture, SQLite `total_changes()` fell from **12 to 2** for
  a favourite update after migration 0049. A repeated favourite request changes
  **zero rows**, including the revision. These are local SQLite row changes,
  **not Cloudflare billing measurements or an app-wide percentage saving**.
- Tests cover cache expiry, session changes, both completion orders around
  invalidation, failed requests, maintenance retries, and a Journal response
  completing while maintenance checks remain blocked.
- No live database contents or production latency/usage metrics were accessed.
  D1 counts rows scanned and written, including index work; validate deployment
  impact using `rows_read`, `rows_written`, query duration and the D1 dashboard.
  See [Cloudflare D1 pricing and metrics](https://developers.cloudflare.com/d1/platform/pricing/).

## Deployment

Apply `0049_avoid_redundant_search_updates.sql` through the normal D1 migration
command (`npm run db:migrate`) before or with deployment. The existing
`npm run deploy` runs the build, migrations and deployment in that order.
The migration replaces one trigger, performs no data backfill and is rerunnable.
The PR does not deploy or modify the live database.

## Further profiling targets

- The Journal still computes an exact count for each page/filter request and
  derives photo ordering with a correlated subquery. Any count/page cache needs
  invalidation for tasting changes as well as wine changes; the current owner
  revision intentionally does not track every tasting-table update.
- Cuvée resolution still seeds/reconciles legacy identities on some reads.
  Moving that work entirely to writes needs explicit coverage of catalog imports,
  manual links, merges and legacy repairs before removing those read-time checks.
- Producer detail reads query the latest tasting twice per wine (date and rating).
  Profile that query on a large producer before replacing it with a single join,
  preserving the existing latest-experience and NULL fallback semantics.

These are candidates for measurement, not claimed production bottlenecks.
