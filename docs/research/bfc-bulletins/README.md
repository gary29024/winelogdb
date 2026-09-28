# Côte-d'Or notices in the BFC administrative bulletins

A reusable index of every Côte-d'Or DDT notice in the Bourgogne-Franche-Comté regional *recueils des actes administratifs*, 2019–2026. The farm-structure notices among them (applications and decisions on who may farm which cadastral parcels) are the only public source that names applicants, previous operators and exact parcel references. The index was built for the Échezeaux farming research and is meant to be reused for every grand cru.

## Files

| File | What it holds | Edited by |
| --- | --- | --- |
| `links-YYYY.txt` | Every bulletin PDF link for the year, from the prefecture's listing page | Hand (see *Adding a year*) |
| `coverage.json` | Every bulletin checked: hash, page count, whether its contents list was read, how many Côte-d'Or notices it holds, failed downloads | Generated |
| `notices.json` | One row per Côte-d'Or DDT notice: bulletin and pages, act ID and date, applicant, a title-derived kind, and OCR hints (communes mentioned, parcel references) | Generated |
| `notice-text.jsonl.gz` | The text of each notice's pages (text layer or OCR), one JSON line per notice | Generated |
| `reviewed-parcels.json` | Parcel references read from a notice **and checked against the page image** | Hand, validated by the builder |
| `cote-dor-communes.json` | INSEE code → DGFiP commune name, used to detect commune mentions | Generated once from the pinned DGFiP 2025 file |

## How it was built

Each bulletin starts with a machine-readable contents list naming the issuing service, the act and its page. [`scripts/scan_bfc_bulletins.py`](../../../scripts/scan_bfc_bulletins.py) downloads each PDF, reads the contents list, and reads only the acts listed under the Côte-d'Or DDT (OCR at 110 dpi for scanned pages). A bulletin without a readable contents list is read in full. [`scripts/build_bfc_bulletin_index.py`](../../../scripts/build_bfc_bulletin_index.py) turns the scan cache into the generated files; `--check` validates the committed files without the cache.

## Using it for another cru

1. Filter `notices.json` for `farmStructures` notices whose `communesMentioned` include the cru's commune (INSEE code), or search `notice-text.jsonl.gz` for the commune name and section.
2. Open the bulletin PDF at `firstPage` and read the parcel list from the image. OCR misreads references (D558 came out as "DSS8") and tables.
3. Add each checked reference to `reviewed-parcels.json` with its status. Only reviewed rows may feed a research register.

## Limits

- **An application or decision is not farming.** A receipt of a complete application explicitly does not authorise cultivation; an authorisation still needs confirmation of actual operation, and the notices say nothing about later seasons.
- **Coverage.** Only the regional bulletins, only acts filed under the Côte-d'Or DDT. Decisions published elsewhere (departmental bulletins, notices posted in town halls) are not included. Operations that need no authorisation often leave no notice at all.
- **OCR hints.** `communesMentioned` also catches addresses (every DDT letter mentions Dijon) and `referenceHints` includes misreadings. Treat both as search aids.
- **Scope of an authorisation.** Some decisions list several communes without assigning each parcel row, and printed areas can differ from the cadastral area (partial parcels or errors). Record the ambiguity; do not resolve it by guesswork.

## Adding a year

The prefecture's listing pages refuse automated clients (Cloudflare), while the PDFs download normally. Open [the listing page for the year](https://www.prefectures-regions.gouv.fr/bourgogne-franche-comte/Documents-publications/Recueils-des-actes-administratifs) in a browser, save it, extract every `recueil-bfc-*.pdf` link into `links-YYYY.txt`, then run:

```sh
python scripts/scan_bfc_bulletins.py docs/research/bfc-bulletins/links-YYYY.txt   # needs curl, poppler-utils, tesseract-ocr-fra
python scripts/build_bfc_bulletin_index.py
```

A bulletin whose download fails is recorded as `download-failed`; rerunning the scan retries it and resumes partial downloads.
