# Lossless detailed map downloads

The four largest detailed Burgundy maps now have precompressed Brotli and gzip
copies. This changes transport only: every coordinate, feature, metadata field,
and existing display geometry survives byte for byte. Regional overview
simplification remains a separate feature documented in
[burgundy-regional-overviews.md](burgundy-regional-overviews.md).

## Measurements

| Map | Canonical GeoJSON bytes | Gzip level 9 bytes | Brotli bytes | Smaller than gzip |
| --- | ---: | ---: | ---: | ---: |
| Chablis | 2,390,645 | 886,926 | 497,626 | 43.9% |
| Côte de Beaune-Villages | 2,000,145 | 745,474 | 564,905 | 24.2% |
| Petit Chablis | 1,791,410 | 668,482 | 495,765 | 25.8% |
| Pouilly-Fuissé | 1,430,315 | 539,081 | 337,462 | 37.4% |

These are reproducible compressed-file measurements, **not a measured improvement
over production**. Production may already use Brotli or another edge encoding;
its previous transfer sizes and cache headers still need an audit using the
public site URL. The full 44-map detailed inventory, source/catalogue hashes,
compressed hashes and encoder versions are in
`scripts/burgundy-lossless-map-report.json`.

## Delivery and compatibility

The loader fetches only after the map opens. Modern browsers receive Brotli JSON;
the existing conservative `DecompressionStream` capability check selects the gzip
JSON copy for older browsers. Both formats are decoded by HTTP, then parsed with
`response.json()`. No browser codec or new dependency is needed. Failure uses the
dialog's explicit retry; it never starts another, larger download. Cancellation
and the existing 20-second budget remain in effect.

The assets live under `/maps/lossless/`. Only this prefix is added to
`assets.run_worker_first`; other map routes retain their existing delivery.
`worker/losslessMapAssets.ts` streams the allowlisted static file with the correct
`Content-Encoding` and `encodeBody: 'manual'`. Setting encoding in `_headers`
alone caused double compression in the local Cloudflare runtime. Cloudflare's
[Response documentation](https://developers.cloudflare.com/workers/runtime-apis/response/)
requires manual encoding for data which is already compressed.

The SHA256 fingerprint in each URL permits one-year immutable browser caching.
The handler retains ETags/304 responses, rejects unknown paths, rejects writes,
and prevents missing assets from returning compressed-labelled SPA HTML. Asset
requests omit credentials and byte ranges. A cold fetch invokes the Worker; a
fresh browser cache hit does not. There is no D1/R2 access, per-request compression,
or geometry parsing in the handler. Production request cost/cache behaviour is
part of the remaining deployment audit in #363.

## Rebuild and verification

Run `node scripts/build-burgundy-lossless-maps.mjs` from the repository. The builder
normalises Git text line endings to LF, then compresses the canonical text without
JSON reserialization. Node, Brotli and zlib versions are recorded in the report;
use those versions for identical compressed output. Updating an encoder may
legitimately create new fingerprints. Review/remove superseded assets explicitly.
Source catalogues, source GeoJSON and their builders are never rewritten.

Unit tests check byte-exact round trips, unchanged source/catalogue hashes, URL
fingerprints, size budgets, both loader choices, cancellation and failure. The
real Worker smoke test verifies HTTP-decoded hashes, exact wire sizes/hashes,
HEAD and ETag revalidation. This catches delivery errors that a mocked fetch or
plain Vite server cannot expose.

Browser tests cover owner/shared routes on Chromium and mobile WebKit, gzip
fallback with a failed download/retry, and a real Chromium cache hit. The normal
network checks throttle only the largest Brotli file and largest gzip file to
1 Mbps plus 150 ms latency, with code warm and map caching disabled; they require
exact asset transfer size and readiness within 20 seconds. The exhaustive map
flag expands that check to all four maps in both formats. Plain Vite's test-only
middleware mirrors delivery headers; the separate Worker smoke test exercises
Cloudflare's actual encoding behaviour.

The local Chromium run on 28 September 2026 measured 4,974 ms for Côte de
Beaune-Villages Brotli (564,905 transferred bytes) and 7,529 ms for Chablis gzip
(886,926 bytes), under that code-warm 1 Mbps / 150 ms profile. These are local
measurements, not production or full-cold timings.
