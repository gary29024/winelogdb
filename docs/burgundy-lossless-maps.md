# Lossless detailed map downloads

The fourteen largest detailed Burgundy maps now have precompressed Brotli and gzip
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
| Meursault | 991,883 | 373,359 | 86,492 | 76.8% |
| Santenay | 966,834 | 362,157 | 83,307 | 77.0% |
| Marsannay | 872,497 | 329,123 | 98,920 | 69.9% |
| Beaune | 860,567 | 319,361 | 93,030 | 70.9% |
| Montagny | 786,748 | 286,452 | 133,156 | 53.5% |
| Saint-Aubin | 764,178 | 277,590 | 56,377 | 79.7% |
| Savigny-lès-Beaune | 719,478 | 268,553 | 58,373 | 78.3% |
| Viré-Clessé | 718,547 | 268,272 | 109,149 | 59.3% |
| Givry | 740,101 | 265,703 | 131,654 | 50.5% |
| Chassagne-Montrachet | 742,174 | 263,189 | 81,508 | 69.0% |

The first four maps were introduced in #372. The next ten complete the detailed
maps above 250 KB gzip-equivalent in the inventory. Bourgogne Hautes Côtes de
Beaune, the regional entry in the original second-priority list, already uses
the regional overview from #371.
Together the ten new Brotli files total 931,966 bytes versus 3,013,759 bytes at
gzip level 9 (69.1% smaller). The four pilot assets retain their exact bytes and
URLs. All 44 canonical source and catalogue hashes remain unchanged.

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
flag expands that check to all fourteen maps in both formats. Plain Vite's test-only
middleware mirrors delivery headers; the separate Worker smoke test exercises
Cloudflare's actual encoding behaviour.

Routine CI keeps the pilot's four owner/shared download cases and adds Meursault
and Montagny, the largest new gzip and Brotli assets respectively. It retains the
two existing slow-network checks. Every enabled map has exact unit and real
Worker wire/decode checks. Scheduled/manual exhaustive Chromium CI covers every browser
case and format; the registry completeness guard prevents silently omitting a
new map from that matrix.

For a focused, reproducible Chromium and mobile WebKit run, use
`npx playwright test --config playwright.burgundy.config.ts`. Set
`WINELOG_E2E_EXHAUSTIVE_MAPS=1` to cover every enabled map on owner/shared routes
and every throttled format. The JSON report includes per-map transfer bytes and
readiness timings at `.cache/test-reports/burgundy-browser.json`. Other map
interaction regressions remain in `tests/e2e/burgundy-village-map.spec.ts`.

The local Chromium run on 28 September 2026 measured 4,974 ms for Côte de
Beaune-Villages Brotli (564,905 transferred bytes) and 7,529 ms for Chablis gzip
(886,926 bytes), under that code-warm 1 Mbps / 150 ms profile. These are local
measurements, not production or full-cold timings.

The next ten maps were all exercised under the same profile in both formats:
Brotli readiness ranged from 973 to 1,549 ms, and gzip from 2,428 to 3,506 ms.
Their measured response body sizes matched the files exactly. The exhaustive
focused run passed 87 cases (29 Chromium-only checks skipped on WebKit), covering
all fourteen maps on both owner/shared routes and all 28 throttled formats.
