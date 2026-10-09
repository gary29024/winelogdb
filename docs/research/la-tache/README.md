# La Tâche parcels: Tier 2 (#429)

La Tâche uses INAO `inao-denom-656`, appellation 191, and Vosne-Romanée commune
21714. Tier 1 history reviewed 7 October 2026; Tier 2 research reviewed
8 October 2026, locally audited 9 October 2026, for season 2026 under the
[rollout playbook](../../grand-cru-parcel-rollout.md) and
[#461 history method](../grand-cru-history.md). It shares the Vosne bundle with
five other crus; this delivery enables only La Tâche.

**No current farmer is verified.** Recorded rights, parcel filiation, deeds and
administrative procedures are distinct evidence, and none establishes farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 2; 6.048219 ha of measured cru overlap |
| Parcels with recorded legal-entity rights (1 January 2025) | 2; 1 holder identifier and 2 right records |
| Parcels without matched rights | 0 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights file listed at the 7 October recheck |
| Parcels whose rights changed over the imported snapshot range | 0; 2019–2025 |
| Official DFI release and commune coverage | July 2026, complete department 21 member; commune 21714 records validate from 1989-05-05 to 2026-06-29 |
| Earliest / latest reachable official DFI validation date | None: no DFI event reaches either current parcel |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01; all 35 listed vintages through the pinned map obtained; September 2026 is outside the pinned geometry range |
| Current parcels with documented predecessors / pre-2019 events | 0 / 0 |
| Distinct DFI documents / analysis lots supporting those parcels | 0 / 0 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; both traces end at a source boundary or unrecorded event |
| Sales and notices: available / imported date ranges and gaps | DVF+ declared 2014-01-01–2025-12-31, complete BFC 2026-1 archive imported; commune observations 2014-01-20–2025-12-17. Notices: partial departmental 2004–2015, departmental 2016–2020 and regional 2019–2026 indexes; archive gaps below |
| Parcels with an authorisation / application or suspension | 0 |
| Parcels with sale records (DVF) | 0; no deed on either current reference |
| Parcels with holder or research leads | 2; a recorded legal holder alone is not a lead |
| Parcels with no lead | 0 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: the complete DFI member contains no event for AM0009 or AM0016, so tracing stops at the source boundary; all pinned geometry vintages and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 77,030 / 12,485 bytes. Evidence: 45,696 / 7,830 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 83-parcel Vosne bundle; the La Tâche selection contains 2 of those
parcels. No named-area GeoJSON is added (see below). Rights geometry and evidence
load only after Parcel rights is switched on. The production payload report
additionally measures compiled JS.

## Geometry and named areas

The [bundle](../../../scripts/grand-crus/bundles/vosne-romanee.json) pins the
1 June 2026 cadastre, lieux-dits, rights files, licences, URLs and SHA-256 hashes.
Full parcel polygons remain unchanged; overlaps are measured separately in
EPSG:2154. The [commune audit](../../../scripts/grand-crus/reports/la-tache-commune-audit.json)
finds 0.2 m² of the 60,483.0 m² INAO outline without parcel coverage, well below
the default 0.1% limit; no neighbouring parcel covers it. Flagey-Échezeaux,
Nuits-Saint-Georges and Vougeot have no contact. Ten own-commune contacts, each
below 0.2 m², are excluded and retained individually in the
[parcel report](../../../scripts/grand-crus/reports/vosne-romanee-parcels.json).
No geometry is repaired, clipped, buffered or filled to pass this audit.

The [BIVB appellation page](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/tache-la,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MzIzJnw%3D)
lists two climats, La Tâche and Les Gaudichots. The pinned cadastre divides the cru
between two lieux-dits, `LA TACHE` and `LES GAUDICHOTS OU LA TACHE`. The first
matches by case and accent normalization. The second differs from the BIVB's
"Les Gaudichots", so no alias is added; the cadastral name is kept as printed.
Clipped to INAO, the two named areas measure 1.448337 and 4.599904 ha, each a
single polygon, leaving a 0.63 m² gap. The
[named-area audit](../../../scripts/grand-crus/reports/la-tache-named-plots.json)
records these measurements.

**No display layer is published.** The cru's own name is also the name of one
named area, so the app's label matcher would send every "La Tâche" wine to the
smaller `LA TACHE` area (24% of the cru). That would wrongly narrow the map. The
map therefore keeps the whole-cru outline until a selectable layer can exclude the
cru's own name from area matching. The [parcel crosswalk](parcel-named-areas.json)
still records AM0016 entirely in `LA TACHE` and AM0009 entirely in
`LES GAUDICHOTS OU LA TACHE`. These are cadastral named areas, not producer
holdings.

## Rights, history and sales

The [source recheck](source-review.json) uses the shared
[7 October Vosne snapshot](../../../scripts/grand-crus/sources/catalogues/2026-10-07-vosne-romanee/),
pinning catalogue bytes, sizes, hashes and exact UTC retrieval times, plus the
cru's own BIVB page hash. It confirms the existing rights years, latest DFI
release/schema and geometry release inventory. The
[shared inventory](../../../scripts/grand-crus/sources/inventory-2026-10-01.json)
retains the raw member identities and original acquisition timestamps.

Both parcels join on complete references with matching fiscal areas. Each has one
code P (ownership) record for the same identifier, `778269407`, unchanged in every
snapshot from 2019 to 2025. A single recorded owner is a rights fact only: it does
not establish who farms the vineyard, and no monopoly or operator claim is
inferred from the holder's name. Tier 2 adopts the
[shared holder table](../holders/holder-links.json), whose reviewed `owner-company` link
names the holder as the Domaine de la Romanée-Conti company; the app groups both parcels
under that heading and says **Research link · farming unverified**. Paid SPF
copies and outreach remain Tier 3.

[Rights history](rights-history.json) finds no DFI event for AM0009 or AM0016 in
the complete July 2026 department member, whose commune records start on
5 May 1989. Both parcels are observed in every geometry vintage from 6 July 2017,
and their traces stop at a source boundary. That first observation is not a
creation date. No spatial next-vintage candidate is accepted or rejected.

[DVF+](sale-records.json) has no deed on either reference. Available and observed
intervals are not proof of uninterrupted records.

## Notices and gaps

The [notice audit](notice-audit.json) and [notice history](notice-history.json)
query both current references against the three Côte-d'Or corpora. There are zero
reviewed matches and zero unreviewed candidates. One OCR reference hint, AM 16,
occurs in `bfc-2020-008:p25`, a notice for an applicant in Viévigne that names
five other communes and never Vosne-Romanée, so it is not assigned to La Tâche.
The three reviewed Vosne-Romanée rows (AB 100, AN 112 and AN 249) are outside
La Tâche's reachable reference set and remain unassigned. No OCR-only event is
promoted.

Earlier publications are partial Internet Archive/Common Crawl captures under
their original official URLs. No Côte-d'Or bulletin was obtained for 2007, 2009,
2012 or 2014. Other 2004–2015 years have incomplete coverage; departmental
2021–2026, regional pre-2019 and pre-2004 intervals remain unsearched or outside
the indexed corpus. See the [dated availability audit](../../../scripts/grand-crus/sources/notice-coverage-2026-10-04.json)
and [earlier-bulletin research](../earlier-bulletins/README.md). Access failure or
an unsearched interval is a gap, not absence of history. These shared gaps remain
tracked in #461; unverified operation and unresolved name research stay under
#364 and #344 respectively.

## Tier 2 holder and filing research

The one recorded holder, `778269407`, was researched through the shared table. Its reviewed `owner-company` link to Domaine de la Romanée-Conti, recorded for Échezeaux and Grands-Échezeaux and re-checked for Richebourg, Romanée-Saint-Vivant and Romanée-Conti, now applies here. The pass screened **7 DRC filings / 548 pages** with embedded text and OCR of every image page, then checked the cited schedule against page images. The [filing inventory](filings.md) records dates, references, page numbers, hashes, bounded negatives and effort.

The 21 December 1974 notarial statutes, deposited in 2002, list the estate as then composed. Item 20 is AM 9, “Les Gaudichots” or “La Tâche”, 4 ha 62 a 75 ca, and item 22 is AM 16, “La Tâche”, 1 ha 43 a 45 ca. Both equal the current cadastral areas, so both parcels have an exact filing. The 6 later filings, from 2003 to 2024, print no cadastral schedule; the 2003, 2009 and 2024 statutes recite the 1942 contribution of the whole estate and its brands, including the Clos de La Tâche label.

The DRC’s estate page publishes 6.0620 ha, equal to the summed cadastral areas of AM 9 and AM 16. It feeds only the named-area census; an equal total is not a parcel assignment.

The prior cloud pass reviewed four user-supplied Winehog archives (see [filings](filings.md#winehog-articles)). They are **not re-verified locally**, as instructed. The prior findings of no cadastral number and rounded 1.43 ha / 4.63 ha totals remain qualified census context; the historical account remains critic evidence.

Research leads rise from **0 to 2 of 2 parcels**. The legal-rights and geometry counts are unchanged; verified farming remains **0**.

| Measure | Tier 1 | Tier 2 |
| --- | ---: | ---: |
| Parcels with holder or research leads | 0 | 2 of 2 |
| Parcels with no named candidate | 2 | 0 |
| Holders with an applicable link | 0 | 1 of 1: reviewed `owner-company` |
| Parcels with exact-reference company filings | 0 | 2 in 1 filing entry |
| Published holdings in the named-area census | 0 | 1 |
| Verified farming links | 0 | **0** |

### Effort per holder

| Recorded holder | Filings | Pages | Outcome |
| --- | ---: | ---: | --- |
| Domaine de la Romanée-Conti (`778269407`) | 7 | 548 | The 1974 notarial estate schedule names AM9 and AM16 with their exact areas. 6 later DRC filings add no cadastral schedule or lease; legal company identity remains a research link. Farming unverified. |

The counts above describe this pass, including DRC files re-screened after earlier crus; earlier totals remain in the table’s effort note.

### Tier 2 access and evidence gaps

- Bounded filing review: 7 DRC filings (548 pages) were screened, chosen for statutes and estate schedules. The free index lists 55 DRC filings, mostly share donations and management changes; unscreened filings are a bounded negative, not proof that no later schedule exists.
- The 1974 schedule is historical estate evidence: no screened filing records a later lease, operator or farming season for AM 9 or AM 16. The same schedule’s AM 10 and AM 14 (Les Gaudichots) lie outside this cru.
- Local audit 2026-10-09 retried data.inpi.fr and pappers.fr for SIREN 778269407; both returned HTTP 403. Filings or accounts available only there remain unverified.
- All four Winehog archives are not re-verified locally, at the repository owner’s instruction. Original URLs, printed dates and hashes remain qualified prior cloud evidence; the recorded lack of cadastral numbers, named-area totals and historical account were not independently checked locally.
- Source boundaries, failed notice downloads and unsearched historical intervals remain in the Tier 1 coverage. Current farming remains unconfirmed for both parcels; paid SPF copies and outreach remain Tier 3.

## Local audit (Codex CLI, Windows, Python 3.12)

On 9 October 2026, **7 PDFs / 548 pages** were freshly downloaded; every SHA-256, byte count and page count matches. The files also match the copies already read in full during the earlier local audits. That all-page reading was reused by exact hash, and all cited pages were re-read for La Tâche. PDF pages 38–39 were checked as images: AM 9 is 46,275 m² and AM 16 is 14,345 m²; AM 10 and AM 14 are separate, outside this cru. Both exact matches remain historical evidence, with no parcel-specific lease or current farming claim.

The 2024 citation now includes PDF page 41 (14 November management declaration) and page 44 (statutes dated 27 July). The estate page’s 6.0620 ha and raw bytes match. The company API, cited under two source IDs, has changed response bytes but preserves SIREN 778269407, legal name, active status and Vosne-Romanée seat; it remains identity evidence only. Both INPI/Pappers retries returned HTTP 403. All four Winehog archives are **not re-verified locally**, at the owner’s instruction; their totals and historical claims remain qualified prior findings.

Validation:

- Passed: research `--all --check`, holder links, app registry, independent rollout audit, lint, typecheck, production build, payload measurement and `git diff --check`.
- Complete raw-source history rollout `--check`: passed.
- Python CI list: **226 passed / 1 error (227 total)**, the established Windows Corton climat rounding difference (4603.0682 versus committed 4603.0683 m²).
- Vitest: **5,626 passed / 1 failed**, the known `tasteSection` English-month expectation against Windows `2026年8月`.
- Chromium and mobile WebKit: **43 passed / 3 skipped / 2 failed**. Both failures are `Official history: la-tache`: the shared test assumes a DFI-validation event exists, but neither parcel has one; it fails before browser interaction. Both La Tâche parcel journeys pass.
- Production evidence: **33 chunks, 5,610,093 raw / 504,895 gzip bytes**; zero evidence modules in initial or map static module graphs. La Tâche evidence: **45,696 / 7,830 bytes**. Independent audit: 451 obtained and two documented missing resources, 33 crus, 2,721 parcels, zero verified farming.

The platform and shared-test exceptions remain open; this is not an all-green local run.

## Reproduce and validate

Use Python 3.12, as CI does, with
`scripts/burgundy-map-requirements.txt`. From the repository root:

```sh
python scripts/download_grand_cru_sources.py --cru la-tache
python scripts/build_grand_cru_parcels.py --cru la-tache --check
python scripts/build_grand_cru_commune_audit.py --cru la-tache --check
python scripts/build_grand_cru_named_plots.py --cru la-tache
python scripts/build_grand_cru_parcel_named_areas.py --cru la-tache --check
python scripts/build_grand_cru_history_rollout.py --bundle vosne-romanee --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
python scripts/audit_grand_cru_history_rollout.py --check
npm run build
python scripts/measure_grand_cru_payload.py
```

The browser journey uses `WINELOG_E2E_CRU=la-tache` with
`burgundy-village-map.spec.ts`, without expanding the normal Chromium matrix.

This delivery references #429 and tracker #420 without closing them. Tier 1 history
review remains separately tracked under #461; current farming remains under #364.
