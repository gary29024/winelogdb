# Burgundy Atlas links

Wine details now offer **Explore on Burgundy Atlas** below the identity pills when the recorded appellation matches a mapped Burgundy Grand Cru. The same link appears as **Burgundy Atlas** on every row of one curated collection, including untasted rows:

- Burgundy Grand Cru Explorer (33)

The three narrower Burgundy checklists - Côte de Nuits Grand Crus, Côte de Beaune Grand Crus and The Nine Gevrey Grand Crus - are in `curatedLaunch.ts`'s `removed` set and are not served, so naming them here would describe a page nobody can open. `atlasCollections` lives in that same file and refuses to boot on an id curation has dropped.

Owner and shared wine pages use the same component. Links open in a new tab, leaving the tasting and its navigation state available. Existing links to tasted vintages remain separate.

## Review previews

Screenshots of the implementation with synthetic example wine and progress data:

<img src="mockups/burgundy-atlas-wine-mobile.png" width="390" alt="Mobile wine detail with Explore on Burgundy Atlas beneath the appellation and Grand Cru pills" />

![Desktop collection with Atlas links on tasted and untasted crus](mockups/burgundy-atlas-collection-desktop.png)

## Mapping and matching

`src/lib/places/burgundyAtlasLinks.json` maps WineLog's existing canonical place IDs to complete URLs published in [Atlas's sitemap](https://burgundyatlas.com/sitemap.xml). All 33 destinations were checked on 2026-09-21 for HTTP 200, an exact canonical URL and matching Grand Cru metadata. Chambertin's designation and appellation pages were also compared in the browser.

For the Côte d'Or, the mapping uses 32 **wine designation** pages, which focus the named vineyard and provide its terrain context. La Romanée points specifically to the Grand Cru in Vosne-Romanée, excluding its Premier Cru namesakes. Chablis Grand Cru uses its **appellation** page: a bottle naming only that appellation does not identify one of its seven climats. Atlas remains responsible for the mapped data and boundaries.

Matching accepts case, accent and punctuation variations, AOC/AOP markers, Grand Cru prefixes/suffixes and a small explicit alias set. It never searches arbitrary wine-name substrings. A supplied non-French country, incompatible region/subregion, contradictory cru tier or disputed reference suppresses the wine link. A specific, exact Grand Cru appellation can match when broader fields are absent. Village names in the region field are not treated as legal parents of Grand Cru appellations.

The mapping is shared static frontend data. There are no migrations, database reads, AI calls, embeds or automatic requests to Atlas. Navigation sends only the public Atlas destination; `noopener noreferrer` omits the WineLog referrer and opener.

## Extending coverage

Premier Cru climats, village fallbacks, producer ranges and internal vineyard pages are follow-up work. Unmapped places show no link in this release. A new collection must be curated - that is, absent from `removed` - before `atlasCollections` may name it, and every one of its rows must resolve. A new destination must be selected from Atlas's published records, checked for name, classification and geographic scope, and keyed to WineLog's canonical place identity. Do not generate Atlas IDs or substitute a nearby vineyard. Update `verifiedAt` only after checking the complete mapping again.

## Validation

- Focused Vitest checks: matching, complete 33-cru coverage, every claimed collection live and fully linked, name collisions, geography conflicts and wine-detail regressions.
- Chromium: owner/shared details, all 33 checklist links, preserved tasting links, no background Atlas requests, new-tab behavior and unsupported Premier Cru suppression.
- Layouts checked at 320, 390 and 1280 pixels; screenshots reviewed for overlap and clipping.
- TypeScript, production build and lint.

Run the focused checks with:

```sh
npx vitest run tests/unit/burgundyAtlas.test.ts tests/unit/wineClassificationDisplay.test.tsx tests/unit/wineDetailOrder.test.ts tests/unit/wineDetailMapping.test.ts
npx playwright test tests/e2e/burgundy-atlas.spec.ts --project=chromium
npm run build
npm run lint
```
