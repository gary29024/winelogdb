# Worker runtime and routing release gate

WineLog treats authentication, account ownership, database migrations, SPA/Worker routing, and Cloudflare runtime configuration as high-risk boundaries. Green unit tests are not sufficient for those changes because provider routing can fail before application code runs.

The existing **Lint and build** CI job therefore runs `scripts/worker-runtime-smoke.mjs` whenever a pull request touches Worker/runtime code, Wrangler configuration, auth UI, D1 migrations, workflow/runtime configuration, package/build configuration, `index.html`, or `public/`. The smoke also runs on every push to `main`.

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
