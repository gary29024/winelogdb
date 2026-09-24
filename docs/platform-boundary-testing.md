# Worker runtime and routing release gate

WineLog treats authentication, account ownership, database migrations, SPA/Worker routing, and Cloudflare runtime configuration as high-risk boundaries. Green unit tests are not sufficient for those changes because provider routing can fail before application code runs.

The **Lint and build** CI job runs `scripts/worker-runtime-smoke.mjs` for PRs that change Worker or database code, shared high-risk configuration, or other paths classified as broad-risk changes. It also runs on every push to `main`, manual dispatch, and weekly checkpoint. See [the test policy](testing-strategy.md) for all CI tiers and the full-suite checkpoints.

Before the smoke starts, CI builds the production app and applies all D1 migrations to a local Wrangler database. The gate then performs two complementary checks:

1. It statically asserts that `wrangler.jsonc` keeps `assets.run_worker_first` containing `/api/*`. This is the production routing invariant that prevents Cloudflare's SPA asset layer from intercepting API navigation.
2. It starts the actual Worker through `wrangler dev --local` and exercises Worker/OAuth/JSON/SPA behavior with browser-style navigation headers:
   - `/api/public/config` returns JSON from the Worker;
   - `/api/auth/google/start` returns a `302` to Google with the expected callback URI;
   - `/api/auth/google/callback` is handled by the Worker;
   - unauthenticated `/api/me` returns JSON `401`;
   - unknown `/api/auth/*` navigation returns JSON `404`;
   - normal SPA navigation such as `/login` still returns HTML.

## Important limitation

`wrangler dev --local` does **not** reproduce Cloudflare's deployed asset-routing precedence. In particular, removing `run_worker_first` may still allow local `/api/*` requests to reach the Worker even though the deployed site would let the SPA asset router intercept them. For that reason, the local **Worker runtime smoke** must not be described as proof of deployed Cloudflare asset-router precedence.

The current gate closes that known regression path with the explicit `run_worker_first` configuration invariant plus the local behavioral smoke. A true end-to-end check of Cloudflare's production asset-routing layer would require deploying an isolated preview/version in CI with Cloudflare credentials and testing that preview URL. That is a possible future hardening step, not something the current local gate claims to provide.

The test deliberately uses fake local OAuth values and never contacts the Google token endpoint, so CI needs no production OAuth secret. Together, the static routing invariant and local Worker runtime smoke provide a fast release gate without overstating what local Wrangler can emulate.

## Local sharing journey

The same CI platform tier also installs Chromium and runs `npm run test:stack` after the production build. [`playwright.stack.config.ts`](../playwright.stack.config.ts) keeps this separate from the API-mocked UI suite. The harness applies every migration to fresh isolated local D1, serves the built SPA and production Worker entrypoint through Miniflare, and uses real local R2 and Images bindings. No WineLog API response is mocked.

The journey covers owner save/correction/photo upload/tagging, recipient Journal and Smart Search, recipient-owned experience, source updates and revocation. Persisted-state and HTTP assertions cover a third account, private fields, original and cached-thumbnail authorization, cached search results and independently adopted factual research. The [verification report](sharing-journey-verification.md) records reproduction evidence and final results.

External OAuth and embedding providers are local fixtures: synthetic signed tokens still pass through the production callback verifier and session code, while deterministic vectors establish search visibility and persistence. Unexpected Worker egress is rejected. This does not verify real Google authorization, model quality, production Images quota behavior or deployed routing. No production credentials or authentication bypass are required.

For an isolated run of the existing runtime smoke, apply local migrations with `--persist-to <directory>` and set `WINELOG_SMOKE_PERSIST_TO` to the same absolute directory. The database binding ID must also match the smoke's Wrangler configuration; the sharing harness deliberately uses its own separate database ID.
