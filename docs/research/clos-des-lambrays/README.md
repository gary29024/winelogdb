# Clos des Lambrays parcels: Tier 2 (#434)

Clos des Lambrays uses INAO `inao-denom-547`, appellation 163, and
Morey-Saint-Denis commune 21442. Tier 1 reviewed 7 October; Tier 2 reviewed 9 October 2026 for season 2026 under the
[rollout playbook](../../grand-cru-parcel-rollout.md) and
[#461 history method](../grand-cru-history.md). Its shared Chambolle-Morey bundle
also contains five other crus; this delivery advances Clos des Lambrays to Tier 2.

**No current farmer is verified.** Recorded rights, parcel filiation, deeds and
administrative procedures are distinct evidence, and none establishes farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 22; 8.746229 ha of measured cru overlap |
| Parcels with recorded legal-entity rights (1 January 2025) | 14; 3 holder identifiers and 14 right records |
| Parcels without matched rights | 8 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights file listed at the 7 October recheck |
| Parcels whose rights changed over the imported snapshot range | 14; 2019–2025 |
| Official DFI release and commune coverage | July 2026, complete department 21 member; commune 21442 records validate from 1989-04-14 to 2026-03-23 |
| Earliest / latest reachable official DFI validation date | None; no current parcel has a DFI event |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01; all 35 listed vintages through the pinned map obtained; September 2026 is outside the pinned geometry range |
| Current parcels with documented predecessors / pre-2019 events | 0 / 0 |
| Distinct DFI documents / analysis lots supporting those parcels | 0 / 0 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; all 22 traces end at the DFI source boundary |
| Sales and notices: available / imported date ranges and gaps | DVF+ declared 2014-01-01–2025-12-31, complete BFC 2026-1 archive imported; commune observations 2014-02-14–2025-12-17. Notices: partial departmental 2004–2015, departmental 2016–2020 and regional 2019–2026 indexes; archive gaps below |
| Parcels with an authorisation / application or suspension | 7; one page-reviewed 2021 application receipt, published twice |
| Parcels with sale records (DVF) | 1; 1 deed on a current reference |
| Parcels with holder or research leads | 8; Tier 1 had 7 notice leads; the company link covers 8 parcels, including those 7 |
| Parcels with no lead | 14 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: the complete DFI member has no event for a current parcel, so tracing stops at its source boundary; all pinned geometry vintages and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 346,184 / 54,353 bytes. Evidence: 60,458 / 8,476 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 378-parcel Chambolle-Morey bundle; the Clos des Lambrays selection
contains 22 of those parcels. Named-area GeoJSON adds 8,741 / 3,045 bytes raw /
gzip when the village map opens. Rights geometry and evidence load only after
Parcel rights is switched on. The production payload report additionally measures
compiled JS.

## Geometry and named areas

The [bundle](../../../scripts/grand-crus/bundles/chambolle-morey.json) pins the
1 June 2026 cadastre and lieux-dits for Chambolle-Musigny and Morey-Saint-Denis,
the rights files, licences, URLs and SHA-256 hashes, and audit-only
Flagey-Échezeaux, Gevrey-Chambertin and Vougeot parcels. Full parcel polygons
remain unchanged; overlaps are measured separately in EPSG:2154.

The [commune audit](../../../scripts/grand-crus/reports/clos-des-lambrays-commune-audit.json)
finds 435.8 m² (0.50%) of the 87,898.1 m² INAO outline without parcel coverage,
above the default 0.1% limit. The largest piece is a 337.8 m² strip, 1.25 m wide
on average, along the northern side; the rest are narrow strips at the eastern
edge, and 62.6 m² lies between parcels inside the outline. It is not a missing
INAO commune, and no neighbouring commune's parcels touch the cru. The reviewed
cap in the [cru config](../../../scripts/grand-crus/clos-des-lambrays.json)
allows less than 0.1 m² above this measurement and is tied to the exact INAO and
cadastre hashes, so a changed source fails until it is reviewed again. No
own-commune contact is excluded. No geometry is repaired, clipped, buffered or
filled to pass this audit.

The [BIVB appellation page](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/clos-des-lambrays,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9Mjg4Jnw%3D)
lists Clos des Lambrays, Les Bouchots and Meix-Rentier. The cadastre records them
as `LES LARRETS OU CLOS DES LAMBRAYS`, `LES BOUCHOTS` and `MEIX RENTIER`: the last
two match using only case, accent and hyphen normalization, and the first is the
only cadastral name containing the official one. The neighbouring cadastral
`LES LARRETS` is a different lieu-dit and is not used. Their display polygons are
exact intersections with INAO, measuring 5.631826, 1.993299 and 1.114840 ha, with
all 2, 1 and 2 polygon components retained. The
[named-area audit](../../../scripts/grand-crus/reports/clos-des-lambrays-named-plots.json)
reports 0.049844 ha unmapped.

One climat shares the cru's name. A wine label naming only Clos des Lambrays keeps
the whole-cru outline: the matcher ignores a plot name identical to its cru, so
that area is selected on the map, not inferred from the label. Les Bouchots and
Meix-Rentier are selected only by their exact names.

The [parcel crosswalk](parcel-named-areas.json) assigns 2 parcels to Clos des
Lambrays, 2 to Les Bouchots and 8 to Meix-Rentier, each wholly inside that
lieu-dit at stored precision. Ten parcels only touch the cru edge, by 7.9–57.7 m²
each: nine lie in `LE VILLAGE` and one in `LES LARRETS`. They remain Clos des
Lambrays parcels for rights and history, but the config lists those names as
neighbouring lieux-dits, not Clos des Lambrays climats.

## Rights, history and sales

The [source recheck](source-review.json) pins freshly obtained catalogue bytes,
sizes, hashes and exact UTC retrieval times. It reuses the bundle's 7 October
catalogue snapshot: the rights, DFI and geometry bytes are identical to the
Vosne-Romanée recheck that day, and the DVF catalogue differs only in
data.gouv.fr's re-analysis timestamps for one resource. The
[shared inventory](../../../scripts/grand-crus/sources/inventory-2026-10-01.json)
retains the raw member identities and original acquisition timestamps.

All rights join on complete parcel references. The 14 records are all code
P (ownership), one per parcel, for three identifiers; recorded fiscal areas match
the current cadastre's stated areas for all 14. Private-person rights are absent
from this legal-entity dataset. The provisional `U…` keys are retained. Company filings crosswalk the old
Merme-Morizot exploitation company to GFA 778237206, without a producer link.
SCI 21 23 remains unresolved. The Domaine des Lambrays company link enables
grouping; paid SPF copies and present-season confirmation remain Tier 3.

[Rights history](rights-history.json) finds no DFI event for any current parcel in
the complete July 2026 department member, so every trace stops at the source
boundary. That is a source boundary, not evidence that the parcels were never
divided or merged. No spatial predecessor candidate exists in the geometry
vintages. Fourteen parcels show rights changes between 2019 and 2025; the history
keeps each snapshot's original identifiers and does not infer transfers.

[DVF+](sale-records.json) contains one sale deed, on 25 April 2025, for the edge
parcel AP0074. Only dates, deed types and references are retained, without prices,
addresses or party names.

## Notices and gaps

The [notice audit](notice-audit.json) and [notice history](notice-history.json)
query all 22 current references against the three Côte-d'Or corpora. Both index
candidates were read from their page images. `bfc-2021-096:p257` (page 258) is
the Domaine des Lambrays application receipt for dossier 2021-061, act
BFC-2021-04-09-00018. It prints Morey-Saint-Denis AP0101, AP0102, AP0105, AP0106,
AP0107, AP0108 and AP0199 in that commune's own list, names SCEA Les Beaux Monts as
previous operator, covers 13.2473 ha across four communes and was complete on
7 April 2021. OCR had found only AP0105, AP0107 and AP0199. `bfc-2021-128:p138`
(page 139) republishes the same letter as act BFC-2021-04-09-00022.

The [curation](curation.json) records one historical-application event on those
seven current parcels and keeps the second publication as a repeat of it, not a
second event. A receipt is not an authorisation, and no outcome or actual
operation is established.

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

All three recorded holders have new entries and local research rows using the
[shared holder table](../holders/holder-links.json). Domaine des Lambrays has a reviewed company
link from its exact SIREN and filed wine-estate statutes. It covers eight mapped parcels, seven
already carrying the Tier 1 application lead, so the union rises from seven to eight and fourteen
parcels remain unresolved. A wine-company relationship is not proof of current parcel operation.

The Merme-Morizot U-id has a company-record identity crosswalk to **778237206**: the 1994 filing
identifies the old exploitation company, and the 1997 deed expressly converts it into the
non-operating GFA Merme Morizot. The deed recites long-term leases but names no tenant or individual
parcels. The Taupenot family names are not an independently documented producer-company relation.
The SCI 21 23 U-id remains unresolved; same-name Rennes SCI 505373852 is retained as a candidate,
without a Morey company-record or exact parcel crosswalk.

The bounded selection screened **10 PDFs / 148 pages**: six Lambrays filings (75 pages), two
Merme-Morizot filings (39 pages), and two SCI candidate filings (34 pages). Every page was OCR-screened
at 150 dpi with RapidOCR and DirectML, and identity/date ambiguities were checked against images.
No selected filing supplies a current reference, individual area and recorded holder together.
The 2014 Lambrays share-sale document refers to property titles and cadastral extracts in Annex 6,
but that annex is absent from the downloaded 18-page filing. Thus **exact filing matches remain zero**.
The [filing log](filings.md) records dates, page counts, original-byte hashes and bounded gaps.

The supplied Winehog article and all four maps were reviewed. References 99/181/182 have no
individual areas; a suggested predecessor 100 is explicitly speculative. The unnumbered
Taupenot-Merme plot is stated as 420 m², unlike current AP104 at 430 m², and no match is forced from
map position or rounding. Three unmatched entries preserve these limits. The public estate page's
8.66 ha across three named areas and Winehog's 0.042 ha Taupenot-Merme total in Meix Rentier are
separate named-area census rows with no allocation to current parcels.

Source dates remain distinct from filing dates. The SCI decision signatures say 19/26 May 2018,
although the free index calls them 2019 and the deposit is 29 May 2019. The 1996 Lambrays formation
was deposited in 1997. No present operation follows from company objects, historical share sales
or undated estate totals. **Verified farming stays zero.** Raw PDFs, archives, OCR and images remain
outside Git; missing annexes, original leases and present-season confirmation remain gaps.

## Reproduce and validate

Use Python 3.12, as CI does, with
`scripts/burgundy-map-requirements.txt`. From the repository root:

```sh
python scripts/download_grand_cru_sources.py --cru clos-des-lambrays
python scripts/build_grand_cru_parcels.py --cru clos-des-lambrays --check
python scripts/build_grand_cru_commune_audit.py --cru clos-des-lambrays --check
python scripts/build_grand_cru_named_plots.py --cru clos-des-lambrays
python scripts/build_grand_cru_parcel_named_areas.py --cru clos-des-lambrays --check
python scripts/build_grand_cru_history_rollout.py --bundle chambolle-morey --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
python scripts/audit_grand_cru_history_rollout.py --check
npm run build
python scripts/measure_grand_cru_payload.py
```

The named-area builder is deterministic; rebuilding must leave its outputs
unchanged. The browser journey uses `WINELOG_E2E_CRU=clos-des-lambrays` with
`burgundy-village-map.spec.ts`, without expanding the normal Chromium matrix.
