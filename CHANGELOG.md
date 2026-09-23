# Changelog

All notable WineLogDB changes are summarized here by shipped impact. Each stable release consolidates merged pull requests rather than duplicating the full PR-by-PR history.

## [1.3.0] - 2026-09-23

### Multi-user accounts and friend sharing

- Shipped the invite-only multi-user foundation with Google sign-in, owner/member roles, owner controls, account-scoped wines/research/storage, accepted-friend relationships and selective wine sharing.
- Reworked sharing into a compact **Tag friends** flow available from wine detail, Journal multi-select and tastings, plus per-friend defaults for automatically tagging newly logged wines.
- Integrated shared wines directly into the recipient's Journal, Passport, Insights and Wine Collections without copying the source wine into the recipient account; shared wine facts remain read-only while favourites, rating, notes, structure and other recipient experience data stay recipient-owned.
- Added shared-producer read models and research reuse so a member can recognise and browse a producer already visible through a friend's shared wine without creating duplicate producer identities.
- Reused the owner's canonical R2 image and persistent thumbnail for shared photos instead of creating per-recipient photo copies, while preserving share authorization checks.
- Simplified member-facing screens by hiding provider/model/compression details and exposing support IDs for troubleshooting instead.

### Sponsored member AI and model policy

- Replaced pilot credit pricing with the intended sponsored-access policy: member scanning and Smart Search are included, while Wine Deep Search, individual producer research and Vintage Window share a configurable weekly allowance that defaults to **2 user-facing runs per week**.
- Kept owner usage provider-bill-direct while retaining per-account usage, provider-operation and audit records; owner controls now show member usage, allowances, storage and budget guardrails.
- Centralized active AI model assignments in one policy module while keeping capability-specific transports for recognition, grounded research, Vintage Intelligence, producer-range extraction and embeddings.
- Switched the Workers AI text fallback to Qwen3-30B-A3B and hardened Vertex/Gemini queue timeouts so slow provider calls persist explicit failures and can enter the existing recovery path instead of leaving abandoned jobs.
- Added Smart Search query-result caching and clearer Champagne/Vintage usage attribution, reducing repeat embedding/vector work after returning to the same semantic search.

### LWIN and ELID wine identity

- Added a versioned LWIN/ELID reference layer backed by producer-keyed R2 shards, with only matched external IDs and lightweight sync state stored in D1.
- Added direct LWIN XLSX/CSV import, deterministic redirect handling for Live/Combined/Deleted records and explicit recognition states for vintage, non-vintage, multi-vintage and unknown wines plus edition/release designations.
- Added conservative owner-only backfills for existing wines: deterministic matching first, followed by an optional AI-assisted second pass that can only choose from supplied LWIN candidates and must pass strict confidence/canonical-resolution checks.
- Added resumable backfill checkpoints, leases and recovery, plus reference snapshots that enrich missing wine facts while preserving populated fields, manual decisions, tasting data and other personal information.
- Added owner review tools for previewing/linking/rejecting LWIN identities and applying producer-name corrections across linked wines without silently merging producer identities.
- Populated ELIDs from the public registry and made later identity refreshes fill missing verified ELIDs without overwriting stored identifiers or manual rejections.

### Journal, detail pages and navigation

- Completed the Journal, Account & friends and Owner Controls layout redesign with compact page headers, focused settings sections, removable filter chips, clearer empty states and stronger mobile responsiveness.
- Made Smart Search index and find wines shared to the current member using only recipient-visible wine facts plus that recipient's own notes/score/tasting name; withdrawn shares are removed from semantic candidates.
- Added dedicated **Cellar** and **Favorites** Journal headers, stable mobile tab positioning, a consistent Filters control and result counts beside Filters.
- Brought owner and shared wine detail pages onto a shared wine-facts definition, including classification styling, denominations, grape percentages and sparkling release details, while keeping private owner fields outside the shared payload.
- Fixed Deep Search website attribution when Gemini returns Google Search redirect URLs, moved Champagne production details into the main detail flow and fixed full-screen photo/lightbox bounds on phones.

### Burgundy Atlas and identity-aware exploration

- Added verified Burgundy Atlas links for all 33 Grand Cru appellations and extended them to named Premier Crus, village appellations and safe Premier Cru appellation fallbacks.
- Added static coverage for 630 Premier Cru plot destinations, 43 village appellations and 29 Premier Cru appellations, with strict geography/tier/identity guards and no runtime Atlas API or AI dependency.
- Added Atlas links to relevant live collection rows while withholding links for ambiguous, conflicting or unmapped cases instead of guessing.

### Reliability, performance and release integrity

- Hardened Champagne extraction selection/translation, member recognition response contracts, shared wine ordering, producer identity reuse and LWIN matching/review flows based on production testing.
- Reduced redundant backend reads, reference lookups and queue dispatch, made LWIN AI rollout checkpoint one wine per queue job, and streamlined/parallelized CI while retaining risk-boundary regression coverage.
- v1.3.0 consolidates all merged product work after v1.2.0 through PR #327, including PR #224 which was intentionally excluded from v1.2.0 and merged afterward.
- Product baseline before release metadata: `main` at `99edcd4b9c51691bc7c7c178e863a072d1c3906b` (merged PR #327); its CI push run `35876749364` completed successfully.
- New schema migrations since v1.2.0 are `0061_semantic_query_cache.sql` through `0083_lwin_reference_snapshot.sql` (23 migrations).
- Production upgrades must use `npm run deploy` so outstanding remote D1 migrations run before the Worker is deployed.

## [1.2.0] - 2026-09-15

### Smart Journal search

- Added opt-in **Smart Search** for descriptive natural-language Journal queries while keeping normal debounced typing on the existing cheap lexical/structured path.
- Added Cloudflare Workers AI `@cf/qwen/qwen3-embedding-0.6b` as the default embedding provider with optional Gemini `gemini-embedding-001` BYOK support, background document refresh and fail-open lexical fallback.
- Stored normalized Float32 embedding vectors in D1 and combined semantic candidates with the canonical Journal filters, pagination and explicit sorting rather than creating a parallel search surface.
- Fixed production D1 BLOB decoding for number-array results and removed SQL-variable-limit failures by packing semantic candidate IDs/ranks instead of binding large ID lists repeatedly.

### Vintage Intelligence and durable research

- Expanded grounded vintage lookup with a source-aware **WineLog 70–100 estimate**, quality band, AI-assessed confidence, consensus, strengths and cautions while keeping WineLog's estimate explicitly separate from third-party critic scores.
- Added a dedicated cellar Vintage Intelligence dialog, clearer researched-vs-typical drinking readiness and evidence/source presentation without automatic repeat AI calls.
- Moved accepted vintage lookups onto the existing research queue so browser closure/disconnection no longer cancels paid work; persisted owner/cell jobs, deduplicated active work and preserved the previous saved result when a refresh fails.
- Removed the drinking-window panel/request from tasted-wine detail by default while retaining the feature behind the surface flag and keeping it active for cellar bottles.

### Champagne and sparkling release details

- Added per-bottle Champagne/traditional-method release details for dosage, dosage style, disgorgement, tirage/bottling, base vintage, reserve percentage, lees ageing, lot/release code, assemblage, reserve detail, malolactic information and fermentation/elevage.
- Extended Single Wine multi-photo recognition to capture those details only when they are explicitly visible on supplied labels, without inferring precise release facts from general producer/cuvée knowledge.
- Added background **Fill Champagne details from photos** for existing Journal entries. Suggestions are persisted separately, fill only empty form fields and are applied only through the normal wine Save.
- Fixed Champagne eligibility for village-valued appellations, `Champagne Grand Cru` / `Champagne Blanc de Blancs` wording and rosé Champagne while excluding still/fortified Champagne-region wines and unrelated sparkling wines.

### Sharing, producer research and imagery

- Added 1080 × 1920 tasting/Journal story cards for up to 16 selected wines, with label-first adaptive layouts, favourite markers, native file sharing where supported and a save fallback elsewhere.
- Made story-card date and tasting name independently optional and allowed the grid to reclaim freed header space automatically.
- Added Producer Range Phase 2: reuse/crawl bounded official-site evidence, try low-cost GLM-4.7-Flash extraction through AI Gateway/Z.AI with a Workers AI resilience path, and fall back to grounded Gemini when the evidence is incomplete or providers fail.
- Added durable manual producer-catalogue additions and reviewable possible-missing-wine suggestions so later machine refreshes cannot erase user-confirmed corrections.
- Added authenticated persistent private WebP thumbnails in R2 with ownership checks, edge/R2 reuse and safe original-image fallback; existing photos generate derivatives lazily rather than requiring re-upload or bulk backfill.

### Save, scan and UI reliability

- Made normal JSON/multipart wine saves transactional across the wine row, supplied photos, tasting state, latest experience, live-tasting activity and optional tasting structure; failed multipart creation cleans up R2 objects uploaded for that attempt.
- Made Group Scan tolerant of missing non-essential bounding-box coordinates while continuing to reject invalid/inverted boxes.
- Prevented automatically matched tasting-sheet wines from being offered to another row, and showed photographed wine-list pages before AI reading.
- Sorted producer tasted-cuvée lists alphabetically, accepted realistic spirit alcohol percentages such as Calvados at 46%, and surfaced field-level Batch Scan validation failures instead of a generic error.
- Fixed Journal/image-list D1 binding limits, semantic-search production decoding and multiple image/search loading issues found under real usage.
- Standardized mobile inputs, selects and textareas at the 16 px anti-zoom threshold, including compact sparkling-detail fields.

### Release integrity and deployment

- v1.2.0 consolidates all merged product work after v1.1.0 through PR #255; open draft PR #224 (multi-user accounts, friend sharing and AI credit controls) is intentionally excluded.
- Product baseline before release metadata: `main` at `64f2bf45ce86bb98a93d4e60d7500d36caa8aba9` (merged PR #255), whose CI run #863 completed successfully.
- New schema migrations since v1.1.0 are `0048_producer_hero_rejected.sql` through `0060_champagne_extraction.sql` (13 migrations).
- Latest shipped migration for this release: `0060_champagne_extraction.sql`.
- Production upgrades must use `npm run deploy` so remote D1 migrations run before the Worker is deployed.

## [1.1.0] - 2026-09-03

### Cellar and bottle maturity

- Added a dedicated **In cellar** scope for bottles owned but not yet drunk. Cellar holdings live outside `wines`, so they do not count as tasted wines, producer experience, Passport progress, Insights statistics or collection progress until a bottle is actually opened.
- Added manual cellar entry/editing with bottle count, format, purchase price/currency, merchant and storage location, while resolving only against producer/cuvée identities that already exist instead of creating untasted library entities.
- Added an **Open bottle** flow that transfers the holding into the normal wine log on save, decrements the cellar quantity only after a successful save, carries purchase price into the wine record and optionally checks a label photo for disagreements without silently applying them.
- Made cellar entry and editing practical on mobile with producer matching/near-miss suggestions, a substantially shorter sheet, edit/cancel paths, currency normalization and prefetching of the lazy cellar route.
- Added deterministic drinking-window guidance from the place hierarchy and wine style, including cru-tier-aware Burgundy rules and named prestige-Champagne exceptions.
- Added on-demand grounded vintage assessment. The researched shift is cached by the appropriate vintage cell, shown alongside the rule-of-thumb window, and never runs automatically.
- Refined vintage cells so named Burgundy grand crus can receive site-specific assessments while village/premier-cru wines continue to share broader regional vintage context; prestige Champagne retains its cuvée-specific baseline.
- Routed vintage lookup through the shared Gemini transport, using the lower-cost grounded model first and escalating only on provider/grounding/shape failure; added robust grounded-response parsing, source/model diagnostics, refresh support and correct per-attempt metering.

### Collections, Passport and journal semantics

- Added curated collections for **Primum Familiae Vini · The 12 Families**, **Napa Valley · 17 Nested AVAs** and **Willamette Valley · 11 Nested AVAs**.
- Added one **World Benchmark Producers & Cuvées** collection containing 143 course-derived targets. Producer-only examples remain producer-level goals, while specifically named wines use cuvée-level matching so another wine from the same house cannot complete the target.
- Prevented artificial double counting in the benchmark collection: when the course names a specific wine such as Sassicaia, La Turque or Yattarna, that cuvée replaces the broad producer target rather than sitting beside it.
- Expanded Passport mapping beyond one dot per large country. Geographically spread countries can now render canonical wine-region markers, with fallback to the country marker for unknown regions, and the payload no longer truncates the region set before the map can use it.
- Folded grape synonyms for counting and filtering while preserving the wording stored on each bottle. For example Pinot Nero/Spätburgunder/Blauburgunder aggregate under Pinot Noir in Insights/Passport, without rewriting the wine label text.
- Added local grape-name suggestions in the wine form and kept deliberately style-distinct names such as Syrah/Shiraz and Pinot Gris/Pinot Grigio separate.
- Reconciled derived country/region/appellation/grape/style tags when a wine is edited while preserving hand-written tags and respecting a previously deleted suggested tag.

### Journal, scanning and frontend performance

- Fixed Journal Reset after a remembered search so a cleared query cannot silently restore itself while leaving the search box blank.
- Kept rapid Journal search typing local to a small input component, debounced only the settled URL/API update, retained current results while refreshing and memoized chronological grouping.
- Added a D1 expression index for the Journal's real chronological sort, `coalesce(tasting_date, created_at)`, reducing the candidate set that needs secondary sorting during pagination.
- Treated Cloudflare R2 same-object throttling (`10058`) during Batch Scan as transient: retry locally with backoff, then use the existing delayed queue retry before marking an item failed, without billing Gemini when storage failed first.
- Added browser-memory reuse for Batch Scan previews and Group Photo originals/previews/crops, including in-flight request deduplication and bounded caches, reducing repeat private R2 reads without weakening authenticated `no-store` delivery.
- Isolated research elapsed-time clocks into a tiny leaf component so one-second timers no longer re-render entire wine/producer detail pages.
- Added explicit summary-cache invalidation after wine/tasting writes so Passport, Insights and collection progress do not remain stale in the client after a mutation.

### AI usage, configuration and diagnostics

- Corrected monthly AI usage rollups to preserve model and service tier, so billing-month totals use the same underlying rates as the detailed workflow cards instead of repricing mixed usage at a fallback model.
- Clarified the AI spend tile as **This billing month**, separated token cost from grounding-search allowance/cost and retained enough precision for small recognition costs.
- Removed the requirement for a direct `GEMINI_API_KEY` when the Cloudflare AI Gateway / Vertex configuration is complete; partially configured gateway environments now fail clearly instead of silently attempting a keyless direct call.
- Improved vintage-lookup failure diagnostics without enabling full payload logging: rejection logs now include finish reason, grounding/search/source shape and a bounded reply excerpt, while successful UI summaries identify the model that answered.

### Reliability and release integrity

- v1.1.0 consolidates all merged product work after the v1.0.0 tag through PR #207; unmerged work is excluded.
- Release baseline before metadata: `main` at `24a8ca7c816d52ac41b3c8d33f3f361e7120008d` (merged PR #207), whose CI completed successfully.
- New schema migrations since v1.0.0 are `0044_journal_date_index.sql`, `0045_cellar_holdings.sql`, `0046_vintage_windows.sql` and `0047_ai_usage_monthly_model.sql`.
- Latest shipped migration for this release: `0047_ai_usage_monthly_model.sql`.
- Production upgrades must use `npm run deploy` so the remote D1 migrations run before the Worker is deployed.

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
