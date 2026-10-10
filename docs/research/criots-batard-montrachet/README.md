# Criots-Bâtard-Montrachet parcels: Tier 2 (#450)

Criots-Bâtard-Montrachet uses INAO `inao-denom-564`, appellation 178.
Only Chassagne-Montrachet (21150) is imported. Puligny-Montrachet shares the download bundle but is an audited neighbour for this cru. Tier 1 reviewed 7 October 2026; Tier 2 reviewed 10 October 2026 for season 2026 under the
[rollout playbook](../../grand-cru-parcel-rollout.md) and [#461 history method](../grand-cru-history.md).

**No current farmer is verified.** Recorded rights, filiation, deeds and
administrative procedures remain distinct evidence; none establishes current farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 11; 1.543904 ha of measured cru overlap |
| Parcels with recorded legal-entity rights (1 January 2025) | 5; 4 holder identifiers |
| Parcels without matched rights | 6 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights file listed at the 7 October recheck |
| Parcels whose rights changed over the imported snapshot range | 2; names and unprovable identifiers distinguished from holder changes |
| Official DFI release and commune coverage | July 2026, complete department 21 member; 21150 validations 1989-04-12–2026-06-15 |
| Earliest / latest reachable official DFI validation date | 2001-03-15 / 2013-04-22 |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01; all 35 listed vintages per INAO commune through the pinned map obtained; September 2026 is outside the pinned geometry range |
| Current parcels with documented predecessors / pre-2019 events | 6 / 6 |
| Distinct DFI documents / analysis lots supporting those parcels | 3 / 3 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; 11 terminal references reach a source boundary or unrecorded event |
| Sales and notices: available / imported date ranges and gaps | DVF+ declared 2014-01-01–2025-12-31, complete BFC 2026-1 archive imported; observed commune deeds 2014-01-08 to 2025-12-12. Notices: partial departmental 2004–2015, departmental 2016–2020 and regional 2019–2026 indexes; gaps below |
| Parcels with an authorisation / application or suspension | 0 |
| Parcels with sale records (DVF) | 2; 2 current-reference deeds, 0 historical-reference deeds |
| Parcels with holder or research leads | 2; recorded holders without a reviewed producer relationship remain separate |
| Parcels with no lead | 9 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: complete official DFI member queried, earliest reachable validation 2001-03-15, all pinned geometry vintages and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 177,348 / 27,064 bytes. Evidence: 57,806 / 9,380 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 201-parcel Montrachet bundle; this cru selects 11 unique parcels.
No named-area asset loads. Parcel geometry and evidence load only after Parcel
rights is enabled; the production payload report checks compiled JS.

## Tier 1 to Tier 2

| Measure | Tier 1 | Tier 2 |
| --- | ---: | ---: |
| Parcels with research leads | 0 | 2 |
| Unresolved parcels | 11 | 9 |
| Reviewed holder links applicable to the cru | 0 | 2 |
| Parcels with exact company filings | 0 | 0 |
| Current farmers verified | 0 | 0 |

[The filing inventory](filings.md) records 18 new distinct PDFs / 564 pages and three reused PDFs / 113 pages. Lamy is linked to its own company; Maison Prosper Maufoux is a partner-company relationship. GFA Saint-Joseph and provisional U21930118 remain without producer links. Neither supplied Winehog article gives individual number-and-area matches; three named-area census entries remain unallocated.

| Recorded holder | Shared effort reused | New filings / pages | Finding |
| --- | ---: | ---: | --- |
| SAINT JOSEPH (`324396639`) | — | 4 / 81 | The GFA Saint-Joseph statutes retain an authority to acquire land in Les Criots, without a cadastral number or individual area. The two copies dated 2 April 2026 differ: the later deposit names Edouard Guerrand and Roger Belland, while the earlier deposit names Marie and Roger Belland. These private partners and a general obligation to lease do not identify a producer company or a parcel tenant. No AE97/6120 m² schedule is found in the bounded four-PDF corpus; no producer link is accepted. |
| DOMAINE HUBERT LAMY (`419971130`) | — | 6 / 300 | The official registry and 25 July 2023 statutes identify Domaine Hubert Lamy (419971130), supporting the domaine company link. In the older formation/donation bundles, Criots entries are wine stocks, not land schedules. The lease schedule names Chassagne AM132/AM133 and Puligny AP91 (8985 m²), not Chassagne AE91 (465 m²). No exact current Criots schedule is found in the six-file corpus; company identity and historic leases do not establish current parcel operation. |
| DOMAINE DU CHATEAU DE SAINT AUBIN (`778249052`) | — | 8 / 183 | The 16 September 2026 collective decision names Maison des Grands Crus (395115447) as a partner of Domaine du Chateau de Saint Aubin (778249052). Prosper Maufoux’s official legal notice identifies that same 395115447 company as its publisher. This supports a partner-company relationship to Maison Prosper Maufoux, not substitution of the holder or a farming claim. The 2021 resolutions approve absorption of GFA Domaine Prosper Maufoux (431087675); the selected eight-PDF corpus supplies no individual AE90/504 m² schedule. |
| SC DOMAINE D AUVENAY (`U21930118`) | 3 / 113 | 0 / 0 | The provisional U21930118 identifier has no accepted company-record crosswalk. Three existing 778252445 d’Auvenay filings (2001, 2019 and 2024; 113 pages) were reacquired with unchanged hashes and fully OCR-screened for Criots. They contain no AE92/AE93 reference with individual areas supporting the identity. Winehog prints only their combined 0.0637 ha. The shared 778252445 company identity cannot be transferred to this U identifier by name or aggregate area. |

## Geometry and named areas

The [commune audit](../../../scripts/grand-crus/reports/criots-batard-montrachet-commune-audit.json) measures 15,439.044669 m² covered by Chassagne within the 15,718.181560 m² INAO feature. Puligny-Montrachet and Saint-Aubin have no contact, and there are no own-commune subthreshold contacts. The original 11 full cadastral polygons form one parcel set.

The [boundary review](boundary-review.json) records 279.136890 m² uncovered (1.775885%), bounded by a source-hash-specific 279.2 m² cap. The single connected strip follows the northern and western edges and tapers at the eastern corner. Its wide enclosing rectangle reflects the bent outline, not a missing interior parcel. The whole feature and enlarged component were visually inspected; no missing commune or detached missing parcel was found. No source geometry is clipped, buffered, filled or simplified.

The [BIVB reference](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/criots-batard-montrachet,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MzA0Jnw%3D) supports the appellation and commune scope.
Cadastral names are reviewed as constituents, without declaring separate official
climats or producer holdings. The [named-area audit](../../../scripts/grand-crus/reports/criots-batard-montrachet-named-plots.json) measures LES CRIOTS as the main cadastral constituent (1.567727 ha inside INAO) and BLANCHOT DESSUS as a 40.907 m² boundary contact. The latter is audited source geometry, not a declaration that the neighbouring name is an official Criots climat or a producer holding.

All 11 [parcel crosswalk](parcel-named-areas.json) entries are LES CRIOTS; no parcel is assigned to BLANCHOT DESSUS and every parcel touches a lieu-dit polygon. `displayLayer` remains false: the main area is effectively the whole cru and the other intersection is only boundary context. White-wine tests preserve the full official INAO outline.

## Sources, rights, history and sales

The [source recheck](source-review.json) pins the
[7 October Montrachet catalogue snapshots](../../../scripts/grand-crus/sources/catalogues/2026-10-07-montrachet/)
with URLs, acquisition hashes, sizes and exact UTC retrieval times. The BIVB
HTML has its embedded Google API key redacted using the shared byte-preserving
redactor; metadata retains original and sanitized hashes and sizes. The recheck
confirms rights 2019–2025, the July 2026 DFI release, January 2025 schema,
geometry inventory and DVF release. The [shared inventory](../../../scripts/grand-crus/sources/inventory-2026-10-01.json)
retains original archive/member identities, licence labels and download provenance.

Exact full-reference joins preserve all holders/right codes and never suppress
geometry for unknown rights. Missing legal-entity records do not establish
private ownership or absence of an owner. Company continuity requires an
unchanged valid SIREN. Reviewed company relationships enable research grouping. Company identity and
partnership remain distinct from farming. Paid SPF/outreach stays Tier 3.

[Rights history](rights-history.json) preserves complete mother/daughter sets,
original validation dates and full ancestry paths. There are
0 accepted multi-vintage spatial candidates and
0 rejected candidates; 0
next-vintage successors satisfy the separate #411 rule. They remain spatial
inference, distinct from documented DFI. No current parcel has inference-only
ancestry. A source boundary is not a creation date; filiation never backdates
rights or automatically transfers an operator.

[Sale records](sale-records.json) retain dates and original references without
prices, addresses or parties. Observed source ranges do not prove continuity or
extend back to the oldest DFI event.

## Notice review and gaps

The [notice audit](notice-audit.json) queries all 14 current/reachable references across the three Côte-d’Or corpora. There are no reviewed matches, pending page-image candidates or raw OCR suffix hits. This source-specific result does not establish absent history across the published archive gaps. No administrative event or current farmer is inferred.

Earlier publications are partial Internet Archive/Common Crawl captures under
official URLs. No Côte-d'Or bulletin was obtained for 2007, 2009, 2012 or 2014.
Other 2004–2015 years remain incomplete; departmental 2021–2026, regional
pre-2019 and pre-2004 intervals remain unsearched or outside the corpus.
See the [availability audit](../../../scripts/grand-crus/sources/notice-coverage-2026-10-04.json)
and [earlier-bulletin research](../earlier-bulletins/README.md). These shared gaps
remain under #461; unverified operation remains under #364. Access failure or
an unsearched interval is a gap, not absence of history.

## Reproduce and validate

Use Python 3.12 with `scripts/burgundy-map-requirements.txt`:

```sh
python scripts/download_grand_cru_sources.py --cru criots-batard-montrachet
python scripts/build_grand_cru_parcels.py --cru criots-batard-montrachet --check
python scripts/build_grand_cru_commune_audit.py --cru criots-batard-montrachet --check
python scripts/build_grand_cru_named_plots.py --cru criots-batard-montrachet
python scripts/build_grand_cru_parcel_named_areas.py --cru criots-batard-montrachet --check
python scripts/build_grand_cru_history_rollout.py --bundle montrachet --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
python scripts/audit_grand_cru_history_rollout.py --check
bun run build
python scripts/measure_grand_cru_payload.py
bun run test
```

The representative Chromium journey uses `WINELOG_E2E_CRU=criots-batard-montrachet` with
`burgundy-village-map.spec.ts` to check mobile width, keyboard toggling, retry,
unknown rights, holder search, scoped manual producer links, dated evidence and
owner/shared views. The routine browser matrix remains unchanged.
The cru issue and its #461 line are completed only after review and merge.

## Supplemental Pappers review: 10 October 2026

Supplemental Pappers review on 10 October 2026 reuses ch-pappers-auvenay-2012 (31 pages), first counted at Chevalier. Criots remains 18 new distinct PDFs / 564 pages. U21930118 still lacks a company-record identity crosswalk or individual AE92/AE93 schedule. The 28 April 1989 contribution is a targeted unacquired deed lead.

Key findings and source hashes are in the [supplemental filing review](filings.md#supplemental-pappers-review-10-october-2026). Exact parcel coverage, supported holder links and verified farming counts do not change.
