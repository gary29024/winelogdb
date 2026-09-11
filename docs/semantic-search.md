# Journal semantic search

WineLogDB keeps its existing D1 FTS5 search and adds semantic retrieval only for descriptive queries. The same Journal search box therefore supports both exact searches such as `Lamarche` and natural-language searches such as `floral elegant Burgundy with fine tannins`.

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

Semantic retrieval turns on automatically for:

- an English/space-separated query containing at least three terms; or
- a CJK query containing at least four Han characters.

Short identity-oriented searches continue directly to FTS5. `?semantic=1` forces semantic retrieval for testing and `?semantic=0` disables it for a request.

Semantic candidates are unioned with FTS/tasting-name matches. Existing country, region, style, rating, month, tasting and favourite filters remain SQL predicates. With the default sort, semantic candidates are ordered by similarity; an explicit Journal sort such as rating, producer or vintage always wins.

The semantic layer does not replace the canonical `/api/journal` route. It forwards candidate IDs into that route, so the existing authentication, CORS, identity maintenance, filtering and pagination remain single-owner behaviour.

## Index lifecycle and cost control

A semantic document contains wine identity and meaning-bearing fields only: producer, wine, vintage, geography, classification, style, grapes, tasting notes, rating, event/venue and tags. Operational IDs, photo URLs and timestamps are not embedded.

Document indexing never blocks the Journal response. A descriptive query schedules bounded cache warm-up through `waitUntil`; on a completely cold cache the current request simply uses the existing lexical result while vectors are built in the background. Once cached candidates exist, a semantic request waits only for the one query embedding.

The cache records the wine's `updated_at`. An unchanged wine is never re-embedded. If a wine changes, its previous vector remains searchable until the background refresh replaces it, so an edit does not make that wine temporarily disappear from semantic results. Deleted wines are excluded by the join to the live `wines` table.

Embedding model calls are recorded in the app AI-usage ledger under `search_embedding`, with one request plus the number of query/document embeddings covered by that call. The current embedding response shapes do not expose exact billed token/neuron usage, so provider dashboards remain authoritative for exact embedding spend.

If the embedding service is unavailable, misconfigured or over quota, the Worker logs the failure and falls through to the existing FTS Journal search rather than failing the page.

## Quick check after deployment

Open Journal and try both forms:

1. `Lamarche` — should behave like the existing name search.
2. `floral elegant Burgundy with fine tannins` — after the background cache has begun warming, should return semantically similar wines even when those exact words do not all appear in the record.

For an A/B check, append `semantic=0` to the same Journal URL and compare it with the normal result.
