# Clos de Tart parcels: Tier 2 (#433)

Clos de Tart uses INAO `inao-denom-545`, appellation 161, and Morey-Saint-Denis
commune 21442. Tier 1 reviewed 7 October; Tier 2 reviewed 9 October 2026 for season 2026 under the
[rollout playbook](../../grand-cru-parcel-rollout.md) and
[#461 history method](../grand-cru-history.md). Its shared Chambolle-Morey bundle
also contains five other crus; this delivery advances Clos de Tart to Tier 2.

**No current farmer is verified.** Recorded rights, parcel filiation, deeds and
administrative procedures are distinct evidence, and none establishes farming.
Its reputation as a monopole is not used: a dated, citable source would be needed
before any verified operator link.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 17; 7.469388 ha of measured cru overlap |
| Parcels with recorded legal-entity rights (1 January 2025) | 9; 5 holder identifiers and 9 right records |
| Parcels without matched rights | 8 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights file listed at the 7 October recheck |
| Parcels whose rights changed over the imported snapshot range | 5; 2019–2025 |
| Official DFI release and commune coverage | July 2026, complete department 21 member; commune 21442 records validate from 1989-04-14 to 2026-03-23 |
| Earliest / latest reachable official DFI validation date | 1989-04-18 / 2003-11-04 |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01; all 35 listed vintages through the pinned map obtained; September 2026 is outside the pinned geometry range |
| Current parcels with documented predecessors / pre-2019 events | 5 / 5 |
| Distinct DFI documents / analysis lots supporting those parcels | 4 / 4 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; every trace ends at a source boundary or unrecorded event |
| Sales and notices: available / imported date ranges and gaps | DVF+ declared 2014-01-01–2025-12-31, complete BFC 2026-1 archive imported; commune observations 2014-02-14–2025-12-17. Notices: partial departmental 2004–2015, departmental 2016–2020 and regional 2019–2026 indexes; archive gaps below |
| Parcels with an authorisation / application or suspension | 0 |
| Parcels with sale records (DVF) | 0 |
| Parcels with holder or research leads | 7; Tier 1 had zero leads |
| Parcels with no lead | 10 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: recursive DFI to 1989, all pinned geometry vintages and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 346,184 / 54,353 bytes. Evidence: 124,541 / 11,396 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 378-parcel Chambolle-Morey bundle; the Clos de Tart selection
contains 17 of those parcels. Clos de Tart adds no named-area GeoJSON. Rights
geometry and evidence load only after Parcel rights is switched on. The
production payload report additionally measures compiled JS.

## Geometry and named areas

The [bundle](../../../scripts/grand-crus/bundles/chambolle-morey.json) pins the
1 June 2026 cadastre and lieux-dits for Chambolle-Musigny and Morey-Saint-Denis,
the rights files, licences, URLs and SHA-256 hashes, and audit-only
Flagey-Échezeaux, Gevrey-Chambertin and Vougeot parcels. Full parcel polygons
remain unchanged; overlaps are measured separately in EPSG:2154.

The [commune audit](../../../scripts/grand-crus/reports/clos-de-tart-commune-audit.json)
finds 323.9 m² (0.43%) of the 75,017.8 m² INAO outline without parcel coverage,
above the default 0.1% limit. It is one strip, with a mean width of 1.25 m, along
the cru's northern side between the official line and the nearest cadastral
parcels. It is not a missing INAO commune, and no neighbouring commune's parcels
touch the cru. The reviewed cap in the [cru config](../../../scripts/grand-crus/clos-de-tart.json)
allows less than 0.1 m² above this measurement and is tied to the exact INAO and
cadastre hashes, so a changed source fails until it is reviewed again. One
own-commune contact below 0.1 m² is excluded and retained in the
[parcel report](../../../scripts/grand-crus/reports/chambolle-morey-parcels.json).
No geometry is repaired, clipped, buffered or filled to pass this audit.

The [BIVB appellation page](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/clos-de-tart,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MjgzJnw%3D)
lists Clos de Tart as the only climat. Its exact match, the cadastral
`CLOS DE TART`, measures 7.249706 ha inside the 7.501784 ha outline. The
southern part of the cru is recorded under the cadastral `LES BONNES MARES`: parcel
AR0064 lies 88% inside Clos de Tart, with a small overlap into Bonnes-Mares. That
name is not an official Clos de Tart climat, so it is listed as unresolved and no
crosswalk is made. Because the only climat is the cru itself, no separate layer is
published and the map keeps the official outline. The
[named-area audit](../../../scripts/grand-crus/reports/clos-de-tart-named-plots.json)
reports 0.252078 ha unmapped.

The [parcel crosswalk](parcel-named-areas.json) assigns 6 parcels to Clos de Tart
and keeps AR0064 under its unreviewed cadastral name. Ten parcels only touch the
cru edge, by 1.3–66.6 m² each, and lie wholly in `EN LA RUE DE VERGY`. They remain
Clos de Tart parcels for rights and history, but the config lists that name as a
neighbouring lieu-dit, not a Clos de Tart climat.

## Rights, history and sales

The [source recheck](source-review.json) pins freshly obtained catalogue bytes,
sizes, hashes and exact UTC retrieval times. It reuses the bundle's 7 October
catalogue snapshot: the rights, DFI and geometry bytes are identical to the
Vosne-Romanée recheck that day, and the DVF catalogue differs only in
data.gouv.fr's re-analysis timestamps for one resource. The
[shared inventory](../../../scripts/grand-crus/sources/inventory-2026-10-01.json)
retains the raw member identities and original acquisition timestamps.

All rights join on complete parcel references. The 9 records are all code
P (ownership), one per parcel, for five identifiers; recorded fiscal areas match
the current cadastre's stated areas for all 9. The main parcel, AR0060, carries
72,095 m² of the cru. Private-person rights are absent from this legal-entity
dataset. The two provisional `U…` keys are retained, with company-record crosswalks to
686042409 (Clos de Tart) and 424223410 (Perrot-Minot GFA). Three company links
enable grouping; the GFA and MABI remain unlinked to a producer. Paid SPF copies
and present-season confirmation remain Tier 3.

[Rights history](rights-history.json) preserves four documents and four complete
analysis lots. On 18 April 1989, DFI records both the merger of 25 references into
AR0140 and AR0140's division into AR0141–AR0143; AR0141 was divided again on 26 November 1992, giving today's
AR0142, AR0146 and AR0147. AR0062 → AR0148/AR0149 followed on 4 November 2003.
Every intermediate reference and the complete merge set are kept. These events
predate obtained geometry, so their predecessors have no observed polygon. DFI
validation dates are not acquisition, creation or farming dates, and
source-boundary terminal reasons do not imply original ownership. No spatial
predecessor candidate exists in the geometry vintages.

[DVF+](sale-records.json) contains no deed on a current or historical Clos de Tart
reference in the available range. That is a source observation, not proof that no
transfer occurred.

## Notices and gaps

The [notice audit](notice-audit.json) and [notice history](notice-history.json)
query all 45 current/reachable references, including the 1989 merge references,
against the three Côte-d'Or corpora. There are zero reviewed matches and zero
unreviewed candidates. Two raw OCR reference-hint hits are in notices that never
name Morey-Saint-Denis; they are recorded in the audit but not assigned.

Earlier publications are partial Internet Archive/Common Crawl captures under
their original official URLs. No Côte-d'Or bulletin was obtained for 2007, 2009,
2012 or 2014. Other 2004–2015 years have incomplete coverage; departmental
2021–2026, regional pre-2019 and pre-2004 intervals remain unsearched or outside
the indexed corpus. The absolute earliest notice year remains unresolved. See
the [dated availability audit](../../../scripts/grand-crus/sources/notice-coverage-2026-10-04.json)
and [earlier-bulletin research](../earlier-bulletins/README.md). Access failure or
an unsearched interval is a gap, not absence of history. These shared gaps remain
tracked in #461; unverified operation and unresolved name research stay under
#364 and #344 respectively.

## Tier 2 holder and source review

All five recorded holders have a local research row in the [shared holder table](../holders/holder-links.json).
Two entries are new; three reuse prior links, searches and effort. Clos de Tart, Groffier and
Perrot-Minot have company links. The Perrot-Minot GFA and GFA MABI remain unlinked to a producer.
Company relationships create seven parcel leads; ten parcels remain unresolved. None establishes
current farming or changes a printed appellation classification.

The Maison Mommessin U-id resolves to **686042409** through the filed Maison Mommessin → Famille
Mommessin → Societe du Clos de Tart name chain and an exact four-parcel property annex. The
separate Mommessin et Thorin company 685750598 is excluded. The 2018 transaction transfers shares;
its annex recites a 1932 land acquisition. AR60, AR64, AR148 and AR149 match individual current areas.
The already reviewed Perrot-Minot GFA formation adds exact AR146, described as AOC Morey-Saint-Denis.
That parcel's 20.6304 m² mapped contact does not change its classification. Two filing entries thus
cover five current parcels, with no inference of a new land transfer or present operation.

The two new holders required **four additional PDFs / 48 pages**. Five correct-company Clos de Tart
filings / 422 pages were already screened in Bonnes-Mares and are reused. All nine files / 470 pages
were checked for byte count, SHA-256, page count and complete OCR coverage. Prior Groffier and
Perrot-Minot GFA work is reused as well. The [filing log](filings.md) separates newly screened and
reused effort. Every selected image page was OCR-screened using RapidOCR with DirectML at 150 dpi.

The supplied Winehog history individually matches references 60 (7.2548 ha) and 64 (0.2780 ha).
Its 1828 reference 929 and two unnumbered expansion plots remain unmatched. A later summary says
1965 where the decree discussion says 1966; that source discrepancy is retained, without changing
the named-area audit or asserting an independently reviewed decree. The article and public estate
page publish 7.53 ha: a whole-cru named-area census, with no distribution across current cadastral
areas. In particular AR64's cadastral name remains unresolved in the named-area crosswalk.

The SCEA Perrot-Minot and Groffier links cover small edge contacts, without inferring a Clos de Tart
wine holding. MABI's cash formation and generic future-acquisition mandate name no producer or
AR139 schedule. No current tenant is established for the Perrot-Minot GFA from shared officers or
family names. Original leases, renewals, paid SPF records and present-season confirmation remain
unreviewed. **Verified farming stays zero.** Raw PDFs, archives, OCR and images remain outside Git.

## Reproduce and validate

Use Python 3.12, as CI does, with
`scripts/burgundy-map-requirements.txt`. From the repository root:

```sh
python scripts/download_grand_cru_sources.py --cru clos-de-tart
python scripts/build_grand_cru_parcels.py --cru clos-de-tart --check
python scripts/build_grand_cru_commune_audit.py --cru clos-de-tart --check
python scripts/build_grand_cru_named_plots.py --cru clos-de-tart
python scripts/build_grand_cru_parcel_named_areas.py --cru clos-de-tart --check
python scripts/build_grand_cru_history_rollout.py --bundle chambolle-morey --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
python scripts/audit_grand_cru_history_rollout.py --check
npm run build
python scripts/measure_grand_cru_payload.py
```

The browser journey uses `WINELOG_E2E_CRU=clos-de-tart` with
`burgundy-village-map.spec.ts`, without expanding the normal Chromium matrix.
