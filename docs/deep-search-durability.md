# Member Wine Deep Search durability audit

The production member HTTP/queue handlers were exercised against fully migrated
SQLite D1, deterministic provider replies, fake clocks and injected write
failures. No merge, deployment, production mutation or paid AI call was made.
Unrelated pre-existing workspace changes remain intact.

## State model

The model was recorded before changes. Reservation, run creation, initial
dispatch and operation linkage were separate writes; job completion preceded run
completion; acknowledgement preceded settlement. Uncertain provider receipts had
no bounded terminal path. Thus a completed job could have a running run, a failed
run could have an indefinitely live allowance, and a completed operation could
still return HTTP 202.

The resulting model reuses the existing operation, provider ledger and outbox:

| Transition | Durable state and recovery |
| --- | --- |
| Quote | Fingerprint, priced scopes and expiry; reservation recalculates reuse. A pending allowance does not block rediscovery of its existing operation. |
| Reserve | Atomic operation, ledger reservation and subject locks/follower. Same key, same active path and linked logical request ID converge; concurrent losers reread the winner. |
| Allowance | One pending action per operation. Existing-operation replay precedes allowance claiming. |
| Start | Run running/queued, operation linkage/accepted response and initial outbox commit together, before returning acceptance. |
| Dispatch/claim | Existing 60-second outbox dispatch lease and 600-second delivery lease. Lost receipts resend the same identity. Delivery finalisation is conditional on its acquired lease. |
| Submit | Persist native handle or emulated request, research job and poll dispatch. Local setup failure retries the existing submission. |
| Provider | submitted -> saved, or uncertain. Saved responses replay; ambiguity blocks automatic sends/fallback. New sends require a live operation within the recovery horizon. |
| Emulated execution | PENDING -> RUNNING -> SUCCEEDED. A 12-minute stale lease is reclaimed with compare-and-set guards. Batch identity is operation-scoped; entry/retry receipt keys are stable. |
| Apply | Run saving; unchanged quality, grounding and claim gates select scopes. Cache, publication, required adoption and snapshot persistence precede success. Storage errors propagate to queue retry. |
| Complete | Job and run complete atomically. Repair old split completion from saved scopes; delayed progress cannot reopen completion. |
| Settle | Atomic capture/release, terminal operation and allowance triggers. Count quality-validated own scopes, not invalid/adopted rows. Cached completion removes pending usage. |
| Acknowledge | Reconciliation and delivery persistence succeed before ack. |
| Recover review | A late saved reply reopens its retained emulated request through one existing poll outbox, in receipt-replay-only mode. Concurrent terminal settlement wins. |
| Expire | Provider-free undispatched work releases after the existing 15-minute window. At the 48-hour recovery horizon, unresolved work terminates as uncertain/interrupted, after any finite live delivery lease. |
| Revisit/replay | Persisted run/operation/follower state restores the UI. Terminal HTTP results replace 202. Members see safe text and Support IDs; diagnostic records remain available to owners. |

An accounting operation may complete with a failed research run when valid
partial scopes were saved: this preserves the existing one-successful-action
policy. Its HTTP result explicitly reports status failed and partial true.
No valid saved scopes means allowance release. Cached/friend-only reuse is free.

The existing five-minute maintenance cron processes active operations in bounded
batches. The 48-hour horizon fences new sends; settlement occurs on an available
maintenance pass after live leases. It does not promise scheduler/database
availability at an exact instant. Provider routes, quality gates, identity,
privacy/sharing and NV exact-release restrictions remain in force.

## Reproduced defects and fixes

Each defect below had a failing deterministic reproduction before its fix.

| Root cause / observed defect | Fix |
| --- | --- |
| Initial run/outbox/linkage partially persisted | Commit all three plus acceptance in one D1 batch. |
| Different-key concurrent requests conflicted; pending allowance blocked rediscovery | Reread the winner and recognize existing work in quotes. |
| Completed logical request with fresh HTTP key failed | Owner/path/request-ID/fingerprint lookup returns its operation. |
| Storage errors became model failures or false success | Retain/replay existing submissions and propagate emulation, cache, publication, adoption and snapshot write failures. |
| Job/run completion split | Atomic completion plus old-state repair. |
| Null stored payload broke polling | Use stored state when result JSON is null. |
| Native stall policy cancelled live emulation | Use emulation lease/reclaim while retaining native policy. |
| Timeout budget changed provider receipt identity | Stable persisted entry/attempt keys; conservative saved-only recovery for old entries. |
| Native prompt changed after a setup failure when reusable cache arrived | Stable native wine-attempt identity and recovery of saved create handles missing their local job row, including legacy receipts. |
| Global display-name reuse crossed operations; concurrent creation duplicated batches | Deterministic operation-scoped identity with insert-or-ignore. |
| Stale readers reset new executors; old delivery released successor | Compare-and-set executor transitions and lease-fenced delivery completion. |
| Uncertain review never ended | Retain evidence, recover late saved replies without sends, reconcile at 48-hour horizon. |
| Maintenance recovery resurrected settled work | Recovery updates require an admitted outbox in the same transaction. |
| Early ack defeated settlement retry | Defer acknowledgement until outer reconciliation and delivery persistence. |
| Replayed refresh erased newly saved scopes | Resume the existing durable attempt before cache preparation/invalidation. |
| Delayed acceptance/progress reopened terminal state | Guard terminal operation/run writes. |
| Cache reuse charged allowance; failed replay recreated pending usage | Cached completion removes pending usage; replay returns before allowance claim. |
| Timestamp-only settlement counted invalid/adopted cache rows | Existing quality-validated cache reader plus ownership/timestamp checks. New own results clear stale adoption attribution. |
| Partial completion reported full success; completed replay retained 202 | Persist honest terminal result independently from partial-success accounting. |
| Undispatched running/review reservations never expired | Existing 15-minute provider-free expiry now includes those wine states. |
| Revisit omitted failed/follower states and obscured uncertainty | Restore persisted states with safe messages, explicit uncertainty and Support IDs. |

## Requested fault scenarios

| Case | Local evidence |
| --- | --- |
| 1. Normal success | Valid scopes, snapshot, terminal state and one allowance. |
| 2. Browser closes | Queue completes with no status polling; browser reopen scenarios. |
| 3. Refresh/revisit | Fresh status restores running/follower/failure; refresh replay preserves saved scopes. |
| 4. Repeat submission | Same key, different-key race, allowance exhaustion and completed logical-ID replay. |
| 5. Duplicate delivery | Completed skip, lost dispatch receipt, live executor wait, stale-reader and delivery fencing. |
| 6. Ambiguous timeout | Hold without fallback; late durable reply recovers with one send; unresolved expiry retains diagnostics. |
| 7. Definite failure | Existing bounded model attempts; released allowance without valid scopes; terminal replay creates no claim. |
| 8. Persistence failure | Injected result, cache, publication, adoption, snapshot, job/run completion, linkage, setup, fallback and settlement failures. |
| 9. Interrupted execution | Saved receipt replay, durable redispatch after physical queue retries exhaust, native submission reuse after local setup failure. |
| 10. New reusable cache | Own/friend reuse completes free; adoption survives friendship removal; mid-flight adoption does not misattribute later own research. |
| 11. Abandoned reservation | Provider-free expiry and bounded uncertainty reconcile allowance; recovery cannot reopen settled work. |
| 12. Completed replay | Terminal response, no new send/allowance, fresh HTTP key with same logical ID, delayed-progress guards. |

Main tests: wineResearchPersistence.test.ts (44), researchReconciliation,
multiUser, memberAiAllowance, backendWorkSafety, deepSearchLayout and existing
routing/quality suites. SQL triggers inject storage faults; explicit barriers
establish overlapping workers. Five new Chromium browser tests cover reopening
running, failed, held, terminal-uncertain and friend-following states.

## Validation

- Full Vitest checkpoint: **282 files / 2,491 tests passed** (68.46 seconds).
- Subsequent maintenance-race fix: **53 related tests passed**, including all
  44 durability tests; final TypeScript and targeted ESLint passed.
- Final native receipt/replanning fix: **48 related tests passed**, including
  all 44 durability tests; production build and targeted lint passed again.
- Production build, full ESLint and git diff --check passed.
- Five dedicated Chromium reopen tests passed.
- Full Chromium and both iPhone WebKit projects: **96 passed** (1.9 minutes).
- All **83 migrations** applied to isolated local D1; Worker runtime smoke passed.
- Real browser-to-Worker sharing journey passed against fresh local D1/R2/Images,
  synthetic signed OAuth and deterministic provider fixtures (1.6 minutes).

Initial browser launches failed with sandbox spawn EPERM; full browser/sharing
checks were repeated with permission to launch browsers. Wrangler config/logs
were redirected into the workspace after its user-level directory was blocked.
These were startup failures, not application assertion failures. Local logs are
under .tmp/deep-search-* and are not committed.

## Limits

These tests establish the specified transitions and selected race interleavings,
not a formal proof of every distributed execution.
Cloudflare provides [at-least-once delivery](https://developers.cloudflare.com/queues/reference/delivery-guarantees/),
[transactional D1 batches](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch),
and [first-decision ack/retry semantics](https://developers.cloudflare.com/queues/configuration/batching-retries/#explicit-acknowledgement-and-retries/).
Actual scheduler delay, Worker termination and deployed D1/network behavior need
an isolated deployed environment; none was deployed here.

A provider can finish without a recoverable local reply. Local tests cannot
establish its remote bill/result. Automatic resubmission is blocked; bounded
termination retains that uncertainty. Legacy timeout-dependent receipt keys that
cannot be reconstructed fail closed. A native submission whose reply never
reaches the ledger has no locally known handle and follows bounded
reconciliation, not blind retry. A saved handle is recoverable even if its
local job-row write failed and the prompt later changed.
Replies arriving after the recovery horizon do not automatically restart a
terminal operation. Deterministic fixtures preserve the quality gates but cannot
establish factual quality of future live model output.

## PR integration validation (2026-09-25)

The PR was prepared in an isolated checkout from origin/main at f29d9cc4.
Integration preserves shared-wine access, NV edition targets, Champagne
extraction reconciliation, and operation-free cleanup recovery. Recipient-owned
research on a shared bottle has an additional settlement regression test.
The existing-operation quote bypass applies only to Deep Search.

On this integrated branch, all 293 unit files / 2,751 tests passed, including
45 persistence/recovery tests. All five Chromium reopen tests passed. Build,
TypeScript and ESLint checks passed. Earlier audit counts above describe the
original audit checkout; these are the checks repeated on the PR branch.

## Review follow-up (2026-09-25)

Reproduced and fixed the three review findings: a follower must not expire as
undispatched work while its sponsor is running; a deleted/unshared bottle or
incomplete cache is a terminal outcome rather than a persistence retry; exempt
emulated batches must retain a stable run/attempt identity, including recovery
of existing UUID batches. Terminal job/run writes are atomic and remain
retryable when persistence fails. The ordinary queue failure path can terminate
a run after its configured retries; the review's 48-hour description does not
apply to every deterministic failure.

Validation after these fixes: 293 unit files / 2,758 tests passed on Node 24,
including 52 persistence/recovery tests; production build and ESLint passed.
