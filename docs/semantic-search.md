# Journal semantic search

WineLogDB keeps its existing D1 FTS5 search and adds semantic retrieval only for descriptive queries. The same Journal search box therefore supports both exact searches such as `Lamarche` and natural-language searches such as `floral elegant Burgundy with fine tannins`.

## Default: Cloudflare Workers AI

The production default is `workers-ai`, using `@cf/qwen/qwen3-embedding-0.6b`. `wrangler.jsonc` already declares the `AI` binding, so there is no API key to create or save.

Deployment remains the normal WineLogDB deployment:

```bash
npm run deploy
```

That command builds the app, applies D1 migrations, then deploys the Worker. Migration `0052_semantic_search_embeddings.sql` creates the local vector cache.

No Vectorize binding is required. For the current single-user database, embeddings are stored as normalized Float32 blobs in D1 and ranked with exact cosine similarity in the Worker. This produces the same similarity score as a vector database; the trade-off is scalability, not retrieval quality. If the library later becomes large or multi-user, the storage/ranking implementation can move to Vectorize or another vector database without changing the Journal UI or the embedding provider.

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

Semantic candidates are unioned with FTS/tasting-name matches. Existing country, region, style, rating, month, tasting and favourite filters remain SQL predicates. With the default sort, semantic candidates are ordered by cosine relevance; an explicit Journal sort such as rating, producer or vintage always wins.

## Index lifecycle and cost control

A semantic document contains wine identity and meaning-bearing fields only: producer, wine, vintage, geography, classification, style, grapes, tasting notes, rating, event/venue and tags. Operational IDs, photo URLs and timestamps are not embedded.

The cache records the wine's `updated_at`. An unchanged wine is never re-embedded. A changed wine is refreshed on the next semantic search. The first request indexes a bounded batch and schedules additional bounded warm-up work when required; normal browsing does not generate embedding calls or semantic-cache writes.

If the embedding service is unavailable, misconfigured or over quota, the Worker logs the failure and falls through to the existing FTS Journal search rather than failing the page.

## Quick check after deployment

Open Journal and try both forms:

1. `Lamarche` — should behave like the existing name search.
2. `floral elegant Burgundy with fine tannins` — should return semantically similar wines even when those exact words do not all appear in the record.

For an A/B check, append `semantic=0` to the same Journal URL and compare it with the normal result.
