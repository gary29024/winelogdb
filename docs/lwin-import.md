# Importing and refreshing the LWIN reference database

WineLogDB stores the Liv-ex Wine Identification Number (LWIN) catalogue once as **global reference data** in D1. It is not duplicated per WineLog user, and refreshing it does not rewrite tasting notes, photos, user corrections, producer research or other personal data.

This runbook covers both the **first LWIN load** and **periodic manual refreshes** while Liv-ex API access is delayed, unavailable or unsuitable. Manual snapshot import is a supported maintenance path. Even after `LWIN Change Since` is automated, an occasional full snapshot remains useful for reconciliation and recovery.

## What the importer does

`npm run lwin:build-import` reads the official LWIN CSV and generates idempotent, chunked D1 SQL. It:

- imports Live, Combined and Deleted rows;
- preserves Combined -> REFERENCE redirects;
- normalises Excel-style identifiers such as `1000131.0` to `1000131`;
- converts blank/`NA` values to NULL where appropriate;
- upserts by stable product key instead of creating duplicates;
- does **not** infer deletion merely because a row is absent from a later snapshot;
- records the source filename, SHA-256 hash, latest source update timestamp and row counts in `wine_reference_sync_state`.

The LWIN workbook and generated SQL are operational data. Do **not** commit them to Git.

## Before importing

The identity migration must already be deployed:

```powershell
npm install
npm run db:migrate
```

The migration creates `wine_reference_products`, `wine_reference_external_ids` and `wine_reference_sync_state`.

### Back up D1 first

Run this before the initial import and before every later full refresh:

```powershell
New-Item -ItemType Directory -Force backups | Out-Null
$stamp = Get-Date -Format "yyyy-MM-dd-HHmm"
npx wrangler d1 export DB --remote --output "backups/winelog-$stamp.sql"
```

Keep the backup until the new reference snapshot has been verified.

## 1. Download the official LWIN workbook

Download the latest official LWIN database from Liv-ex and keep the original workbook unchanged as the source snapshot.

A useful naming convention is:

```text
LWINdatabase-YYYY-MM-DD.xlsx
```

## 2. Export the LWIN worksheet as CSV UTF-8

The WineLog importer deliberately accepts CSV rather than XLSX so an Excel parser does not become part of the Worker/runtime dependency tree.

In Excel:

1. Open the downloaded workbook.
2. Select the worksheet containing the LWIN records.
3. Choose **File -> Save As**.
4. Choose **CSV UTF-8 (Comma delimited) (*.csv)**.
5. Save it outside the repository or in an ignored local working folder.

Example:

```text
C:\WineLogData\LWINdatabase-2026-09-18.csv
```

Do not rename, remove or reorder the source columns. The importer validates the expected header before producing SQL.

## 3. Generate D1 import files

From the WineLogDB repository root:

```powershell
Remove-Item ".tmp\lwin-import" -Recurse -Force -ErrorAction SilentlyContinue
npm run lwin:build-import -- "C:\WineLogData\LWINdatabase-2026-09-18.csv" ".tmp\lwin-import"
```

The output looks like:

```text
.tmp\lwin-import\
  lwin-0001.sql
  lwin-0002.sql
  ...
  lwin-sync-state.sql
  manifest.json
```

Review the manifest before touching production:

```powershell
Get-Content ".tmp\lwin-import\manifest.json"
```

Check that:

- `accepted` is close to the expected source row count;
- `rejected` is zero, or every rejection is understood;
- `redirected` is plausible for Combined records;
- `latestSourceUpdate` is recent;
- `sha256` is populated.

If there are unexplained rejected rows, stop and inspect the source first.

## 4. Apply the numbered chunks to remote D1

Apply only the numbered data files first:

```powershell
Get-ChildItem ".tmp\lwin-import\*.sql" |
  Where-Object { $_.Name -match '^lwin-\d{4}\.sql
    Write-Host "Applying $($_.Name)..."
    npx wrangler d1 execute DB --remote --file $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "LWIN import stopped at $($_.Name)" }
  }
```

The generated statements are idempotent. If the process stops because of a network or Cloudflare error, fix the problem and rerun the same loop. Successfully applied chunks update the same records instead of duplicating them.

Only after every numbered chunk succeeds, write the completed sync marker:

```powershell
npx wrangler d1 execute DB --remote --file ".tmp\lwin-import\lwin-sync-state.sql"
```

Keeping the state file last prevents an incomplete import from being recorded as complete.

## 5. Verify the import

### Sync status

```powershell
npx wrangler d1 execute DB --remote --command "SELECT source, source_version, source_updated_at, rows_seen, rows_written, rows_redirected, rows_rejected, status, updated_at FROM wine_reference_sync_state WHERE source='lwin';"
```

Expected `status`: `complete`.

### LWIN status counts

```powershell
npx wrangler d1 execute DB --remote --command "SELECT status, COUNT(*) AS records FROM wine_reference_products GROUP BY status ORDER BY status;"
```

These counts should broadly agree with the downloaded snapshot.

### Combined redirect integrity

```powershell
npx wrangler d1 execute DB --remote --command "SELECT COUNT(*) AS broken_combined FROM wine_reference_products WHERE status='Combined' AND (reference_lwin7 IS NULL OR reference_lwin7='');"
```

Expected result: `0`.

### Recent source changes

```powershell
npx wrangler d1 execute DB --remote --command "SELECT lwin7, display_name, status, source_updated_at FROM wine_reference_products ORDER BY source_updated_at DESC LIMIT 10;"
```

After deployment, also spot-check several known wines in WineLog. A unique match should acquire an LWIN reference, while unmatched wines must continue to save normally. Check at least one vintage wine, one true NV wine and one numbered edition/release.

## Periodic manual refresh

Until Liv-ex API access is available, repeat the same full-snapshot process whenever you obtain a newer official workbook:

```text
Download fresh workbook
        ↓
Keep the original snapshot
        ↓
Export CSV UTF-8
        ↓
Back up D1
        ↓
Generate fresh import files
        ↓
Review manifest/rejections
        ↓
Apply numbered chunks
        ↓
Apply sync-state last
        ↓
Run verification queries
```

Always generate into a clean output directory so old and new chunks cannot be mixed.

### Why repeated full imports are safe

The reference tables use stable keys and upserts. Re-importing the same snapshot should converge on the same data. A newer snapshot updates changed records and adds newly issued LWINs.

The importer is intentionally non-destructive: a missing row in a later file does **not** cause WineLog to delete the existing external identity. Liv-ex's explicit `Deleted` and `Combined` statuses are the signals WineLog trusts.

## Coexisting with the future Liv-ex API

When `LWIN Change Since` access is available, it should update the **same reference tables**:

```text
Routine updates
Liv-ex Change Since API
        ↓
incremental upsert
        ↓
wine_reference_products

Fallback / reconciliation
Official LWIN snapshot
        ↓
manual importer
        ↓
same tables
```

Keep manual full-snapshot import available for:

- initial bootstrap;
- delayed API credentials;
- API outages or long gaps;
- periodic reconciliation against the official snapshot;
- rebuilding a fresh D1 database.

Do not run an API delta sync and a full snapshot import concurrently. Finish one update source before starting the other.

## Troubleshooting

**Required columns are missing**  
Re-export the original worksheet as CSV UTF-8 without editing its headings.

**LWIN/REFERENCE values end in `.0`**  
That is expected from Excel. The importer normalises valid seven-digit values to strings.

**A chunk fails halfway through**  
Do not apply `lwin-sync-state.sql`. Rerun the numbered chunks after fixing the problem.

**The manifest reports rejected rows**  
Do not ignore a large or unexplained count. Malformed identifiers/statuses and Combined rows without a valid REFERENCE are rejected intentionally.

**The new snapshot has fewer records**  
Do not delete the difference manually. WineLog preserves historical identities and trusts explicit Liv-ex status/REFERENCE changes rather than absence.

**A known wine still does not match LWIN**  
The current resolver intentionally avoids guessing. Exact aliases, fuzzy suggestions and more advanced conflict handling are separate resolver work; the WineLog record remains valid when no LWIN match exists.

## Data and attribution

Use the official LWIN dataset under Liv-ex's applicable licence/terms and retain the required attribution. Do not publish the downloaded workbook or generated bulk reference data from the WineLogDB repository.

The repository contains the schema, importer and integration logic only.
 } |
  Sort-Object Name |
  ForEach-Object {
    Write-Host "Applying $($_.Name)..."
    npx wrangler d1 execute DB --remote --file $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "LWIN import stopped at $($_.Name)" }
  }
```

The generated statements are idempotent. If the process stops because of a network or Cloudflare error, fix the problem and rerun the same loop. Successfully applied chunks update the same records instead of duplicating them.

Only after every numbered chunk succeeds, write the completed sync marker:

```powershell
npx wrangler d1 execute DB --remote --file ".tmp\lwin-import\lwin-sync-state.sql"
```

Keeping the state file last prevents an incomplete import from being recorded as complete.

## 5. Verify the import

### Sync status

```powershell
npx wrangler d1 execute DB --remote --command "SELECT source, source_version, source_updated_at, rows_seen, rows_written, rows_redirected, rows_rejected, status, updated_at FROM wine_reference_sync_state WHERE source='lwin';"
```

Expected `status`: `complete`.

### LWIN status counts

```powershell
npx wrangler d1 execute DB --remote --command "SELECT status, COUNT(*) AS records FROM wine_reference_products GROUP BY status ORDER BY status;"
```

These counts should broadly agree with the downloaded snapshot.

### Combined redirect integrity

```powershell
npx wrangler d1 execute DB --remote --command "SELECT COUNT(*) AS broken_combined FROM wine_reference_products WHERE status='Combined' AND (reference_lwin7 IS NULL OR reference_lwin7='');"
```

Expected result: `0`.

### Recent source changes

```powershell
npx wrangler d1 execute DB --remote --command "SELECT lwin7, display_name, status, source_updated_at FROM wine_reference_products ORDER BY source_updated_at DESC LIMIT 10;"
```

After deployment, also spot-check several known wines in WineLog. A unique match should acquire an LWIN reference, while unmatched wines must continue to save normally. Check at least one vintage wine, one true NV wine and one numbered edition/release.

## Periodic manual refresh

Until Liv-ex API access is available, repeat the same full-snapshot process whenever you obtain a newer official workbook:

```text
Download fresh workbook
        ↓
Keep the original snapshot
        ↓
Export CSV UTF-8
        ↓
Back up D1
        ↓
Generate fresh import files
        ↓
Review manifest/rejections
        ↓
Apply numbered chunks
        ↓
Apply sync-state last
        ↓
Run verification queries
```

Always generate into a clean output directory so old and new chunks cannot be mixed.

### Why repeated full imports are safe

The reference tables use stable keys and upserts. Re-importing the same snapshot should converge on the same data. A newer snapshot updates changed records and adds newly issued LWINs.

The importer is intentionally non-destructive: a missing row in a later file does **not** cause WineLog to delete the existing external identity. Liv-ex's explicit `Deleted` and `Combined` statuses are the signals WineLog trusts.

## Coexisting with the future Liv-ex API

When `LWIN Change Since` access is available, it should update the **same reference tables**:

```text
Routine updates
Liv-ex Change Since API
        ↓
incremental upsert
        ↓
wine_reference_products

Fallback / reconciliation
Official LWIN snapshot
        ↓
manual importer
        ↓
same tables
```

Keep manual full-snapshot import available for:

- initial bootstrap;
- delayed API credentials;
- API outages or long gaps;
- periodic reconciliation against the official snapshot;
- rebuilding a fresh D1 database.

Do not run an API delta sync and a full snapshot import concurrently. Finish one update source before starting the other.

## Troubleshooting

**Required columns are missing**  
Re-export the original worksheet as CSV UTF-8 without editing its headings.

**LWIN/REFERENCE values end in `.0`**  
That is expected from Excel. The importer normalises valid seven-digit values to strings.

**A chunk fails halfway through**  
Do not apply `lwin-sync-state.sql`. Rerun the numbered chunks after fixing the problem.

**The manifest reports rejected rows**  
Do not ignore a large or unexplained count. Malformed identifiers/statuses and Combined rows without a valid REFERENCE are rejected intentionally.

**The new snapshot has fewer records**  
Do not delete the difference manually. WineLog preserves historical identities and trusts explicit Liv-ex status/REFERENCE changes rather than absence.

**A known wine still does not match LWIN**  
The current resolver intentionally avoids guessing. Exact aliases, fuzzy suggestions and more advanced conflict handling are separate resolver work; the WineLog record remains valid when no LWIN match exists.

## Data and attribution

Use the official LWIN dataset under Liv-ex's applicable licence/terms and retain the required attribution. Do not publish the downloaded workbook or generated bulk reference data from the WineLogDB repository.

The repository contains the schema, importer and integration logic only.
