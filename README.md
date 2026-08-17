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

## Backup and recovery

Schedule `wrangler d1 export DB --remote --output backups/winelog-YYYY-MM-DD.sql` and R2 replication or `rclone sync` to a second private bucket. Encrypt backups, restrict service tokens, test restores quarterly, and apply retention policy. To recover: disable writes, restore the latest D1 export into a new database, restore R2 objects preserving their keys, update bindings, apply any later migrations, validate record/image counts, and redeploy before re-enabling traffic.

## Quality checks

```bash
npm test
npm run build
npm run test:e2e
```

Coverage includes metadata/schema validation, hostile Gemini responses, upload limits, and R2 keys. The API design exposes authorization, CRUD, partial-failure, private-image, and search boundaries for integration tests with Miniflare/D1; the Playwright flow verifies upload/review discovery and shareable search state.
