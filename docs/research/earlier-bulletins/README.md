# Earlier departmental bulletins from archived captures (#461)

The Côte-d'Or (2004–2015) and Yonne (2008–2026) prefecture websites refused every
connection during acquisition on 1–2 October 2026. Every host on their shared platform
sent an empty reply after the TLS handshake, from the home network and from French
and Japanese VPN exits, with curl, Python and the in-app browser. The bulletins were
therefore obtained from **Internet Archive Wayback Machine captures of the official
URLs**. This adds to the pinned
[Côte-d'Or 2016–2020 archive](../cote-dor-bulletins/README.md) and never replaces it.
Côte-d'Or indexes are never applied to Yonne.

## What was obtained

The [4 October acquisition report](acquisition-report-2026-10-04.json) records every listed or
captured document, its state and the gaps. It is pinned by hash in the
[notice coverage audit](../../../scripts/grand-crus/sources/notice-coverage-2026-10-04.json).

| Department | PDF source URLs | Indexed pages | Years with bulletins | Gaps |
| --- | ---: | ---: | --- | --- |
| Côte-d'Or | 112 | 6,147 | 2004, 2005, 2006, 2008, 2010, 2011, 2013, 2015 | Nothing obtained for 2007, 2009, 2012 or 2014; 111 queued URLs remain unresolved, including 96 links in the archived 2013 and 2015 listings (17 listed bulletins are probably obtained as same-filename captures with a matching cover year) |
| Yonne | 1,261 | 38,760 | Every year 2008–2026 | 1,229 queued URLs remain missing or unusable; 2024–2026 have no archived listing |

Archive availability is not publication completeness. Missing captures, missing
listings and unsearched years are unknown coverage, never evidence that no notice
exists. Extraction finished with zero pending or failed pages.

The [4 October retry](retry-report-2026-10-04.json) checked all 1,406 missing URLs
against four publisher-domain capture catalogues. It retried 155 URLs through 157
exact capture requests and recovered 55 source URLs: 37 new distinct PDFs and 18
additional citations to bytes already present or recovered in this run. The
indexes gained 2,640 source-URL pages. Their totals retain byte-identical aliases
as separate citations, rather than counting them as distinct bulletins.

Some nearest-capture requests using a normalised HTTPS URL had returned 404 even
though the catalogue's exact timestamp and original HTTP spelling worked. The
downloader now supports this fallback with `--retry-unavailable`. Other captures
remain unavailable or truncated. No catalogue match is not proof that a bulletin
was never published or captured. The 2 October snapshots remain unchanged.

A paged listing of every Internet Archive capture of both domains' download paths
(21,849 captures, all content types) found no further complete copy: each remaining
match is a capture already tried, most truncated at exactly 1 MiB.

The [Common Crawl report](commoncrawl-report-2026-10-04.json) then searched all
128 Common Crawl crawls (322 host lookups) for the remaining URLs, by listed URL or
the same publisher document ID only. Filename-only matches are not used, because
Yonne names such as `recueil n°4.pdf` repeat every year. Many matching
Common Crawl bodies were truncated at 1 MiB. Older crawls did not flag the truncation,
which shows instead as `Content-Length: 1048576` with a larger
`X-Crawler-Content-Length`. Eleven complete PDFs were recovered and stored with
their exact WARC record: Côte-d'Or 31 May 2005 and ten Yonne 2017 bulletins. The
97 URLs found only truncated stay missing. None of the recovered pages names a
Grand Cru commune in a land or parcel context, so no new page needed image review.
The catalogue results checked in this run yielded no usable copy of the remaining
Yonne 2020, 2021 or 2023 bulletins; this does not establish that no copy exists.

The [6 October local and downloader check](downloader-check-2026-10-06.json)
verified all 11 Common Crawl recoveries against their recorded publisher and WARC
record. A live download reproduced the 31 May 2005 PDF's pinned hash and stored it
successfully in a separate test archive. The prefecture hosts still returned empty
replies; the Wayback catalogue returned 503 and the Common Crawl catalogue closed
its connection. Known Common Crawl record downloads work even when catalogue
discovery is unavailable. The downloader now scopes document IDs to their publisher,
retains all listed URL aliases, initializes a fresh archive and checks that range
responses cover the requested bytes before reading them.

All recovered pages were text-extracted or OCRed and searched for Grand Cru commune
names. Six Côte-d'Or covers were image-read to confirm their 2011/2013 issue dates;
three Yonne screening pages were image-read and supplied no new Grand Cru parcel
attribution. Existing curated parcel readings are retained. Broad search candidates
remain unreviewed. Updated cover dating is in
[`undated-dating-2026-10-04.json`](undated-dating-2026-10-04.json).

## How the captures were found and stored

[`sources.json`](sources.json) is the inventory made by
`scripts/pull_wayback_bulletins.py`:

1. **Annual listings:** the latest Wayback capture of each annual listing page that
   contains PDF links (an early-year capture lists only January). Its raw HTML hash and
   capture timestamp are kept, and its PDF links are percent-encoded as found.
2. **Domain captures:** for years without a listing, bulletin PDFs captured on the
   publisher's current and former (`*.pref.gouv.fr`) domains that carry a date in their
   filename. Undated `RAA_0xx` files are dated only from their own cover page
   ([`undated-dating.json`](undated-dating.json)). Five were byte-identical to the
   pinned 2016 archive and are excluded. One special issue prints only its month.
3. **Alternate spellings:** captures of the same publisher document ID under another
   URL spelling, such as a mis-encoded `sp%EF%BF%BD%EF%BF%BDcial` or a print layout.
   These are tried only when the listed URL has no capture.

Each PDF is stored in the shared archive under its **original official URL**, with
`final_url` set to the exact capture. The raw `id_` bytes must pass the archive's
PDF signature and EOF checks. Captures truncated by the crawler, for example at
exactly 1 MiB, fall back to other captures and are otherwise recorded as
unavailable. HTTP 403, 404 and 410 are marked unavailable until an explicit
`--retry-unavailable` run; other failures stay retryable.

## Indexes and review

`index/` holds the full-page export of `scripts/index_cotedor_bulletins.py` for each
department. It includes coverage, the extracted text of every page, unreviewed contents
entries and broad candidate pages. The Yonne export uses
[`../bfc-bulletins/yonne-communes.json`](../bfc-bulletins/yonne-communes.json),
built from the DGFiP 2025 legal-entity parcel file in the same way as the Côte-d'Or
dictionary.

Every page was searched for each Grand Cru commune, its climats, farm-structure and
land-procedure wording, and the reachable current and former references of all 33
crus. Pages that print a candidate parcel were then read as page images.

**Côte-d'Or** ([`review-decisions.json`](cote-dor/review-decisions.json),
[`reviewed-parcels.json`](cote-dor/reviewed-parcels.json)): eight image-reviewed
farm-structure decisions, dated 2009–2013, print parcel references in Grand Cru
communes. They expand to 58 rows across all of their printed communes. The 2004–2008
decisions name communes and areas only. Twelve whose land lies in a Grand Cru commune
are kept, text-screened, in [`commune-context.json`](cote-dor/commune-context.json),
and are never parcel evidence. Two decisions print impossible dates:

- `15 février 203`, in a bulletin of 2 April 2013;
- `3 décembre 2013`, in a bulletin of 31 January 2013.

Both act dates stay null rather than corrected. The notice history withholds their
direct and ancestor matches as `notice-act-date-unresolved`.

**Yonne** ([`review-decisions.json`](yonne/review-decisions.json),
[`reviewed-parcels.json`](yonne/reviewed-parcels.json)): no Yonne farm-structure
decision prints a Chablis parcel reference. One 2016 decision whose land includes
Chablis is kept as [context](yonne/commune-context.json). Two aerial-spraying
derogations for Soufflet Vigne list Chablis Grand Cru parcels by section, number,
lieu-dit and surface:

| Order | Valid until | Annex rows | Printed total |
| --- | --- | ---: | ---: |
| DDT/SEEP/2012/0018 of 16 May 2012 | 15 August 2012 | 76 | 20.2443 |
| DDT/SEEP/2013/0011 of 22 May 2013 | 19 August 2013 | 63 | 12.6036 |

Their annex rows are parsed from the committed text layer, and the build fails unless
the row count and the sum of printed surfaces, including merged cells, equal the
image-read values. Footnotes limiting treatment near a watercourse, and the 8-are
La Prêle zone, are kept with each decision. A derogation is a treatment authorisation
requested by a services company. It never establishes ownership, a lease or who farmed
a parcel. A third order (2013/0012) refers to an annex that is not published, so it
yields no parcel.

Normalisation follows the 2016–2020 review: shared sections carry forward within a
printed commune group, and a notice total is never divided among parcels. Lettered
sub-parcels (`AD 34j`), slash pairs (`1365/1366`) and section `A2` keep a null reference.
No row is a verified current farmer.

## Reproduce

```sh
python scripts/pull_wayback_bulletins.py inventory --out docs/research/earlier-bulletins/sources.json
python scripts/pull_wayback_bulletins.py alternates --sources docs/research/earlier-bulletins/sources.json
python scripts/pull_wayback_bulletins.py pull --sources docs/research/earlier-bulletins/sources.json
python scripts/pull_wayback_bulletins.py pull --sources docs/research/earlier-bulletins/sources.json --retry-unavailable --limit 20 --report .tmp/wayback-retry.json
python scripts/pull_commoncrawl_bulletins.py scan
python scripts/pull_commoncrawl_bulletins.py recover
python scripts/index_cotedor_bulletins.py --corpus 'cote-dor-200%' cote-dor-2010 cote-dor-2013 cote-dor-2015 cote-dor-undated --output <dir>
python scripts/index_cotedor_bulletins.py --corpus 'yonne-%' --communes docs/research/bfc-bulletins/yonne-communes.json --output <dir>
python scripts/pull_wayback_bulletins.py date --sources docs/research/earlier-bulletins/sources.json --out docs/research/earlier-bulletins/undated-dating.json
python scripts/build_earlier_bulletin_reviews.py --department cote-dor --check
python scripts/build_earlier_bulletin_reviews.py --department yonne --check
```

Downloads are serial with a five-second gap and back off on 429, resets and truncated
reads. Rerunning resumes and never refetches a stored PDF. An inventory rerun can
select a newer listing capture, so review its changes before replacing `sources.json`.
Extraction needs the Poppler and Tesseract builds pinned in
[`../cote-dor-bulletins/extraction-tools.json`](../cote-dor-bulletins/extraction-tools.json).
The original PDFs live in the ignored `.tmp/bulletin-archive`; back it up rather than
committing it.
