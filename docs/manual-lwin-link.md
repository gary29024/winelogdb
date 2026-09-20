# Manually correcting a LWIN link

The existing review card can confirm its stored LWIN or re-run automatic matching, but cannot select a different product. This leaves a user unable to correct an identity when the right product is absent from the candidates.

In Needs review or a wine's detail page, open **Change LWIN**, enter a seven-digit product code, and choose **Preview LWIN**. Check the catalogue label and geography, then explicitly choose **Link LWIN**. Previewing does not write to the database. The imported catalogue distinguishes `1017425` (R Rieussec) from `1017483` (Chateau Rieussec Premier Cru Classe, Sauternes); the bottle must determine the selection.

Linking records a manual identity decision. It replaces the old product reference, derives LWIN11 only when the catalogue supports the saved vintage, clears the previous ELID, and replaces obsolete field suggestions with comparisons against the selected product. Personal names, vintage, region, tasting notes, and ratings remain unchanged. Any remaining field differences can be accepted or kept separately. The review queue refreshes after linking and removes fully resolved wines.

The server scopes both operations to the signed-in account. Confirmation requires a preview token covering the wine snapshot and selected catalogue product. A changed wine or catalogue requires a fresh preview, and the conditional database update also rejects changes made during confirmation. Deleted codes are rejected; combined codes show their live replacement before confirmation.

## Catalogue compatibility

New LWIN imports write sharded ID indexes before publishing the manifest. Exact-code lookup then reads a small index and the relevant product shard, including when the saved producer is incorrect. Existing manifests remain supported through a bounded lookup under the current producer. To enable arbitrary cross-producer lookup for an older catalogue, re-import its source with the updated importer. No production catalogue or wine data is changed by this PR.

## Validation

SQLite/D1 tests cover read-only previews, explicit replacement, preservation of personal fields, stale previews, account isolation, invalid/missing/deleted codes, combined-code redirects, vintage restrictions, and indexed lookup across producers. Mobile browser tests cover preview invalidation after typing, explicit confirmation, queue removal, and light/dark layouts. An importer dry run verifies the generated ID index and manifest pointer.

## Accepted names reverting

Applying a wine-name suggestion previously updated `wine_name` and cleared the cuvée link, then called `ensureWineIdentity`. The cuvée linker preferred `recognized_wine_name`, which still contained the older name, and immediately wrote that old identity's name back. The suggestion was already removed, so the operation appeared successful despite the unchanged title.

Accepting a name now updates the cuvée-linking input in the same guarded SQL write, matching the ordinary edit path. A SQLite regression reproduces `Grand Cru Grand Vintage` reverting after accepting `Grand Vintage Brut Grand Cru`, then verifies the corrected name survives relinking and a producer maintenance sweep. Keeping the current value still leaves the name unchanged. Previously dismissed suggestions are not reconstructed because the database does not distinguish these failed applications from deliberate Keep decisions; an affected wine can be corrected through **Edit wine**.
