# La Romanée parcels: Tier 2 (#428)

La Romanée uses INAO `inao-denom-655`, appellation 190, and Vosne-Romanée
commune 21714. Tier 1 history reviewed 7 October 2026; Tier 2 research reviewed
8 October 2026 for season 2026 under the
[rollout playbook](../../grand-cru-parcel-rollout.md) and
[#461 history method](../grand-cru-history.md). It shares the Vosne bundle with
five other crus; this delivery enables only La Romanée.

**No current farmer is verified.** Recorded rights, parcel filiation, deeds and
administrative procedures are distinct evidence, and none establishes farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 1; 0.841545 ha of measured cru overlap |
| Parcels with recorded legal-entity rights (1 January 2025) | 1; 1 holder identifier and 1 right record |
| Parcels without matched rights | 0 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights file listed at the 7 October recheck |
| Parcels whose rights changed over the imported snapshot range | 1; an identifier-format change between 2019 and 2020 with the same recorded name and right code |
| Official DFI release and commune coverage | July 2026, complete department 21 member; commune 21714 records validate from 1989-05-05 to 2026-06-29 |
| Earliest / latest reachable official DFI validation date | None: no DFI event reaches the current parcel |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01; all 35 listed vintages through the pinned map obtained; September 2026 is outside the pinned geometry range |
| Current parcels with documented predecessors / pre-2019 events | 0 / 0 |
| Distinct DFI documents / analysis lots supporting those parcels | 0 / 0 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; the trace ends at a source boundary or unrecorded event |
| Sales and notices: available / imported date ranges and gaps | DVF+ declared 2014-01-01–2025-12-31, complete BFC 2026-1 archive imported; commune observations 2014-01-20–2025-12-17. Notices: partial departmental 2004–2015, departmental 2016–2020 and regional 2019–2026 indexes; archive gaps below |
| Parcels with an authorisation / application or suspension | 0 |
| Parcels with sale records (DVF) | 0; no deed on the current reference |
| Parcels with holder or research leads | 1; a recorded legal holder alone is not a lead |
| Parcels with no lead | 0 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: the complete DFI member contains no event for AN0074, so tracing stops at the source boundary; all pinned geometry vintages and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 77,030 / 12,485 bytes. Evidence: 48,363 / 8,715 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 83-parcel Vosne bundle; the La Romanée selection contains 1 of
those parcels. No named-area GeoJSON is added (see below). Rights geometry and
evidence load only after Parcel rights is switched on. The production payload
report additionally measures compiled JS.

## Geometry and named area

The [bundle](../../../scripts/grand-crus/bundles/vosne-romanee.json) pins the
1 June 2026 cadastre, lieux-dits, rights files, licences, URLs and SHA-256 hashes.
The single parcel, AN0074, keeps its full polygon; its overlap is measured
separately in EPSG:2154. The [commune audit](../../../scripts/grand-crus/reports/la-romanee-commune-audit.json)
finds 0.2 m² of the 8,415.7 m² INAO outline without parcel coverage, well below
the default 0.1% limit; no neighbouring parcel covers it. Flagey-Échezeaux,
Nuits-Saint-Georges and Vougeot have no contact. Three own-commune contacts, each
below 0.1 m², are excluded and retained individually in the
[parcel report](../../../scripts/grand-crus/reports/vosne-romanee-parcels.json).
No geometry is repaired, clipped, buffered or filled to pass this audit.

The [BIVB appellation page](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/romanee-la,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MzIxJnw%3D)
lists La Romanée as the cru's only climat, and the pinned cadastre records
`LA ROMANEE`. Clipped to INAO, it measures 0.841561 ha in one polygon, leaving a
0.10 m² gap; the cadastral lieu-dit extends about 212 m² beyond the INAO line,
which is not added. The [named-area audit](../../../scripts/grand-crus/reports/la-romanee-named-plots.json)
records these measurements. Because the named area is the whole cru, no duplicate
display layer is published and the map keeps the whole-cru outline. No aliases or
producer-holding outlines are inferred. The [parcel crosswalk](parcel-named-areas.json)
places AN0074 entirely in `LA ROMANEE`.

## Rights, history and sales

The [source recheck](source-review.json) uses the shared
[7 October Vosne snapshot](../../../scripts/grand-crus/sources/catalogues/2026-10-07-vosne-romanee/),
pinning catalogue bytes, sizes, hashes and exact UTC retrieval times, plus the
cru's own BIVB page hash. It confirms the existing rights years, latest DFI
release/schema and geometry release inventory. The
[shared inventory](../../../scripts/grand-crus/sources/inventory-2026-10-01.json)
retains the raw member identities and original acquisition timestamps.

AN0074 joins on its complete reference with a matching fiscal area. Every
snapshot from 2019 to 2025 records one code P (ownership) right under the same
recorded name. The 2019 file gives only a MAJIC code (`PBCLPZ`); from 2020 the
record carries the provisional identifier `U14132333`. Because the two
identifiers cannot be proved equal, the change is kept as an unprovable
identifier change rather than merged. `U14132333` remains an identifier, not a
verified SIREN. A recorded owner does not establish who farms the vineyard, and
no monopoly or operator claim is inferred from the holder's name. Tier 2 adopts
the [shared holder table](../holders/holder-links.json): company filings match `U14132333`
to RCS 408 280 667 there, while the rights file keeps the provisional identifier, and a
reviewed `family-holding` link groups the parcel under Domaine du Comte Liger-Belair.
The app says **Research link · farming unverified**. Paid SPF copies and outreach
remain Tier 3.

[Rights history](rights-history.json) finds no DFI event for AN0074 in the
complete July 2026 department member, whose commune records start on
5 May 1989. The parcel is observed in every geometry vintage from 6 July 2017, and
its trace stops at a source boundary. That first observation is not a creation
date. No spatial next-vintage candidate is accepted or rejected.

[DVF+](sale-records.json) has no deed on AN0074. Available and observed intervals
are not proof of uninterrupted records.

## Notices and gaps

The [notice audit](notice-audit.json) and [notice history](notice-history.json)
query the single current reference against the three Côte-d'Or corpora. There
are zero reviewed matches, zero unreviewed candidates and no OCR reference-hint
hit in any indexed notice. The three reviewed Vosne-Romanée rows (AB 100, AN 112
and AN 249) are outside La Romanée's reachable reference set and remain
unassigned. No OCR-only event is promoted.

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

The one recorded holder identifier, `U14132333`, was researched through the shared table. The pass screened **17 filings / 518 pages**: the company’s own filings and those of the domaine company that publishes La Romanée. The [filing inventory](filings.md) records dates, references, page numbers, hashes, bounded negatives and effort.

The rights file’s name, SCI DU CHATEAU DE VOSNE ROMANEE, is the pre-2003 name of RCS 408 280 667. That company’s 2002 registration filing contains statutes updated in 1998 that reproduce the 3 July 1967 contribution of Vosne-Romanée AN 74, 84 a 52 ca, its lieu-dit corrected in the margin to “La Romanée”; the area equals today’s cadastral area, so this is an exact filing. A 2003 notarial deed turned the company into the GFV du Château de Vosne-Romanée under the same number. On that evidence the shared table matches `U14132333` to 408280667; the rights file keeps the provisional identifier.

The 2003 deed also recites three long leases the company granted to one of its partners, without a parcel list. The GFV’s 14 April 2021 notarial deed schedules them: the 8 November 2001 métayage covers AN 74, La Romanée, 84 a 52 ca (with three Aux Raignots parcels), for 18 years from 1 November 2001, tacitly renewable by nine-year periods. The deed states that the leased land, except buildings added in 2005, is made available by that partner to SCEA Domaine du Comte Liger-Belair (429010846) with the lessor’s authorisation, that rents are paid by the tenant or that domaine, and that the leases are valid at its date. The register lists the same family partners in the GFV and the SCEA at the same Château seat, and CLB Participations, a partner and manager of the SCEA, was GFV co-manager from 2019 to 2023. On that company evidence the `family-holding` link to Domaine du Comte Liger-Belair is **reviewed**.

The 2021 statement is a dated, parcel-specific recital that the land is made available to the domaine company. It is flagged for #364 as a candidate verified-operator record as of 14 April 2021; it is not a current farming season, and verified farming stays **0**.

The domaine’s undated climat page publishes La Romanée, monopole, at 0.8452 ha — AN 74’s cadastral area — and its history page says the domaine took La Romanée into operation in 2002. These undated producer publications stay in the named-area census; they do not meet the verified-operator gate.

The repository owner supplied all four requested Winehog articles (see [filings](filings.md#winehog-articles)). None prints a La Romanée plot or cadastral reference; the 1928 bottle history’s 0.85 ha is a rounded cru total, not a parcel crosswalk.

Research leads rise from **0 to 1 of 1 parcel**. The legal-rights and geometry counts are unchanged; verified farming remains **0**.

| Measure | Tier 1 | Tier 2 |
| --- | ---: | ---: |
| Parcels with holder or research leads | 0 | 1 of 1 |
| Parcels with no named candidate | 1 | 0 |
| Holder identifiers matched to a SIREN by company filings | 0 | 1 of 1 |
| Holders with an applicable link | 0 | 1 of 1: reviewed `family-holding` |
| Parcels with exact-reference company filings | 0 | 1 in 2 filing entries |
| Published holdings in the named-area census | 0 | 1 |
| Verified farming links | 0 | **0** |

### Effort per holder

| Recorded holder | Filings | Pages | Outcome |
| --- | ---: | ---: | --- |
| GFV du Château de Vosne-Romanée (`U14132333`) | 17 | 518 | Company filings match U14132333 to GFV du Château de Vosne-Romanée (408280667): its statutes contribute AN74 and its 2021 deed lists AN74 under a 2001 métayage to a partner, with the land made available to SCEA Domaine du Comte Liger-Belair. Dated recital only; farming unverified. |

### Tier 2 access and evidence gaps

- Bounded filing review: 17 filings (518 pages) were screened — 13 of the 13 filings the free index lists for the GFV and 4 of the 9 for the SCEA. Unscreened filings are a bounded negative.
- `U14132333` is matched to RCS 408280667 by the rights file’s name, the company’s 2002 registration filing (whose statutes contribute AN 74 with its exact area) and the 2003 renaming deed; the 2019 MAJIC code PBCLPZ stays an unprovable identifier change in the rights file.
- The 2001 métayage over AN 74 is held by a partner personally; the 2021 deed states it is tacitly renewed and valid and that the land is made available to SCEA Domaine du Comte Liger-Belair. That dated recital (14 April 2021) is flagged for #364 as a candidate verified-operator record; it is not a current farming season, and verified farming stays 0. The lease deed and any later change are unreviewed.
- CLB Participations was GFV co-manager from 3 May 2019 until its resignation from 4 June 2023; today the two companies share family partners and their seat, not a manager.
- The domaine’s pages are undated producer publications. They give La Romanée’s area and a 2002 start of operation; they stay census evidence.
- data.inpi.fr and pappers.fr refuse this cloud environment: filings or accounts available only there are pending local audit.
- All 4 requested Winehog articles were supplied by the repository owner as saved webarchives and reviewed; URLs, printed dates and archive hashes are recorded, and archives and article text are not committed. None prints a La Romanée plot or cadastral reference; one gives the cru as a 0.85 ha monopole, a rounded total that is not a parcel crosswalk.
- Source boundaries, failed notice downloads and unsearched historical intervals remain in the Tier 1 coverage. Current farming remains unconfirmed; paid SPF copies and outreach remain Tier 3.

## Reproduce and validate

Use Python 3.12, as CI does, with
`scripts/burgundy-map-requirements.txt`. From the repository root:

```sh
python scripts/download_grand_cru_sources.py --cru la-romanee
python scripts/build_grand_cru_parcels.py --cru la-romanee --check
python scripts/build_grand_cru_commune_audit.py --cru la-romanee --check
python scripts/build_grand_cru_named_plots.py --cru la-romanee
python scripts/build_grand_cru_parcel_named_areas.py --cru la-romanee --check
python scripts/build_grand_cru_history_rollout.py --bundle vosne-romanee --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
python scripts/audit_grand_cru_history_rollout.py --check
npm run build
python scripts/measure_grand_cru_payload.py
```

The browser journey uses `WINELOG_E2E_CRU=la-romanee` with
`burgundy-village-map.spec.ts`, without expanding the normal Chromium matrix.

This delivery references #428 and tracker #420 without closing them. Tier 1 history
review remains separately tracked under #461; current farming remains under #364.
