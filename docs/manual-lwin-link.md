# Manually correcting a LWIN link

The review card can confirm its stored LWIN, recheck it, select a different product, or reject the match when no catalogue product applies.

Owners can open **Change LWIN** in Needs review or a wine's detail page, enter a seven-digit product code, and choose **Preview LWIN**. Check the catalogue label and geography, then explicitly choose **Link LWIN**. Previewing does not write to the database. The imported catalogue distinguishes `1017425` (R Rieussec) from `1017483` (Chateau Rieussec Premier Cru Classe, Sauternes); the bottle must determine the selection.

Members do not see catalogue maintenance on the detail page, and the public API restricts those maintenance endpoints to the owner. Logging is normally one tap on **Save wine**: a clear match is linked automatically, while missing or temporarily unavailable matches save without a reference. Only a proposed match that differs from populated wine fields opens **Is this the same wine?**, showing the name and place. **Yes, save wine** and **Keep my details** both save directly; the latter leaves the wine without a reference and prevents automatic rematching. There are no catalogue codes or radio-button confirmation steps. Editing the form invalidates the review; saving a selected match rechecks it and rejects a changed match. A missing or unavailable match remains eligible for later automatic matching. This flow covers manual, single-photo, group-photo and batch-review forms; the separate tasting-sheet import retains its existing matching flow.

Linking records a manual identity decision. It replaces the old product reference, derives LWIN11 only when the catalogue supports the saved vintage, clears the previous ELID, and replaces obsolete field suggestions with comparisons against the selected product. Personal names, vintage, region, tasting notes, and ratings remain unchanged. Any remaining field differences can be accepted or kept separately. The review queue refreshes after linking and removes fully resolved wines.

The server scopes both operations to the signed-in account. Confirmation requires a preview token covering the wine snapshot and selected catalogue product. A changed wine or catalogue requires a fresh preview, and the conditional database update also rejects changes made during confirmation. Deleted codes are rejected; combined codes show their live replacement before confirmation.

Choose **Reject match — keep without LWIN** from Needs review or the wine detail page when no replacement applies. This clears the LWIN, LWIN11, ELID, catalogue metadata and pending suggestions while preserving the wine's names, vintage, location, style and tasting data. The choice is stored as a manual identity with no reference, so edits, rechecks and automatic or AI backfills cannot restore the match. The wine leaves Needs review. A new LWIN can still be previewed and linked later. Rejection is account-scoped and rejects stale wine snapshots.

## Catalogue compatibility

New LWIN imports write sharded ID indexes before publishing the manifest. Exact-code lookup then reads a small index and the relevant product shard, including when the saved producer is incorrect. Existing manifests remain supported through a bounded lookup under the current producer. To enable arbitrary cross-producer lookup for an older catalogue, re-import its source with the updated importer. No production catalogue or wine data is changed by this PR.

Legacy producer lookup recognises `Cave` and `Caves` prefixes, so `Cave de Tain` can find records stored under structured producer name `de Tain`. An exact-code preview shows the catalogue colour even when it differs from the saved wine's style; previewing never changes the wine. Check the colour before explicitly confirming a replacement.

## Validation

SQLite/D1 tests cover read-only previews, explicit replacement, preservation of personal fields, stale previews, account isolation, invalid/missing/deleted codes, combined-code redirects, vintage restrictions, and indexed lookup across producers. Mobile browser tests cover preview invalidation after typing, explicit confirmation, queue removal, and light/dark layouts. An importer dry run verifies the generated ID index and manifest pointer.

## Accepted names reverting

Applying a wine-name suggestion previously updated `wine_name` and cleared the cuvée link, then called `ensureWineIdentity`. The cuvée linker preferred `recognized_wine_name`, which still contained the older name, and immediately wrote that old identity's name back. The suggestion was already removed, so the operation appeared successful despite the unchanged title.

Accepting a name now updates the cuvée-linking input in the same guarded SQL write, matching the ordinary edit path. A SQLite regression reproduces `Grand Cru Grand Vintage` reverting after accepting `Grand Vintage Brut Grand Cru`, then verifies the corrected name survives relinking and a producer maintenance sweep. Keeping the current value still leaves the name unchanged. Previously dismissed suggestions are not reconstructed because the database does not distinguish these failed applications from deliberate Keep decisions; an affected wine can be corrected through **Edit wine**.
