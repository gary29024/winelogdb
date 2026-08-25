# WineLogDB

A private, Cloudflare-native wine notebook. React provides an accessible responsive UI; a Hono Worker owns authentication, Gemini recognition, D1 metadata, and private R2 images.

## Architecture and security

- `src/features/wines`: normalized records, CRUD, library/search, detail, and edit UI.
- `src/features/uploads`: multi-image selection, client previews/progress, validation, independent result state, and retries.
- `src/features/recognition`: strict schema for model output and editable review.
- `src/lib/db`: D1 schema/migrations; `src/lib/r2`: opaque collision-resistant keys.
- `worker/index.ts`: the authenticated API. Gemini secrets and R2 bindings never enter browser code. Images are fetched only after ownership checks at `/api/images/:id` and cached privately for five minutes.

Uploads accept JPEG, PNG, WebP, or HEIC, up to 10 MiB and 12 files per batch. Dimensions must be 300–12,000 px. Each image receives its own row and state, so a failed upload or recognition can be retried without duplicating successful items. Wine deletion first removes the record; R2 objects are deleted only if no remaining image row references them.

Recognition is server-only and schema constrained. Returned JSON is parsed with a strict Zod schema, then shown for human correction. Each request has a 20-second timeout and up to three attempts with exponential backoff. Batch processing is deliberately sequential (bounded concurrency of one) to protect quotas and retain clear per-image state.

## Local development

Requires Node 20+ and a Cloudflare account.

```bash
npm install
cp .dev.vars.example .dev.vars
# Fill local-only secrets; never commit .dev.vars
npm run db:migrate:local
npm run dev
```

The application expects the host authentication layer to issue an HS256 bearer token whose subject is the stable owner ID. Set `AUTH_SECRET` to at least 32 random bytes. For production, integrate the sign-in provider or Cloudflare Access at the same boundary; every API query additionally scopes records by owner.

## Cloudflare setup and deployment

1. Create private resources: `wrangler d1 create winelogdb` and `wrangler r2 bucket create winelog-private`.
2. Put the returned D1 ID in `wrangler.jsonc`. Keep the R2 bucket private.
3. Add secrets: `wrangler secret put GEMINI_API_KEY` and `wrangler secret put AUTH_SECRET`.
4. Set `APP_URL` in `wrangler.jsonc` to the exact production origin.
5. Apply schema with `npm run db:migrate`, then run `npm run deploy`.

No bucket CORS policy is needed because uploads and image reads pass through the authenticated Worker. If direct signed uploads are introduced later, restrict CORS to the exact application origin, required `PUT`/`HEAD` methods and content headers; never use `*` with credentials. Store object keys—not URLs, API credentials, or signatures—in D1.

## Search

The migration creates owner/filter/sort indexes and an FTS5 table for producer, name, region, grapes, notes, event, and tags. API filtering supports vintage, country, region, style, minimum rating, and event, plus stable `limit`/`offset` loading and sorts for newest, oldest, rating, producer, and vintage. The UI stores all selections in URL query parameters so views are bookmarkable. Production write paths should maintain `wine_search` using D1 triggers or application transactions when enabling FTS queries at scale.

## Deep Search quality gate

Research is cached per scope and every scope passes a quality gate on write and
again on read, so a cached entry that no longer meets the bar is re-researched
rather than served. Four things keep that gate honest.

- **Vintage references.** A field is rejected only when it asserts a year that
  is not the requested vintage. Years introduced as history or comparison
  ("converted to biodynamics in 2008", "picked later than 2015") are context,
  not a claim about which wine this is, and no longer fail the scope.
- **Source tiering.** Appellation bodies, consorzi and regulatory councils are
  recognised across Europe and the New World, not just France and Napa, and
  independent corroboration raises a field's score. A well-sourced wine outside
  the named host lists can now reach `verified`; previously it was capped at
  `mixed` however good its sources were.
- **Retries carry the reason.** When the gate rejects a scope, the fallback
  attempt is told what was wrong instead of re-sending an identical prompt.
- **One implementation each.** `batchWineResearch.ts` and `batchResearch.ts` are
  the only wine and producer researchers. Three earlier generations sat behind
  shadowed routes where they could neither run nor be noticed; a test now pins
  route ownership so a duplicate cannot creep back.

The result's quality status, score and any warnings are shown on the wine page,
so a rejection is diagnosable rather than an opaque failure.

## The wine page's Deep Search layout

A complete result covers six scopes plus a summary, each with its own claim
evidence, so shown at full length it pushed the rest of the wine page well
below the fold. The six research sections — vintage quality, producer,
producer-wide practices, this wine's winemaking, terroir, drinking window —
are collapsible accordions, closed by default with a compact evidence count
("`8 direct`") on the header so a section is worth opening or skipping without
opening it first. The summary stays open always, since it is the one thing
worth reading regardless. An expand/collapse-all control sits above the list,
and which sections a reader leaves open is remembered in `localStorage` across
visits and wines — a reader who always wants Terroir open does not have to
reopen it every time.

The quality status moves into a compact pill beside the DEEP SEARCH label,
visible without scrolling; the detailed warning box beneath the summary
appears only when there is a warning to explain, not for a clean `verified`
result.

Sources are grouped by host rather than listed flat, because Gemini's grounding
metadata often carries no page title, so several links on one host used to
render as identical-looking rows — `wine.com` three times over with no way to
tell the pages apart. Grouped, the host appears once with a count, and each
link underneath falls back to its URL path when the title is just the
hostname repeated. The list itself is collapsed behind a `<details>` summarising
the source and site counts, since the same references already appear beside
the specific claims they support (see Evidence below); the grouped list is
kept as the complete bibliography for a reader who wants to see everything
that was searched at once; the exact evidence for a given sentence is what
the per-section Evidence link is for.

## Producer catalogue corrections

Producer research rebuilds `catalog_json` from scratch on every run, and the
range is researched as six alphabetical slices in parallel. The same wine named
differently in two slices ("Clos de la Roche" and "Domaine X Clos de la Roche
Grand Cru") therefore arrives twice, and no normalizer can safely decide whether
two similar names are one cuvee or two — collapsing "Chambolle-Musigny" into
"Chambolle-Musigny 1er Cru" would lose a real wine.

Storage-time and display-time dedupe now share one identity key
(`catalogPresentationKey`), so a wine the producer page shows as a single row is
stored as a single row. What survives that is resolved by hand and remembered:
`producer_catalog_decisions` records a decision (`merge` into a surviving wine,
or `hide`) against a stable cuvee signature rather than against a row, and
`applyCatalogDecisions` re-applies it on every read and after every research
run. A resolved duplicate cannot come back.

The catalogue completeness guard counts both sides after those corrections, so
hiding duplicates never reads as a suspicious shrink. Corrections are listed
with an undo control under the producer's wine range.

## Geographic indications: IGT and IGP

The place tree treats a denomination as a fact about the place rather than the
bottle, so every Chianti Classico is DOCG without the label saying so. Italy's
IGT zones broke that model in a way worth knowing about: they are named after
the regions they cover, and one name can mean only one place in the tree, so
"Toscana" resolved to the administrative region and the appellation was dropped
entirely — every Super Tuscan stored no appellation at all.

IGT zones are therefore appellation-tier nodes carrying `denomination:'IGT'`,
and the label is what separates a zone from its region. A zone whose name
collides with a region — Toscana, Umbria, Veneto, Marche, Campania, Puglia,
Lazio, Calabria, Basilicata — is marked `denominationRequired` and answers only
to the spelled-out form, leaving the bare name to the region. Zones with a name
of their own, such as Terre Siciliane or Salento, match either way.

France's multi-region IGPs (Pays d'Oc, Méditerranée, Val de Loire, Atlantique,
Comtés Rhodaniens) share nothing with an administrative name, so they are
denominated regions in the same shape as Rioja and Priorat.

Where a zone is missing from the tree, the resolver falls back to the marker the
label spells out: an unknown "… IGT" still reads as IGT, with the marker
stripped from the stored name and the raw value reported as unresolved so
nothing is silently dropped. Only IGT and IGP are read this way. A label
claiming "Barolo DOC" is simply wrong, and the tree, which knows Barolo is
DOCG, keeps the last word.

The names themselves are meant to come from eAmbrosia, the Commission's Union
register, rather than from anyone's memory. `npm run gi:sync` fetches the wine
geographical indications and rewrites `src/lib/places/giRegister.json`; the
register owns the names, the tree owns where each zone sits, and
`giRegisterDrift.test.ts` reports every name the two disagree on. A sync that
comes back with an implausibly short list refuses to overwrite the file rather
than quietly shrinking it.

`giRegister.json` records its own provenance in `source`. It ships seeded from
the tree — `"hand-transcribed"` — because the environment this was written in
denies egress to `webgate.ec.europa.eu`, so the comparison is circular until
the first real sync. Run `npm run gi:sync` somewhere that host is reachable and
commit the result; any name that was wrong will fail the drift test on the same
run.

Two Italian regions register no IGT at all — Piedmont and Valle d'Aosta — and
the tree says so explicitly rather than leaving it to look like an omission.

The same "a region that is itself an appellation" idea covers Champagne, Alsace
and Beaujolais, which are each a single AOC over the whole region they name.
Without marking them the country default stopped above the region tier, so a
wine recorded as "Champagne" showed no denomination while the same wine
recorded under its village showed AOC. Burgundy and Tuscany stay unmarked: they
are collective names holding many appellations, and that is the rule the tier
cut-off exists to protect.

## Staying inside the D1 free tier

D1's free plan is metered on rows read and rows written per day, so the design goal
is that browsing the notebook costs almost nothing and only real edits write.

- **Reads never write.** Opening a wine used to re-derive its producer and cuvée
  links on every request, which cost a `wines` UPDATE and two alias upserts per view
  — and, through the achievement cache triggers, invalidated cached progress each
  time. Identity is now backfilled only when a link is genuinely missing, and every
  remaining upsert on those paths carries a `WHERE` guard so an unchanged row is not
  rewritten.
- **The landing page is cached.** `/api/journey` ran twelve aggregate scans of the
  owner's wines on every visit. Results are cached in `journey_summary_cache`, keyed
  on the shared owner revision in `achievement_cache_state`, so an unchanged journal
  costs two indexed lookups. Achievement progress uses the same revision.
- **Conditional requests.** `/api/journey` and `/api/achievements` return a
  revision-tagged `ETag` with `Cache-Control: private, max-age=0, must-revalidate`.
  A client that already holds the current revision gets a `304` for the price of the
  revision lookup, with no recompute and no response body.
- **One join instead of seven subqueries.** The shared wine projection resolves the
  latest experience through a single indexed join rather than seven correlated
  subqueries per row, which mattered most on list pages.
- **Covering indexes for photo lookups.** `idx_wine_images_owner_wine_id` and
  `idx_wine_images_owner_wine_captured` keep the Journal's per-wine photo and
  capture-timestamp lookups index-only. The capture lookup sits in the Journal's
  `ORDER BY`, so it is evaluated for every candidate row, not just the page.
- **Backed-off polling.** Background Deep Search, producer research and batch scans
  poll status with an increasing interval instead of a flat two-second timer, so a
  ten-minute run costs tens of status reads rather than hundreds.

When adding a query, prefer one statement that returns what a screen needs over a
per-row lookup, and give any new write on a read path a `WHERE` guard. If a new
cached payload reads a table that does not yet bump `achievement_cache_state`, add
its triggers in the same migration.

## Which model researches, and enforcing grounding

Deep Search runs on `gemini-3.7-flash` with `gemini-3.6-flash` as the
availability fallback. The two are not interchangeable for research: an answer
that comes back without Google Search grounding cannot satisfy the quality gate
however well written it is, so a call to a model that did not search cannot
succeed whatever it returns.

Which model grounds is **observed, not assumed**. Evidence has pointed both
ways, and it varies by serving mode, so `research_model_health` records what
each model did with each grounded request: a model seen to ground is tried
first, one seen to answer ungrounded is routed around for six hours, and a
model that grounds again clears its own cooldown with no intervention. If the
health table cannot be read, routing falls back to the configured order, so a
migration that has not run yet degrades to the previous behaviour rather than
failing.

Retries follow what the failure was. A grounded answer that fails the gate gets
a second opinion and then stops, because failing twice on real evidence is a
research limit rather than an infrastructure one. An answer with no grounding at
all earns one further attempt, on a different model. Three attempts is the
ceiling.

**Grounding and controlled generation cannot share a request.** Declaring the
search tool while also setting `responseMimeType` and a `responseSchema` asks
the API for two things it will not do at once, and what comes back is
well-formed JSON with the grounding silently dropped — which the gate then
rejects for having no sources. Grounded requests therefore send no schema and
ask for JSON in the prompt; the schema stays the single definition of the
contract and is rendered into the prompt from itself by `describeResponseSchema`,
so the two cannot drift. Responses are parsed with the existing tolerant reader
rather than trusted to be bare JSON.

There is no API flag that guarantees grounding, so enforcement is three things
together: every research prompt — wine, producer profile and catalogue slices —
opens by requiring the model to search before answering and to say plainly that
a fact could not be verified rather than write an ungrounded one; the search
tool is declared on every request; and the gate rejects what comes back
ungrounded anyway. The first is a request, the third is the enforcement.

## Diagnosing a Deep Search failure

Two log streams matter, and they answer different questions.

**Workers Logs** carry WineLog's own structured records and are enabled at full
sampling in `wrangler.jsonc`. Every batch result logs `stage:"batch_result"`
with the model, attempt, finish reason, response length and — the fields that
matter when a run fails ungrounded — `chunks` and `supports`, the counts of
grounding chunks and grounding segments the response carried. Follow them live
with `wrangler tail --format pretty`, or search the Workers Logs view for
`batch_result`. Zero on both counts means the model answered without searching,
which fails every research scope at once.

**AI Gateway logs** carry the raw request and response bodies, and only for
traffic that goes through the gateway. Body collection is decided per request by
the `cf-aig-collect-log-payload` header, which overrides the gateway's own
setting — so while WineLog sends `false`, no dashboard toggle can turn payload
logging on. Set the `AI_GATEWAY_LOG_PAYLOADS` var to `"true"` and redeploy to
collect them, then set it back: these payloads are whole research prompts and
answers, which is both a lot of storage and a copy of the owner's data living
outside D1.

Reach for the gateway payloads only when the Workers Logs counts are not enough
— typically to see whether `groundingMetadata` is absent from the response or
merely shaped differently from what the parser expects.

## Backup and recovery

Schedule `wrangler d1 export DB --remote --output backups/winelog-YYYY-MM-DD.sql` and R2 replication or `rclone sync` to a second private bucket. Encrypt backups, restrict service tokens, test restores quarterly, and apply retention policy. To recover: disable writes, restore the latest D1 export into a new database, restore R2 objects preserving their keys, update bindings, apply any later migrations, validate record/image counts, and redeploy before re-enabling traffic.

## Quality checks

```bash
npm test
npm run build
npm run test:e2e
```

Coverage includes metadata/schema validation, hostile Gemini responses, upload limits, and R2 keys. The API design exposes authorization, CRUD, partial-failure, private-image, and search boundaries for integration tests with Miniflare/D1; the Playwright flow verifies upload/review discovery and shareable search state.
