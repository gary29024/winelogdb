# Hotfix: API worker-first routing

Cloudflare Static Assets with SPA fallback can serve `index.html` for direct browser navigations unless API paths are configured to run the Worker first. WineLog therefore requires `assets.run_worker_first` to include `/api/*`.

This is particularly important for Google OAuth start and callback routes, which are browser navigations rather than `fetch()` calls.
