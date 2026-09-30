# Grand Cru parcel rollout: applying the Échezeaux approach

This playbook turns the Échezeaux pilot (#374, then #409–#416) into one repeatable
approach for the other 32 Grand Cru issues (#377–#408). It covers what every cru
gets, what is optional, the code work needed first, and the wording and evidence
rules that must stay the same.

Tracking: [Grand Cru milestone](https://github.com/gary29024/winelogdb/milestone/1),
umbrella issues #344 (named areas) and #364 (rights and farming evidence).

## 1. What Échezeaux established

| Layer | Pilot PR | Reusable as-is? |
| --- | --- | --- |
| Cadastral parcels, cru overlap, named areas, DGFiP rights snapshot | #374 | No: scripts and manifest are Échezeaux-only |
| Manual producer links (D1 `parcel_producer_links`) | #409 | Yes: keyed by `parent_feature_id` and rights snapshot |
| Rights history 2019–2025 and parcel lineage (≥95% inside, next vintage only) | #411 | Method yes, script no |
| Côte-d'Or farm-structure notices: regional 2019–2026 (#410), departmental 2016–2020 (#412) | #410, #412 | Yes: indexes cover every Côte-d'Or commune |
| Per-parcel dated evidence panel, lazy-loaded | #413 | Component yes, data file and loader no |
| Pinned map, open on linked holder, consistent folding | #414 | Yes: applies to every village map |
| DVF sale records, company deeds and leases | #415 | Method yes, script no |
| Producer-scoped links, stable selection, domaine grouping | #416 | Component yes, only turned on for `inao-denom-565` |

Pilot result: 276 Échezeaux parcels, 28 with exact-reference filing evidence,
127 without a named candidate, **zero confirmed current farmers**. That result is
honest and is the expected outcome for most crus.

## 2. Tiered research depth

Every cru gets Tier 1. Tier 2 happens only when the owner asks for it for a named
cru. Tier 3 stays deferred everywhere.

### Tier 1 — required to close a cru issue

1. Parcels: pinned Cadastre Etalab snapshot for every commune in the cru, full
   polygons, separately measured cru overlap, edge-contact audit.
2. Named areas: cadastral lieux-dits clipped to the INAO boundary, reviewed exact
   aliases only, whole-cru fallback where a crosswalk is missing (as with
   Les Poulaillères).
3. Rights: DGFiP legal-entity snapshot joined by exact reference, visible
   "as of" date, all holders and right codes kept.
4. Rights history: 2019–2024 files compared with the current one; parcel lineage
   accepted only under the #411 rule (first appears in the next vintage and lies
   at least 95% inside the retired parcel). Rejected slivers are recorded.
5. Official notices: match the cru's communes against the existing Côte-d'Or
   indexes (#410, #412). Only image-reviewed rows enter the cru's register.
6. Sales: DVF+ sale/exchange records for the cru's parcels (dates and parcel
   references only; no prices, addresses or party names).
7. App: evidence panel, legal-holder list, domaine grouping only where research
   links exist, manual links scoped to the wine's producer, pinned map.
8. Published counts (table in section 5) and limitations.

### Tier 2 — on request, per cru

- Free company-filing mirrors: deeds, contributions, lease recitals.
- Published producer holdings and independent articles (e.g. Winehog), facts only
  with links; printed references kept separate from today's parcels.

### Tier 3 — deferred

- Paid land-registry (SPF) copies, domaine or CVI outreach.

## 3. Make the pipeline generic first

Do this before Clos de Vougeot, and prove it on Grands-Échezeaux (#377), which
already shares the Flagey data but is excluded from the evidence panel and domaine
grouping by a hard-coded `parentId!=='inao-denom-565'` check in
`src/features/vineyards/GrandCruParcels.tsx`.

1. **One config per cru**, e.g. `scripts/grand-crus/<slug>.json`: INAO feature IDs,
   commune INSEE codes, cadastre date and hashes, DGFiP department file, named-area
   aliases, research tier.
2. **Generic scripts**: replace the seven `build_echezeaux_*.py` scripts and
   `download_echezeaux_sources.mjs` with `build_grand_cru_*.py --cru <slug>`.
   Échezeaux outputs must regenerate byte-identical (same hashes) as the proof.
3. **Per-cru research folder**: `docs/research/<slug>/curation.json` plus generated
   register, so research for one cru never edits another's files.
4. **App registry**: map `parentFeatureId` to its manifest, parcel URL and lazy
   evidence loader. Remove the Échezeaux name/ID checks in `GrandCruParcels.tsx`
   and the fixed JSON import in `ParcelEvidence.tsx`. Rename
   `echezeauxParcelOwners.ts` to a generic module.
5. **CI**: the `research-data` job loops over every configured cru's `--check`.
   Browser tests stay one representative journey, parameterised by config, so the
   Chromium matrix does not grow with each cru.

**Done in #417.** Échezeaux regenerates with identical hashes for every data file
(parcel and named-area GeoJSON, manifest, holder index, app evidence, named areas,
rights history, sale records, both build reports). Only the research register's
input paths and rebuild commands changed, because the files moved. Grands-Échezeaux
now gets the evidence panel and domaine grouping through the registry.

### Adding a cru

1. **Bundle.** If its communes already have a bundle in `scripts/grand-crus/bundles/`
   (e.g. `flagey-echezeaux.json`), add the cru's slug to `crus` and its INAO feature
   to `parcels.parentFeatureIds`. Otherwise create `<bundle-id>.json`: `villageMap`,
   `assetName`, the pinned `parcels` block (first commune, then `additionalCommunes`),
   `lieuxDits` per commune, and optionally `rightsHistory` and `saleRecords`.
2. **Cru config** `scripts/grand-crus/<slug>.json`: `slug`, `name`,
   `parentFeatureId`, `issue`, `tier`, `bundle` and `evidenceFrom`. Add
   `appellationId` and `namedPlots` once named areas are reviewed,
   `rightsHistoryPurpose` for the history, and `research` (method and filings docs)
   once `docs/research/<slug>/curation.json` exists.
3. **Build**, from the repository root:

   ```sh
   python scripts/download_grand_cru_sources.py --cru <slug>   # once per bundle
   python scripts/build_grand_cru_parcels.py --cru <slug>      # rebuilds the whole bundle
   python scripts/build_grand_cru_named_plots.py --cru <slug>
   python scripts/build_grand_cru_parcel_named_areas.py --cru <slug>
   python scripts/build_grand_cru_rights_history.py --cru <slug>
   python scripts/build_grand_cru_sale_records.py --cru <slug>
   python scripts/build_grand_cru_research.py --cru <slug>     # --all --check is what CI runs
   ```

4. **App.** Add the cru (and a new bundle's manifest, holder index and any evidence
   loader) to `src/lib/places/grandCruParcels/registry.ts`, `holders.ts` and
   `evidence.ts`. `tests/unit/grandCruRegistry.test.ts` fails until the registry
   matches the configs. Components need no change.

Outputs by convention: research in `docs/research/<slug>/`; app files in
`src/lib/places/grandCruParcels/` (`<bundle>.manifest.json`, `<bundle>.holders.json`,
`<slug>.evidence.json`, `<slug>.named-plots.json`); build reports in
`scripts/grand-crus/reports/`. The browser journey
`Grand Cru parcels: … from its config` runs one cru (`WINELOG_E2E_CRU=<slug>`).

## 4. Per-cru differences to plan for

| Case | Crus | What changes |
| --- | --- | --- |
| Cru across several communes | Montrachet, Bâtard-Montrachet (21150, 21512); Corton, Corton-Charlemagne (21010, 21480, 21606); Charlemagne (21010, 21480); Bonnes-Mares (21133, 21442) | Import every commune; audit cross-commune overlap; one parcel set per cru, never split at the commune line |
| Several crus in one commune | Vosne-Romanée 21714 (6 crus); Gevrey-Chambertin 21295 (9); Morey-Saint-Denis 21442 (4 plus Bonnes-Mares); Puligny/Chassagne (5) | Download, rights history and notice matching run once per commune bundle, as Flagey serves both Échezeaux crus; each cru is still validated and closed separately |
| Nested or alternative labels | Mazoyères / Charmes-Chambertin; Corton climats; Chablis Grand Cru's seven climats | Wine identity rules are unchanged; parcels attach to the INAO feature, never to a label alias |
| Monopoles | Romanée-Conti, La Tâche, La Romanée, La Grande Rue, Clos de Tart | Few holders, so Tier 1 is quick. The verified-operator gate still applies: a dated, citable source is needed before any verified link |
| Many holders | Clos de Vougeot, Corton, Charmes-Chambertin | Test holder list, search and grouping at scale; measure payload size |
| Outside Côte-d'Or | Chablis Grand Cru (Yonne, 89068) | The pinned DGFiP file covers departments 01–56 only, so Yonne needs the other department file; Côte-d'Or notice indexes do not apply, a Yonne notice index is needed first |

## 5. Standard results table for every cru PR and issue

| Measure | Value |
| --- | ---: |
| Cadastral parcels | |
| Parcels with recorded legal-entity rights (as of date) | |
| Parcels without matched rights | |
| Parcels whose rights changed 2019–current | |
| Parcels with an authorisation / application or suspension | |
| Parcels with sale records (DVF) | |
| Parcels with holder or research leads | |
| Parcels with no lead | |
| Verified farming links | 0 unless the gate is met |
| Raw / gzip payload (parcels, evidence) | |

## 6. Rules that stay the same everywhere

- Legal holder, applicant, previous operator, authorised operator, verified operator
  and bottler are different things. None is inferred from another.
- UI wording: "Recorded right holder", "Research link · farming unverified",
  "Manual link · unverified". Never "farms" or "farmed by" without a verified link.
- Unknown rights never hide a parcel. Unresolved printed references are kept
  verbatim, never guessed.
- Free public sources only for Tiers 1–2; hashes, dates and page anchors recorded;
  original PDFs not committed.
- Parcel and evidence files load only when "Show parcels" is switched on.

## 7. How to start each piece of work

Give Claude one of these requests. Each one points at the issue, so the scope,
tier and checklist come from there.

| Step | Request |
| --- | --- |
| Once, first | "Implement #417 using docs/grand-cru-parcel-rollout.md. Prove it on Grands-Échezeaux (#377)." |
| Each cru, Tier 1 | "Start Grand Cru #378 (Clos de Vougeot), Tier 1, following docs/grand-cru-parcel-rollout.md." |
| Optional Tier 2 | "Do Tier 2 research for #378." Attach or link any PDFs you want reviewed. |
| Shared village | "Prepare the Gevrey-Chambertin bundle for #391–#399, then start #391, Tier 1." |

Each cru gets its own branch and PR, and the issue closes only after that PR is
reviewed and merged. Suggested order: #377, #378, then one village bundle at a time
(Vosne-Romanée, Morey-Saint-Denis and Chambolle-Musigny, Gevrey-Chambertin,
Puligny/Chassagne, the Corton hill), and Chablis (#408) last.

Some government download sites may refuse connections from the cloud session. If
a download is blocked, Claude reports it and gives the commands to run locally,
as was done for earlier map batches.
