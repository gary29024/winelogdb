# API routing note

WineLog uses Cloudflare Static Assets with SPA fallback. All `/api/*` requests must run the Worker before static asset handling via `assets.run_worker_first` in `wrangler.jsonc`.

Without this rule, direct browser navigations such as Google OAuth start/callback can be treated as SPA navigations and receive `index.html` instead of the Worker response.
