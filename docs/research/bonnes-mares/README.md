# Bonnes-Mares parcels: Tier 2 (#432)

Bonnes-Mares uses INAO `inao-denom-361`, appellation 137, and crosses the
Chambolle-Musigny (21133) and Morey-Saint-Denis (21442) commune line. Tier 1 reviewed 7 October; Tier 2 reviewed
9 October 2026 for season 2026 under the
[rollout playbook](../../grand-cru-parcel-rollout.md) and
[#461 history method](../grand-cru-history.md). It appears on both village maps.
Its shared Chambolle-Morey bundle also contains Musigny and four Morey-Saint-Denis
crus; this delivery advances Bonnes-Mares to Tier 2.

**No current farmer is verified.** Recorded rights, parcel filiation, deeds and
administrative procedures are distinct evidence, and none establishes farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 130; 15.037599 ha of measured cru overlap (118 in Chambolle-Musigny, 12 in Morey-Saint-Denis) |
| Parcels with recorded legal-entity rights (1 January 2025) | 78; 30 holder identifiers and 78 right records |
| Parcels without matched rights | 52 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights file listed at the 7 October recheck |
| Parcels whose rights changed over the imported snapshot range | 42; 2019–2025 |
| Official DFI release and commune coverage | July 2026, complete department 21 member; commune 21133 records validate from 1989-04-12 to 2025-05-12, commune 21442 from 1989-04-14 to 2026-03-23 |
| Earliest / latest reachable official DFI validation date | 1990-01-10 / 2020-11-09 |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01 for both communes; all 35 listed vintages of each through the pinned map obtained; September 2026 is outside the pinned geometry range |
| Current parcels with documented predecessors / pre-2019 events | 22 / 22 |
| Distinct DFI documents / analysis lots supporting those parcels | 7 / 11 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; all 130 traces end at a source boundary or unrecorded event |
| Sales and notices: available / imported date ranges and gaps | DVF+ declared 2014-01-01–2025-12-31, complete BFC 2026-1 archive imported; commune observations 2014-02-14–2025-12-29. Notices: partial departmental 2004–2015, departmental 2016–2020 and regional 2019–2026 indexes; archive gaps below |
| Parcels with an authorisation / application or suspension | 3; one page-reviewed 2022 application receipt |
| Parcels with sale records (DVF) | 23; 7 deeds on current references, none on historical references |
| Parcels with holder or research leads | 34; Tier 1 had 3 notice leads; a recorded legal holder alone is not a lead |
| Parcels with no lead | 96 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: recursive DFI to 1990, all pinned geometry vintages of both communes and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 346,184 / 54,353 bytes. Evidence: 159,409 / 18,099 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 378-parcel Chambolle-Morey bundle; the Bonnes-Mares selection
contains 130 of those parcels. Bonnes-Mares adds no named-area GeoJSON. Rights
geometry and evidence load only after Parcel rights is switched on. The
production payload report additionally measures compiled JS.

## Geometry and named areas

The [bundle](../../../scripts/grand-crus/bundles/chambolle-morey.json) pins the
1 June 2026 cadastre and lieux-dits for both communes, the rights files, licences,
URLs and SHA-256 hashes, and audit-only Flagey-Échezeaux, Gevrey-Chambertin and
Vougeot parcels. Both INAO communes are imported, and the cru is one parcel set,
never split at the commune line. Full parcel polygons remain unchanged; overlaps
are measured separately in EPSG:2154.

The [commune audit](../../../scripts/grand-crus/reports/bonnes-mares-commune-audit.json)
finds 307.5 m² (0.20%) of the 150,676.3 m² INAO outline without parcel coverage,
above the default 0.1% limit. It is twelve narrow strips with mean widths of
0.21–1.18 m: 52.0 m² lies between parcels inside the outline and the rest along
its edge. None is a missing INAO commune, and no neighbouring commune's parcels
touch the cru. The reviewed cap in the [cru config](../../../scripts/grand-crus/bonnes-mares.json)
allows less than 0.1 m² above this measurement and is tied to the exact INAO and
cadastre hashes, so a changed source fails until it is reviewed again. Three
own-commune contacts at or below 0.7 m² are excluded and retained in the
[parcel report](../../../scripts/grand-crus/reports/chambolle-morey-parcels.json).
No geometry is repaired, clipped, buffered or filled to pass this audit.

The [BIVB appellation page](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/bonnes-mares,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MjI0Jnw%3D)
lists Les Bonnes Mares as the only climat. The pinned cadastre records
`LES BONNES MARES` in both communes; the reviewed entry lists both, and the two
features form one named area. Its exact intersection with INAO measures
15.014907 ha, leaving 0.052720 ha unmapped in the
[named-area audit](../../../scripts/grand-crus/reports/bonnes-mares-named-plots.json).
Because the named area is the whole cru, no separate layer is published and the
map keeps the official outline. No aliases or producer-holding outlines are
inferred.

The [parcel crosswalk](parcel-named-areas.json) assigns 105 parcels to Les Bonnes
Mares, each with at least 99.99% of its polygon in that lieu-dit. Twenty-five
parcels only touch the cru edge, by 2.0–73.6 m² each: 22 lie in `LES VEROILLES`
and 3 in `EN LA RUE DE VERGY`. They remain Bonnes-Mares parcels for rights and
history, but the config lists those names as neighbouring lieux-dits, not
Bonnes-Mares climats.

## Rights, history and sales

The [source recheck](source-review.json) pins freshly obtained catalogue bytes,
sizes, hashes and exact UTC retrieval times. It reuses the bundle's 7 October
catalogue snapshot: the rights, DFI and geometry bytes are identical to the
Vosne-Romanée recheck that day, and the DVF catalogue differs only in
data.gouv.fr's re-analysis timestamps for one resource. The
[shared inventory](../../../scripts/grand-crus/sources/inventory-2026-10-01.json)
retains the raw member identities and original acquisition timestamps.

All rights join on complete parcel references. The 78 records preserve codes
P (ownership) and N (bare ownership); no parcel has more than one right. Recorded
fiscal areas match the current cadastre's stated areas for all 78 matched parcels.
Private-person rights are absent from this legal-entity dataset. Eleven
provisional `U…` identifiers remain identifiers, not verified SIRENs or inferred
persons. No holder-to-domaine crosswalk is established, so domaine grouping stays
off. Producer research and company filings remain Tier 2; paid SPF copies and
outreach remain Tier 3.

[Rights history](rights-history.json) preserves seven documents and eleven
complete analysis lots. The earliest are three AB divisions on 10 January 1990;
the latest is AB0467 → AB0481/AB0482 on 9 November 2020, dividing a daughter of
AB0133's 2006 division. Every intermediate reference is kept. Events before 2017
predate obtained geometry, so their predecessors have no observed polygon. DFI
validation dates are not acquisition, creation or farming dates, and
source-boundary terminal reasons do not imply original ownership. The independent
raw-source audit verifies the complete event sets and retained rights.

The older spatial rule remains separately labelled: two current parcels have a
next-vintage inferred predecessor, with no rejected candidate. Both also have
official documentation, so inferred-only current parcels remain zero.

[DVF+](sale-records.json) contains seven sale deeds on 23 current references and
none on historical references. Only dates, deed types and references are
retained, without prices, addresses or party names. Available and observed
intervals are not proof of uninterrupted records.

## Notices and gaps

The [notice audit](notice-audit.json) and [notice history](notice-history.json)
query all 141 current/reachable references against the three Côte-d'Or corpora.
The one index candidate, `bfc-2023-037:p10`, was read from its page image
(page 11): an application receipt for SCEA Domaine d'Eugénie, dossier 2022-217,
printing Chambolle-Musigny AB304, AB438 and AB440 separately from its
Gevrey-Chambertin references. It covers 0.6426 ha across both communes, names
Maison Bouchard Père et fils as previous operator and was complete on
24 November 2022. The letter is dated 15 December 2022 although its published act
ID reads 2023-12-15. The [curation](curation.json) records it as one
historical-application event on those three current parcels; the receipt states
it does not authorise cultivation, and no outcome or actual operation is
established.

An independent raw OCR sweep over every indexed notice also hit `bfc-2019-054:p80`,
a 28 January 2019 SARL Domaine Michel Gros application receipt (dossier 2019-012)
that the index does not flag as farm-structures. Its page image (page 81) prints
AB114 and AB115 under Vosne-Romanée, not Chambolle-Musigny, and none of its
Chambolle-Musigny or Morey-Saint-Denis references is reachable from any cru in
this bundle, so nothing is assigned. Seventeen other raw hits are in notices that
never name either commune; the [notice audit](notice-audit.json) records them
unassigned.

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

All 30 recorded holders have a local research row using the [shared holder table](../holders/holder-links.json).
Nineteen entries are new; eleven reuse prior links, searches and effort. Five new links cover the
Groffier, Auvenay and Clos de Tart wine companies, an undated Hudelot-Baillet reported tenancy, and Arlaud's
historically recited lease. The existing Dujac family-company lead remains provisional. Thirteen
holders have applicable links; a lease or weak identity basis stays a lead rather than a company heading.

The selected pass screened **46 filings / 1,788 pages**, with RapidOCR and DirectML at 150 dpi on
every page, and image review of the positive schedules. Eight exact filing entries cover 17 current
parcels. These match the recorded holder, reference and individual area; old usufruct, fractional
interests and AB41's Chambolle-Musigny description remain qualified. The [filing log](filings.md)
records source dates, deposit dates, page counts, raw-byte hashes and the bounded negative screens.

Five U-id company identities are supported by exact schedules: Grands Vins Fins, Bart-Clair,
Arlaud, Clos Bussiere and Maison Mommessin. The Dujac, Bachus, Veroilles and two BND identities remain
unresolved. Individual officers and family names are not a producer-company crosswalk. The separate
Arlaud registration 429825441 is not merged with the filed company 444144190.

Three supplied Winehog Bonnes-Mares articles and the supplied Vogue and Clos de Tart histories were reviewed.
Arlaud AB76/121 and Groffier AB266 match both number and individual area. Drouhin's four-reference
group total and Vogue's mismatched AB98 stay unmatched. The Bachus filing supports only historical
external mandate evidence on exact AB304; AB438/440 have area discrepancies and are not renamed
AB437/439. Eight producer totals are a named-area census, with no parcel allocation. Arlaud's
published 0.2131 ha total differs from the two stated areas' 0.2081 ha sum, retained without correction.

Six additional Bonnes-Mares Winehog subscriber articles remain unsupplied; their links are in the
filing log. Public estate material was accessed directly. Downloads, archives, full article text,
page images and OCR remain outside Git. No geometry, rights, history or schema was changed.
Original leases, renewals, paid SPF records and current-season confirmations remain unreviewed.
**Verified farming stays zero.**

AR64 also matches the Clos de Tart company property annex (2018) and Winehog history (2015). The filed Maison Mommessin to Famille Mommessin to Societe du Clos de Tart name chain and four individually matched references resolve the U-id. The 2018 event is a share transfer; the property annex recites a 1932 land acquisition. No new land conveyance or current farming is inferred.

## Reproduce and validate

Use Python 3.12, as CI does, with
`scripts/burgundy-map-requirements.txt`. From the repository root:

```sh
python scripts/download_grand_cru_sources.py --cru bonnes-mares
python scripts/build_grand_cru_parcels.py --cru bonnes-mares --check
python scripts/build_grand_cru_commune_audit.py --cru bonnes-mares --check
python scripts/build_grand_cru_named_plots.py --cru bonnes-mares
python scripts/build_grand_cru_parcel_named_areas.py --cru bonnes-mares --check
python scripts/build_grand_cru_history_rollout.py --bundle chambolle-morey --check
python scripts/build_grand_cru_holder_links.py --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
python scripts/audit_grand_cru_history_rollout.py --check
npm run build
python scripts/measure_grand_cru_payload.py
```

The browser journey uses `WINELOG_E2E_CRU=bonnes-mares` with
`burgundy-village-map.spec.ts`, without expanding the normal Chromium matrix.
