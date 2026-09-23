# Owner-to-member sharing verification

The bounded sharing journey and required local regression gates pass. No deployment, merge, production mutation or paid AI call was made. The PR is isolated from the original working tree's unrelated edits and starts from main at `d9fefb19` (v1.3.0).

## Baseline and execution boundary

Read before implementation: `CHANGELOG.md` (including v1.2.0's exclusion of the draft multi-user work), `MULTI_USER_ROLLOUT.md`, the testing strategy and platform-boundary guide, authentication/social/Journal/semantic-search implementation, and existing SQLite, sharing, research-adoption and browser support. The baseline production build passed.

[`tests/stack/sharing-journey.spec.ts`](../tests/stack/sharing-journey.spec.ts) runs Chromium against the built SPA and production `worker/multiUserEntry.ts`, bundled into local workerd through Miniflare. Wrangler applies all 83 real migrations through `0083_lwin_reference_snapshot.sql` to a fresh isolated D1 database; the harness checks the applied count against the migration directory. R2 and the Images binding are local. WineLog API responses are never fulfilled by test mocks.

Only external provider boundaries are replaced. OAuth start uses Playwright's real HTTP client and the browser's cookie jar, stops at the Google redirect, then navigates the browser through the actual callback. Synthetic one-use authorization codes, PKCE checks, signed RS256 ID tokens and JWKS exercise the production verifier and session creation. Google itself is not part of the passing test. Deterministic Gemini embeddings exercise vector persistence and retrieval. Unexpected Worker egress is rejected; external browser requests are blocked. There is no production authentication bypass.

Invitations and factual research are synthetic D1 fixtures. The local pilot fixture admits two members for recipient/outsider isolation; allowance settings are unchanged. Existing wine-save and research-adoption fixtures were extracted and reused. Friendship setup and security probes use real browser fetches; save, correction, upload, friend tagging, recipient experience, Smart Search and tag removal use the UI.

## Reproduced defects and scoped fixes

| Defect reproduced before correction | Evidence retained locally | Correction and focused regression |
| --- | --- | --- |
| Shared wines appeared in Journal but had no recipient semantic document or candidate in the original checkout. | `.tmp/shared-semantic-before.log`: `expected '' to contain 'Wine: Shared bottle'`; command: `node node_modules/vitest/vitest.mjs run tests/unit/semanticSearch.test.ts -t recipient-visible`. | This was also fixed by merged PR #327 while this task was in progress. The PR preserves that implementation of shared indexing, timestamp staleness, visible candidates and cache invalidation. The added SQLite regression covers recipient edits, source edits, private fields and revocation. |
| Revoked shares left obsolete recipient vectors stored after warming on current main. | PR-worktree `.tmp/sharing-pr-semantic-before.log`, same focused command: expected zero persisted recipient vectors, received one. | Prune no-longer-visible vectors during warming. The existing delete trigger advances the index revision. Keep main's visibility checks and cached-query behavior. |
| A schema-valid cross-account edit omitting optional fields returned 500 before reaching the owner check. | `.tmp/sharing-cross-owner-before.log` from the stack journey and `.tmp/sharing-unowned-before.log` from `wineSaveAtomic.test.ts -t unowned`: expected 404, received 500. | Read the owner-scoped existing wine before enrichment/binding and return 404 when absent. Reuse that row in the existing atomic save. The regression asserts refusal and unchanged persisted source/experience. |
| Schema-valid wine saves with omitted optional columns bound JavaScript `undefined`, which D1 rejects. | `.tmp/sharing-optional-save-before.log` from the stack journey and `.tmp/sharing-optional-unit-before.log` from `wineSaveAtomic.test.ts -t omitted`: SQLite binding error and 500. | Normalize absent wine-row bindings to SQL null in JSON create, multipart create and update. Parameterized tests cover both creation formats and subsequent update; the stack journey creates an additional minimal wine through real D1. |

No schema migration, UI change, public API shape, allowance rule or deployment-architecture change was needed for these fixes. Four older edit-test doubles were corrected to return the existing owned wine their scenarios require; their behavior assertions remain intact.

The final PR retains main's cached-search work profile (2 reads, zero embedding calls) and adds one pruning DELETE attempt to a clean warm (1 read/1 write attempt). Recipient-visible shared wines use the existing embedding budget guards. The journey leaves `member_ai_action_usage` empty. The original checkout's intermediate implementation used 3 cached-search reads; that alternative is not included in the PR.

## Acceptance evidence

| Scenario | Passing assertions |
| --- | --- |
| Owner saves and corrects a wine | UI round trip plus D1 values before and after correction. Uploaded image row and source R2 object both exist. |
| Owner tags an accepted friend | UI confirmation and persisted recipient grant; recipient Journal links to shared detail. No recipient-owned wine is cloned. |
| Account and private-field isolation | Unrelated account receives 404; recipient cannot use the owner route or edit source. Source notes, venue, location, tags, rating and price are excluded from the shared response; source tasting date remains the policy-defined chronology fallback. Embedding text excludes source private sentinels. |
| Recipient owns their experience | UI save/favorite survives reload; `shared_wine_preferences` stores recipient notes, rating, venue, currency, favorite and structure. Owner notes/rating/venue remain unchanged. |
| Shared Smart Search | Non-lexical UI query finds the shared wine after a recipient vector is persisted. The provider document contains recipient notes. Source correction advances the stored revision and remains searchable. |
| Images and thumbnails | Shared original bytes match local R2 size. Local Images generates a WebP derivative under the canonical source thumbnail key; repeat retrieval succeeds. Anonymous access is 401; outsider, owner-route substitution and another wine's image ID are 404. |
| Source correction | Updated wine name/alcohol appears on recipient detail while recipient notes/rating/price remain intact. |
| Revocation | UI tag removal deletes the grant. Subsequent detail, experience-write, original-photo and cached-thumbnail requests return 404. Journal, shared list and cached semantic results omit the wine; direct UI navigation shows the not-found state. Owner image access remains valid. |
| Independently adopted research | A separately owned matching wine adopts the quality-gated source research through its real GET path. Provenance is retained, no recipient contribution is published, and research survives share removal plus unfriending. Existing adoption tests also retain the own-paid-research protection. |

## Original workspace validation

These commands ran before preparing the PR against updated main. Their logs remain in the original workspace under `.tmp/` and are disposable local evidence, not checked-in artifacts. The PR-branch revalidation below supersedes these counts.

| Command | Result | Log |
| --- | --- | --- |
| `npm run build` | Passed, TypeScript and production bundle | `.tmp/sharing-build-final.log` |
| `npm run typecheck` | Passed after final fixture edits | `.tmp/sharing-typecheck-final.log` |
| `npm run lint` | Passed | `.tmp/sharing-lint-final.log` |
| `npm test -- --maxWorkers=2` | 280 files, 2,439 tests passed | `.tmp/sharing-unit-final.log` |
| `node --test scripts/ci-scope.test.mjs` | 7 policy cases passed | `.tmp/sharing-policy-final.log` |
| `node node_modules/@playwright/test/cli.js test --output=.tmp/sharing-ui-results` | 91 existing Chromium/iPhone WebKit checks passed | `.tmp/sharing-ui-final.log` |
| `node node_modules/@playwright/test/cli.js test --config=playwright.stack.config.ts` (`npm run test:stack`) | 1 complete real-stack Chromium journey passed, including 83 migrations | `.tmp/sharing-stack-final.log`; fixture state `.tmp/sharing-journey/run-tWnEzM/` |
| `node node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --local --persist-to .tmp/sharing-smoke-state` | All 83 migrations passed in a separate local smoke database | `.tmp/sharing-smoke-migrations.log` |
| `node scripts/worker-runtime-smoke.mjs` with `WINELOG_SMOKE_PERSIST_TO` set to the absolute `.tmp/sharing-smoke-state` path | Passed static routing invariant and local HTTP assertions | `.tmp/sharing-smoke-final.log` |

Focused save, semantic, adoption and backend-work tests passed before the complete suite. Initial harness failures involved sandboxed browser startup, Miniflare v5 persistence/asset options, and a smoke run pointed at the journey's different local database ID. These were corrected without weakening assertions; the smoke rerun uses the production binding's ID in a fresh local state directory.

The CI platform tier now runs this journey after build/migrations/runtime smoke and installs Chromium. Journal-library changes select that tier too. Failure traces are uploaded from `test-results/`. The separate `tests/e2e` suite keeps its fast API mocks. Hosted CI results are recorded separately on the PR; the evidence here is local.

## PR branch revalidation

The isolated `codex/verify-sharing-journey` branch starts from main `d9fefb19`, preserving v1.3.0 and the merged UI, research and CI changes. PR #327 already supplies shared Smart Search, so this branch retains that code and adds only obsolete-vector cleanup to it. The stack assertion uses its existing timestamp revision format, and friend-tag selection follows the accessible label now including the tagged count. Neither adjustment removes journey assertions.

All checks below passed in the PR worktree. Log paths are relative to that worktree.

| Command | Result | Log |
| --- | --- | --- |
| `npm run build` | TypeScript and production build passed | `.tmp/sharing-pr-build.log` |
| `npm run lint` | Passed | `.tmp/sharing-pr-lint.log` |
| `node --test scripts/ci-scope.test.mjs` | 7 passed | `.tmp/sharing-pr-policy.log` |
| `npm test -- --maxWorkers=2` | 285 files, 2,620 tests passed | `.tmp/sharing-pr-unit.log` |
| `node node_modules/@playwright/test/cli.js test --output=.tmp/sharing-pr-ui-results` | 131 Chromium/iPhone WebKit checks passed | `.tmp/sharing-pr-ui.log` |
| `npm run test:stack` (Playwright CLI equivalent) | Complete sharing journey passed; all 83 migrations applied and served | `.tmp/sharing-pr-stack.log`; `.tmp/sharing-journey/run-lCwwUl/` |
| `node scripts/worker-runtime-smoke.mjs` | Passed using `WINELOG_SMOKE_PERSIST_TO` pointing at the isolated migrated smoke database from the original validation | `.tmp/sharing-pr-smoke.log` |

The initial PR-branch stack run found the changed friend-tag accessible label; the corrected selector passed the complete rerun. The original working tree remains intact and its unrelated uncommitted edits are excluded from the PR.

## Limits

This proves the bounded journey locally with synthetic users and provider responses. It does not prove deployed Cloudflare asset-router precedence, live Google authorization, actual model relevance/quality, provider billing or production Images quota/fallback behavior. Existing unit regressions continue to cover fallback/budget rules. Production `assets.run_worker_first` is checked statically; deployed validation would require a separately authorized preview.

Revocation applies to subsequent authorized requests. Content already downloaded cannot be recalled, and the test does not claim that an already-open page is remotely erased. Deterministic embeddings verify visibility and persistence, not search quality. No external blocker remains for the defined local acceptance scope.
