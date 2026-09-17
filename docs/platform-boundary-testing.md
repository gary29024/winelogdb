# Platform-boundary release gate

WineLog treats authentication, account ownership, credits/billing, storage ownership, database migrations, and Cloudflare runtime routing as high-risk boundaries. Green unit tests are not sufficient for those changes because provider routing can fail before application code runs.

The existing **Lint and build** CI job therefore runs `scripts/platform-boundary-smoke.mjs` whenever a pull request touches Worker/runtime code, Wrangler configuration, auth UI, credits/usage code, D1 migrations, workflow/runtime configuration, or package/build configuration. The smoke also runs on every push to `main`.

Before the smoke starts, CI builds the production app and applies all D1 migrations to a local Wrangler database. The smoke then starts the actual Worker through `wrangler dev` and verifies the deployed boundary contract rather than calling route functions directly:

- browser-style `Accept: text/html` navigation to `/api/public/config` returns JSON from the Worker;
- `/api/auth/google/start` returns a `302` to Google with the expected callback URI;
- `/api/auth/google/callback` is handled by the Worker, not SPA fallback;
- unauthenticated `/api/me` returns JSON `401`;
- unknown `/api/auth/*` navigation returns JSON `404`;
- normal SPA navigation such as `/login` still returns HTML.

The test deliberately uses fake local OAuth values and never contacts the Google token endpoint, so CI needs no production OAuth secret. Its purpose is to prove the Cloudflare/SPA/Worker/D1 boundary is wired correctly before a high-risk change can pass the existing required build check.
