# LWIN + ELID identity integration plan

## Goal

Give WineLogDB a stable external wine-identity layer before public multi-user onboarding, while keeping WineLog's own IDs authoritative for application data.

LWIN is the primary external reference dataset and taxonomy. ELID is a complementary registry-backed, human-readable identifier. Neither replaces WineLog's internal wine, producer or cuvée IDs.

## Design principles

1. **Global reference data, tenant-owned journals.** Bulk LWIN/ELID catalogues are shared once as versioned R2 reference shards. D1 stores only sync state and identifiers attached to user wines; user experiences, photos, corrections and research remain scoped by `owner_id`.
2. **Evidence before canon.** Recognition records what the label shows. A resolver then matches that evidence to WineLog/LWIN. Canonical metadata is enrichment, not hallucinated label text.
3. **No invented external IDs.** LWIN and ELID are stored only when backed by imported/reference data. WineLog never fabricates an ELID producer/wine code.
4. **Backward compatible rollout.** Existing wines continue to work when no external match exists. Existing `wine_style`, `classification` and `vintage` behavior remains readable while richer fields are introduced.
5. **No bulk reference duplication.** Product metadata is not copied to every journal row. The large external catalogues live once in R2; matched identifiers are persisted on the user wine.
6. **Cheap hot path.** Matching reads one producer-keyed R2 shard and uses a short in-isolate cache. No Liv-ex/ELID internet request is required for ordinary recognition/save.
7. **Safe corrections.** User edits never rewrite the global LWIN/ELID reference tables.

## Phase 1 — reference catalogue and bootstrap tooling

Keep the large external catalogues in versioned R2 shards. A content-addressed import writes immutable version files first and switches the small `current.json` manifest last.

R2 contains:
- LWIN producer-keyed shards with product identity, geography, colour/type, classification and vintage configuration;
- a Combined -> current-LWIN redirect map;
- ELID producer-keyed registry shards containing only registered identifier facts;
- one current manifest per provider.

D1 contains:
- `wine_reference_sync_state`, a small operational marker for completed imports;
- the LWIN/ELID values actually matched to individual WineLog wines.

This avoids trying to write the full 200k+ LWIN catalogue through the Free-plan D1 write allowance and avoids duplicating reference data per member.

The LWIN importer accepts the official XLSX directly (CSV remains supported). The ELID sync is a conservative registry crawler because no official machine-readable feed is currently available.

The importers must:
- keep Live, Combined and Deleted LWIN records;
- preserve Combined -> REFERENCE redirects;
- treat external identifiers as strings;
- reject malformed records rather than guess;
- shard deterministically by normalized producer;
- publish the current manifest only after every version file succeeds;
- record source/version/counters in D1;
- never commit bulk external data to Git.

See [Importing and refreshing LWIN and ELID reference data](./lwin-import.md).

## Phase 2 — user-wine external identity

Add to `wines`:
- `reference_product_key`
- `lwin7`
- `lwin11`
- `elid`
- `identity_match_status` (`matched`, `suggested`, `ambiguous`, `unmatched`, `manual`, `conflict`)
- `identity_match_confidence`
- `identity_matched_at`

Add richer bottle/release semantics while preserving current fields:
- `recognized_producer`
- existing `recognized_wine_name` remains the original wine-name reading
- `recognized_vintage_text`
- `vintage_kind` (`vintage`, `non_vintage`, `multi_vintage`, `unknown`)
- `release_designation`
- `colour`
- `product_type`
- `product_subtype`

Do not remove `vintage`, `wine_style` or current cru-level `classification` in this PR. They remain compatibility fields. A later migration can rename/split them after the new model has production data.

## Phase 3 — local identity resolver

Create one server-side resolver that accepts recognition/save evidence:
- producer
- wine name
- vintage/vintage kind
- country/region/appellation
- style/colour
- optional release designation

Resolution order:
1. preserve the existing WineLog producer/cuvée identity;
2. read the producer's LWIN R2 shard and look for an exact normalized producer/wine candidate;
3. narrow with geography/colour when supplied;
4. redirect Combined LWINs to the imported current reference;
5. attach an ELID only when an actually crawled registry entry matches the product/release;
6. otherwise return ambiguous/unmatched rather than guess.

Rules:
- a high-confidence LWIN match may enrich canonical metadata;
- it must not overwrite visibly conflicting label identity silently;
- no ELID is synthesized;
- ELID attaches only from an imported registry-backed external-id row;
- failures fall back to current WineLog behavior.

## Phase 4 — recognition schema standardisation

Create shared recognition identity fields reused by single, group and sheet scans.

Recognition should return:
- visible producer/wine identity;
- numeric vintage when visible;
- `recognizedVintageText`;
- `vintageKind`;
- optional `releaseDesignation`;
- visible/known broad wine facts already supported.

Keep geography simple in the AI response. Do not ask the model for LWIN-only `sub_region/site/parcel/designation`; those are filled by reference matching.

After primary recognition:
1. canonicalise current WineLog fields;
2. run local identity resolution;
3. if matched, attach external identity/reference metadata;
4. use resolver ambiguity/conflict as an escalation signal where practical;
5. return resolver metadata to review/save.

Group and sheet flows must use the same core identity schema so field definitions cannot drift.

## Phase 5 — save/read/UI integration

Persist resolver fields on create/update without making them mandatory.

Wine detail:
- show a compact read-only **Identity** section only when external identity exists;
- show LWIN and ELID when present;
- show release designation/vintage-kind where it materially clarifies the bottle;
- do not expose match scores as normal member UI.

Wine form:
- keep normal inputs compact;
- release designation can be edited;
- external IDs are read-only and are never free-text user inputs.

Shared wines:
- external IDs/reference metadata are bottle facts and may be projected if the shared projection explicitly allow-lists them;
- no private owner data is added.

## Phase 6 — tests and rollout

Unit coverage:
- LWIN CSV row parsing/normalisation;
- Combined redirect handling;
- import idempotency;
- ELID syntax validation without ID synthesis;
- resolver exact/ambiguous/conflict cases;
- NV vs unknown vintage distinction;
- release designation handling;
- recognition schema parity across single/group/sheet;
- existing recognition remains valid when no reference dataset has been imported;
- tenant isolation: global reference reads never bypass owner checks on user wine writes.

Validation:
- lint;
- production build;
- affected/full unit tests as selected by CI;
- migration smoke test.

Deployment order:
1. merge/deploy schema and code;
2. run `npm run lwin:build-import -- <official.xlsx>` as a local dry run;
3. run `npm run lwin:import -- <official.xlsx>` to publish a versioned R2 catalogue;
4. check the R2 current manifest, D1 sync-state row and sample identities;
5. run an ELID producer/country dry-run, then `npm run elid:sync` when appropriate;
6. optionally run a bounded backfill of existing wines after sample verification;
7. continue using the documented full-snapshot refresh whenever a newer official LWIN workbook is downloaded;
8. add automated LWIN Change Since sync later when Liv-ex credentials are available.

## Explicit non-goals for this PR

- no Liv-ex paid market/pricing data;
- no ELID editorial/technical content ingestion; the registry crawler is limited to public identifier facts and obeys robots instructions;
- no invented ELIDs;
- no LWIN API dependency;
- no automatic destructive rewrite of existing producer/cuvée identities;
- no removal of legacy `wine_style`/`classification` fields;
- no embedding the full LWIN export in the repository;
- no cross-user sharing of personal corrections.

## Follow-up work

Manual full-snapshot import remains a supported maintenance path after bootstrap. See [Importing and refreshing the LWIN reference database](./lwin-import.md). This covers the period while API credentials are pending, API outages, and periodic reconciliation.

After Liv-ex API access is confirmed:
- add scheduled `LWIN Change Since` ingestion through the same upsert layer;
- reconcile changed/combined LWIN mappings without rewriting user data silently;
- retain the official full-snapshot importer as a fallback and reconciliation path.

If ELID later publishes an official machine-readable feed/API, replace the registry crawler with that source while retaining the same R2 shard format. Technical/editorial ELID content remains outside the identifier sync.
