# La Grande Rue parcels: Tier 2 (#430)

La Grande Rue uses INAO `inao-denom-654`, appellation 189, and Vosne-Romanée
commune 21714. Tier 1 history reviewed 7 October 2026; Tier 2 research reviewed
8 October 2026 for season 2026 under the
[rollout playbook](../../grand-cru-parcel-rollout.md) and
[#461 history method](../grand-cru-history.md). It shares the Vosne bundle with
five other crus; this delivery enables only La Grande Rue.

**No current farmer is verified.** Recorded rights, parcel filiation, deeds and
administrative procedures are distinct evidence, and none establishes farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 3; 1.649917 ha of measured cru overlap |
| Parcels with recorded legal-entity rights (1 January 2025) | 3; 1 holder identifier and 3 right records |
| Parcels without matched rights | 0 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights file listed at the 7 October recheck |
| Parcels whose rights changed over the imported snapshot range | 3; a record first appears in 2020, and the same identifier's recorded name changes in 2022 |
| Official DFI release and commune coverage | July 2026, complete department 21 member; commune 21714 records validate from 1989-05-05 to 2026-06-29 |
| Earliest / latest reachable official DFI validation date | None: no DFI event reaches any current parcel |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01; all 35 listed vintages through the pinned map obtained; September 2026 is outside the pinned geometry range |
| Current parcels with documented predecessors / pre-2019 events | 0 / 0 |
| Distinct DFI documents / analysis lots supporting those parcels | 0 / 0 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; all 3 traces end at a source boundary or unrecorded event |
| Sales and notices: available / imported date ranges and gaps | DVF+ declared 2014-01-01–2025-12-31, complete BFC 2026-1 archive imported; commune observations 2014-01-20–2025-12-17. Notices: partial departmental 2004–2015, departmental 2016–2020 and regional 2019–2026 indexes; archive gaps below |
| Parcels with an authorisation / application or suspension | 0 |
| Parcels with sale records (DVF) | 0; no deed on any current reference |
| Parcels with holder or research leads | 3; a recorded legal holder alone is not a lead |
| Parcels with no lead | 0 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: the complete DFI member contains no event for AM0001, AM0002 or AM0008, so tracing stops at the source boundary; all pinned geometry vintages and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 77,030 / 12,485 bytes. Evidence: 51,219 / 8,623 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 83-parcel Vosne bundle; the La Grande Rue selection contains 3 of
those parcels. No named-area GeoJSON is added (see below). Rights geometry and
evidence load only after Parcel rights is switched on. The production payload
report additionally measures compiled JS.

## Geometry and named area

The [bundle](../../../scripts/grand-crus/bundles/vosne-romanee.json) pins the
1 June 2026 cadastre, lieux-dits, rights files, licences, URLs and SHA-256 hashes.
Full parcel polygons remain unchanged; overlaps are measured separately in
EPSG:2154. The [commune audit](../../../scripts/grand-crus/reports/la-grande-rue-commune-audit.json)
finds 0.4 m² of the 16,500.6 m² INAO outline without parcel coverage, well below
the default 0.1% limit; no neighbouring parcel covers it. Flagey-Échezeaux,
Nuits-Saint-Georges and Vougeot have no contact. Three own-commune contacts, each
below 1 m², are excluded and retained individually in the
[parcel report](../../../scripts/grand-crus/reports/vosne-romanee-parcels.json).
No geometry is repaired, clipped, buffered or filled to pass this audit.

The [BIVB appellation page](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/grande-rue-la,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MzE5Jnw%3D)
lists La Grande Rue as the cru's only climat, and the pinned cadastre records
`LA GRANDE RUE`. Clipped to INAO, it measures 1.417529 ha in one polygon, about
86% of the 1.650055 ha outline. **Of the remaining 2,325 m², 2,324 m² lies in no
cadastral lieu-dit polygon at all** and 0.9 m² touches `LES GAUDICHOTS OU LA TACHE`.
The first is a hole in the pinned lieu-dit layer, not another name. The
[named-area audit](../../../scripts/grand-crus/reports/la-grande-rue-named-plots.json)
records the 0.232526 ha unmapped remainder. Because the named area is the whole
cru, no display layer is published and the map keeps the whole-cru outline;
nothing is filled or extended to close the gap.

The [parcel crosswalk](parcel-named-areas.json) places AM0001 entirely in
`LA GRANDE RUE`. AM0002 (2,093.5 m²) and AM0008 (230.8 m²) touch no lieu-dit
polygon, so they get no cadastral name rather than a guessed one. The cru config
lists them as reviewed `parcelsWithoutLieuDit`, and any other parcel outside every
lieu-dit fails the build. The register labels them "No cadastral lieu-dit".
Unresolved name research stays under #344.

## Rights, history and sales

The [source recheck](source-review.json) uses the shared
[7 October Vosne snapshot](../../../scripts/grand-crus/sources/catalogues/2026-10-07-vosne-romanee/),
pinning catalogue bytes, sizes, hashes and exact UTC retrieval times, plus the
cru's own BIVB page hash. It confirms the existing rights years, latest DFI
release/schema and geometry release inventory. The
[shared inventory](../../../scripts/grand-crus/sources/inventory-2026-10-01.json)
retains the raw member identities and original acquisition timestamps.

All three parcels join on complete references with matching fiscal areas. The
1 January 2019 legal-entity file has no record for any of them. From 2020 each
records one code P (ownership) right for identifier `397738634`; the recorded name
for that identifier changes in the 2022 file. The absence in 2019 is not evidence
of a private owner or a sale: this dataset omits private persons, and nothing is
inferred about the earlier holder. A recorded owner does not establish who farms
the vineyard, and no monopoly or operator claim is inferred from the holder's
name. Tier 2 adopts the [shared holder table](../holders/holder-links.json), whose
reviewed `owner-company` link names the holder as the company of Domaine Nicole
Lamarche; the app groups all three parcels under that heading and says
**Research link · farming unverified**. Paid SPF copies and outreach remain Tier 3.

[Rights history](rights-history.json) finds no DFI event for AM0001, AM0002 or
AM0008 in the complete July 2026 department member, whose commune records start on
5 May 1989. All three parcels are observed in every geometry vintage from
6 July 2017, and their traces stop at a source boundary. That first observation is
not a creation date. No spatial next-vintage candidate is accepted or rejected.

[DVF+](sale-records.json) has no deed on any of the three references. Available
and observed intervals are not proof of uninterrupted records.

## Notices and gaps

The [notice audit](notice-audit.json) and [notice history](notice-history.json)
query all 3 current references against the three Côte-d'Or corpora. There are
zero reviewed matches and zero unreviewed candidates. The OCR reference hint AM 8
occurs in two notices, `bfc-2020-001:p96` and `bfc-2021-006:p43`. Both name other
communes and never Vosne-Romanée, so neither is assigned to La Grande Rue. The
three reviewed Vosne-Romanée rows (AB 100, AN 112 and AN 249) are outside
La Grande Rue's reachable reference set and remain unassigned. No OCR-only event
is promoted.

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

The one recorded holder, `397738634`, was researched through the shared table. Its reviewed `owner-company` link to Domaine Nicole Lamarche, recorded for Échezeaux, now applies here. The pass screened **17 of the company’s 17 indexed filings / 591 pages** with embedded text and OCR of every image page. The [filing inventory](filings.md) records dates, page numbers, hashes, bounded negatives and effort.

No filing prints AM 1, AM 2 or AM 8. The GFA Domaine François Lamarche was formed in 1994 and received the whole vineyard business by an 11 August 1994 notarial deed that later statutes recite by value only; that deed is not in the free index. In 2001 the GFA authorised a long-term lease of its land to a family member, to be made available to the operating SARL; in 2019 it absorbed that SARL and became SAS Nicole Lamarche, which also absorbed EARL Nicole Lamarche in 2022. These filings explain the rights file’s 2022 change of recorded name for the same identifier but are not parcel-specific operation evidence.

The domaine’s own La Grande Rue page, captured by the Internet Archive in November 2022, gives the monopole as 1 ha 65 a, consistent with the three parcels’ 16,525 m². It feeds only the named-area census; the domain now serves unrelated content.

The repository owner supplied both requested Winehog articles (see [filings](filings.md#winehog-articles)). Both give 1.65 ha and neither prints a cadastral number. They link the former Gaudichots part to the 1989 promotion and to a 1959 exchange of plots with the DRC respectively; its 0.2318 ha equals AM 2 + AM 8 by area only, which is not a crosswalk.

Research leads rise from **0 to 3 of 3 parcels**. The legal-rights and geometry counts are unchanged; verified farming remains **0**.

| Measure | Tier 1 | Tier 2 |
| --- | ---: | ---: |
| Parcels with holder or research leads | 0 | 3 of 3 |
| Parcels with no named candidate | 3 | 0 |
| Holders with an applicable link | 0 | 1 of 1: reviewed `owner-company` |
| Parcels with exact-reference company filings | 0 | 0 |
| Published holdings in the named-area census | 0 | 1 |
| Verified farming links | 0 | **0** |

### Effort per holder

| Recorded holder | Filings | Pages | Outcome |
| --- | ---: | ---: | --- |
| Nicole Lamarche (`397738634`) | 17 | 591 | Filings trace the 1994 GFA, which received the whole Lamarche vineyard business by an unfiled 1994 deed, to SAS Nicole Lamarche after its 2019 merger with the operating company. No filing prints AM1, AM2 or AM8; the company link is reviewed. Farming unverified. |

### Tier 2 access and evidence gaps

- Bounded filing review: 17 of the 17 filings the free index lists for 397738634 were screened (591 pages); the rest are listed below as not screened. None prints AM 1, AM 2 or AM 8.
- The 11 August 1994 notarial deed that contributed the Lamarche vineyard business to the GFA is recited by value only and is not in the free index; its parcel list would need a paid land-register copy (Tier 3).
- The 2001 lease authorisation, the 29 November 2001 rural lease recited in 2010 (to 31 December 2018, land in four communes) and the 2019 merger treaty describe leases to family members and mises à disposition to the operating company without parcel lists; they are not parcel-specific operation evidence.
- The domaine’s current website domain hosts unrelated content; the published 1 ha 65 a comes from a November 2022 archive capture.
- data.inpi.fr and pappers.fr refuse this cloud environment: filings or accounts available only there are pending local audit.
- Both requested Winehog articles were supplied by the repository owner as saved webarchives and reviewed; URLs, printed dates and archive hashes are recorded, and archives and article text are not committed. Neither prints a cadastral number. The 2014 article links the former Gaudichots part to the 1989 promotion and the 2018 article to a 1959 exchange with the DRC; the 2018 article’s 0.2318 ha equals AM 2 + AM 8 by area only, which is not a crosswalk.
- Source boundaries, failed notice downloads and unsearched historical intervals remain in the Tier 1 coverage. Current farming remains unconfirmed for all three parcels; paid SPF copies and outreach remain Tier 3.

## Reproduce and validate

Use Python 3.12, as CI does, with
`scripts/burgundy-map-requirements.txt`. From the repository root:

```sh
python scripts/download_grand_cru_sources.py --cru la-grande-rue
python scripts/build_grand_cru_parcels.py --cru la-grande-rue --check
python scripts/build_grand_cru_commune_audit.py --cru la-grande-rue --check
python scripts/build_grand_cru_named_plots.py --cru la-grande-rue
python scripts/build_grand_cru_parcel_named_areas.py --cru la-grande-rue --check
python scripts/build_grand_cru_history_rollout.py --bundle vosne-romanee --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
python scripts/audit_grand_cru_history_rollout.py --check
npm run build
python scripts/measure_grand_cru_payload.py
```

The browser journey uses `WINELOG_E2E_CRU=la-grande-rue` with
`burgundy-village-map.spec.ts`, without expanding the normal Chromium matrix.

This delivery references #430 and tracker #420 without closing them. Tier 1 history
review remains separately tracked under #461; current farming remains under #364.
