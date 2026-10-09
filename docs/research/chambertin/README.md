# Chambertin parcels: Tier 1 (#391)

Chambertin uses INAO `inao-denom-447`, appellation 148, and Gevrey-Chambertin
commune 21295. Reviewed 7 October 2026 for season 2026 under the
[rollout playbook](../../grand-cru-parcel-rollout.md) and
[#461 history method](../grand-cru-history.md). This delivery enables Chambertin;
each of the other eight bundle crus requires its own review.

**No current farmer is verified.** Recorded rights, parcel filiation, deeds and
administrative procedures are separate evidence; none establishes current farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 137; 28.218078 ha of measured cru overlap |
| Parcels with recorded legal-entity rights (1 January 2025) | 99; 33 holder identifiers |
| Parcels without matched rights | 38 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights file listed at the 7 October recheck |
| Parcels whose rights changed over the imported snapshot range | 49; name changes and unprovable identifier changes are distinguished from holder changes |
| Official DFI release and commune coverage | July 2026, complete department 21 member; commune 21295 records validate from 1989-04-12 to 2026-06-22 |
| Earliest / latest reachable official DFI validation date | 1989-04-17 / 2024-11-04 |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01; all 35 listed vintages through the pinned map obtained; September 2026 is outside the pinned geometry range |
| Current parcels with documented predecessors / pre-2019 events | 34 / 32 |
| Distinct DFI documents / analysis lots supporting those parcels | 10 / 14 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; 137 traces end at a source boundary or unrecorded event |
| Sales and notices: available / imported date ranges and gaps | DVF+ declared 2014-01-01–2025-12-31, complete BFC 2026-1 archive imported; commune observations 2014-01-14–2025-12-15. Notices: partial departmental 2004–2015, departmental 2016–2020 and regional 2019–2026 indexes; gaps below |
| Parcels with an authorisation / application or suspension | 1; BN0034 application receipt, no permission or current operation confirmed |
| Parcels with sale records (DVF) | 4; four deeds, no historical-reference deed |
| Parcels with holder or research leads | 1; the reviewed application; a recorded legal holder alone is not a lead |
| Parcels with no lead | 136 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: recursive DFI to 1989, all pinned geometry vintages and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 420,894 / 62,023 bytes. Evidence: 127,125 / 11,882 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 442-parcel Gevrey bundle; Chambertin selects 137 of those parcels.
No named-area GeoJSON is added. Geometry and evidence load only after Parcel
rights is switched on; the production payload report also checks compiled JS.

## Geometry and named areas

The [bundle](../../../scripts/grand-crus/bundles/gevrey-chambertin.json) pins the
1 June 2026 cadastre, lieux-dits, rights files, licences, URLs and hashes. The
INAO Chambertin feature covers 28.230852 ha and includes the Clos de Bèze area.
That is the imported official feature, not a claim that the Chambertin lieu-dit
alone has that area. Parcels attach to this INAO identity and the separate
Chambertin-Clos de Bèze feature where their measured geometry overlaps each.
Alternative wine names never supply parcel membership.

The [commune audit](../../../scripts/grand-crus/reports/chambertin-commune-audit.json)
finds 127.6 m² uncovered, below the default 0.1% limit. Brochon and
Morey-Saint-Denis have no parcel contact. One own-commune contact below the
1 m² import threshold is retained in the
[parcel report](../../../scripts/grand-crus/reports/gevrey-chambertin-parcels.json).
Full cadastral parcels remain unchanged; measured cru overlap is separate.
No geometry is filled, buffered or repaired to pass the audit.

The BIVB pages list [Chambertin](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/chambertin,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MjY0Jnw%3D)
and [Clos-de-Bèze](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/chambertin-clos-de-beze,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MjY1Jnw%3D)
under their respective appellations. The cadastral `CHAMBERTIN` and
`CLOS DE BEZE` polygons intersect the broader INAO Chambertin feature by
12.827524 and 15.340474 ha. The
[named-area audit](../../../scripts/grand-crus/reports/chambertin-named-plots.json)
retains the remaining 0.062855 ha without adding it to either area.

**`namedPlots.displayLayer` is false.** A selectable `CHAMBERTIN` area would
redirect every Chambertin wine to only part of its official feature. The map
retains the whole-cru outline, including when a reference names either audited
area. No label aliases or producer holdings are added.

The [parcel crosswalk](parcel-named-areas.json) assigns 78 parcels to
`CHAMBERTIN` and 47 to `CLOS DE BEZE`. Twelve other full parcels have small
INAO edge overlaps while lying mostly in `BEL-AIR` (5), `LES MAZIS-HAUTS` (4)
or `MONTCHARMONT` (3). Their exact cadastral names are retained with unresolved
climat crosswalks under #344. Every parcel has at least 90% in one lieu-dit;
none touches no lieu-dit polygon, so `parcelsWithoutLieuDit` is empty.

## Rights, history and sales

The [source recheck](source-review.json) pins the
[7 October Gevrey catalogue snapshot](../../../scripts/grand-crus/sources/catalogues/2026-10-07-gevrey-chambertin/)
with acquisition and sanitized-snapshot hashes, sizes and UTC retrieval times.
The BIVB HTML has its embedded Google API key redacted. The `redaction` metadata
retains the original hash/size and transformation; `sha256`/`size` pin the
sanitized file. All other source bytes, including names and whitespace, are
preserved. [The redactor](../../../scripts/redact_grand_cru_html.py) reproduces
this transformation without executing the HTML. The recheck reconfirms available
rights years, latest DFI release/schema, geometry inventory and DVF release.
The [shared inventory](../../../scripts/grand-crus/sources/inventory-2026-10-01.json)
retains original department members and acquisition provenance.

Exact full-reference joins preserve all holders and right codes. Missing
legal-entity records do not establish private ownership or absence of an owner.
Company continuity requires an unchanged valid SIREN; provisional identifier
changes remain unprovable. No holder-to-domaine crosswalk is established, so
domaine grouping stays off. Producer and company filings remain Tier 2; paid
SPF copies and outreach remain Tier 3.

[Rights history](rights-history.json) traces 34 current parcels through
documented predecessors, 32 with pre-2019 events. The earliest event splits
BO0080 into BO0121 and BO0122 on 17 April 1989. All 14 analysis lots retain their
complete mother/daughter sets and original validation dates. Two accepted
next-vintage spatial relationships remain separately labelled inference; no
current parcel has inference-only ancestry, and none of the spatial candidates
is rejected. Source-boundary termination is not a parcel creation date, and
filiation never backdates rights or transfers an operator automatically.

[DVF+](sale-records.json) retains four deeds on four current references and no
historical-reference deeds. Dates and references are retained without prices,
addresses or parties. Available and observed intervals do not prove continuity.

## Notice review and gaps

The [notice audit](notice-audit.json) and [notice history](notice-history.json)
query all current and reachable historical references against the three
Côte-d'Or corpora. The pending candidate `bfc-2023-037:p10` was reviewed from
the hash-verified PDF, using page images of the cover, heading and letter.

Page 11 explicitly places **BN34 in Gevrey-Chambertin**. It names SCEA DOMAINE
d'EUGENIE as applicant and Maison Bouchard Père et fils as previous operator.
The letter is stamped **15 December 2022**, while its printed identifier is
`BFC-2023-12-15-00001`; the bulletin cover is dated 4 April 2023. The stamped
letter date is used for the event and the conflicting identifier is preserved.
The application and completeness date is 24 November 2022. The stated 0.6426 ha
covers both communes collectively and is not assigned to BN34. The receipt
expressly does not authorise cultivation; outcome and current operation remain
unconfirmed. No other reference is inferred from this event.

Earlier publications are partial Internet Archive/Common Crawl captures under
their official URLs. No Côte-d'Or bulletin was obtained for 2007, 2009, 2012 or
2014. Other 2004–2015 years have incomplete coverage; departmental 2021–2026,
regional pre-2019 and pre-2004 intervals remain unsearched or outside the corpus.
See the [availability audit](../../../scripts/grand-crus/sources/notice-coverage-2026-10-04.json)
and [earlier-bulletin research](../earlier-bulletins/README.md). These shared gaps
remain under #461; unverified operation remains under #364. Access failure or an
unsearched interval is a gap, not absence of history.

## Reproduce and validate

Use Python 3.12 with `scripts/burgundy-map-requirements.txt`:

```sh
python scripts/download_grand_cru_sources.py --cru chambertin
python scripts/build_grand_cru_parcels.py --cru chambertin --check
python scripts/build_grand_cru_commune_audit.py --cru chambertin --check
python scripts/build_grand_cru_named_plots.py --cru chambertin
python scripts/build_grand_cru_parcel_named_areas.py --cru chambertin --check
python scripts/build_grand_cru_history_rollout.py --bundle gevrey-chambertin --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
python scripts/audit_grand_cru_history_rollout.py --check
npm run build
python scripts/measure_grand_cru_payload.py
npm test
```

The representative Chromium journey uses `WINELOG_E2E_CRU=chambertin` with
`burgundy-village-map.spec.ts`. It covers mobile width, keyboard toggling,
download retry, unknown rights, holder search, producer-scoped manual links and
owner/shared wine views without expanding the standard Chromium matrix.

The cru issue and its #461 line are completed only after review and merge.
