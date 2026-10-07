# Grand Cru parcel rollout: applying the Échezeaux approach

This playbook turns the Échezeaux pilot (#374, then #409–#416) into one repeatable
approach for the other 32 Grand Cru issues (#377–#408). It covers what every cru
gets, what is optional, the code work needed first, and the wording and evidence
rules that must stay the same.

Tracking: [Grand Cru milestone](https://github.com/gary29024/winelogdb/milestone/1),
umbrella issues #344 (named areas) and #364 (rights and farming evidence).

Shared historical extension: [#461](https://github.com/gary29024/winelogdb/issues/461)
requires official evidence back to the earliest available records for all 33 crus.
The shared acquisition/parser and historical backfills now cover all 33 crus.
See the [history delivery and source gaps](research/grand-cru-history.md). A cru's
register supplies the historical basis, but the cru stays off the app's maps until
its Tier 1 commune-edge audit is committed. Per-cru progress is tracked in the cru
issues and the #461 checklist, not here. Earlier notice bulletins were partially
recovered through archived copies; missing publications and unsearched intervals
stay explicit in each cru's notice coverage.

## 1. What Échezeaux established

| Layer | Pilot / follow-up | Reusable as-is? |
| --- | --- | --- |
| Cadastral parcels, cru overlap, named areas, DGFiP rights snapshot | #374 | No: scripts and manifest are Échezeaux-only |
| Manual producer links (D1 `parcel_producer_links`) | #409 | Yes: keyed by `parent_feature_id` and rights snapshot |
| Original rights history 2019–2025 and inferred spatial lineage (≥95% inside, next vintage only) | #411 | Baseline method; spatial inference stays distinct from official filiation |
| Official DFI filiation and history to the earliest available records | #461 | Shared acquisition/parser, all 33 history files and the raw-source audit exist; earlier notice bulletins and per-cru review remain open in #461 |
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
4. Official history: compare all published annual DGFiP rights snapshots, obtain
   the latest complete official DFI department files, and trace every current
   parcel through all documented predecessor generations to the earliest
   reachable record. Reconcile with all available cadastre vintages; publish
   source-specific coverage and gaps. Apply #461 and the requirements below.
   The #411 rule remains separately labelled spatial inference where official
   correspondence is unavailable, with rejected candidates retained.
5. Official notices: match current and reachable historical references against
   the official notice sources, starting with the existing Côte-d'Or indexes
   (#410, #412). Audit earliest available archive coverage, obtain earlier
   relevant official records where published, and state gaps. Only image-reviewed
   rows enter the register; Yonne requires its own sources.
6. Sales: obtain available official sale/exchange records for current and
   reachable historical references; record the available/imported date range,
   original reference, scope and ancestry path. Retain dates and parcel
   references only; no prices, addresses or party names.
7. App: evidence panel, legal-holder list, domaine grouping only where research
   links exist (the registry's `domaineGrouping` flag), manual links scoped to the
   wine's producer, pinned map.
8. Published counts (table in section 5) and limitations, in
   `docs/research/<slug>/README.md`. The research `--check` fails when the table
   disagrees with the generated register.

### Historical coverage required by #461

“Earliest available” is determined separately for recorded rights, parcel
filiation, geometry, sales and administrative notices. It is not a universal
starting year or a claim of continuous ownership. Recheck official catalogues at
implementation and pin the observed availability.

As checked on 1 October 2026, the [DGFiP rights catalogue](https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/fichiers-des-locaux-et-des-parcelles-des-personnes-morales)
lists 1 January 2019–2025, with no earlier or 2026 rights file listed.
[Official DFI records](https://www.data.gouv.fr/datasets/documents-de-filiation-informatises-dfi-des-parcelles)
can extend parcel ancestry to departmental computerisation in the 1980s–1990s;
rural land-consolidation changes lack correspondence in this source.
[Etalab geometry archives](https://files.data.gouv.fr/cadastre/etalab-cadastre/)
start at 6 July 2017. Actual commune availability and earliest reachable events
must be established independently; those different dates never backdate rights.

For each commune bundle and cru:

1. **Acquire and pin official evidence.** Inventory the relevant department and
   commune releases; obtain the latest complete official DFI member and schema,
   all available annual rights files, and all available commune cadastre
   vintages through the pinned current geometry, including intermediate releases.
   Reuse department/bundle downloads. Retain catalogue/download URLs, licences,
   source/as-of dates, schema/member identity, raw-byte hashes, sizes and exact
   UTC retrieval times. Publish available, obtained and missing ranges separately.
2. **Trace the full event chain.** Parse paired DFI mother/daughter rows with
   document ID, analysis lot, change type, validation date and exact full parcel
   IDs. Preserve complete sets in one-to-many and many-to-many event groups;
   do not infer individual geographic correspondences within an ambiguous lot.
   From every mapped parcel, traverse all reachable predecessors, including
   intermediate retired references, to a source boundary or explicit unresolved
   gap. Retain public-domain/non-cadastral events and terminal reasons. Detect
   malformed/missing pairs, identity conflicts, chronology problems and cycles.
3. **Separate documented filiation from spatial inference.** Check DFI against
   dated geometry where available and publish discrepancies. The original #411
   rule still requires first appearance in the next pinned vintage and at least
   95% of the successor inside the retired polygon, but its result is an inferred
   spatial relationship, not an official document. Retain rejected candidates
   and conflicting records. Historical context outside today's cru never adds
   land to the current map.
4. **Research older references with their original scope.** Re-query official
   rights, sales and reviewed notice records over each source's available range.
   Keep original dates/references and the full event path when displaying
   historical evidence on a current parcel. Partial scope and ambiguous
   many-to-many routes remain qualified or unassigned. Filiation does not
   automatically transfer a holder, tenant, applicant or farmer.
5. **Publish coverage and limitations.** State rights years, DFI release/commune
   coverage and earliest/latest reachable events, geometry vintages, sale/notice
   ranges, parcels with documented/pre-2019 ancestry, distinct documents and lots,
   inferred-only relationships, unresolved references and missing intervals.
   Each parcel records its earliest supported event and where tracing stops.
   Validation/release/first-seen dates do not establish acquisition or creation;
   a failed download or unsearched interval is a gap, not absent history.
6. **Validate the delivery.** Use the shared acquisition/parser work from #461,
   then independently rebuild and review each cru. Regressions must cover the
   source-checked 1991 Échezeaux and 1989 Vougeot examples, multiple generations,
   many-to-many/partial scope, missing records, chronology/cycles and the rejected
   #411 slivers. Generated-data checks must reproduce pinned outputs. Keep
   app evidence lazy-loaded and measure the payload after adding history.

Validate first on Échezeaux, Grands-Échezeaux and Clos de Vougeot, then proceed
once per shared commune bundle. Open cru issues must pass this expanded gate
before closing. Previously completed #376/#377 retain their original results;
their additional history backfills are tracked explicitly in #461.
A legacy Tier 1 completion or a catalogue's theoretical start does not complete
the historical extension for a cru.

### Tier 2 — on request, per cru

- Free company-filing mirrors: deeds, contributions, lease recitals.
- Published producer holdings and independent articles (e.g. Winehog), facts only
  with links; printed references kept separate from today's parcels.

#### Shared holder research

Many legal holders have rights in several crus, so holder-to-domaine research is done
once per holder in [`docs/research/holders/holder-links.json`](research/holders/holder-links.json),
not in each cru's curation. Entries are keyed by the identifier the DGFiP rights file
records (SIREN or provisional `U…`). The generated [holder report](research/holders/holders.md)
lists every recorded holder by parcels held. It is the research queue and the coverage
record.

- **A link** names the domaine or producer, a `relation` and its `basis`, `sourceIds`,
  `reviewStatus` and `reviewedAt`.
  - Relations: `owner-company`, `family-holding`, `subsidiary`, `parent-group`,
    `common-ownership`, `management`, `brand-identity`, `lessor-per-filing`,
    `reported-tenancy`, `succession` and `shared-office`. None of them means farming.
  - A lease or reported tenancy covers particular land. It lists the `crus` whose
    parcels it names. A filing lease also records `leaseStatus`: `executed`, `recited`
    or `mandate-only`.
  - Any link may be limited to `crus` when the domaine label differs by village.
- **Review status:** `provisional` marks a cited lead whose relation is not yet
  established. A `retired` link keeps its `retiredReason` and is never shown.
- **No link found:** a holder searched without finding one keeps a `searches` record,
  so later crus don't repeat the search. Record `effort` (filings screened, pages read)
  as you go.
- **Provisional `U…` identifiers** need an `identity` crosswalk to a SIREN, with sources
  and its limitation, before they can be linked. The rights file keeps the provisional
  identifier. The SIREN may be another table key only if the two record no parcels in
  the same cru.
- **Evidence:** family holdings and other corporate relations need a company record,
  filing or legal notice. Never link from a similar name or monopole reputation.
  An undated or older owner map never overrides the current rights file or a later
  filing; use one only where nothing newer covers the parcel, and never record the
  private owners it names.
- **Scanned filings:** OCR every page before calling a screen negative; many deeds are
  image-only. A filing that names a parcel with no company record is
  `externalResearch` (`filing-named-cadastral-reference`), not a `parcelFilings` entry.
- **Sources** live in the table: shared source IDs are unique across the table and every
  curation. A filing records its deed date as `documentDate`, its raw-byte SHA-256 and the
  pages read; a filing or deposit date is a separate field.

A cru uses the table by setting `"holderLinks": "shared"` in its curation, in its Tier 2 PR.
Its `holders[]` rows keep the cru's own `basis`, `finding` and `sourceIds`. Candidate
names never appear inline: the research builder fills them from the links that apply to
that cru and appends their sources. Exactly one applicable link gives the app's domaine
heading (`holderDomains`, and with it domaine grouping); two or more stay listed leads.
Only a company-record row `basis` groups (`company-identity`, `family-company-record`,
`group-company-record` and the estate and identity bases); lease, mandate, management,
succession and name-and-seat rows stay leads under the legal holder.
Unlinked holders keep their recorded name. `build_grand_cru_holder_links.py --check`,
also run by `build_grand_cru_research.py --all --check`, fails on an unsourced link, an
identifier no cru records, an unused source or a stale report.

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
5. **CI**: the `research-data` job loops over every configured cru's `--check`,
   runs the config and research tests, and installs the geometry packages to run
   `test_grand_cru_parcels`. CI downloads no sources, so it cannot rebuild parcels or
   rerun the commune audit; the config test instead proves each committed commune
   audit was built from today's pinned hashes and stays within its limit. Browser tests stay one representative journey, parameterised by config, so the
   Chromium matrix does not grow with each cru.

**Done in #417.** Échezeaux retains identical parcel and named-area GeoJSON,
holder index, app evidence, rights history and sale records. The parcel manifest
and named-area catalogue/report now carry the pinned source licence labels; the
parcel report also records them. The research register's input paths and rebuild
commands changed because the files moved. Grands-Échezeaux gets the evidence panel
and domaine grouping through the registry.
Its Tier 1 research (#377) is in [docs/research/grands-echezeaux](research/grands-echezeaux/README.md).

### Adding a cru

1. **Bundle.** If its communes already have a bundle in `scripts/grand-crus/bundles/`
   (e.g. `flagey-echezeaux.json`), add the cru's slug to `crus` and its INAO feature
   to `parcels.parentFeatureIds`. Otherwise create `<bundle-id>.json`: `villageMap`,
   `assetName`, the pinned `parcels` block (first commune, then `additionalCommunes`),
   `lieuxDits` per commune, and the required `rightsHistory`, `saleRecords` and
   official filiation inputs. The #461 configuration/acquisition/parser extension
   is implemented for all 33 crus; follow the [history maintenance guide](research/grand-cru-history.md)
   and retain release inventories and source gaps.
   Pin licence labels and dataset pages alongside source URLs, dates and hashes.
   Use `additionalVillageMaps` when the bundle's INAO features
   appear across more than one village map; copies of the same feature must agree.
2. **Cru config** `scripts/grand-crus/<slug>.json`: `slug`, `name`,
   `parentFeatureId`, `issue`, `tier`, `bundle`, `villageMaps` (every map where the
   feature can be explored) and `evidenceFrom`. Add
   `appellationId` and `namedPlots` once named areas are reviewed,
   `rightsHistoryPurpose` for the history, and `research` (method and filings docs)
   once `docs/research/<slug>/curation.json` exists. A cru that is one whole-cru
   named area sets `namedPlots.displayLayer` to false, so the map keeps the official
   outline. So does a cru whose climats INAO already maps as denominations
   (Corton): the cadastral areas are audited and crosswalked, never drawn twice. The named-area builders treat same-name lieu-dit features in one commune
   as a single named area (as for Romanée-Saint-Vivant). A parcel that no lieu-dit
   polygon touches gets no guessed name and must be listed in
   `namedPlots.parcelsWithoutLieuDit` (as for La Grande Rue and Musigny). An official
   climat with no cadastral candidate at all is an `unresolved` entry whose
   `sourceCandidate` is null (Musigny's La Combe d'Orveau). Parcels that only touch the
   cru edge can lie mostly in a neighbouring lieu-dit; list those names in
   `namedPlots.neighbouringLieuxDits`, which the crosswalk accepts only for parcels
   mostly outside the cru. A lieu-dit recorded on both sides of a commune line is one
   named area only when its plot lists `communes` (Bonnes-Mares). Overlapping
   lieux-dits keep their published outlines under a capped `reviewedOverlaps` pair
   (Clos Saint-Denis). A plot named exactly like its cru is never matched from a wine
   label, so the cru's own name keeps the whole-cru outline. The commune audit allows 0.1% of
   the INAO boundary to be uncovered by the cru's own parcels. A larger remainder needs
   a reviewed `communeAudit.reviewedUncoveredArea` (absolute cap in m², review date,
   explanation, and the exact INAO and cadastre hashes it was reviewed against), as in
   `clos-de-vougeot.json`; changed sources then fail until reviewed again. Never clip,
   buffer or fill geometry to pass the audit.
   For a cross-commune cru, set `communeAudit.measureCrossCommuneOverlap` to true:
   the commune audit publishes coverage for each commune, pairwise shared area
   inside INAO and the union area counting that overlap once. Keep the shared
   parcel set intact across commune lines. If the cru's name also identifies one
   of several constituent lieux-dits, retain `namedPlots.displayLayer: false`.
   Before enabling a selectable named-area layer for a white cru, test that its
   white wines still resolve to the official INAO feature.
   A shared download bundle can include communes that INAO does not list for
   an individual cru. The audit counts only the listed communes as its coverage;
   other bundle communes are measured as neighbours and never fill its gaps.
3. **Build**, from the repository root:

   ```sh
   python scripts/download_grand_cru_sources.py --cru <slug>   # once per bundle
   python scripts/build_grand_cru_parcels.py --cru <slug>      # rebuilds the whole bundle
   python scripts/build_grand_cru_commune_audit.py --cru <slug>
   python scripts/build_grand_cru_named_plots.py --cru <slug>  # audit report even when displayLayer is false
   python scripts/build_grand_cru_parcel_named_areas.py --cru <slug>
   python scripts/build_grand_cru_rights_history.py --cru <slug>
   python scripts/build_grand_cru_sale_records.py --cru <slug>
   python scripts/build_grand_cru_notice_history.py --cru <slug>
   python scripts/build_grand_cru_research.py --cru <slug>     # --all --check is what CI runs
   ```

The history/source steps now ingest official DFI and every pinned historical
vintage. `python scripts/build_grand_cru_history_rollout.py --check` reproduces
all eight bundles, registers, lazy evidence and the independent audit. The
[per-cru audit](../scripts/grand-crus/reports/history-rollout-audit.md) reports
source coverage and unresolved notice archive gaps. Rebuild registers and app
evidence together with the history and coverage report.

4. **App.** Run `python scripts/build_grand_cru_app_registry.py` to update
   `registry.ts`, `holders.ts` and the lazy loaders in `evidence.ts` from the
   configs. List all of its `villageMaps` in the cru config. CI checks that the
   generated registry matches every config. The generator enables `domaineGrouping`
   only when the cru's research files contain holder-to-domaine links (`holderDomains`).
   Otherwise the app shows legal holders without a grouping control or domaine-research
   messages. Only crus with a committed commune-edge audit are wired into the app
   (`app_cru_slugs` in `grand_cru.py`); `test_grand_cru_config` fails if a cru without
   one is anything but a pending historical-extension delivery. Components need no change.
5. **Method doc** `docs/research/<slug>/README.md`: the section 5 results table,
   method, sources and limitations. Commit every build report, including the
   commune audit and the named-area audit.

Generated research JSON uses one compact line per record (`record_json` in `grand_cru.py`), so a changed parcel
shows as a one-line diff.

Outputs by convention: research in `docs/research/<slug>/`; app files in
`src/lib/places/grandCruParcels/` (`<bundle>.manifest.json`, `<bundle>.holders.json`,
`<slug>.evidence.json`, `<slug>.named-plots.json`); build reports in
`scripts/grand-crus/reports/`. The browser journey
`Grand Cru parcels: … from its config` runs one cru (`WINELOG_E2E_CRU=<slug>`).

## 4. Per-cru differences to plan for

| Case | Crus | What changes |
| --- | --- | --- |
| Cru across several communes | Montrachet, Bâtard-Montrachet (21150, 21512); Corton, Corton-Charlemagne (21010, 21480, 21606); Charlemagne (21010, 21480); Bonnes-Mares (21133, 21442) | Import every commune; audit cross-commune overlap; one parcel set per cru, never split at the commune line |
| Several crus in one commune | Vosne-Romanée 21714 (6 crus); Gevrey-Chambertin 21295 (9); Morey-Saint-Denis 21442 (4 plus Bonnes-Mares); Puligny/Chassagne (5) | Official DFI/rights acquisition, historical geometry and notice matching run once per department/commune bundle, as Flagey serves both Échezeaux crus; each cru still publishes independent ancestry and coverage reports |
| Nested or alternative labels | Mazoyères / Charmes-Chambertin; Corton climats; Chablis Grand Cru's seven climats | Wine identity rules are unchanged; parcels attach to the INAO feature, never to a label alias |
| Monopoles | Romanée-Conti, La Tâche, La Romanée, La Grande Rue, Clos de Tart | Few holders, so Tier 1 is quick. The verified-operator gate still applies: a dated, citable source is needed before any verified link |
| Many holders | Clos de Vougeot, Corton, Charmes-Chambertin | Test holder list, search and grouping at scale; measure payload size |
| Outside Côte-d'Or | Chablis Grand Cru (Yonne, 89068) | Its bundle pins Yonne's official DFI member, annual rights members and all 35 historical commune geometries, with independent coverage. The department 21 archive and Côte-d'Or notice indexes do not apply; Yonne notice archive gaps remain explicit |

## 5. Standard results table for every cru PR and issue

| Measure | Value |
| --- | ---: |
| Cadastral parcels | |
| Parcels with recorded legal-entity rights (as of date) | |
| Parcels without matched rights | |
| Rights snapshots: available / imported years and missing releases | |
| Parcels whose rights changed over the imported snapshot range | |
| Official DFI release and commune coverage | |
| Earliest / latest reachable official DFI validation date | |
| Cadastre vintages: earliest / latest obtained and gaps | |
| Current parcels with documented predecessors / pre-2019 events | |
| Distinct DFI documents / analysis lots supporting those parcels | |
| Inferred-only ancestry / unresolved references or conflicting events | |
| Sales and notices: available / imported date ranges and gaps | |
| Parcels with an authorisation / application or suspension | |
| Parcels with sale records (DVF) | |
| Parcels with holder or research leads | |
| Parcels with no lead | |
| Verified farming links | 0 unless the gate is met |
| Official history to earliest records (#461) | Delivered, or Pending with the baseline actually covered |
| Raw / gzip payload (parcels, evidence) | |

`build_grand_cru_research.py --check` checks this table in each
`docs/research/<slug>/README.md` against the generated register (Échezeaux's pilot
documents predate it). The value cell must **start with** the register's number;
detail may follow it. Row labels may extend the text shown here (for example with
the rights date), but must start with it.

- **Leads** count register parcels whose research status is not `unresolved`:
  holder leads from reviewed research, parcels named in an official notice, and
  co-sale leads. A recorded legal holder on its own is **not** a lead. **No lead**
  is the register's `unresolved` count, so the two rows always sum to the parcel count.
- **Authorisation / application or suspension** counts parcels with an
  exact-reference notice event, directly or through accepted lineage.
- **Official history (#461)** stays `Pending` until that cru's #461 backfill is
  delivered and reviewed; the value states what the baseline covers. The detailed
  history rows above are filled once it is delivered.
- **Payload** gives `raw / gzip` bytes for both the parcel file and the evidence
  file, measured as the build reports do (Python `gzip.compress(data, mtime=0)`),
  not with the `gzip` command, whose headers vary.

## 6. Rules that stay the same everywhere

- Parcels come only from the communes INAO lists for the cru. Where a neighbouring
  commune's parcels touch the boundary (the INAO line and the cadastral commune line
  disagree by a few metres), `build_grand_cru_commune_audit.py` measures and publishes
  them; they are never added as parcels, whatever their area.
- Legal holder, applicant, previous operator, authorised operator, verified operator
  and bottler are different things. None is inferred from another.
- UI wording: "Recorded right holder", "Research link · farming unverified",
  "Manual link · unverified". Never "farms" or "farmed by" without a verified link.
- Unknown rights never hide a parcel. Unresolved printed references are kept
  verbatim, never guessed.
- Official DFI event groups, inferred spatial overlaps and unresolved ancestry
  are distinct evidence. Preserve each historical record's original reference,
  date, scope and full path; never automatically transfer rights or farming
  through a split/merge. First available observations are not creation dates.
- Free public sources only for Tiers 1–2; hashes, dates and page anchors recorded;
  original PDFs not committed.
- Parcel and evidence files load only when "Show parcels" is switched on.

## 7. How to start each piece of work

Give Claude one of these requests. Each one points at the issue, so the scope,
tier and checklist come from there.

| Step | Request |
| --- | --- |
| Each cru, Tier 1 | "Start Grand Cru #378 (Clos de Vougeot), Tier 1, following docs/grand-cru-parcel-rollout.md and #461." |
| Shared village | "Start the Gevrey-Chambertin bundle, Tier 1: #391–#399, one PR per cru, following docs/grand-cru-parcel-rollout.md and #461." |
| Backfill only | "Complete the #461 backfill for #378." For a cru whose legacy Tier 1 is already closed, as with #376 and #377. |
| Optional Tier 2 | "Do Tier 2 research for #378." Attach or link any PDFs, filings or articles you want reviewed. |

Append "stop before opening the PR" to review the changes first, or "in a worktree"
to keep the main checkout free.

The shared #461 history pipeline is merged (#462, #463, #472, #491): all 33 crus
already have rights history, notice history, sale records and lazy evidence. A
Tier 1 run therefore:

1. Reads the cru issue and its #461 checklist, and checks the generated files.
   Looks up every commune code it will name (`bundle_commune_names` in
   `grand_cru.py`, or geo.api.gouv.fr); a notice's printed commune is matched by
   code, so a swapped code flips accept/reject decisions.
2. Completes the remaining per-cru items: the commune-edge audit (which lets a
   hidden cru appear on the maps), the named-area crosswalk, and page-image review
   of any `unreviewedCandidates` in its `notice-history.json`. Record each read page
   in the curation's `noticeReview`: confirmed rows become `exactParcelEvents`, and
   matched references the page does not support go in `rejectedReferenceHints`,
   each with its reason. A republished copy of the same act is reviewed with
   `repeatOf`, not a second event.
3. Regenerates outputs, updates the README results table and passes every `--check`.
   Rebuild and measure under Python 3.12, as CI does. Python 3.14's zlib-ng gives
   different gzip sizes, and Python 3.11's float `sum()` changes generated areas.
4. Opens one PR per cru. After merge, the cru issue's #461 checklist is ticked with
   its own evidence and links, the cru is ticked in #461, and the issue closes.

Some government download sites may refuse connections. The Côte-d'Or and Yonne
prefecture sites refused every connection in October 2026, so earlier bulletins
came from Internet Archive and Common Crawl copies
([earlier-bulletins README](research/earlier-bulletins/README.md)). If a download is
blocked, Claude reports it, records the gap and gives the commands to run locally.
