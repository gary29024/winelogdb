# LWIN mismatch and review queue

## Cause

The imported reference snapshot (`03383c3400811b6c`, imported September 19, 2026) contains LWIN 1059328 with:

| Field | Value |
| --- | --- |
| DISPLAY_NAME | Domaine de la Vougeraie, Bourgogne, Terres de Famille Pinot Noir |
| PRODUCER_TITLE | Domaine |
| PRODUCER_NAME | de la Vougeraie |
| WINE | Terres de Famille Pinot Noir |

The screenshot's suggested producer is the structured name without the title. The resolver already preferred the display-name producer in the current checkout, but previously saved `reference_suggestions_json` was returned verbatim. Stored-LWIN validation updated match status and candidates without refreshing that JSON. Thus a naming fix alone could not remove the old suggestion. The exact production row was not queried; the imported source and repository behavior establish the path that produces this symptom.

The old owner list selected at most 20 conflict rows from the last validation run. Its “need review” number was a cumulative run statistic. Applying a suggestion removed that field from the JSON, but did not revalidate or clear the separate identity conflict. Its plain wine links also omitted the existing return-target state, causing wine details to fall back to Journal.

## Changes

- A dedicated `/admin/lwin-review` page lists the signed-in owner's pending conflicts and field suggestions, with a live count and cursor pagination. Account and Owner controls link directly to it.
- Expandable cards allow accepting or keeping individual values, rechecking stale comparisons, and explicitly confirming the stored identity. Resolved cards disappear and the next pending card opens.
- Wine and edit links retain the review return target, including page cursor and selected wine.
- Producer fallback combines the structured title and name when a display producer is unavailable. It does not strip identity-bearing house qualifiers.
- Rechecking refreshes pending comparisons from the stored LWIN's current local reference, without replacing populated wine fields or reopening already-kept fields. Successful validation also refreshes pending comparisons.
- Applying or keeping a field rechecks the identity. Only a unique match to the same stored LWIN clears an automatic conflict. A real disagreement remains pending until an explicit decision. Confirming a stored LWIN records a manual identity decision.
- Writes check the relevant snapshot and are scoped to the signed-in account. Pagination and review counts are independent of historical rollout counters.

## Existing records

Open Needs review and use **Recheck LWIN** on a stale card. If its current name and stored identity agree with the catalogue, the obsolete suggestion and conflict disappear without changing the name. **Revalidate stored LWINs** also refreshes pending suggestions for identities it can verify. No production data was changed while implementing this fix.

## Verification

Real SQLite/D1 tests cover the imported producer split, stale suggestion repair, real conflicts, explicit confirmation, keeping fields, account isolation, and pagination beyond 20 wines. A mobile Playwright test covers in-place resolution, advancing to the next wine, returning from wine details, and horizontal layout at 393 px.
