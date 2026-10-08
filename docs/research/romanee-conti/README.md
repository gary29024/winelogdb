# Romanée-Conti parcels: Tier 2 (#427)

Romanée-Conti uses INAO `inao-denom-1084`, appellation 222, and Vosne-Romanée
commune 21714. Tier 1 history reviewed 7 October 2026; Tier 2 research reviewed
8 October 2026 for season 2026 under the
[rollout playbook](../../grand-cru-parcel-rollout.md) and
[#461 history method](../grand-cru-history.md). It shares the Vosne bundle with
five other crus; this delivery enables only Romanée-Conti.

**No current farmer is verified.** Recorded rights, parcel filiation, deeds and
administrative procedures are distinct evidence, and none establishes farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 2; 1.807846 ha of measured cru overlap |
| Parcels with recorded legal-entity rights (1 January 2025) | 2; 1 holder identifier and 2 right records |
| Parcels without matched rights | 0 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights file listed at the 7 October recheck |
| Parcels whose rights changed over the imported snapshot range | 0; 2019–2025 |
| Official DFI release and commune coverage | July 2026, complete department 21 member; commune 21714 records validate from 1989-05-05 to 2026-06-29 |
| Earliest / latest reachable official DFI validation date | 1994-05-30 / 1994-05-30 |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01; all 35 listed vintages through the pinned map obtained; September 2026 is outside the pinned geometry range |
| Current parcels with documented predecessors / pre-2019 events | 1 / 1 |
| Distinct DFI documents / analysis lots supporting those parcels | 1 / 1 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; both traces end at a source boundary or unrecorded event |
| Sales and notices: available / imported date ranges and gaps | DVF+ declared 2014-01-01–2025-12-31, complete BFC 2026-1 archive imported; commune observations 2014-01-20–2025-12-17. Notices: partial departmental 2004–2015, departmental 2016–2020 and regional 2019–2026 indexes; archive gaps below |
| Parcels with an authorisation / application or suspension | 0 |
| Parcels with sale records (DVF) | 0; no deed on current or historical references |
| Parcels with holder or research leads | 2; a recorded legal holder alone is not a lead |
| Parcels with no lead | 0 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: recursive DFI to 1994, all pinned geometry vintages and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 77,030 / 12,485 bytes. Evidence: 48,686 / 8,717 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 83-parcel Vosne bundle; the Romanée-Conti selection contains 2 of
those parcels. No named-area GeoJSON is added (see below). Rights geometry and
evidence load only after Parcel rights is switched on. The production payload
report additionally measures compiled JS.

## Geometry and named area

The [bundle](../../../scripts/grand-crus/bundles/vosne-romanee.json) pins the
1 June 2026 cadastre, lieux-dits, rights files, licences, URLs and SHA-256 hashes.
Full parcel polygons remain unchanged; overlaps are measured separately in
EPSG:2154. The [commune audit](../../../scripts/grand-crus/reports/romanee-conti-commune-audit.json)
finds 0.5 m² of the 18,079.1 m² INAO outline without parcel coverage, well below
the default 0.1% limit; no neighbouring parcel covers it. Flagey-Échezeaux,
Nuits-Saint-Georges and Vougeot have no contact. Three own-commune contacts, each
below 0.1 m², are excluded and retained individually in the
[parcel report](../../../scripts/grand-crus/reports/vosne-romanee-parcels.json).
No geometry is repaired, clipped, buffered or filled to pass this audit.

The [BIVB appellation page](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/romanee-conti,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MzgyJnw%3D)
lists La Romanée Conti as the cru's only climat, and the pinned cadastre records
`LA ROMANEE CONTI`. Clipped to INAO, it measures 1.807893 ha in two polygon parts,
leaving a 0.20 m² gap; the cadastral lieu-dit extends about 860 m² beyond the
INAO line, which is not added. The [named-area audit](../../../scripts/grand-crus/reports/romanee-conti-named-plots.json)
records these measurements. Because the named area is the whole cru, no duplicate
display layer is published and the map keeps the whole-cru outline. No aliases or
producer-holding outlines are inferred. The [parcel crosswalk](parcel-named-areas.json)
places both parcels entirely in `LA ROMANEE CONTI`.

## Rights, history and sales

The [source recheck](source-review.json) uses the shared
[7 October Vosne snapshot](../../../scripts/grand-crus/sources/catalogues/2026-10-07-vosne-romanee/),
pinning catalogue bytes, sizes, hashes and exact UTC retrieval times, plus the
cru's own BIVB page hash. It confirms the existing rights years, latest DFI
release/schema and geometry release inventory. The
[shared inventory](../../../scripts/grand-crus/sources/inventory-2026-10-01.json)
retains the raw member identities and original acquisition timestamps.

Both parcels (AN0072 and AN0258) join on complete references with matching fiscal
areas. Each has one code P (ownership) record for the same identifier,
`778269407`, unchanged in every snapshot from 2019 to 2025. A single recorded
owner is a rights fact only: it does not establish who farms the vineyard, and no
monopoly or operator claim is inferred from the holder's name. Tier 2 adopts
the [shared holder table](../holders/holder-links.json), whose reviewed `owner-company`
link names the holder as the Domaine de la Romanée-Conti company; the app groups both
parcels under that heading and says **Research link · farming unverified**.
Paid SPF copies and outreach remain Tier 3.

[Rights history](rights-history.json) preserves one document and one complete
analysis lot: AN0073 → AN0258, a *croquis de conservation* validated on
30 May 1994. It predates obtained geometry, so the predecessor has no observed
polygon. AN0072 has no documented predecessor; its trace stops at a source
boundary. No spatial next-vintage candidate is accepted or rejected, and no
historical-reference rights are recorded. DFI validation dates are not
acquisition, creation or farming dates.

[DVF+](sale-records.json) has no deed on either current reference or on AN0073.
Available and observed intervals are not proof of uninterrupted records.

## Notices and gaps

The [notice audit](notice-audit.json) and [notice history](notice-history.json)
query all 3 current/reachable references against the three Côte-d'Or corpora.
There are zero reviewed matches, zero unreviewed candidates and no OCR
reference-hint hit in any indexed notice. The three reviewed Vosne-Romanée rows
(AB 100, AN 112 and AN 249) are outside Romanée-Conti's reachable reference set
and remain unassigned. No OCR-only event is promoted.

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

The one recorded holder, `778269407`, was researched through the shared table. Its reviewed `owner-company` link to Domaine de la Romanée-Conti, recorded for Échezeaux and Grands-Échezeaux and re-checked for Richebourg and Romanée-Saint-Vivant, now applies here. The pass screened **7 DRC filings / 548 pages** with embedded text and OCR of every image page, then checked the cited schedule against page images. The [filing inventory](filings.md) records dates, references, page numbers, hashes, bounded negatives and effort.

The 21 December 1974 notarial statutes, deposited in 2002, list the estate as then composed. Item 28 is AN 72, “La Romanée Conti”, 9 a 27 ca, the parcel’s current area, so it is an exact filing. Item 29 is AN 73 at 1 ha 71 a 23 ca. A 1994 *croquis de conservation* replaced AN 73 with AN 258, which measures 90 m² more; the filing never prints AN 258, so that evidence stays `filing-named-cadastral-reference` research reaching AN 258 only through documented DFI lineage. The 6 later filings, from 2003 to 2024, print no cadastral schedule; the 2003, 2009 and 2024 statutes recite the 1942 contribution of the whole estate and its brands.

The DRC’s estate page publishes 1.8140 ha, equal to the summed cadastral areas of AN 72 and AN 258. It feeds only the named-area census; an equal total is not a parcel assignment.

Research leads rise from **0 to 2 of 2 parcels**. The legal-rights and geometry counts are unchanged; verified farming remains **0**.

| Measure | Tier 1 | Tier 2 |
| --- | ---: | ---: |
| Parcels with holder or research leads | 0 | 2 of 2 |
| Parcels with no named candidate | 2 | 0 |
| Holders with an applicable link | 0 | 1 of 1: reviewed `owner-company` |
| Parcels with exact-reference company filings | 0 | 1 in 1 filing entry |
| Parcels reached only through filing-named retired references | 0 | 1 |
| Published holdings in the named-area census | 0 | 1 |
| Verified farming links | 0 | **0** |

### Effort per holder

| Recorded holder | Filings | Pages | Outcome |
| --- | ---: | ---: | --- |
| Domaine de la Romanée-Conti (`778269407`) | 7 | 548 | The 1974 notarial estate schedule names AN72 with its exact area and retired AN73, which reaches AN258 only through the 1994 DFI croquis. 6 later DRC filings add no cadastral schedule or lease; legal company identity remains a research link. Farming unverified. |

The counts above describe this pass, including DRC files re-screened after earlier crus; earlier totals remain in the table’s effort note.

### Tier 2 access and evidence gaps

- Bounded filing review: 7 DRC filings (548 pages) were screened, chosen for statutes and estate schedules. The free index lists 55 DRC filings, mostly share donations and management changes; unscreened filings are a bounded negative, not proof that no later schedule exists.
- No screened filing prints AN 258. The 1974 schedule’s AN 73 reaches it only through the 1994 DFI croquis, and the 90 m² difference between the printed and current areas is not explained by any reviewed source.
- data.inpi.fr and pappers.fr refuse this cloud environment: filings or accounts available only there are pending local audit.
- Winehog subscriber articles requested, not supplied: “Domaine de la Romanée-Conti – Producer Profile” (2012-09-27); “From Romanee-Conti to Vougeot in the vines” (2021-04-25). No paywalled text was accessed.
- Source boundaries, failed notice downloads and unsearched historical intervals remain in the Tier 1 coverage. Current farming remains unconfirmed for both parcels; paid SPF copies and outreach remain Tier 3.

## Reproduce and validate

Use Python 3.12, as CI does, with
`scripts/burgundy-map-requirements.txt`. From the repository root:

```sh
python scripts/download_grand_cru_sources.py --cru romanee-conti
python scripts/build_grand_cru_parcels.py --cru romanee-conti --check
python scripts/build_grand_cru_commune_audit.py --cru romanee-conti --check
python scripts/build_grand_cru_named_plots.py --cru romanee-conti
python scripts/build_grand_cru_parcel_named_areas.py --cru romanee-conti --check
python scripts/build_grand_cru_history_rollout.py --bundle vosne-romanee --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
python scripts/audit_grand_cru_history_rollout.py --check
npm run build
python scripts/measure_grand_cru_payload.py
```

The browser journey uses `WINELOG_E2E_CRU=romanee-conti` with
`burgundy-village-map.spec.ts`, without expanding the normal Chromium matrix.

This delivery references #427 and tracker #420 without closing them. Tier 1 history
review remains separately tracked under #461; current farming remains under #364.
