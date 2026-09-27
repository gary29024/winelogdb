# Lightweight regional overviews

Regional wine maps answer where an appellation is situated. They use a separate,
generalised display layer; village and cru maps keep their detailed boundaries.
The regional map shows a light fill, at most eight commune labels, and a modest
zoom limit. Commune navigation and separately published colour sectors remain
available. Partial-coverage warnings and wine identity rules are unchanged.
Only those overview labels and, when needed, the selected commune get DOM
markers; hundreds of hidden markers no longer need repositioning on each move.

## Download comparison

The following sizes are bytes. The earlier broad maps already used gzip Geobuf;
for the other regional maps, the report compares against gzip level 9 GeoJSON.
These file measurements are separate from browser transfer timings.

| Map | Earlier download | Overview | Reduction |
| --- | ---: | ---: | ---: |
| Crémant de Bourgogne | 6,553,696 | 463,814 | 92.9% |
| Bourgogne | 3,603,062 | 241,456 | 93.3% |
| Coteaux Bourguignons | 3,409,607 | 233,812 | 93.1% |
| Bourgogne Aligoté | 2,941,992 | 227,465 | 92.3% |
| Mâcon | 1,340,715 | 118,746 | 91.1% |
| Mâcon-Villages | 899,520 | 56,385 | 93.7% |
| All 49 regional maps | 28,599,899 | 2,056,718 | 92.8% |

The largest uncompressed overview is 525,461 bytes. Browsers without native
gzip support use that equivalent binary format. Downloads remain lazy and
cancellable, with explicit retry and a 20-second budget. Failed requests do not
start a larger fallback transfer. The original Crémant 120-second safeguard
remains in its audit catalogue but is no longer the regional UI's download path.

## Geometry and provenance

`build_burgundy_regional_overviews.py` reads the already-reviewed regional
GeoJSON files. It does not edit their coordinates, catalogue metadata, source
builder, or exact source-geometry gates. Source and catalogue hashes are stored
in `burgundy-regional-overview-report.json`, alongside the derived asset hash,
sizes and per-feature geometry diagnostics.

Display generalisation happens in EPSG:2154 metres. A 5 cm grid removes numerical
slivers, then topology-preserving simplification uses a tolerance based on the
map's extent, capped at 30 metres. Holes smaller than four times the squared
tolerance may be omitted. The published overview uses a six-decimal grid.
Tolerance is reduced automatically when the display gates fail.

The checks use the geometry decoded from the published binary, requiring:

- Valid, non-empty polygons; unchanged feature IDs, scope, colour-sector and
  partial-coverage properties; original source area figures remain metadata.
- Less than 5% net area change and 12% symmetric difference from the detailed
  source. These are **display-only budgets**, not new source-accuracy limits.
- Every source part at least as large as the small-hole threshold still
  intersects the overview; bounding extent moves by no more than twice the
  tolerance plus one metre.
- Significant exclusion interiors remain open, with a 1.5-tolerance margin for
  generalised edges. Eligible islands within exclusions are accounted for.
- Every producing commune's source anchor stays within twice the tolerance plus
  one metre of the overview. Source sectors stay within their containing overview.

The UI explicitly identifies the map as a generalised overview. Small gaps and
edges are not parcel evidence, and the display does not identify a wine's plot.
Do not calculate vineyard acreage from the derived layer.

## Rebuild and validation

Use the pinned packages in `scripts/burgundy-map-requirements.txt`. After any
canonical regional data change, run the existing source builder followed by:

```sh
python -B scripts/build_burgundy_regional_overviews.py
```

The builder writes 98 binary assets, a lazy overview registry and an audit report
only after every map validates. Repeated builds must have identical output.
Unit tests cover all 49 maps, source freshness, decoding, identity metadata,
label limits and download limits. Existing detailed map tests remain intact.

The normal browser run still measures the largest actual regional overview at
1 Mbps with browser caching disabled and code warmed separately. Scheduled or
manual exhaustive runs cover every regional overview. Desktop and mobile
journeys retain partial scope, sector selection, retries and older-browser
fallback checks. The smaller files reduce the real transfer and rendering work;
the slow-connection test is retained.

Local validation on 28 September 2026: all 5,251 unit/component/integration
tests pass, as do lint and the production build. The complete map browser suite
passed 109 cases across Chromium and mobile WebKit; after the final label and
sidebar refinements, all 45 selected regional cases passed again. The remaining
cases in those runs are intentional matrix or Chromium-only throttling skips.
An additional exhaustive Chromium run passed all 49 throttled overview downloads
and both Bourgogne owner/shared cases (51 tests in 1.3 minutes).
All 98 assets and the registry were byte-identical across two builds.

Crémant measured **4,426 ms to map-ready for 463,814 bytes** at 1 Mbps and
150 ms latency, with browser caching disabled and application code warmed.
PR #370 recorded 54.38 seconds for the earlier 6,553,696-byte asset under the
same network settings. These are measurements from separate runs, not a
full-cold production benchmark. CI job wall time also includes setup and other
tests, so the transfer saving is not a claim about total CI time.

Related: [map optimisation #363](https://github.com/gary29024/winelogdb/issues/363).
Village/cru transport optimisation and production cache/header measurements
remain separate work.
