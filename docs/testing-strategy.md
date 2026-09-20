# Test policy and suite audit

The complete Vitest suite runs on every PR. It is cheap enough to keep authorization, SQL persistence, AI accounting and historical regressions together; import-graph or path filtering cannot reliably select WineLog's cross-cutting contracts. The `tests/unit` directory is historical naming: it also contains component, Worker-handler and SQLite integration tests.

## CI tiers

| Gate | PR | Main push / manual / weekly | Dependencies |
| --- | --- | --- | --- |
| Lint and build | Lint, TypeScript, production build, all local D1 migrations, Worker smoke | Same | Build precedes runtime smoke; no other job dependency |
| Regression and browser tests | All Vitest tests, then Chromium browser flows | All Vitest tests, then Chromium and both iPhone WebKit projects | Browser checks use the test-mode Vite server; no production build needed |

The two jobs run independently. Main previously installed dependencies in three jobs and split Vitest across two shards; it now installs in two jobs and runs Vitest once. A shared composite action keeps Node 24, Bun 1.2.15 and the dependency download cache consistent. TypeScript is part of `npm run build`; CI does not repeat it. Browser projects share one server at checkpoints. Tests remain isolated and independent; no retries conceal failures, and focused `.only` tests fail CI.

The weekly checkpoint runs Monday at 03:17 UTC. Both iPhone widths, owner/member views, safe areas, rotation, contrast and screenshots remain covered there and on main/manual runs. Those layout permutations are the only deferred tier. Chromium account, recognition, identity-review, edit and deletion flows run on every PR. There are no path-based skips, including for documentation changes.

The required check names are **Lint and build** and **Regression and browser tests**. Repository branch protection, if it requires the former **Affected unit tests** or shard check names, must use the new names when this workflow is adopted. This change does not merge or alter branch protection.

## Counts and classification

Baseline: 2026-09-20, commit `f2ba8454e43e1e5a79a0c940b61e9af8588bc3ec`, plus the existing uncommitted recognition-evaluation test. No `AGENTS.md` was present in the repository or its filesystem ancestors. The pre-existing recognition evaluation work was retained.

The PR excludes that separate, uncommitted evaluation work and its 13 tests. Its committed Vitest counts are therefore **2,315 → 2,316**, across **274 → 275 files**. The local audit tables and timings below include those 13 tests on both sides so their comparison remains consistent; the AI category in the PR alone is 35 files, 348 → 346 cases.

Each file has one primary purpose below. Mixed files also exercise other boundaries: for example, `multiUser.test.ts` includes Queue, R2 and credit contracts. The reporting script emits per-file counts and overlapping SQLite/R2/Queue/source-assertion tags; these labels never control CI selection. The checked-in [baseline inventory](performance/test-suite-baseline.json) records every file.

| Primary purpose | Before files / cases | After files / cases |
| --- | ---: | ---: |
| Fast unit / domain rules | 99 / 814 | 99 / 814 |
| Authorization / multi-user | 12 / 119 | 12 / 119 |
| D1 persistence / integration | 35 / 306 | 36 / 309 |
| API / Worker integration and contracts | 27 / 229 | 27 / 229 |
| AI routing / research / recognition | 36 / 361 | 36 / 359 |
| UI / component | 45 / 403 | 45 / 403 |
| Migration / regression | 9 / 22 | 9 / 22 |
| Source / configuration contracts | 12 / 74 | 12 / 74 |
| **Vitest total** | **275 / 2,328** | **276 / 2,329** |
| Chromium browser flows | 5 / 23 | 5 / 24 |
| iPhone WebKit layouts, two devices | 1 / 16 | 1 / 16 |

There were 58 Vitest files with direct source/file assertions and 44 using the two real-SQLite helpers. Source assertions also occur in behavioral suites, so that count is larger than the source-only category. Historical regression cases are distributed across all categories, not just migration files. R2 and Queue contracts use test doubles for the service boundary; SQLite executes real statements, constraints and transactions. Browser tests intercept APIs and test the frontend contract, not a deployed full-stack service.

## Measured baseline and improvement

Local measurements use Windows, Node 22.22.0, Vitest 3.2.7 and Playwright 1.63.0. CI uses Node 24/Linux. These are observed runs, not latency promises or direct predictions of hosted CI. Vitest timings run from its recorded start to the last test completion; browser timings are Playwright's total reported duration.

| Measurement | Before | After |
| --- | ---: | ---: |
| Full Vitest, two workers | 73.51 s | 51.64 s, all 2,329 passing (30% less) |
| Full Vitest, default local workers | 21.17 s | 17.29 s with randomized file/case ordering |
| Browser suite | 19.26 s Chromium + 19.93 s iPhone | 21.66 s combined, before adding the edit/delete case |
| `multiUser` file within full default run | 11.33 s | 1.36 s after fixture change |
| `tastingPrefill` file within full default run | 8.36 s | 3.84 s after timer change |

The two-worker baseline was reconstructed under `.tmp/test-suite-audit/baseline-checkout` using the original tests/helpers/configuration, current unchanged application sources and the existing evaluation test. Both runs passed. Disabling file isolation was not needed: thread workers reduce process startup overhead while Vitest still isolates each file.

Actual hosted baseline from [main run 35511834996](https://github.com/gary29024/winelogdb/actions/runs/35511834996): lint/build/runtime job 75 s; full-regression jobs 116 s and 86 s, of which test steps used 103 s and 76 s. Local migrations alone cost 30 s. The jobs had no `needs` edges. Aggregate non-skipped job time was 277 s; overall run span including scheduling was 126 s.

[PR run 35511725123](https://github.com/gary29024/winelogdb/actions/runs/35511725123) ran the full suite because its change was high risk: affected-test job 115 s (104 s test step), quality 81 s. Other PRs could skip tests or use a separate Vitest listing followed by execution. Source-file consumers had to be selected separately because they do not appear in the import graph.

The revised workflow has not been submitted to hosted CI, so no after-CI wall time is claimed. The measured suite reduction, removal of a shard's setup, and combined browser server reduce execution work. Browser installation/execution adds coverage that the old workflow omitted, so its cost must be included when measuring the next hosted run. CI uploads JSON inventory/timings, HTML browser reports and failure traces for seven days.

Final validation after adding the browser gap check:

| Command / evidence | Result |
| --- | --- |
| Full Vitest, two thread workers | 2,329 passed; 51.64 s |
| Full Vitest, shuffle seed `20260920` | 2,329 passed; 17.29 s with default local workers |
| `CI=true npm run test:e2e:full -- --reporter=json` | 40 passed, zero skipped/flaky/unexpected; 36.62 s with two workers |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed after the Node imports fix |
| `npm run build` | Passed, including final TypeScript check and production bundles |
| `npm run db:migrate:local`, then `node scripts/worker-runtime-smoke.mjs` | All 83 migrations applied; local runtime gate passed |
| Workflow and composite action YAML parse; `git diff --check` | Passed |

Raw local JSON/logs are under `.tmp/test-suite-audit/`: `baseline.json`, `baseline-two-workers.json`, `threads-two-workers.json`, `final-shuffled.json`, `browser-baseline-elevated.json`, `iphone-baseline.json`, `browser-after.json`, `final-browser.json`, `final-lint.log`, `final-build.log`, `typecheck-after.log`, `migrations.log`, and `worker-smoke-elevated.log`. The baseline-to-final assertion-name audit found only the two documented removals, the coalescing-test rename, and three new fixture cases.

## What changed and why

- Both SQLite adapters now obtain private copies of a database built from all 83 migrations once per invocation. A unique temporary directory is removed at teardown. The template is rebuilt on watch reruns; migration changes trigger the whole suite. No persistent schema cache, shared mutable connection, production data or credentials are used. The adapters retain their existing response shapes and transaction semantics. Migration upgrade tests continue to build their own historical databases.
- Three fixture contract cases verify isolation of rows and schema across concurrent/later copies, foreign keys, rollback after a failing batch, and successful commits through both adapters. Each case gets a new database, including seed rows and sequence state.
- `tastingPrefill` and `journalFilterMemory` advance controlled timers through the entire debounce window inside React `act`, including negative assertions. This removes duplicated polling helpers and 900 ms sleeps. It also fixes the journal guard that previously returned early when the restored offset was already present, before a late debounce could clear it.
- `apiReadWork` releases pending requests explicitly instead of sleeping 5 ms. `backendWorkProfile` holds the first Queue send pending while the competing dispatcher finishes. `vertexBatchConcurrency` explicitly completes tasks out of order and retains the seventh task beyond the six-worker limit. These checks no longer depend on scheduler jitter.
- The obsolete `PROFILE_EXPECT_BASELINE` branches were removed. Tests always assert the current lower read/write/request budgets; they cannot switch back to accepting duplicate requests. Routine runs no longer write those fixed-name profile files.
- Exactly two redundant cases were removed: `core`'s numeric 2021 vintage assertion is already covered by `wineSchema`'s numeric/string/whitespace cases, while its separate minimal-valid-payload case remains; `batchRetryPolicy`'s later-poll array was an exact subset of its first backoff case. No historical regression file was deleted and no product assertion was weakened.
- The browser edit/delete case checks the PUT payload, displayed saved note, cancellation with zero DELETEs and confirmation with exactly one DELETE. Creation, identity review, sharing and recognition flows remain intact.
- The existing recognition-evaluation download script needed explicit Node `process` and `console` imports for local lint. That separate work, including these imports, is excluded from this PR. No download or live-provider evaluation was run.

## High-risk coverage retained

| Boundary | Representative retained coverage |
| --- | --- |
| Authentication, authorization, isolation | `multiUser`, `ownerClaim`, `ownerCutoverCredits`, `accountSwitch`, `memberAiAllowance`, `cellarIsolation`: signed OAuth callbacks, nonce/state replay, origin checks, revoked/suspended sessions, foreign IDs, owner/member permissions |
| Recognition and batch recognition | `core`, `groupRecognition`, `groupRecognitionHandler`, `batchRecognition`, `batchRecognitionAccounting`, `vertexBatchDeadline`: schema normalization, crop regressions, retries, escalation, persistence and accounting |
| LWIN and reference identity | `manualWineReference`, `lwinCanonicalEnrichment`, `lwinAiRepair`, `recognitionReferenceTrust`, `wineReferenceReview`, `referenceIdentity`, `referenceResolverR2`, browser LWIN review |
| D1 and migrations | All numbered migrations on template creation and real local Wrangler; historical migration fixtures; `wineSaveAtomic`, `catalogAtomicRefresh`, `aiUsageIdempotency` |
| R2 | `wineImageRoutes`, `wineThumbnails`, `referenceR2`, `referenceResolverR2`, `multiUser`: upload cleanup, thumbnail races, ownership and revoked shared-photo access |
| Queue retry/idempotency | `multiUser`, `backendWorkSafety`, `backendWorkProfile`, `backgroundRollout`, `vintageResearchSurvivesClose`: dispatch leases, failed sends, redelivery, uncertain provider results and terminal records |
| AI routing/fallback/accounting | `geminiTransport`, `geminiBatch`, `modelHealth`, `groundingModelRouting`, `producerRange*`, `aiUsageLedger`, `aiUsageRunHistory`, `unpricedAiPaths` |
| Wine create/edit/delete, sharing and tagging | `wineSaveAtomic`, `wineImageRoutes`, `wineTags`, `friendRequests`, `multiUser`, browser wine/LWIN flows: rollback, object cleanup, per-viewer experiences, direct/inherited shares, bulk tags |
| Producer identity and ranges | `producerEntities`, `producerNameReview`, `producerCatalogRangeOverlay`, `producerRangePhase2Integration`, `cuveeIdentity`, `cuveeCatalogLinks`, browser producer correction |

Known production regression assertions remain, including API SPA interception, multi-bottle crop bounds, schema fallback accounting, stale session responses, foreign shared images, restored journal filters, tasting duplicate-photo choices, and producer identity corrections. Cheap config/CSS/source contracts remain where runtime tests do not establish the same property; the explicit `run_worker_first` check remains necessary because local Wrangler does not emulate deployed asset precedence.

## Remaining cost and limits

The group-recognition handler tests retain their bounded real retry jitter (about four seconds per file), alongside actual request parsing, schema fallback, metering and response handling. A naive fake-clock experiment could run ahead of native FormData/crypto work, so it was not retained; no timeout or retry budget was increased. React page tests retain module resets where session/tasting caches are intentional application state. Those costs buy meaningful isolation and integration coverage.

All 83 migrations still run through local Wrangler at the platform gate (27–30 seconds in the measured hosted jobs); SQLite fixture copies are not a replacement for that check. WebKit layout permutations are expensive and browser-specific, so they run at checkpoints. The 40-second background-research regression already uses fake timers and is retained.

No live AI, OAuth token exchange, paid infrastructure or production data is required. The runtime smoke validates local Worker routing and fake OAuth start/callback behavior; it does not prove deployed Cloudflare asset precedence. Browser APIs and R2/Queue service boundaries remain mocked at the same layers as before. Dependencies remain on the repository's existing Bun/no-committed-lockfile policy; the download cache is not a dependency lock.

## Reproduce and extend

```sh
npm test
npm test -- --maxWorkers=2 --reporter=json --outputFile=.cache/test-reports/vitest.json
node scripts/test-suite-report.mjs .cache/test-reports/vitest.json
npm test -- --sequence.shuffle --sequence.seed=20260920
npm run test:e2e
npm run test:e2e:iphone
npm run test:e2e:full
npm run typecheck
npm run lint
npm run build
npm run db:migrate:local
node scripts/worker-runtime-smoke.mjs
```

Install Chromium and WebKit with `npx playwright install chromium webkit` first; Linux CI also uses `--with-deps`. On Windows, browser and Wrangler launches may require execution outside the filesystem sandbox. The initial sandbox browser run failed with `spawn EPERM`; the subsequent unrestricted runs passed. This is an environment limitation, not a test retry policy.

Prefer domain contracts for pure rules, migrated SQLite for transaction/owner boundaries, and browser tests for actual navigation or layout. Do not add a full browser permutation for a rule already proven below that layer unless it adds a distinct integration risk. New files automatically join the full Vitest suite; purpose tags are for the report only. Keep local-only measurements under `.tmp`/`.cache`, and compare identical worker limits when assessing future changes.
