# Multi-user pilot cutover

This change prepares an invite-only deployment with at most 25 accounts. It does
not deploy resources, open admission, grant initial credits, or upgrade a plan.
The existing `owner` keys remain unchanged in D1 and R2.

## Configure before launch

1. Back up the existing D1 database and record its row counts, migration state,
   and R2 object inventory. Keep the backup outside the public assets directory.
   Use `npx wrangler d1 export DB --remote --output=winelog-before-multi-user.sql`.
   Check the export is readable and test restoring it to a separate database.
2. Create a Google **web** OAuth client and register the exact HTTPS
   `APP_URL/api/auth/google/callback`. Configure `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, `OWNER_GOOGLE_SUB`, `APP_URL`, and a rotated
   `AUTH_SECRET`. Obtain the owner's subject from a verified Google ID token for
   that account. An email address is not a subject. Do not infer ownership from
   the first login. See [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect).
3. Apply migrations 0050 (accounts and credits), 0051 (storage and dispatch), and
   0052 (provider receipts and cleanup), and 0053 (friend codes and requests), then deploy the new public entrypoint
   `worker/multiUserEntry.ts`. Never deploy the old entrypoints as separate public
   Workers. Password login returns 410, and public bearer tokens are rejected.
   Drain/reconcile old queue jobs before cutover: new consumers require a member
   identity and a credit operation for AI work.
4. Sign in with the configured owner. Check legacy wines, producers, cuvées,
   cellar holdings, tasting documents and photos against the backup counts.
5. In **Account & friends → Owner controls**, configure all budget fields and
   every action price. Prices are positive integers, versioned, and disabled
   until configured. Set an initial owner grant; all accounts start at zero.
   Credits have no expiry, transfer, or cash value.
6. Run **Inventory R2 storage** and **Index existing research** to completion.
   Both jobs use resumable cursors. Unknown legacy object prefixes are charged
   conservatively to `owner`. Research indexing also visits producers with no
   journal wines. Existing research must pass the current quality gates before
   being made reusable. No friend admission is permitted before these tasks and
   all prices are configured.
7. Verify live Cloudflare subscriptions, remaining allowances and provider
   budgets. Run the production workload checks below, then issue one test
   invitation tied to the member's verified email. Invitations expire in seven
   days and can be consumed once. Admission and friendship are separate steps.

Do not run `npm run deploy` until the backup, configuration, and maintenance
window are ready; that script applies remote migrations. Reverting only the
Worker to password authentication after admitting members is unsafe. Keep the
new boundary in place during any application rollback.

## How access works

Google's provider/subject pair maps to an internal user ID. Opaque session
secrets live only in Secure, HttpOnly, SameSite=Lax cookies; D1 stores hashes.
OAuth uses one-use state, nonce and PKCE. Mutations require the configured
Origin. Every nested API receives a short-lived internal identity only after
the outer Worker authenticates the session. Administration checks owner role
separately. Session revocation and suspension take effect on subsequent requests.

Each account receives a permanent friend code at creation, displayed as
`A1B2-C3D4-E5F6` in **Account & friends**. Migration 0053 assigns codes to existing
accounts too. Enter another member's code to send an in-app request. Only the
recipient can accept it; sending requests in both directions does not bypass
acceptance. Members can decline incoming requests or cancel sent requests.
The page refreshes requests when focused and offers a manual refresh button.
Friend codes do not admit new members. Old friend links are retired and cannot
create friendships. Existing accepted friendships remain unchanged.
Friendship is mutual and non-transitive.
The owner selects recipients on each wine. **Shared with me** is read-only and
does not insert journal rows or affect statistics. Its explicit serializer
includes wine identity, notes, rating, tasting date and authorized wine photos;
it excludes price, venue, coordinates, private tags, cellar and tasting documents.
Unsharing, deleting or unfriending revokes subsequent access. Downloaded content
cannot be recalled.

Sharing photos are browser-rendered JPEG derivatives, with application/comment
metadata and trailing data removed again on the server. Original images and
unrelated group-source photos are never exposed by shared endpoints. New photos
added through the web journal get derivatives when the wine is already shared.
API clients that attach photos must also upload the sharing copy before it can
appear to recipients. Reads are authorization-checked and use `no-store`.

Browser caches and draft/upload stores use the account ID. Authentication
changes invalidate in-flight responses and reload other tabs; old password
tokens are removed. Unscoped legacy browser drafts are not imported into a new
account. Export any unsaved legacy drafts before cutover.

## Research and credits

Private producer/cuvée records remain owned by their author. Reusable factual
records retain contributor, canonical subject, scope, source evidence, quality
version and research time. Reads prefer valid own results, then the newest
passing result from a currently accepted friend. Friend facts are assembled on
read and never copied into another account's permanent research cache. Removing
a friend therefore removes access without deleting independently researched data.

Cross-account matching requires normalized Unicode names and sufficient
geography/style context. Vintage and release designations stay distinct; unknown
or ambiguous identities are not automatically reused. Correct the private wine
identity before asking for a new quote. Similar names alone do not merge records.
For non-vintage wines, automatic reuse covers stable producer and terroir facts;
exact-release findings stay private until an explicit release identity can be
represented. An unknown bottling or disgorgement is never treated as the same
release merely because its wine name matches.
Producer facts, cuvée terroir, vintage context, producer catalogue and vintage
windows retain their respective scopes.

Each AI action first receives an expiring server quote bound to account, path,
input and price versions. Execution supplies `X-WineLog-Quote` and
`Idempotency-Key`. Reservations, capture and release are atomic D1 batches backed
by an append-only ledger and wallet constraints. Successful scan drafts are
charged even if later discarded. Failed units are released; successful research
sections are captured separately. Verified continuations of the same truncated
sheet page are free and limited to four continuations. Internal retries add no
credit fee. Producer campaigns are limited to eight producers per request to
bound D1 queries; additional campaigns can follow.

Wine identity and producer names are also bound to the quote. Background
submission and result saving reject a changed identity instead of researching
or filing results under a different wine after an edit.

Matching active friend research can be followed for zero credits. The initiating
member funds it. A failed contribution or lost friendship does not start new AI
work; a new explicit quote is required. Browsing never invokes AI.
This includes matching vintage-window lookups. When only part of another wine
or campaign overlaps active friend work, admission waits for that work to finish;
the member then requests a new quote for the sections still missing. Scope locks
also prevent concurrent requests from paying twice for that overlapping work.

Queue dispatch goes through a durable outbox. Redelivery uses a lease and saved
provider receipts. A saved provider response can be replayed without another
submission; uncertain submissions hold credits for reconciliation. The five-minute
maintenance job redispatches expired deliveries, settles known terminal jobs,
releases reservations that never started, and prunes old completed receipts.
Completed raw provider receipts are retained for seven days; ledger entries and
operation results remain. Storage deletion also uses a durable cleanup list.

An operation in `review` is intentionally held. Inspect its provider receipt,
research/batch run, outbox and provider-side status. Do not manually decrement
wallets or release a reservation while the provider may still finish. Unknown
provider outcomes need operator reconciliation; there is no automatic timeout
refund or blind resubmission. Owner grants can compensate a member separately
without rewriting the original ledger.

## Budgets and free allowances

Storage allowances apply per member and across the bucket. AI admission checks
concurrency, daily actions, measured monthly provider usage, and outstanding
estimated holds. `aiUnitBudgetUsd` must cover the entire unit including expected
retry/fallback costs and all producer catalogue slices. It is an estimate, not
a provider-enforced limit. Refresh `cloudflareObservedMonth` and the delayed
Cloudflare cost measurement every month. Disabling overages stops new AI when a
positive Cloudflare cost is recorded; warning/stop amounts do not override hard
free-plan limits. No setting upgrades a Cloudflare subscription.

The published free allowances include 100,000 Worker requests/day and 10 ms CPU
per request ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/));
5 million D1 rows read/day, 100,000 written/day, and **500 MB per free database**
([D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/),
[D1 limits](https://developers.cloudflare.com/d1/platform/limits/)); and 10,000
queue operations/day with 24-hour retention
([Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)).
Queue writes, reads, deletes, retries and payload size all matter. Provider AI
charges are separate. The provider grounding allowance is applied once across
the deployment, while usage remains attributed to individual members.

Local fixture: 25 members, 2,500 wines and 2,500 sharing grants occupy 9,334,784
SQLite bytes. Twenty-five shared-list reads returned 625 wines using 25 read
statements and no writes; the recipient index is used. A scenario with two
1 MiB originals and two 256 KiB derivatives per wine would occupy 6.55 GB in R2.
This is a scenario, not measured production storage. Regenerate the report with
`npx vitest run tests/unit/pilotWorkload.test.ts`; output is
`.cache/pilot-workload.json`.

These measurements do **not** establish free-tier suitability. Before admission,
measure real Worker CPU (including OAuth, uploads and research processing), D1
`rows_read`/`rows_written` and database size, queue operations including retries,
and R2 bytes/operations over a representative pilot day. Include journal,
statistics, sharing, scans, catalogue work and polling. Reduce concurrency,
campaign size, uploads or polling if the free account cannot support the load.
The implementation session had no authenticated Wrangler account, so live plan
capacity and remaining allowances were not inspected.

## API and later phases

New API families: `/api/auth/*`, `/api/me`, `/api/friends/*` (including
`/api/friends/code`, `/api/friends/requests`, and `/api/friends/requests/:id/accept`),
`/api/wines/:id/shares`, `/api/images/:id/sharing-copy`, `/api/shared/wines`,
`/api/credits`, `/api/credits/history`, `/api/credits/quotes?path=…`,
`/api/credits/operations/:id`, and owner-only `/api/admin/*`.
Existing private resource routes remain; AI routes now require the quote headers.
Operation reads are scoped to their initiating user.

The identity table supports provider-neutral subjects; Apple login and native
token exchange are deliberately deferred. Linking must prove both identities
while authenticated and must never merge accounts merely because email matches.
The ledger reserves unique `external_transaction_ref` values for later purchases;
checkout and payment processing are absent. Review current
[Apple login and purchase requirements](https://developer.apple.com/app-store/review/guidelines/)
when implementing the iOS phase.

Validation commands: `npm test`, `npm run build`, `npm run lint`, and
`npm run test:e2e`. Integration tests apply every migration to real SQLite and
mock provider calls. Browser tests exercise Google invitation navigation, mobile
sharing, and explicit quote confirmation/cancellation with mocked API responses.
Live Google OAuth and provider billing are separate rollout checks.
