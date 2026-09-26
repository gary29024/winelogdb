# Test strategy

PR checks follow the changed paths. Pushes to `main` run the complete normal Vitest and browser suites, both iPhone WebKit projects, the production build, all local migrations, the Worker runtime smoke, and the local browser-to-Worker sharing journey. The normal Chromium suite uses representative Burgundy map journeys instead of replaying every catalogue permutation. Manual runs and the Monday 03:17 UTC checkpoint additionally set `WINELOG_E2E_EXHAUSTIVE_MAPS=1`, restoring the full Burgundy browser matrix.

| PR impact | Vitest | Browser | Platform gate |
| --- | --- | --- | --- |
| Documentation only | None | None | None |
| Unit test only | Changed tests | None | None |
| Ordinary application or Worker code | Import-affected tests plus source-reading contracts | Relevant Chromium flows for frontend features | Worker and Journal-library changes run migrations, runtime smoke and sharing journey |
| CSS or shared layout | Import-affected tests plus source-reading contracts | Relevant or all Chromium flows, plus both iPhone projects | Only if another changed path requires it |
| Shared configuration, database, authorization, credits, test support, or broad changes | Full suite | All Chromium and both iPhone projects | Full |

The exact rules and the feature-to-browser-spec mapping live in [`scripts/ci-scope.mjs`](../scripts/ci-scope.mjs), with [policy tests](../scripts/ci-scope.test.mjs). A PR with more than 40 changed files, an unclassified path, or an unreadable/empty diff uses full coverage. New frontend feature directories without a browser mapping use all Chromium flows. A new high-risk path should be added to the full-coverage rules; a new browser flow should be added to the feature mapping when it covers a distinct journey.

Vitest's `--changed` follows static imports. About 59 test files also read application source as text; imports alone can miss those contracts. For application changes, [`scripts/source-text-tests.mjs`](../scripts/source-text-tests.mjs) adds every source-reading test to the affected set. If the resulting selection is empty, CI runs the full Vitest suite. The `tests/unit` name is historical: it includes UI, Worker-handler, SQLite integration, and migration tests. Every unit file is included automatically in the main/checkpoint suite.

On the isolated PR branch, the source-reading fallback ran 59 files and 506 tests in 11.65 seconds; the full two-worker suite ran 283 files and 2,575 tests in 58.43 seconds. A real affected run also includes tests found through the import graph. These local Windows timings show the size of the fixed fallback, not a hosted CI latency target.

The `tests/e2e` browser specs intercept API calls. Frontend features select their relevant Chromium specs; Burgundy place changes explicitly include the Burgundy map browser smoke. Shared app shell, public assets, and unknown feature areas run all normal Chromium specs. The Burgundy map spec keeps exhaustive village/regional and identity/colour permutations behind `WINELOG_E2E_EXHAUSTIVE_MAPS=1`; ordinary CI runs only distinct browser behaviours such as real map rendering, responsive layout, lazy loading, failure recovery, special producer overlays, cross-commune navigation and state restoration. The unit suite continues to validate every registry target, catalogue identity, commune and geometry. CSS and shared component changes add iPhone WebKit coverage because layout is browser-specific. On checkpoints both iPhone widths, owner/member views, safe areas, rotation, contrast, and screenshots remain covered. The separate `tests/stack` sharing journey uses actual browser requests to the production Worker with isolated migrated D1, local R2 and local Images; only external OAuth and embedding providers are fixtures.

The `Lint and build` and `Regression and browser tests` check names remain stable for branch protection. The final check requires every selected job to pass and tolerates only jobs that the scope plan explicitly omitted. The scope decision appears in the workflow summary. The scoped jobs remain independent so browser installation does not extend the unit-test job.

The local platform gate applies all D1 migrations, checks runtime routing with fake OAuth values, and runs the sharing journey. It runs for Worker, database and Journal-library changes, all broad-risk changes, and checkpoints. See [Worker runtime and routing release gate](platform-boundary-testing.md) for its limits and [sharing verification](sharing-journey-verification.md) for acceptance evidence. The sharing harness exchanges synthetic signed tokens with a local provider fixture. No live AI, paid infrastructure, real Google token exchange, or production data is used.

The [September 20 suite audit](testing-strategy-2026-09-20.md) records the full-suite baseline and earlier CI timing. That document describes the previous all-PR policy. Its measured local and hosted durations are historical, not promises for the scoped policy. The selector's seven policy cases pass locally; hosted latency and coverage should be checked from the first PR and main runs after this change.

## Local commands

```sh
node --test scripts/ci-scope.test.mjs
npm test
npm run test:e2e
# Full Burgundy browser matrix (PowerShell):
# $env:WINELOG_E2E_EXHAUSTIVE_MAPS='1'; npm run test:e2e -- tests/e2e/burgundy-village-map.spec.ts
npm run test:e2e:full
npm run build
npx playwright install chromium
npm run test:stack
npm run db:migrate:local
node scripts/worker-runtime-smoke.mjs
```

`test:stack` requires the production build and creates its own fresh migrated database under `.tmp/sharing-journey/`. It loads Wrangler's own Miniflare and config reader, removes its run directory after success, and retains failed runs for debugging. For an isolated runtime-smoke database, pass `--persist-to <directory>` to the local migration command and set `WINELOG_SMOKE_PERSIST_TO` to the same absolute directory when running the smoke script.
