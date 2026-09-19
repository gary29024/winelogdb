# Importing and refreshing LWIN and ELID reference data

WineLogDB keeps the large external reference catalogues in **R2**, not in D1.

That is deliberate. The LWIN snapshot is already over 200,000 rows, while Cloudflare's Free-plan D1 write allowance is much smaller than a full catalogue refresh once indexes are counted. R2 lets WineLog keep the full reference dataset cheaply while D1 stores only the small sync marker and the external IDs actually attached to user wines.

The normal workflows are now:

```powershell
npm run lwin:import -- "C:\WineLogData\LWINdatabase.xlsx"
npm run elid:sync
```

Neither command is required on the recognition hot path. Recognition reads the already-imported local R2 reference shards.

## Storage layout

Each import creates an immutable version and changes a small manifest **only after all shards have uploaded successfully**:

```text
reference/
  lwin/
    current.json
    versions/<content-hash>/
      shard-000.json
      shard-001.json
      ...
      redirects.json

  elid/
    current.json
    versions/<content-hash>/
      shard-000.json
      shard-001.json
      ...
```

The shards are distributed by normalized producer identity. A normal bottle lookup therefore reads one small shard rather than the whole catalogue.

Old versions are not overwritten when a new snapshot is published, which gives us a straightforward recovery path.

## Before importing

Install the repository dependencies and deploy/apply the PR's schema first:

```powershell
npm install
npm run db:migrate
npm run deploy
```

The deployment provides the `REFERENCE_DATA` R2 binding. It points at the existing private `winelog-private` bucket, but is intentionally separate from the metered `WINE_IMAGES` binding so global reference reads do not count as member photo storage.

The external source files and generated shards are operational data. Do **not** commit them to Git.

---

# LWIN

## First import

Keep the original Liv-ex workbook unchanged, for example:

```text
C:\WineLogData\LWINdatabase-2026-09-18.xlsx
```

WineLog reads the XLSX directly; **you no longer need to convert it to CSV**.

Before changing production, run a dry build:

```powershell
npm run lwin:build-import -- "C:\WineLogData\LWINdatabase-2026-09-18.xlsx"
```

This validates the workbook and writes the generated version under:

```text
.tmp\lwin-reference\<version>\
```

It does not upload anything.

Review the console summary. Pay particular attention to:

- valid rows accepted;
- rejected rows;
- Combined records;
- unresolved Combined redirects;
- the generated content version.

Unexpected rejected rows or unresolved redirects should be investigated before publishing. A small number of unresolved redirects does not block the refresh: those Combined identities remain in the catalogue but resolve as `conflict` rather than being guessed. Circular redirect chains still stop the import because they indicate a structurally corrupt source graph.

When the dry run looks right:

```powershell
npm run lwin:import -- "C:\WineLogData\LWINdatabase-2026-09-18.xlsx"
```

The importer:

1. reads the official XLSX;
2. validates the expected LWIN columns;
3. normalizes Excel numeric IDs such as `1000131.0` to `1000131`;
4. retains Live, Combined and Deleted rows;
5. builds Combined -> REFERENCE redirect data;
6. writes producer-keyed R2 shards under a new immutable version;
7. uploads every shard;
8. switches `reference/lwin/current.json` **last**;
9. writes one small `wine_reference_sync_state` row to D1.

If an upload fails before step 8, the application continues using the previous `current.json`.

## CSV is still accepted

If you already have a UTF-8 CSV export, it can still be used:

```powershell
npm run lwin:import -- "C:\WineLogData\LWINdatabase-2026-09-18.csv"
```

XLSX is simply the preferred path because it removes the manual conversion step.

## Verify LWIN after import

Check the D1 operational marker:

```powershell
npx wrangler d1 execute DB --remote --command "SELECT source,source_version,source_updated_at,rows_seen,rows_written,rows_redirected,rows_rejected,rows_unresolved,status,updated_at FROM wine_reference_sync_state WHERE source='lwin';"
```

Expected `status` is `complete`. `rows_unresolved` should normally be zero; if non-zero, review the importer warnings to see whether each target was rejected by WineLog validation or was genuinely absent from the Liv-ex workbook.

Download the current R2 manifest:

```powershell
New-Item -ItemType Directory -Force ".tmp\reference-check" | Out-Null
npx wrangler r2 object get "winelog-private/reference/lwin/current.json" --remote --file ".tmp\reference-check\lwin-current.json"
Get-Content ".tmp\reference-check\lwin-current.json"
```

Confirm that the manifest contains:

- `provider: "lwin"`;
- the expected source filename;
- the expected row count;
- a recent `sourceUpdatedAt`;
- a `prefix` pointing to the new version.

Then spot-check several wines in WineLog:

- one normal vintage wine;
- one true NV wine;
- one numbered release such as Champagne edition;
- one wine whose label spelling differs slightly from canonical naming.

An unmatched wine must continue to save normally.

## Periodic LWIN refresh

Manual full-snapshot refresh remains a supported operating mode even after Liv-ex API access eventually becomes available.

When Liv-ex publishes a newer workbook:

```powershell
npm run lwin:build-import -- "C:\WineLogData\LWINdatabase-NEW-DATE.xlsx"
npm run lwin:import -- "C:\WineLogData\LWINdatabase-NEW-DATE.xlsx"
```

The new content hash creates a new R2 version. The old version remains available instead of being overwritten.

This makes the snapshot path useful for:

- delayed API approval;
- API outages;
- catching up after a long gap;
- periodic reconciliation against Liv-ex's official full database;
- rebuilding a fresh WineLog deployment.

When `LWIN Change Since` is implemented, it should update the same reference catalogue format. The full-XLSX importer should remain as the reconciliation/recovery route.

## LWIN rollback

Every completed version retains its own manifest at:

```text
reference/lwin/versions/<version>/manifest.json
```

so rollback does not depend on remembering to save `current.json` beforehand. Retrieve the manifest for the version you want and promote it back to `current.json`:

```powershell
npx wrangler r2 object get "winelog-private/reference/lwin/versions/<version>/manifest.json" --remote --file ".tmp\reference-check\lwin-rollback.json"
npx wrangler r2 object put "winelog-private/reference/lwin/current.json" --remote --file ".tmp\reference-check\lwin-rollback.json" --content-type "application/json" --force
```

A version directory without `manifest.json` is incomplete and must not be promoted. Then verify a known wine again.

---

# ELID

There is currently no official machine-readable ELID database/feed available to WineLog, so #282 includes a **registry-only crawler**.

It deliberately does **not** copy the rich editorial/technical content on ELID wine pages. It retains only identity facts needed to link an official registered ELID:

- ELID;
- base ELID;
- producer code/name;
- wine/cuvée name;
- vintage/NV/release code;
- source URL.

WineLog never fabricates a missing ELID.

## Small ELID smoke test

Before a full crawl, test one producer:

```powershell
npm run elid:sync -- --producer=FR-KRUG --dry-run
```

Or one country:

```powershell
npm run elid:sync -- --country=FR --dry-run
```

The crawler:

- checks `robots.txt` before proceeding;
- identifies itself with a WineLogDB user agent;
- waits between network requests;
- caches fetched pages locally for seven days;
- applies page-size safety limits;
- visits producer/wine registry pages only;
- stores only the registry fields above.

If robots instructions disallow the relevant paths, it aborts rather than working around them.

## Publish ELID registry data

For a full registry refresh:

```powershell
npm run elid:sync
```

For one country:

```powershell
npm run elid:sync -- --country=FR
```

Force a fresh fetch instead of using the seven-day local cache:

```powershell
npm run elid:sync -- --fresh
```

A full registry crawl can involve many pages. If it is interrupted, simply rerun it; the local cache means already-fetched pages normally do not need another request.

After all R2 shards upload successfully, `reference/elid/current.json` is switched last and the D1 sync marker is updated.

Verify it with:

```powershell
npx wrangler d1 execute DB --remote --command "SELECT source,source_version,rows_seen,rows_written,status,updated_at FROM wine_reference_sync_state WHERE source='elid';"
npx wrangler r2 object get "winelog-private/reference/elid/current.json" --remote --file ".tmp\reference-check\elid-current.json"
Get-Content ".tmp\reference-check\elid-current.json"
```

## ELID refresh frequency

ELID identity data does not need to be crawled on every bottle scan. A periodic manual refresh—such as monthly, or after learning that the registry has materially changed—is enough initially.

The application never contacts `elid.wine` during ordinary recognition. Recognition reads the imported R2 catalogue.

---

# Troubleshooting

### LWIN workbook says required columns are missing

Use the original Liv-ex workbook without renaming/removing columns. If using CSV, export the original sheet as CSV UTF-8 without modifying the headers.

### Some LWIN values display with `.0`

That is normal Excel behavior. The importer converts valid seven-digit identifiers to strings before building the catalogue.

### An LWIN redirect is reported as unresolved

The importer distinguishes between a redirect target that exists in the source workbook but was rejected by WineLog validation and a target that is genuinely absent from the workbook. The affected Combined identity is retained but has no redirect entry, so runtime resolution reports a conflict instead of guessing. Investigate the warning, but an isolated unresolved redirect does not prevent the rest of the official snapshot from refreshing.

A circular redirect chain is different: it stops the import because there is no safe terminal identity.

### Import/crawl stops during upload

The existing `current.json` remains active until the new version uploads completely. Rerun the command after fixing the issue.

### A known wine does not receive an LWIN/ELID

The resolver intentionally avoids guessing. A missing external ID does not invalidate the WineLog wine. Alias/fuzzy candidate scoring remains a later resolver enhancement.

### ELID crawl suddenly refuses to run

Check ELID's current robots instructions/site structure rather than bypassing the block. The crawler is intentionally fail-closed for explicit crawl restrictions.

## Source/licensing boundary

Use the official LWIN dataset under Liv-ex's applicable licence/attribution requirements.

For ELID, the crawler is intentionally limited to public registry identity facts. It does not bulk-copy technical specifications, editorial descriptions, drinking windows, tasting notes, prices or other enriched content.

If ELID later publishes an official machine-readable feed/API, replace the crawler with that source while retaining the same R2 catalogue format.
