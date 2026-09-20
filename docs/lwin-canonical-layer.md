# Canonical LWIN reference layer

Implemented on `codex/lwin-canonical-enrichment`. This work does not deploy, run a production backfill, or merge to main. Apply migration `0083_lwin_reference_snapshot.sql` before deploying this code.

## Architecture trace and root causes

- Single recognition (`recognitionHandler`), group/sheet recognition, Vertex and legacy batch recognition, tasting-sheet writes, and wine create/edit all reach `enrichRecognitionReference` / `resolveWineReference`.
- Existing-wine deterministic, validation and AI work runs through owner-only `/api/admin/rollout/*`, consumed by `multiUserEntry`. The five-minute maintenance handler recovers lost dispatches.
- Manual linking uses an exact-code preview, a snapshot token, and an owner-scoped conditional update. Owner review/recheck is separate from shared read-only wine access.
- `scripts/import_lwin.ts` parses the official workbook/CSV and builds immutable producer-hashed R2 shards, redirects, a bounded producer index and (for new imports) an exact-ID index. `current.json` switches last. D1 holds the import status, not a copy of the full catalogue.

Root causes addressed:

1. Separate backfill writers had diverged: deterministic matching filled country/region/classification, AI matching did not, and already-linked wines were excluded from enrichment.
2. Matching underused type/subtype, structured location, classification and vintage bounds. A shared structured producer name could bypass a conflicting domaine/maison title. Fuzzy token scores could qualify as deterministic identity evidence.
3. `WINE` can contain only a cuvée while `DISPLAY_NAME` contains its location. Full display wine names were not usable as exact matching keys.
4. AI selection was resolved a second time by name, which could discard an otherwise valid candidate selection when multiple records shared that name.
5. Wine updates and rollout cursors/counters committed separately. An interruption could leave completed work behind the cursor, lose counts or repeat work. Starts raced; recovery sent new untracked messages.
6. Several imported fields were dropped, preventing downstream reuse. Reference colour/type writes and rejection could overwrite/clear populated taxonomy. A manually linked wine could retain a stale vintage-specific identifier after its vintage was edited.
7. Research and range grouping mostly reconstructed facts from names rather than consuming the accepted reference identity.

No applicable AGENTS.md files were found in the repository or its parent directories.

## Actual data inspected

The local imported snapshot `03383c3400811b6c` contains 212,430 rows, including 184,037 matchable and 28,393 sparse rows. Its source update timestamp is 2026-09-18. This is evidence from the local import artifacts, not a claim about the currently deployed R2 manifest.

| Imported field | Populated rows | Use |
| --- | ---: | --- |
| SUB_REGION | 141,152 | Structured matching, reference facts, range grouping, research |
| SITE | 15,981 | Matching clue and retained reference/research context |
| PARCEL | 55 | Preserve distinctions and reference/research context |
| DESIGNATION | 173,124 | Retain AOP, DOCG, AVA, GI, etc. without mapping them all to cru tiers |
| CLASSIFICATION | 16,013 | Matching, reference facts, supported missing-field fills and regional range labels |
| COLOUR | 187,588 | Candidate compatibility and safe missing-field fills |
| TYPE | 212,430 | Distinguish wine, spirits, fortified wine, beer, etc. |
| SUB_TYPE | 210,763 | Distinguish still/sparkling and other product subtypes |
| VINTAGE_CONFIG | 212,430 | Restrict vintage-specific identity composition |

Also retained/used: LWIN, STATUS, REFERENCE redirects, DISPLAY_NAME, PRODUCER_TITLE, PRODUCER_NAME, WINE, COUNTRY, REGION, FIRST_VINTAGE, FINAL_VINTAGE and DATE_UPDATED. Import timestamps and manifest versions identify the source snapshot. Sparse fields stay absent; they are not invented.

There is no exact `vintageValues` list, bottle-size or pack-size field in this imported schema. `nonSequential` ranges therefore do not prove a specific vintage. LWIN7 is product identity; LWIN11 additionally requires a known vintage consistent with supported vintage configuration/bounds. LWIN16 and LWIN18 encode bottle and pack precision; the parser preserves these distinctions and rejects numeric inputs that risk JavaScript integer precision loss. The existing manual link UI intentionally accepts LWIN7 only and rejects longer codes rather than truncating them. No LWIN16/18 values or bottle/pack facts are synthesized.

## Matching and persistence

`lwinMatching.ts` supplies common hard compatibility checks for deterministic and AI candidate matching. Prefix stripping remains candidate retrieval, not permission to merge producers. Exact full display names and structured wine names are both usable; geography, appellation/sub-region, site, parcel, designation, classification, colour, product type/subtype and available vintage bounds narrow candidates. Fields only constrain a match when both sides supply comparable evidence.

Deterministic resolution always precedes paid assistance. Exact ambiguity remains reviewable without an AI call. AI only selects supplied, compatible Live candidates at confidence >= 0.90 and <= 1. Candidate retrieval is capped at 16 shards; overly broad lookups report an actionable retry error. A selected product goes directly through the same reference metadata/vintage rules as a deterministic match.

The additive `wines.lwin_reference_json` column stores validated source facts, source version/update time, matching method/confidence, the input producer/wine identity, fields actually filled by LWIN, and current conflicts. The API exposes this reference snapshot to the owner, but the wine input schema strips it and other external identity fields. Clients and recognition models cannot install their own trusted LWIN snapshot.

`lwinEnrichment.ts` handles saved-wine enrichment and conditional persistence. A same-version accepted snapshot can be reused without reading its product shard. Legacy automatic matches must pass the current resolver before acquiring a trusted snapshot. Manual opt-outs remain excluded. Existing manual links can acquire reference facts without replacing their selected product.

Accepted AI aliases survive ordinary edits with unchanged identity clues and subsequent validation. On an import refresh, a previously trusted unchanged input can refresh its reference facts by the stored product ID rather than spending on the same alias decision again.

## Conflict and provenance policy

- Country, region, supported classification, colour, type and subtype are filled only when blank. A classification override wins.
- Producer and wine names remain user-visible names. Canonical names, raw display name and structured reference fields stay in the reference snapshot; existing name suggestions remain explicit user decisions.
- Populated disagreements are retained and recorded. Selecting another LWIN, rejecting a reference, or changing a name does not silently erase populated colour/type fields.
- A disagreement about an existing automatic product preserves the ID and marks it as a conflict. Disputed snapshots are withheld from research and structured range enrichment.
- Per-field `filled` values record actual LWIN contributions. User edits that differ from those values cease to be attributed to LWIN. Existing recognition evidence and separate research provenance remain intact. Legacy values of unknown origin are not falsely relabelled as user-, recognition- or LWIN-authored.
- Notes, ratings, favourites, images, shares, prices, experiences and research content are outside the enrichment update allowlist.
- Shared wine responses expose only allowlisted catalogue facts. They omit private conflict, matching and fill diagnostics and retain the viewer's own experience. Authorization and share relationships are unchanged.

## Backfill and recovery

Existing admin controls and API routes are retained:

| Request | Behavior |
| --- | --- |
| `POST /api/admin/rollout/lwin` | Resolve/enrich existing records, including already-matched and explicitly linked wines; 25 wines per delivery |
| `POST /api/admin/rollout/lwin-ai` | Deterministic first, then eligible AI assistance for unresolved wines; one wine per delivery |
| `POST /api/admin/rollout/lwin-validate` | Revalidate automatic identities and enrich verified matches; 25 wines per delivery |
| POST with `{"refresh":true}` | New generation from the beginning, including previously ambiguous/unmatched items |
| POST without refresh after a failure/pause | Resume from the last committed wine |
| `POST .../pause` | Stop between items while retaining progress |
| `GET /api/admin/rollout/status` | Durable running/paused/completed state, counts, failure message and existing review links |

Starts are serialized with a lease. Each dispatch has a stable outbox ID derived from kind, generation and cursor. The existing outbox delivers it; recovery resends the same logical job after a lost send/delivery. Generation/cursor checks discard stale messages. Busy deliveries retry instead of being acknowledged and stranded.

AI resolution requests Vertex Flex with a 600-second server timeout and a 660-second local deadline. Both the AI rollout and its queue delivery use 780-second leases so a slow response can commit without a duplicate worker taking over. It remains one wine per queue delivery, within Cloudflare's 15-minute consumer limit. Flex is a discounted request tier, not the asynchronous Batch API; it can still return capacity errors.

Transient HTTP 408/429/500/502/503/504, transport network failures and local timeouts receive up to two automatic retries, delayed by 60 then 120 seconds plus jitter. Retry counts and eligibility times are durable; early deliveries and maintenance recovery respect the delay. The checkpoint and counters stay unchanged on failure. Successful checkpoint commits clear the retry budget; explicit Resume also clears it. Permanent errors or exhausted retries pause for inspection. Retries never upgrade to standard pricing. Native provider Batch submission/polling is not implemented by this path.

Each wine's reference changes, cursor and counters commit in one D1 batch. Compare-and-swap guards cover ownership and relevant input/reference fields. A lease assertion or stale-wine assertion aborts the transaction. The assertion deliberately violates the existing NOT NULL constraint inside the batch; its failure is translated to a readable retry message. Leases renew between items, and a worker that loses its lease cannot pause a newer worker. R2 outages, missing indexed shards, AI failures and interrupted writes retain the checkpoint. Resume does not recount successful wines.

Re-running valid enrichment generates no wine UPDATE. Progress bookkeeping still writes its bounded checkpoint. New wines added behind a running cursor are covered by the next explicit refresh; this is a resumable scan, not a permanent subscription.

## Range and research

Wine research receives accepted LWIN identity/taxonomy in its existing prompt. Producer range research receives a bounded list of known logged LWIN identities, explicitly labelled as incomplete historical/reference context rather than proof of the complete current range. Research remains responsible for winemaking, viticulture, history, terroir interpretation and sensory characteristics.

Owner range reads reuse their existing wine query to attach unambiguous accepted references. Catalogue rebuilds attach the same public taxonomy. No cuvées are merged by shared geography. Burgundy uses its supported cru hierarchy; other regions keep their actual classification/designation labels, such as DOCG or Premier Grand Cru Classe A. Sub-region grouping comes from structured data where available. A conflicting or removed reference no longer supplies automatic range taxonomy.

## Cost, validation and limits

- No new external lookup during normal matching: catalogue access remains R2, with bounded shard reads and existing short caches.
- Same-version accepted snapshots avoid product-shard reads; repeat enrichment avoids wine writes and AI. Producer page enrichment reuses an existing query. Producer research adds one bounded D1 reference read and at most 40 compact reference facts.
- AI is restricted to the explicit admin AI rollout. Each actual provider response is metered separately, including a real repeated call after interruption. A process crash between a provider response and D1 commit can still require another provider call; database results and job state remain idempotent.
- Imported vintage metadata cannot validate nonSequential years or bottle/pack precision. Genuine ambiguity needs more evidence or explicit owner review.
- A new import can change reference facts. Filled/user taxonomy is never silently reconciled to a conflicting new value. Exact-ID lookup across a renamed producer requires a current import with an ID index; older manifests retain the bounded producer fallback.
- Production migration, deployment and the actual account backfill were not run by this change.

Regression coverage includes exact/full-display matches, no match, ambiguity, AI selection, house distinction, structured discriminators, all four LWIN precision formats, matched/unmatched/manual records, blank/conflicting fields, repeat enrichment, field attribution, owner/shared boundaries, queue-send recovery, concurrent starts, stale messages, interrupted writes, checkpoint rollback and concurrent wine edits.

Validation commands: `npm test`, `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint`, `npm run build`, `npm run test:e2e`, and `npm run test:e2e:iphone`. The existing ignored `.tmp` directory contains old checkout/build artifacts; ESLint now excludes it, consistently with Git and Vitest. Production source and tests remain linted.

Final verification: 274 test files with 2,315 tests passed, plus 23 standard browser scenarios and 16 iPhone scenarios. TypeScript, ESLint, the production build and whitespace checks passed. The first Windows browser run completed its scenarios but stalled during server teardown; a second run exited cleanly, and the temporary development server was stopped afterward.

Platform/reference contracts checked against the [Liv-ex LWIN guide](https://files.liv-ex.com/Liv-ex_LWIN_guide.pdf), [D1 batch transaction documentation](https://developers.cloudflare.com/d1/worker-api/d1-database/), and [Cloudflare Queue retry documentation](https://developers.cloudflare.com/queues/configuration/batching-retries/).
