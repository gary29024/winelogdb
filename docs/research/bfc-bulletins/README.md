# Côte-d'Or notices in the BFC administrative bulletins

A reusable index of every Côte-d'Or DDT notice in the Bourgogne-Franche-Comté regional *recueils des actes administratifs*, 2019–2026. The farm-structure notices among them (applications and decisions on who may farm which cadastral parcels) are the only public source that names applicants, previous operators and exact parcel references. The index was built for the Échezeaux farming research and is meant to be reused for every grand cru.

## Files

| File | What it holds | Edited by |
| --- | --- | --- |
| `links-YYYY.txt` | Every bulletin PDF link for the year, from the prefecture's listing page | Hand (see *Adding a year*) |
| `coverage.json` | Every bulletin in the link lists, with hash, page count, Côte-d'Or notice count, failed pages and a status: `contents-read`, `full-ocr-no-contents`, `extraction-incomplete`, `download-failed` or `not-scanned` | Generated |
| `notices.json` | One row per Côte-d'Or DDT notice: bulletin and pages, act ID and date, applicant, a title-derived kind, and OCR hints (communes mentioned, parcel references) | Generated |
| `notice-text.jsonl.gz` | Each notice's page text with a per-page extraction status (`text-layer`, `ocr`, or `failed:<step>`), one JSON line per notice. A blank separator page is extracted and empty; a failed page is labelled | Generated |
| `reviewed-parcels.json` | Parcel references read from a notice **and checked against the page image** | Hand, validated by the builder |
| `cote-dor-communes.json` | INSEE code → DGFiP commune name, used to detect commune mentions | Generated once from the pinned DGFiP 2025 file |

## Contents

All 1,277 regional bulletins for 2019–2026 (to the end of September 2026) were checked; none failed to download. 268 contain Côte-d'Or DDT notices, 1,411 in total, of which about 1,120 concern farm structures. Farm-structure notices appear regularly only from 2021; earlier ones were probably published in the Côte-d'Or departmental bulletins, which are not included. One bulletin (bfc-2019-052) has no readable contents list; it was read in full and is kept as a single whole-bulletin entry.

## How it was built

Each bulletin starts with a machine-readable contents list naming the issuing service, the act and its page. [`scripts/scan_bfc_bulletins.py`](../../../scripts/scan_bfc_bulletins.py) downloads each PDF, reads the contents list, and reads only the acts listed under the Côte-d'Or DDT (OCR at 110 dpi for scanned pages). A bulletin without a readable contents list is read in full. Every extraction step's exit status is checked. A page whose OCR fails is recorded as `failed:<step>`, keeping any text-layer output, and its bulletin is marked incomplete and retried on the next run, so a failure can never pass as "no match". Downloads run one at a time per host, paced by `--min-interval` and backing off on throttling (HTTP 429/503 with `Retry-After`, HTTP/2 `ENHANCE_YOUR_CALM`); OCR runs in parallel. PDFs of bulletins with Côte-d'Or notices or failed pages are kept in `.tmp/bfc-bulletins/pdf/` (outside Git) for visual review and re-OCR; others are deleted unless `--keep-all-pdfs` is given.

[`scripts/build_bfc_bulletin_index.py`](../../../scripts/build_bfc_bulletin_index.py) reconciles the link lists with the scan cache and writes the generated files. `--check` runs offline and verifies that every listed URL has a coverage status, the summary counts, that each notice belongs to a read bulletin and has every page with a status, and that reviewed parcels cite their notice's act ID and date.

## Using it for another cru

1. Filter `notices.json` for `farmStructures` notices whose `communesMentioned` include the cru's commune (INSEE code), or search `notice-text.jsonl.gz` for the commune name and section.
2. Open the bulletin PDF at `firstPage` and read the parcel list from the image. OCR misreads references (D558 came out as "DSS8") and tables.
3. Add each checked reference to `reviewed-parcels.json` with its status. Only reviewed rows may feed a research register.

## Limits

- **An application or decision is not farming.** A receipt of a complete application explicitly does not authorise cultivation; an authorisation still needs confirmation of actual operation, and the notices say nothing about later seasons.
- **Coverage.** Only the regional bulletins, only acts filed under the Côte-d'Or DDT. Decisions published elsewhere (departmental bulletins, notices posted in town halls) are not included. Operations that need no authorisation often leave no notice at all.
- **OCR hints.** `communesMentioned` also catches addresses (every DDT letter mentions Dijon) and misses misread names ("FLAGEV-ECHEZEAUX"); `referenceHints` only covers references printed after a commune name or in area tables, and includes misreadings. Treat both as search aids and search the full text as well, allowing for OCR variants.
- **Scope of an authorisation.** Some decisions list several communes without assigning each parcel row, and printed areas can differ from the cadastral area (partial parcels or errors). Record the ambiguity; do not resolve it by guesswork.

## Adding a year

For persistent acquisition, offline search and the **Côte-d'Or departmental 2016–2020**
queue, use the [shared archive workflow](../cote-dor-bulletins/README.md). The scanner's
`--archive-dir` mode uses that archive's persistent host cooldown and retained PDF objects;
`--offline` separates extraction from all network access.

The prefecture's listing pages refuse automated clients (Cloudflare), while the PDFs download normally. Open [the listing page for the year](https://www.prefectures-regions.gouv.fr/bourgogne-franche-comte/Documents-publications/Recueils-des-actes-administratifs) in a browser, save it, extract every `recueil-bfc-*.pdf` link into `links-YYYY.txt`, then run:

```sh
python scripts/scan_bfc_bulletins.py docs/research/bfc-bulletins/links-YYYY.txt   # needs curl, poppler-utils, tesseract-ocr-fra
python scripts/build_bfc_bulletin_index.py
```

A bulletin whose download fails is recorded as `download-failed` with its attempt count, and one with failed pages as `extraction-incomplete`; rerunning the scan retries both and resumes partial downloads. For a throttled host such as the Côte-d'Or departmental site, add `--min-interval 150`.
