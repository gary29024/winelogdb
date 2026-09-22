# Backend work measurements — 2026-09-20

Baseline application revision: `cb517dc088da55b5bbed0a284745d3d7c6d2885e`.
Work branch: `codex/reduce-backend-work`. No deployment, migration, paid service, or merge is required for these changes.

## Method and evidence

Measured the original implementation before changing application code. The backend harness runs production functions against an in-memory SQLite database with all project migrations and counts executed D1 statements. R2, AI and queue bindings are deterministic doubles that count calls. The browser API harness counts fetches in jsdom. These are local operation counts, **not production latency, Cloudflare billed rows, or billing estimates**.

The backend fixture has 72 wines shared with one viewer, one photo, a producer with no missing catalog identities, and 20 recognition results from the same producer against an empty matching reference shard. Both outbox flushes start before a delayed queue send resolves. The frontend fixture runs three simultaneous reads each for a producer and a shared wine.

Original raw captures: [backend-before.json](backend-before.json), [api-before.json](api-before.json).
First comparison captures: [backend-after.json](backend-after.json), [api-after.json](api-after.json).
Elapsed milliseconds are retained for transparency. They are single local samples, include harness overhead, and do not establish a statistically reliable latency change. In particular the producer and outbox samples got slower even though redundant work fell. The conclusions below concern operation counts only.

| Scenario | Before | After | Interpretation |
| --- | ---: | ---: | --- |
| Journal page, D1 statements | 2 | 2 | Exact count and page already use one D1 batch; retained |
| Four own research scopes, D1 reads | 4 | 1 | One owner-scoped set lookup replaces one read per scope |
| Cached semantic ranking, D1 reads / AI calls | 2 / 0 | 2 / 0 | Revision validation and cached IDs retained |
| Current/empty member semantic index, D1 reads | 4 | 1 | Skip allowance reads when there is nothing to embed |
| Shared photo, D1 reads | 2 | 1 | Check sharing and the exact photo in one small projection |
| Original shared photo, R2 reads | 1 | 1 | Bytes must still be loaded on an uncached request |
| Producer detail, D1 reads | 13 | 11 | Reuse aliases and own tasted wines from this authenticated request |
| 20 group recognition reference enrichments, R2 reads | 40 | 2 | Share pending manifest/shard reads within this request |
| Two overlapping outbox flushes, queue sends | 2 | 1 | Atomic dispatch claim prevents a competing sender |
| Same outbox scenario, D1 reads / writes attempted | 2 / 2 | 2 / 3 | One extra attempted write is the deliberate price of atomic dispatch |
| Six overlapping producer/shared detail reads, fetches | 6 | 2 | Share only in-flight matching reads; later navigation revalidates |

The existing friend-research regression now enforces three reads (own scopes, aliases, friend research) instead of allowing six. A 160-target lookup also uses one statement with two bindings, avoiding a growing bind-variable list.

## Changes and retained safeguards

- **Journal:** existing input-local state, 300 ms debounce, composition handling, cancellation, and keeping previous cards painted remain unchanged. A new Chromium test drives seven input events, verifies they produce one settled search, and proves typing and all 36 cards remain available while its response is withheld. The recorded run processed those seven events in 5.5 ms locally; this is a responsiveness observation, not a before/after speed claim. Two initial requests in development are React StrictMode's abort/restart; their cancellation semantics are intentionally preserved.
- **Research:** the set lookup retains exact `(scope, cache_key)` matching, owner scoping, input-target order, quality gates, provenance validation, friend fallback and adoption. It does not reuse a friend's private fields or weaken friendship checks.
- **Smart search / AI:** a current index now avoids account/settings/usage queries. A stale index still checks the live allowance immediately before every provider batch, including the first. Query rankings still require the current index revision and existing expiry; deletes and index refreshes invalidate them. The cached flow already spends zero AI calls. No AI-call reduction is claimed. Cold index building, changed source timestamps, independent searches before a ranking is saved, and quality/schema retries remain genuine work. Broadening cross-request AI reuse would require durable coordination and a more explicit freshness contract; this change does not suppress those calls or change their output/charging semantics.
- **Recognition / R2:** group and sheet enrichment share a request-local `ReferenceReadScope`. Pending promises never cross Workers request boundaries. The existing bounded cache still holds only resolved JSON, with unchanged manifest/shard and negative-cache lifetimes. Failures are removed from the pending map, so a later attempt can recover. Matching, escalation and AI accounting are unchanged.
- **Shared photos:** the new query retains friendship, active source-account, direct or inherited tasting-share, and exact photo/wine/owner checks. It selects only the owner and object key. Missing/inaccessible wine and missing photo errors retain their previous distinction. Authorization still runs before the internal thumbnail cache. Tests revoke every relevant grant after a cache hit, and verify no further cache or R2 read occurs.
- **Producer:** aliases and own tasted-wine IDs are reused only inside the already-authorized request. Shared rows are excluded from own catalog statistics. The raw catalog is still read separately: its presentation overlay is not interchangeable with the catalog repair input. Existing missing-identity repair may perform per-entry reads/writes; these are conditional correctness repairs and do not recur once identities exist. Fixed read sets and indexed correlated subqueries are retained where replacing them would require broader behavior changes.
- **Frontend requests:** only matching, non-abortable Journal/producer/shared-detail GETs coalesce. Keys include account generation, identity, URL and request options/headers. Responses are independently consumable. No settled data cache is added. A mutation clears pending reuse, and account changes reject old responses. Abortable reads remain independent, preserving cancellation. Later navigation deliberately rechecks current permissions and remote edits rather than serving potentially stale private data.
- **Queue:** the outbox claim reuses `due_at` as a 60-second dispatch lease. A crashed sender becomes eligible again; failed sends retain their body/credit link and existing retry delay. Delivery is still at-least-once: send-success/ack-loss and lease expiry can cause redelivery, so the existing delivery/provider idempotency checks remain necessary. This removes the measured competing-flush duplication without promising exactly-once delivery.

## Verification

- `npm test`: 273 files, 2,294 tests passed.
- `npx tsc -b`: passed.
- `npm run build`: production build passed.
- `npm run test:e2e -- --reporter=line`: 23 Chromium tests passed.
- `npm run test:e2e:iphone -- --reporter=line`: 16 WebKit tests passed across iPhone 15 Pro and Pro Max.

The initial `npm test` accidentally discovered old review checkouts in ignored `.tmp` directories (1,611 files) and failed on a stale test there. A dedicated Vitest configuration now restricts discovery to this checkout's `tests/unit`. All 270 pre-existing active-checkout test files passed in the baseline run; the first profiling fixture needed its required image fields filled before its successful baseline capture.

Browser test fixture corrections are confined to tests: the account fixture now supplies the already-required `/api/usage/spend` shape; account/shared navigation assertions reflect the existing pilot access and unified Journal; the iPhone research fixture with missing research scopes expects `Deep Search`, not a complete-report vintage refresh. No product changes were made to satisfy these assertions. Browser launch initially hit the Windows sandbox's `spawn EPERM`; authorized browser execution resolved it.

## Reproduction

Run `npx vitest run tests/unit/backendWorkProfile.test.ts tests/unit/apiReadWork.test.ts` for current operation budgets. Raw current measurements are written to `.cache/backend-profile-current.json` and `.cache/api-read-profile-current.json`. `PROFILE_LABEL` changes the output suffix. Safety coverage is in `backendWorkSafety.test.ts`, `multiUser.test.ts`, `wineDetailReadCost.test.ts`, and the existing semantic/recognition tests.

To replay the original counts, use a separate checkout of the baseline revision, copy the two profiling test files into it, set `PROFILE_EXPECT_BASELINE=1` and `PROFILE_LABEL=before`, and run only the tests whose names start with `profiles common` or `measures overlapping`, excluding `**/.tmp/**`. Do not run the new behavioral regression assertions against old code.

Run the Journal browser test with `npx playwright test tests/e2e/journal-performance.spec.ts`. It writes `.cache/journal-input-profile.json` and attaches the same measurement to the test result. Browser binaries must be installed; `PLAYWRIGHT_BROWSERS_PATH` can point to a local installation. No production credentials or live AI calls are used by these measurements.
