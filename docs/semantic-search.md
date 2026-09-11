# Journal semantic search

WineLogDB keeps its existing D1 FTS5 search and adds semantic retrieval only when the user explicitly asks for Smart search. The same Journal search box therefore supports both exact searches such as `Lamarche` and natural-language searches such as `floral elegant Burgundy with fine tannins` without making normal typing feel different.

## Default: Cloudflare Workers AI

The production default is `workers-ai`, using `@cf/qwen/qwen3-embedding-0.6b`. `wrangler.jsonc` already declares the `AI` binding, so there is no API key to create or save.

Deployment remains the normal WineLogDB deployment:

```bash
npm run deploy
```

That command builds the app, applies D1 migrations, then deploys the Worker. Migration `0057_semantic_search_embeddings.sql` creates the local vector cache.

No Vectorize binding is required. For the current single-user database, embeddings are stored as unit-normalized Float32 blobs in D1 and ranked in the Worker using exact dot product, which is cosine similarity for unit vectors. The trade-off is scalability, not retrieval quality.

A 1,024-dimensional Float32 vector is 4,096 bytes before row/query overhead. Reading the full D1 vector set is therefore roughly 0.39 MiB for 100 wines and 3.9 MiB for 1,000 wines per semantic search. This is acceptable for the current small single-user library, but around 1,000 wines — or earlier if semantic-search latency or D1 rows read become material — is the point to reassess and move the storage/ranking layer to Vectorize. That migration would not require changing the Journal UI or embedding provider.

## Optional: Gemini AI Studio key

Gemini embeddings are supported as a bring-your-own-key alternative. Change this variable in `wrangler.jsonc`:

```jsonc
"SEMANTIC_SEARCH_PROVIDER": "gemini"
```

If the deployment's existing `GEMINI_API_KEY` is an AI Studio key, semantic search can reuse it. To keep semantic search on a separate key instead:

```bash
npx wrangler secret put SEMANTIC_GEMINI_API_KEY
npm run deploy
```

The default Gemini embedding model is `gemini-embedding-001` at 768 dimensions. It can be overridden with `SEMANTIC_GEMINI_MODEL` and `SEMANTIC_GEMINI_DIMENSIONS`, although changing dimensions or models creates a separate lazy cache by design.

To disable semantic retrieval while retaining ordinary Journal search, set:

```jsonc
"SEMANTIC_SEARCH_PROVIDER": "off"
```

## Query behaviour

The shared semantic-query gate classifies these as descriptive:

- an English/space-separated query containing at least three terms; or
- a CJK query containing at least four Han characters.

All settled text continues to update Journal results after the existing 300 ms debounce. Short identity-oriented searches use the ordinary FTS5 path. Descriptive text also uses that same cheap lexical path while showing an additional **✨ Smart search** action. Pressing **Enter** while a descriptive query is present, or tapping **Smart search**, explicitly opts that query into semantic retrieval.

This means a user typing `floral elegant Burgundy` still sees normal literal/metadata results automatically. No query embedding is spent merely because the user paused while composing the description. The URL records this distinction as `semantic=0` for the live lexical version and a positive semantic attempt number after Smart search. The first attempt is `semantic=1`; choosing **Smart search again** increments that number so the same text produces a real Journal refetch while the background index catches up.

The UI deliberately does **not** claim that a Smart search is complete after the first press. On a cold or partially warmed index it shows that the journal index is being built in the background and keeps **Smart search again** available. This avoids presenting lexical or partial results as a completed semantic answer.

The Worker keeps its existing safety gate. `?semantic=1` forces semantic retrieval for direct/API testing and `?semantic=0` disables it. Other positive attempt values from the Journal UI also use semantic retrieval for descriptive queries.

Semantic candidates are unioned with FTS/tasting-name matches. Existing country, region, style, rating, month, tasting and favourite filters remain SQL predicates. With the default sort, semantic candidates are ordered by similarity; an explicit Journal sort such as rating, producer or vintage always wins.

The semantic layer does not replace the canonical `/api/journal` route. It forwards candidate IDs into that route, so the existing authentication, CORS, identity maintenance, filtering and pagination remain single-owner behaviour. The forwarded `__semanticIds` parameter is internal-only: caller-supplied values are removed before the canonical route is invoked.

## Index lifecycle and cost control

A semantic document contains wine identity and meaning-bearing fields only: producer, wine, vintage, geography, classification, style, grapes, tasting notes, rating, event/venue and tags. Operational IDs, photo URLs and timestamps are not embedded.

Document indexing never blocks the Journal response. An explicit Smart search schedules bounded cache warm-up through `waitUntil`; on a completely cold cache the current request simply uses the existing lexical result while vectors are built in the background. Once cached candidates exist, a semantic request waits only for the one query embedding. The user can repeat Smart search if the first result set is incomplete while that background work finishes.

The cache records the wine's `updated_at`. An unchanged wine is never re-embedded. If a wine changes, its previous vector remains searchable until the background refresh replaces it, so an edit does not make that wine temporarily disappear from semantic results. Deleted wines are excluded by the live-wine join and their cached embedding is removed by the foreign-key cascade.

Embedding model calls are recorded in the app AI-usage ledger as **Smart search** (`search_embedding`). Document-index calls count the number of wines embedded; query embeddings count as requests but do not pretend to index another wine. The current embedding response shapes do not expose exact billed token/neuron usage, so provider dashboards remain authoritative for exact embedding compute spend.

If the embedding service is unavailable, misconfigured or over quota, the Worker logs the failure and falls through to the existing FTS Journal search rather than failing the page.

## Quick check after deployment

Open Journal and try both forms:

1. Type `Lamarche` and pause — it should behave like the existing live name search.
2. Type `floral elegant Burgundy with fine tannins` and pause — ordinary lexical/metadata results should still update automatically and a **Smart search** button should be visible.
3. Tap **Smart search** or press Enter — semantic retrieval is attempted and background indexing starts if needed. On a cold index the UI should say that indexing is happening rather than claiming success.
4. If the first set looks incomplete, tap **Smart search again** — the same query should refetch against the warmer index.
5. Edit the text again — after the next 300 ms pause it should return to the cheap lexical mode until Smart search is explicitly chosen again.

For an A/B check, compare the same query with `semantic=0` and `semantic=1` in the Journal URL.
