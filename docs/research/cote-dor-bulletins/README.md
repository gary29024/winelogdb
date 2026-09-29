# Persistent archive: Côte-d'Or departmental bulletins, 2016–2020

The first acquisition target is the five annual listings in [sources.json](sources.json).
This is separate from the [BFC regional index](../bfc-bulletins/README.md): regional
coverage does not establish departmental coverage. The 2019 listing states that
bulletins 26 and 72 do not exist; they are documented publication gaps, not failed downloads.

## Acquire and resume

Use one stable directory outside Git across every checkout. Python 3.11+ is sufficient
for acquisition, importing saved listings and searching existing text. Example in PowerShell:

```powershell
$env:WINELOG_BULLETIN_ARCHIVE = 'E:/Github/winelogdb/.tmp/bulletin-archive'
python scripts/pull_cotedor_bulletins.py --years 2016 2017 2018 2019 2020 --limit 10
python scripts/bulletin_archive.py status
```

Repeat the pull command to continue. The five listings were captured on 29 September
2026 (Taipei time), yielding **61, 63, 73, 78 and 97 PDF URLs** respectively: **372 total**.
The checked-in `links-YYYY.txt` files and capture hashes let a fresh archive seed those
queues without reopening the listing pages. Five further 2018 bulletins (4, 5, 6, 7 and
28) use Nextcloud share links: **377 document references** altogether. These alternate
links are tracked as `needs-resolution` until their PDF download can be resolved. The
listed host `transnum-nextcloud.ac-dijon.fr` failed DNS resolution during acquisition;
these are not silently omitted or counted as downloaded. `--refresh-listings` deliberately recaptures
them. Locally saved HTML has status `saved`; a captured URL manifest imported from the
repository has status `saved-manifest`, with capture provenance in `sources.json`.
Each run makes at most `--limit` PDF attempts; listing refreshes are additional requests.
Increase the batch limit once access is working. Downloads are
serial, with a default three-second gap as a conservative starting setting, not a
claimed site policy. `--min-interval` can increase that gap. A 429/503 `Retry-After`
(seconds or HTTP date), connection failure or other transient error establishes a
shared, persistent host cooldown with bounded exponential backoff and jitter. Restarting
the script does not reset it. By default, waits longer than five seconds are left pending.
The command does not install a background service or schedule future runs.

For an unattended acquisition in one process, add `--until-complete --max-runtime 21600`.
It continues eligible downloads through cooldowns for up to six hours, writes progress
to `run-status.json`, and stops when the eligible queue finishes or the runtime expires.
Manifest and status writes use atomic replacement with bounded retries for temporary
file locks. A failed manifest export leaves the previous complete file intact, logs the
error and retries while preserving acquisition progress in SQLite. Unexpected job errors
are recorded as `failed` when the status file is writable. A forcibly killed process
cannot update its status: check the recorded PID and `updatedAt` before treating `running`
as evidence that it is still alive.
`finished` can still include blocked or unresolved links; inspect the year manifest.
Rerun the same command after interruption or runtime expiry to continue. The flag does
not install an automation or send notifications.

The archive's `manifests/cote-dor-2016-2020.json` records listing status, discovered and
downloaded counts, source URLs, hashes, failures and known gaps. The adjacent
`cote-dor-YYYY.txt` files can be passed to the extractor. A listing that failed or has
not been read is never reported as complete. All documents means all PDFs linked by
the successfully captured annual listings, not a guarantee that every historical act
was published there. Search-engine snippets alone do not establish a complete listing.

If the site works in an ordinary browser, save the annual page as HTML and import it:

```powershell
python scripts/bulletin_archive.py discover saved-2020.html --source-url 'https://www.cote-dor.gouv.fr/Publications/Recueils-des-Actes-Administratifs/Recueils-des-actes-administratifs-des-annees-anterieures/Recueils-des-actes-administratifs-2020' --corpus cote-dor-2020
python scripts/pull_cotedor_bulletins.py --limit 10
```

Saved HTML, its source URL, capture time and hash are retained. A downloaded PDF can
also be imported with `import-pdf URL PATH --corpus cote-dor-2020`. No outreach or
access to a private archive is performed. Connection resets and HTTP/2 protocol errors
are recorded as access failures; they are not evidence of an HTTP rate-limit response.

## Retention and integrity

- PDFs are stored under `objects/<hash-prefix>/<SHA-256>.pdf`. Identical files share
  one object; same-name PDFs at different URLs cannot overwrite each other.
- Originals are retained indefinitely. There is no automatic eviction. Back up the
  entire archive directory, including `archive.sqlite3`, `objects`, `listings` and
  `partials`; do not commit the archive to Git.
- An OS-held acquisition lock prevents concurrent downloaders from bypassing pacing.
  SQLite retains URL provenance, status, attempts, validators and per-host retry times.
- Partial downloads resume only with a strong ETag and matching `Content-Range` and
  validator. A full HTTP 200 replaces the partial file; HTTP error bodies never append
  to it. Without a strong validator the next request restarts the download.
- Length, PDF signature and EOF are checked before publication, and bytes are hashed.
  PDF parsing is a separate extraction step. A pinned-source hash change is blocked
  for review; it does not replace the archived original.
- `verify` checks local hashes and requeues missing/corrupt objects. `fetch-url URL
  --refresh` is the explicit conditional-refresh operation. `retry URL` requeues a
  blocked URL but does not bypass the host cooldown.

## Extract and search locally

Acquisition and extraction are separate, so a machine with OCR tools can work entirely
offline on the archive. Install Poppler (`pdfinfo`, `pdftotext`, `pdftoppm`) and Tesseract
with the French language pack on that machine. Departmental layouts vary, so use a full
page scan instead of the BFC contents-list filter:

```powershell
python scripts/scan_bfc_bulletins.py E:/Github/winelogdb/.tmp/bulletin-archive/manifests/cote-dor-2020.txt --archive-dir E:/Github/winelogdb/.tmp/bulletin-archive --cache-dir E:/Github/winelogdb/.tmp/bulletin-archive/scans --offline --full-text --jobs 4
python scripts/bulletin_archive.py search 'Flagey Echezeaux' --corpus cote-dor-2020
```

Search uses literal, accent-insensitive terms and returns source URL, page, source hash,
extraction status and the local PDF path when available. Failed pages remain explicitly
labelled. Rerunning extraction retries failed pages while retaining successful pages of
the same PDF and extractor version. `--reextract` deliberately replaces cached extraction.
Missing OCR executables are reported as failures rather than empty successful text.

The regional index can be imported separately with `import-index
docs/research/bfc-bulletins`, which runs its strict validator first. Older exports may predate per-page status
tracking. For that original format only,
`--legacy-search-hints` validates URL/page/citation structure and imports text labelled
**legacy-unverified**; it does not invent successful OCR statuses, modify the source
dataset, or establish complete extraction. PDFs are still pending until acquired.

Search results are research leads. Inspect the cited page image and record the printed
commune, reference, date, role and scope before using a notice for parcel identification.
An application or authorisation does not establish who currently farms the parcel.

## Verification

```powershell
python -m unittest discover -s scripts -p '*bulletin*.py'
```

Tests cover restart recovery, hash deduplication, URL collisions, shared cooldowns,
HTTP-date retry instructions, error-body isolation, validated resume and restart,
conditional refresh, pinned-source drift, damaged local objects, acquisition locking,
saved-listing provenance, incomplete year discovery, offline full-text extraction and
retrying only failed pages. They do not contact the government website.
