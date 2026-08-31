# Changelog

All notable WineLogDB changes are summarized here by shipped impact. For v1.0.0, this consolidates all merged pull requests through #185 rather than duplicating the full PR-by-PR history.

## [1.0.0] - 2026-08-31

### Product and journal

- Established the Cloudflare-native React/Hono application with authenticated, owner-scoped D1 records and private R2 imagery.
- Added complete wine CRUD, editable tasting context, favourites, prices/currency, notes/tags, tasting structure, photo metadata and responsive detail/edit surfaces.
- Reworked the Journal into stable paginated browsing with URL-backed search/filter/sort state, month filtering, exact totals, direct page navigation, selection/batch actions and preserved filter/search state on return.
- Added installable PWA/mobile-shell behavior, safe-area handling, app icons, responsive navigation, dark mode, design tokens and accessibility/focus guards.

### Recognition and imagery

- Added Single Wine recognition with strict local validation, editable review and safe normalization.
- Added asynchronous Batch Scan with persistent sessions, recognition jobs, history, staged images, confirmation, retries and recovery for orphaned/stalled queued or running jobs.
- Added Group Photo recognition with per-wine bounding boxes/crops, source-photo retention, server-resumable sessions and links from saved wines back to their shared source image.
- Routed interactive recognition through Cloudflare AI Gateway / Vertex when configured; moved asynchronous recognition/research to queue-backed Vertex Flex PayGo while retaining controlled fallbacks.
- Added selective escalation for uncertain recognition and robust handling of provider schema/JSON/vintage variants without accepting ambiguous data.
- Added photo upload/removal for existing wines and an explicit same-tasting duplicate choice so a scan can add its photo to the existing wine instead of creating a second record.
- Improved group-review box visibility, bottle-shaped crops, label-focused thumbnails and automatic progression to the next unsaved bottle.

### Tastings and printed wine lists

- Promoted tastings to first-class sessions with start/end/reopen semantics, one-open-tasting enforcement, auto-attachment of newly logged wines and retrospective attachment from the Journal.
- Added dedicated tasting list/detail pages, in-progress navigation, month grouping and return-to-tasting behavior after logging a bottle.
- Added persistent photographed tasting documents and AI reading of printed wine lists page by page.
- Decoupled page storage from AI reading so documents can be saved without incurring recognition cost and re-read selectively later.
- Added tolerant sheet parsing, continuation handling, sectioned review, currency confirmation, batched price updates and batched creation of missing wines.
- Added manual matching of printed rows to wines already in the tasting, producer-aware match labels, persistence of unfinished review state and protections against assigning two rows to one wine.

### Producer and cuvée identity

- Added canonical producer and cuvée entities, aliases, link/unlink/merge/reconciliation flows and stable catalogue identities.
- Added producer research catalogues, catalogue-backed cuvée matching, manual catalogue merge/hide decisions and persistent correction replay after future research.
- Generalized numbered/non-vintage release families beyond Krug to MV and reserve-span patterns, with style/appellation/ambiguity guards and word-order-independent family matching.
- Made producer/cuvée identity Unicode-safe and added a bounded repair for earlier ASCII-only collisions while preserving deliberate merges.
- Re-resolve cuvée links when identity-shaping fields change, refresh unresearched producer home country from the wines actually filed under it, and canonicalize United Kingdom country naming.
- Adopt an existing library producer name automatically on exact recognition matches, offer unique near-miss suggestions without auto-merging, and respect explicit user-selected primary producer/cuvée wording.

### Place, denomination and classification model

- Added a hierarchical place resolver that canonicalizes country, principal region and narrowest legal appellation independently of recognition field placement.
- Added runtime/migration drift guards and preserved original recognized region/appellation values for audit and later correction.
- Added Burgundy grand/premier/village classification display, Insights mix, round-trip preservation and explicit manual override/Auto behavior.
- Added denomination modeling for AOC/DOC/DOCG/DOCa/DO/IGT/IGP/AVA/GI and other schemes at the appropriate place tier.
- Expanded/corrected Burgundy, Australian, Italian and French geography including Chablis tiers, Australian zones, Bolgheri Sassicaia, IGT/IGP zones and Champagne/Alsace/Beaujolais denomination handling.
- Added EU GI-register sync tooling plus drift checks; current shipped seed remains explicitly provenance-marked until synced in a network environment that can reach eAmbrosia.

### Deep Search and producer research

- Added scope-level reusable wine research and producer profile/catalogue research with Google Search grounding.
- Added deterministic evidence quality gates: asserted fields require grounded sources; vintage/scope contradictions are rejected; explicit uncertainty is accepted as an honest result.
- Added claim-level provenance from Gemini grounding supports, direct-source links and direct/partial/unsupported/uncertainty status per claim.
- Required direct evidence for precise technical claims such as percentages, durations, dosage, dates, temperatures, vessel sizes, yield and planting density.
- Detect and preserve independently sourced technical conflicts instead of silently choosing one figure; undisclosed contradictions fail only the affected scope.
- Removed the incompatible grounded-search + response-schema combination, added model grounding-health observations and adaptive routing, and made retry selection depend on the actual failure type.
- Reduced Deep Search latency by starting emulated queued work immediately and running producer research submissions at bounded six-way concurrency.
- Added producer batch-research campaigns with bounded concurrency, run history, stop/resume behavior, stalled-run termination and retryable failure navigation.
- Reduced grounded-search cost with whole-range catalogue requests, bounded recursive splitting, prompt-level search budgets and recorded search-query counts.
- Made wine-page Deep Search sections collapsible, surfaced evidence counts/quality status compactly and grouped bibliography links by host.

### Passport, Insights and collections

- Built a journal-driven Passport dashboard with progress milestones, recent tastings, semantic grape presentation and a data-driven world map.
- Rebuilt Insights around signals available even when ratings are sparse: repeat producers, favourite rates, exploration, cadence, drinking age and grape/style mix; rating/structure cards are coverage-gated.
- Added Wine Collections as declarative, identity-aware achievement checklists with retroactive matching and `tasted` / `possible` / `pending` states.
- Added full collection grid/detail UI, Passport previews and cached progress keyed by owner data revision and collection-definition version.
- Added user-created collections: live smart catalogue rules plus manual canonical producer/cuvée/appellation picks.
- Added controlled matching modes for historic-vintage collections and fixed classified-estate semantics so second wines do not complete grand-vin targets.
- Expanded the curated set across Bordeaux, Burgundy, Champagne, DRC, Barolo, Tuscany, Napa, Oregon, Washington, Australia, New Zealand and benchmark producer/appellation themes.
- Added per-vintage tasting links, stable classification headings, selector aliases and cache fingerprints that invalidate when selector/order semantics change.
- Removed the Passport map's 20-country truncation and improved map/style contrast across light and dark themes.

### Performance, reliability and cost accounting

- Removed write-heavy identity work from ordinary reads and guarded remaining upserts so browsing does not mutate unchanged rows.
- Added revision-based Journey/Achievement caches, ETags, covering indexes and a consolidated latest-experience join to reduce D1 reads/writes.
- Added backed-off polling and explicit recovery for Batch Scan and research jobs so lost queue messages or stale runs do not remain indefinitely active.
- Added ESLint 9 flat configuration and CI gates for lint, production TypeScript/build and unit tests.
- Added AI usage metering across producer research, wine research, Single Scan, Batch Scan, Group Photo and tasting-sheet recognition, with D1 history plus Analytics Engine output.
- Added Pacific-time billing-month logic, historical grounding-search seeding and recognition usage units so scan costs are shown per wine.
- Added dated model-rate windows, service-tier multipliers, Flex backfill and thinking-token accounting; small HKD costs display at enough precision to compare workflows.

### Deployment and self-hosting

- Added a full `SETUP.md` covering Cloudflare resources, queues/DLQ, secrets, authentication, Gemini transport choices, migrations, first login, verification, troubleshooting, costs and backups.
- Documented GitHub-connected deployment behavior and the requirement to use the repository deploy command when migrations must run.
- `npm run deploy` is the supported release path: production build -> remote D1 migrations -> Worker deploy.

### Release integrity

- v1.0.0 is based on `main` after merged PR #185.
- PRs that were closed/unmerged or superseded are excluded from shipped history; notably #121 was superseded by #122.
- The release code point passed the repository CI gates for lint, TypeScript/production build and unit tests.
- Latest shipped schema migration at this baseline: `0043_united_kingdom_country_name.sql`.
