# Grand Cru historical extension (#461)

The shared history pipeline covers all 33 Burgundy Grand Crus in issues #376–#408,
using eight commune bundles. Each cru has its own register, source coverage and
lazy app evidence. The [independent audit](../../scripts/grand-crus/reports/history-rollout-audit.md)
links every delivery and records the complete raw-source cross-checks and payload
sizes. This supplies the history basis for each Tier 1 issue; 29 cru registers
still await their Tier 1 named-area and commune-edge review,
so they stay off the app's maps. [Richebourg](richebourg/README.md) now has its
commune audit, two reviewed named areas and Tier 1 results; producer research
remains separately deferred to Tier 2. The independent history audit
checks every cru's current geometry against the raw commune source. The four
app-visible crus retain their reviewed commune and named-area audit gates.

## Pinned coverage

The [2026-10-01 source inventory](../../scripts/grand-crus/sources/inventory-2026-10-01.json)
contains 451 obtained resources and two failed earlier-bulletin PDF downloads.
The dated catalogue snapshots, their UTC retrieval times and hashes are under
`scripts/grand-crus/sources/catalogues/2026-10-01/`. Raw source files and PDFs stay
in the ignored `.tmp/grand-cru-sources/shared/` cache. Metadata records logical
resource size/hash, archive member, schema, licence and source URL. HTTP transport
compression has separate size/hash metadata when it differs from the resource.
An as-of date is retained separately from the publisher's release date; unknown
release dates remain null.

| Source | Obtained coverage | Meaning of its dates |
| --- | --- | --- |
| Official DGFiP DFI | Complete July 2026 members `dfiano-dep210-01072026.txt` and `dfiano-dep890-01072026.txt`, plus January 2025 schema | Document validation, not creation, conveyance or commencement of farming |
| Legal-entity non-built parcel rights | Every catalogue-listed annual member, 2019–2025, independently for departments 21 and 89 | Rights recorded on 1 January; private-person ownership is absent |
| Etalab commune cadastre | All 35 published vintages from 2017-07-06 through the pinned 2026-06-01 geometry, for all 12 INAO communes | Observations of references and geometry, not creation dates |
| Lieux-dits and rights schema | Twelve current commune resources and the 2025 rights schema | Cadastral context; no automatic crosswalk to named vineyard areas |
| Regional DVF+ | Complete BFC 2026-1 archive, covering both departments; official open-data catalogue interval 2014-01-01–2025-12-31 | Original deed date; observed dataset/commune dates are reported separately |
| Administrative notices | Obtained Côte-d'Or departmental 2016–2020 and regional 2019–2026 indexes, plus partial Internet Archive indexes for Côte-d'Or 2004–2015 and Yonne 2008–2026; page-image-reviewed references only become evidence | Act dates stay separate from bulletin publication years; impossible printed dates stay unresolved |

September 2026 cadastre is listed as after the pinned map date. It is not silently
substituted into the current map. No annual rights release before 2019 or after
2025 is listed in the pinned catalogue. The inventory discovers dated releases
rather than imposing those years as permanent bounds.

The [independent notice availability audit](../../scripts/grand-crus/sources/notice-coverage-2026-10-04.json)
locates earlier official publications (Côte-d'Or 2004 and Yonne 2008), records
failed endpoints, the archived captures actually obtained, and the remaining
unsearched intervals. Neither department's absolute earliest notice year is
established. The Côte-d'Or regional index is never applied to Yonne. Access
failures, missing captures and unsearched years do not establish absence of a
record. Search results locate publications; they do not stand in for an obtained
or reviewed PDF.

The [2 October acquisition retry](../../scripts/grand-crus/sources/catalogues/2026-10-02/notices-acquisition.json)
queued Côte-d'Or 2004–2015 and Yonne 2008–2026 independently in the shared archive.
One annual listing and one located PDF were requested per department; all four
connections closed without a response. The remaining 29 annual paths were deferred
by the persistent host cooldown and remain unattempted discovery targets. No new
listing, PDF, extracted page or image-reviewed notice was obtained. HTTP/1.1,
alternate official URL forms, web fetch and the in-app browser also failed.
The 1 October inventory and availability audit remain unchanged.

The same day, the earlier bulletins were obtained instead from [Internet Archive
captures](earlier-bulletins/README.md) of the official prefecture URLs. The live
hosts refused every connection, including from a French exit. The raw captured bytes are stored
under their original official URLs, with the exact capture recorded. Coverage is
partial and uneven: Côte-d'Or yielded 105 PDFs (5,929 pages) across 2004–2006, 2008,
2010, 2011, 2013 and 2015, with nothing for 2007, 2009, 2012 or 2014. Yonne yielded
1,202 PDF source URLs (36,183 pages) for every year 2008–2026, but 1,286 queued URLs
remained missing or unusable. Every page was text-extracted or OCRed and searched for each Grand Cru
commune, its climats and reachable references. The pages that print a candidate
parcel were then read as page images:

- Côte-d'Or: eight farm-structure decisions dated 2009–2013 print parcel references in
  Grand Cru communes (58 rows). Before 2009 the decisions name communes and areas
  only; twelve of these are kept as commune-level context, never parcel evidence.
  Two decisions print impossible dates ("15 février 203"; "3 décembre 2013" in a
  bulletin of 31 January 2013). Their act date stays null, and their direct and
  ancestor matches are withheld as `notice-act-date-unresolved` rather than corrected.
- Yonne: no farm-structure decision prints a Chablis parcel reference. Two aerial-spraying
  derogations for Soufflet Vigne (DDT/SEEP/2012/0018 and 2013/0011) list Chablis
  Grand Cru parcels by section, number, lieu-dit and surface. Their annex rows are
  parsed from the text layer and must reproduce the image-read printed totals. A
  derogation is a treatment authorisation: it never establishes ownership, a lease
  or who farmed a parcel.

All 33 notice histories, registers and lazy evidence files were regenerated with
these indexes and the dated archive-acquisition audit, retaining every earlier reviewed
record and coverage gap.

The [4 October retry and rebuild](earlier-bulletins/retry-report-2026-10-04.json)
rechecked 1,406 missing URLs and recovered 55 source URLs representing 37 new
distinct PDFs. Exact capture timestamps and original URL spellings recovered files
whose nearest-capture requests had failed. A [Common Crawl search](earlier-bulletins/commoncrawl-report-2026-10-04.json)
of all 128 crawls then recovered 11 complete PDFs. A further 97 URLs exist there only as copies
truncated at 1 MiB and stay missing. The rebuilt earlier indexes now contain
112 Côte-d'Or and 1,261 Yonne PDF source URLs, with 44,907 fully extracted pages
and no pending or failed OCR pages. Byte-identical aliases retain separate source
citations. There are still 1,340 unresolved URLs. The updated coverage audit and
all 33 notice histories retain the existing image-reviewed parcel readings; new
search candidates are not automatically promoted to reviewed evidence.

## Correspondence and evidence rules

`grand_cru_filiation.py` parses the schema's semicolon-separated, fixed-width
fields. It pairs consecutive mother/daughter rows into complete document/analysis
lot groups and retains all references, raw source lines, document type and
validation date. Identical duplicate rows are audited; conflicting or malformed
groups remain unresolved. Missing pairs, invalid references/dates, cycles,
chronology conflicts, non-cadastral origins and public-domain exits have explicit
outcomes. Rural consolidation correspondence is unavailable in this source.

Every current parcel has a recursive ancestry trace with all intermediate
references, full reference/event paths, dated support and terminal reasons. Group
members outside the cru remain historical context and never enter the current
map. Complete many-to-many groups are preserved; they do not assert a one-to-one
correspondence. Actual raw anchors include Échezeaux D0327 → D0736/D0737 on
1991-01-22 and Vougeot A0022 → A0408/A0409/A0410 on 1989-04-20. A0409 is retained
in that group even though it is outside Clos de Vougeot.

Official DFI takes precedence over spatial inference. The fallback compares
consecutive obtained vintages of the same commune: a successor must first appear
in the next vintage and lie at least 95% inside the retired reference. Existing
neighbours, boundary slivers, later appearances and sub-threshold overlaps are
rejected candidates. Retired intermediate references are traced too. Conflicts
with DFI stay unassigned. Invalid historical polygons require review if their
bounds touch the cru; they are never silently repaired. The invalid current
Ladoix reference `21480000AM0169` has disjoint bounds from all three Corton parents
and is recorded in the bundle report without changing any current geometry.

Rights, DVF groups and reviewed notices are searched again for reachable former
references. Their original reference, date, stated area, group members and source
stay attached, together with every supported route to a current parcel. Merge,
many-to-many, partial-area, date-conflict and otherwise ambiguous records remain
unassigned context. Collective notice tables without row-level commune attribution
also remain unassigned; a holder's other row cannot supply the missing commune.
OCR candidates stay outside reviewed evidence until their source page is read.

Names alone do not prove identity. A nine-digit, nonzero SIREN with valid control
digits supports comparison of recorded legal entities, without proving registry
existence or farming. No ancestor's right, notice applicant or former operator
is automatically transferred to a descendant. Every delivery retains zero
confirmed current farmers.

## Reproduce the pinned delivery

Use Python 3.12 with `shapely==2.1.2` and `pyproj==3.7.2` to reproduce the committed
gzip measurements as well as the data. From the
repository root, obtain the inputs before running geometry/history checks:

```sh
python -m pip install shapely==2.1.2 pyproj==3.7.2
python scripts/inventory_grand_cru_sources.py --all --stamp 2026-10-01
python scripts/inventory_grand_cru_aux_sources.py --stamp 2026-10-01
python scripts/download_grand_cru_sources.py --all
python scripts/build_grand_cru_history_rollout.py --check
```

Inventory reruns reuse verified bytes and their original exact UTC retrieval
times. An existing failed attempt is retained unless `--retry-missing` is
specified. The pinned catalogue date is immutable: changed catalogues or source
identities fail visibly rather than rewriting provenance. On a fresh cache the
URLs are fetched again and new retrieval times must be reviewed; reproducing
historical retrieval times requires preserving the original cache metadata.

Resume the earlier departmental queue without resetting its cooldowns:

```sh
python scripts/pull_grand_cru_notice_bulletins.py --limit 10
```

Use `--departments 21` or `--departments 89` for one department. The default mutable
report is `.tmp/bulletin-archive/manifests/grand-cru-earlier-notices.json`; preserve a
new dated snapshot after reviewing any successful acquisition. Saved annual HTML
supplies linked PDFs, but child listings, missing publications and the meaning of
each year still require review. Only new indexes and source-page image readings
can expand obtained notice coverage. Do not apply the existing Côte-d'Or indexes
to Yonne, or overwrite either pinned catalogue date when resuming this queue.

While the live hosts stay unreachable, the archived captures are the reproducible
route. See the [earlier-bulletin README](earlier-bulletins/README.md) for each step:

```sh
python scripts/pull_wayback_bulletins.py pull --sources docs/research/earlier-bulletins/sources.json
python scripts/build_earlier_bulletin_reviews.py --department cote-dor --check
python scripts/build_earlier_bulletin_reviews.py --department yonne --check
```

The rollout command uses local pinned inputs only. It checks current parcel
assets once per bundle, then each cru's rights, sales, notice history, register
and app evidence. Finally it checks the generated app registry and independently
audits the raw bytes, unchanged geometry, complete DFI sets, current holder/right
sets, paths and source coverage. Remove `--check` to regenerate. `--bundle <id>`
limits work to a shared bundle; rerun the global registry/audit after such edits.
`--history-only` limits output to the rights/history files.

The register and app evidence can be checked in CI without raw downloads:

```sh
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
cd scripts
python -m unittest test_grand_cru_research test_grand_cru_config test_grand_cru_rights_history test_grand_cru_filiation test_grand_cru_source_inventory test_grand_cru_spatial_lineage test_grand_cru_notice_history test_grand_cru_sale_records test_grand_cru_history_rollout test_build_earlier_bulletin_reviews test_pull_wayback_bulletins test_pull_commoncrawl_bulletins
```

For a new catalogue date, run the source inventory with a fresh `--stamp`, review
release/schema changes and gaps, then pin with `--pin`. A new DFI schema must be
reviewed and supported by the parser before building. The auxiliary DVF release
and its independent catalogue must be updated together; its catalogue dates
cannot be inferred from the rights or geometry catalogue.

## Continue a Tier 1 cru issue

Use its existing `scripts/grand-crus/<slug>.json`, bundle and
`docs/research/<slug>/curation.json`. Preserve INAO identity and every listed
commune, including cross-commune parents. The initialization/configuration helpers
only create missing cru material; they do not overwrite reviewed curation.
Review named areas and producer/notice research in that cru's curation, resolve
source gaps when sources become accessible, and regenerate the register and
evidence together. Complete the remaining issue-specific acceptance before
closing that issue. A historical extension does not complete a named-area
crosswalk or producer investigation.

The evidence panel shows each former-reference record's original scope (for example every
parcel in a deed together) and whether a route is an official DGFiP record or a map-overlap
inference. App evidence schema 2 adds optional date roles, original-scope paths, per-parcel
tracing and per-parent coverage while retaining the existing source/parcel/holder
fields. Configured `evidenceFrom` fallbacks still merge sources in order. Only crus
with a committed commune-edge audit are wired into the app; each evidence file is a
dynamic import, and browser checks ensure a cru fetches only its configured evidence.
The other 29 crus' history files are complete but stay off the maps until their audits. The map, manual producer association and verified
farming gates remain available to subsequent Tier 1 work.

After `npm run build`, run `python scripts/measure_grand_cru_payload.py` to produce
the [production payload report](../../scripts/grand-crus/reports/history-payload.json).
It measures the app-visible parcel assets and compiled evidence chunks and checks
that neither the initial page nor the map's static imports include history.
CI runs it after each selected production build, so a history chunk leaking into
those imports fails the build. The recorded sizes are refreshed rather than
compared, because builds are not byte-reproducible without a lockfile. The register audit's
gzip counts measure source JSON; the production report measures compiled JS.
