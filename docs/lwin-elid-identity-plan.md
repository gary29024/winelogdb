# LWIN + ELID identity integration plan

## Goal

Give WineLogDB a stable external wine-identity layer before public multi-user onboarding, while keeping WineLog's own IDs authoritative for application data.

LWIN is the primary external reference dataset and taxonomy. ELID is a complementary registry-backed, human-readable identifier. Neither replaces WineLog's internal wine, producer or cuvée IDs.

## Design principles

1. **Global reference data, tenant-owned journals.** LWIN/ELID reference rows are shared once in D1. User wines, experiences, photos, corrections and research remain scoped by `owner_id`.
2. **Evidence before canon.** Recognition records what the label shows. A resolver then matches that evidence to WineLog/LWIN. Canonical metadata is enrichment, not hallucinated label text.
3. **No invented external IDs.** LWIN and ELID are stored only when backed by imported/reference data. WineLog never fabricates an ELID producer/wine code.
4. **Backward compatible rollout.** Existing wines continue to work when no external match exists. Existing `wine_style`, `classification` and `vintage` behavior remains readable while richer fields are introduced.
5. **No bulk reference duplication.** Product metadata is not copied to every journal row. User wines link to a global product reference.
6. **Cheap hot path.** Matching uses indexed local D1 data. No network/API request is required for ordinary recognition/save.
7. **Safe corrections.** User edits never rewrite the global LWIN/ELID reference tables.

## Phase 1 — reference schema and bootstrap tooling

Add global D1 tables:

- `wine_reference_products`
  - canonical external product key
  - LWIN7 and LWIN status/reference redirect
  - display/producer/wine names
  - country, region, sub-region, site, parcel
  - colour, type, subtype, designation, classification
  - vintage configuration, first/final vintage
  - source update timestamps
- `wine_reference_external_ids`
  - provider (`lwin`, `elid`)
  - identifier
  - product key
  - optional vintage/release discriminator
  - source/provenance and update timestamp
- `wine_reference_sync_state`
  - source, source version/hash, last source timestamp, counters and status

Add a deterministic bootstrap script that accepts the official LWIN export as CSV. The downloaded XLSX can be exported to CSV without changing its columns; the importer validates the required header before generating chunked D1 SQL. This keeps an Excel parser out of the runtime and avoids committing the 212k-row dataset to Git.

The importer must:
- treat LWIN and REFERENCE as strings;
- upsert idempotently;
- keep Live, Combined and Deleted rows;
- preserve Combined -> REFERENCE redirects;
- map blank cells to NULL;
- reject malformed identifiers/statuses;
- process in bounded chunks suitable for D1 import;
- record source metadata/sync state.

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
1. exact/known WineLog producer + cuvée identity;
2. exact LWIN normalized producer/wine candidate;
3. narrowed LWIN candidate by geography/colour;
4. redirect Combined LWINs to their current reference;
5. return matched/suggested/ambiguous/unmatched with score and candidates.

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
2. export the official LWIN workbook to CSV;
3. run bootstrap generator locally;
4. apply generated D1 import SQL;
5. check sync-state row and sample identities;
6. optionally run a bounded backfill of existing wines after sample verification;
7. add automated LWIN Change Since sync later when Liv-ex credentials are available.

## Explicit non-goals for this PR

- no Liv-ex paid market/pricing data;
- no ELID website scraping;
- no invented ELIDs;
- no LWIN API dependency;
- no automatic destructive rewrite of existing producer/cuvée identities;
- no removal of legacy `wine_style`/`classification` fields;
- no embedding the full LWIN export in the repository;
- no cross-user sharing of personal corrections.

## Follow-up work

After Liv-ex API access is confirmed:
- add scheduled `LWIN Change Since` ingestion through the same upsert layer;
- reconcile changed/combined LWIN mappings without rewriting user data silently.

If ELID publishes an official machine-readable feed/API with suitable reuse terms:
- import it into `wine_reference_external_ids`;
- add an incremental sync path;
- use ELID technical metadata only as attributed enrichment, not as an automatic overwrite of producer/label facts.
