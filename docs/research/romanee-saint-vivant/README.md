# Romanée-Saint-Vivant parcels: Tier 2 (#426)

Romanée-Saint-Vivant uses INAO `inao-denom-1085`, appellation 223, and
Vosne-Romanée commune 21714. Tier 1 history reviewed 7 October 2026; Tier 2 research reviewed 8 October 2026 for season 2026 under the
[rollout playbook](../../grand-cru-parcel-rollout.md) and
[#461 history method](../grand-cru-history.md). It shares the Vosne bundle with
five other crus; this delivery enables only Romanée-Saint-Vivant.

**No current farmer is verified.** Recorded rights, parcel filiation, deeds and
administrative procedures are distinct evidence, and none establishes farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 17; 9.442394 ha of measured cru overlap |
| Parcels with recorded legal-entity rights (1 January 2025) | 16; 11 holder identifiers and 17 right records |
| Parcels without matched rights | 1 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights file listed at the 7 October recheck |
| Parcels whose rights changed over the imported snapshot range | 10; 2019–2025 |
| Official DFI release and commune coverage | July 2026, complete department 21 member; commune 21714 records validate from 1989-05-05 to 2026-06-29 |
| Earliest / latest reachable official DFI validation date | 1990-01-18 / 2022-05-16 |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01; all 35 listed vintages through the pinned map obtained; September 2026 is outside the pinned geometry range |
| Current parcels with documented predecessors / pre-2019 events | 7 / 3 |
| Distinct DFI documents / analysis lots supporting those parcels | 3 / 3 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; all 17 traces end at a source boundary or unrecorded event |
| Sales and notices: available / imported date ranges and gaps | DVF+ declared 2014-01-01–2025-12-31, complete BFC 2026-1 archive imported; commune observations 2014-01-20–2025-12-17. Notices: partial departmental 2004–2015, departmental 2016–2020 and regional 2019–2026 indexes; archive gaps below |
| Parcels with an authorisation / application or suspension | 0 |
| Parcels with sale records (DVF) | 2; 1 deed on current references, no deed on historical references |
| Parcels with holder or research leads | 16; a recorded legal holder alone is not a lead |
| Parcels with no lead | 1 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: recursive DFI to 1990, all pinned geometry vintages and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 77,030 / 12,485 bytes. Evidence: 108,641 / 16,266 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 83-parcel Vosne bundle; the Romanée-Saint-Vivant selection contains
17 of those parcels. No named-area GeoJSON is added (see below). Rights geometry
and evidence load only after Parcel rights is switched on. The production payload
report additionally measures compiled JS.

## Geometry and named area

The [bundle](../../../scripts/grand-crus/bundles/vosne-romanee.json) pins the
1 June 2026 cadastre, lieux-dits, rights files, licences, URLs and SHA-256 hashes.
Full parcel polygons remain unchanged; overlaps are measured separately in
EPSG:2154. The [commune audit](../../../scripts/grand-crus/reports/romanee-saint-vivant-commune-audit.json)
finds 2.4 m² of the 94,426.6 m² INAO outline without parcel coverage, well below
the default 0.1% limit; no neighbouring parcel covers it. Flagey-Échezeaux,
Nuits-Saint-Georges and Vougeot have no contact. Twelve own-commune contacts,
each below 0.1 m², are excluded and retained individually in the
[parcel report](../../../scripts/grand-crus/reports/vosne-romanee-parcels.json).
No geometry is repaired, clipped, buffered or filled to pass this audit.

The [BIVB appellation page](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/romanee-saint-vivant,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9Mzg0Jnw%3D)
lists Romanée-Saint-Vivant as the cru's only climat. The pinned cadastre records it
as `ROMANEE SAINT-VIVANT` in two separate features of the same name; they are
treated as one named area (the builders union same-name features within a commune
and record `sourceFeatures: 2`). Clipped to INAO, it measures 9.442607 ha in three
polygon parts, leaving a 0.54 m² gap. The [named-area audit](../../../scripts/grand-crus/reports/romanee-saint-vivant-named-plots.json)
records these measurements. Because the named area is the whole cru, no duplicate
display layer is published and the map keeps the whole-cru outline, as for
Clos de Vougeot. No aliases or producer-holding outlines are inferred.

The [parcel crosswalk](parcel-named-areas.json) places all 17 parcels entirely in
`ROMANEE SAINT-VIVANT`.

## Rights, history and sales

The [source recheck](source-review.json) pins freshly obtained catalogue bytes,
sizes, hashes and exact UTC retrieval times in a
[bundle snapshot](../../../scripts/grand-crus/sources/catalogues/2026-10-07-vosne-romanee/)
shared by the Vosne Tier 1 reviews. It confirms the existing rights years, latest
DFI release/schema and geometry release inventory. The
[shared inventory](../../../scripts/grand-crus/sources/inventory-2026-10-01.json)
retains the raw member identities and original acquisition timestamps; the recheck
does not overwrite them or silently advance the current map date.

All rights join on complete parcel references, and every recorded fiscal area
matches the current cadastre's stated area; geometric area is measured
independently. The 17 records are all code P (ownership). Parcel AL0001 has two
ownership records from different identifiers. AL0329 has no record in this legal-entity dataset, which omits
private persons; its geometry and history are still shown. The provisional
identifiers `U14149307`, `U21852238` and `U33201044` remain identifiers in the rights file; the
[shared holder table](../holders/holder-links.json) records their company crosswalks and limits. Tier 2
adopts that table: 10 of 11 holders have an applicable link and the app groups rows under domaine
headings only where a company-record basis allows it. The UI says **Research link · farming unverified**.
Paid SPF copies and outreach remain Tier 3.

[Rights history](rights-history.json) preserves three documents and three complete
analysis lots. The earliest is AL0002 → AL0328/AL0329/AL0330, a *croquis de
conservation* validated on 18 January 1990. It predates obtained geometry, so the
predecessor has no observed polygon. Two survey documents validated on
16 May 2022 split AC0271 → AC0357/AC0358 and AC0273 → AC0359/AC0360; both are
reconciled with the April and July 2022 cadastre releases. Rights recorded on
AC0271 and AC0273 from 2019 to 2022 are kept with their original references as
historical context and are not transferred to the daughters. DFI validation dates
are not acquisition, creation or farming dates, and source-boundary terminal
reasons do not imply original ownership.

The older spatial rule remains separately labelled: four current parcels (the
2022 daughters) have a next-vintage inferred predecessor, and no candidate is
rejected. All of them are also officially documented, so inferred-only current
parcels remain zero.

[DVF+](sale-records.json) contains one 2017 sale covering AC0230 and AC0231 and
one other parcel. No deed matches a historical reference. Only dates,
deed types and references are retained, without prices, addresses or party names.
Available and observed intervals are not proof of uninterrupted records.

## Notices and gaps

The [notice audit](notice-audit.json) and [notice history](notice-history.json)
query all 20 current/reachable references against the three Côte-d'Or corpora.
There are zero reviewed matches, zero unreviewed candidates and no OCR
reference-hint hit in any indexed notice. The three reviewed Vosne-Romanée rows
(AB 100, AN 112 and AN 249) are outside Romanée-Saint-Vivant's reachable reference
set and remain unassigned. No OCR-only event is promoted.

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

## Tier 2 holder and filing research

All eleven recorded holders were researched through the shared table. 10 have a link that applies here (8 reviewed, 2 provisional); NICHOLEM was searched without finding one. The pass screened **45 filings / 1,686 pages** with embedded text and OCR of every image page, then checked the cited schedules against page images. The [filing inventory](filings.md) records dates, exact references, page numbers, hashes, bounded negatives and per-holder effort.

5 filing entries name **5 current parcels** with matching individual areas and recorded company rights: Les Héritiers Confuron’s 2024 contribution of AC298 and AC300; Mémoire de Vignes’ 2024 contribution of AL330; GFA Famille Cathiard’s 1996 contribution of AL326; and AL1, whose undivided two-thirds the Corton-Grancey GFA received in 1972 and whose third Maison Louis Latour contributed to Vignoble Latour in 2011. The leases they recite stay qualified: Confuron’s 24-year lease and Poisot-Piguet’s 18-year lease were signed the same day as the 2024 deeds but are not filed, Mémoire de Vignes also recites an earlier lease to an individual, and both AL1 filings recite a lease or oral lease to the Société Civile Domaine Louis Latour. None states a current farming season.

GFV Hudelot-Noëllat’s 2001 founding deed and its later filings print retired AC271 (17 a 84 ca) and AC273 (29 a 93 ca). Their areas equal the sums of the 2022 daughters AC357/358 and AC359/360, but the filings never print the current references. The evidence is therefore `filing-named-cadastral-reference` research on the retired references and reaches the four parcels only through documented DFI lineage.

Two new links rest on company records. The register lists AXA Millésimes as a partner of both the SCI de l’Arlot and the Domaine de l’Arlot operating company, whose 2007 filing gives the SCI 2,550 of its 5,000 parts; the SCI’s 1992 minutes call that company its tenant and report buying the Romanée-Saint-Vivant parcel in 1990; the link is reviewed `common-ownership`. GFA Famille Cathiard has a recorded partner who presides SAS Domaine Sylvain Cathiard et Fils; with no filing naming a tenant, that `family-holding` link stays provisional. The Confuron lease link now also covers this cru. NICHOLEM’s filings name no parcel, tenant or domaine. Domaine Dujac publishes 16 a 56 ca, exactly AL325’s area, but an equal area is not a company crosswalk, so no company link is made and AL325 keeps its legal holder name.

The repository owner supplied all 13 requested Winehog articles (see [filings](filings.md#winehog-articles)). Five print plot numbers whose areas match the cadastre: AL 1 (Louis Latour, 0.7630 ha), 326 (Cathiard, 0.1673 ha) and 327 (Arnoux-Lachaux, 0.345 ha) exactly, and, after rounding at the repository owner’s instruction, 325 (Dujac, printed 0.170 ha against AL325’s 0.1656 ha) and 300 and 298 (Confuron, printed 0.4982 ha against 0.4984 ha). They are `critic-named-cadastral-reference` research, not farming evidence. Only 325 adds a lead: AL325 now names Domaine Dujac as a critic candidate, while its recorded holder NICHOLEM stays unlinked. The history article’s 1966 lease and 1988 purchase dates for the DRC conflict with the filings and DVF and are not used.

11 published holdings feed only the named-area census, from seven official estate pages, two exporter pages and Winehog articles for Leroy and Confuron. The DRC’s 5.2858 ha equals the cadastral sum of AC230 and AC231. Leroy’s new website is still not used because it could not be verified as an official publication; Winehog gives the same 0.9929 ha. Winehog also gives de l’Arlot 0.2518 ha, where the estate page prints no area.

No DRC filing names AC230 or AC231. The former owner’s 2017 statutes (SC Domaine Marey-Monge) print both with today’s areas, the DRC’s 1998 minutes recite a 1975 long-term lease from that company, DVF dates a sale of both to October 2017 without parties, and in December 2017 Marey-Monge held a vendor-credit claim on the DRC without naming the asset. Because Marey-Monge is not the recorded holder, this is `filing-named-cadastral-reference` research on AC230/231, not an exact filing.

Research leads rise from **0 to 16 of 17 parcels**. **1 remains without a named candidate**: AL329, which has no legal-entity right. The legal-rights and geometry counts are unchanged; verified farming remains **0**.

| Measure | Tier 1 | Tier 2 |
| --- | ---: | ---: |
| Parcels with holder or research leads | 0 | 16 of 17 |
| Parcels with no named candidate | 17 | 1 |
| Holders with an applicable link | 0 | 10 of 11: 8 reviewed, 2 provisional |
| Parcels with exact-reference company filings | 0 | 5 in 5 filing entries |
| Parcels reached only through filing-named retired references | 0 | 4 |
| Parcels named only in a former owner’s filing | 0 | 2 |
| Parcels named by a critic with matching number and area (rounding accepted) | 0 | 6 |
| Published holdings in the named-area census | 0 | 11 |
| Verified farming links | 0 | **0** |

### Effort per holder

| Recorded holder | Filings | Pages | Outcome |
| --- | ---: | ---: | --- |
| SCI de l’Arlot (`322235748`) | 2 | 58 | Register and filings show AXA Millésimes as partner of the SCI and of the Domaine de l’Arlot operating company; the SCI’s 1992 minutes call that company its tenant and report the 1990 Romanée-Saint-Vivant purchase. No AL328 schedule; farming unverified. |
| Domaine Arnoux-Lachaux (`328972344`) | 5 | 113 | 5 filings (113 pages) show an operating company formed with cash and capitalised reserves, without an AL327 schedule or lease. Register identity only; farming unverified. |
| GFA Famille Cathiard (`405387101`) | 4 | 128 | The 1996 founding deed contributes AL326 with its exact area; filings of 2001, 2015 and 2024 repeat it. A partner is president of SAS Domaine Sylvain Cathiard et Fils; that provisional family link names no tenant. Farming unverified. |
| GFV Hudelot-Noëllat (`438871279`) | 8 | 289 | The 2001 contribution and later statutes name retired AC271 and AC273 with areas equal to today’s AC357/358 and AC359/360, which they reach only through the 2022 DFI division. No tenant named; farming unverified. |
| NICHOLEM (`484070800`) | 2 | 44 | Both filings (44 pages) show cash formation and a 2021 GFA requiring métayage, without AL325, a tenant or a domaine. Domaine Dujac publishes AL325’s area, but equal area is not a company crosswalk; no link asserted. Winehog’s cadastre 325 is a critic lead only. |
| Vignoble Latour (`528291362`) | 4 | 156 | The 2011 contribution names AL1 (76 a 30 ca) for its undivided third and recites an oral lease to the Société Civile Domaine Louis Latour. The holder is a Maison Louis Latour subsidiary; farming unverified. |
| Domaine de la Romanée-Conti (`778269407`) | 10 | 610 | 5 DRC filings give no Romanée-Saint-Vivant schedule; 1998 minutes recite a 1975 lease from GFA Marey-Monge. 5 Marey-Monge filings name AC230/231 with today’s areas and, in December 2017, a vendor-credit claim on the DRC; DVF dates a sale to October 2017. Farming unverified. |
| Mémoire de Vignes (`931134381`) | 4 | 117 | The 2024 contribution names AL330 (24 a 57 ca) and the statutes an 18-year lease to SCEA du Domaine Poisot-Piguet signed the same day; a 2011 lease to an individual is also recited. Farming unverified. |
| SCI DOM LEROY (provisional) (`U14149307`) | 4 | 99 | Four SCI and SCE filings (99 pages) give no AC299/301 schedule; both companies were formed in 1947 by the Noëllat family and now share Leroy SA. U14149307 to SCI 427469135 stays provisional on name and seat; farming unverified. |
| GFA Domaine de Corton-Grancey (`U21852238`) | 1 | 37 | The statutes reproduce the 1972 contribution of two-thirds of AL1 (76 a 30 ca) and recite that all contributed land is let to the Société Civile Domaine Louis Latour, now to 2031. Farming unverified. |
| GFV Les Héritiers Confuron (`U33201044`) | 1 | 35 | The 27 September 2024 deed contributes AC298 and AC300 (areas match), subject to a 24-year lease signed that day to the SCE du Domaine Jean-Jacques Confuron (348024712). Actual operation is not stated. |

The counts above describe this pass, including re-screened shared files; earlier pass totals remain in the table’s effort notes. Shared-source updates refresh the Clos de Vougeot, Corton and Richebourg registers without changing their parcel research categories.

### Tier 2 access and evidence gaps

- All eleven holders’ free filing indexes and official registry records were checked; 45 selected filings were downloaded and all 1,686 pages screened. This is a bounded selection of formation, contribution, donation, transformation and recent statutes, not every filing ever deposited.
- NICHOLEM (AL325): both filings name no parcel, tenant or domaine. Domaine Dujac publishes 16 a 56 ca, equal to AL325’s cadastral area, but equal area is not a company crosswalk; no company link is asserted. Winehog’s 2018 Dujac article names cadastre 325 as the Dujac plot, printed as 0.170 ha and accepted as a rounded match; that is a critic candidate for AL325, not a company link or farming evidence.
- AL329 has no legal-entity right; DFI places it with AL328 and AL330 in the 1990 division of AL2. Published Poisot (0.49 ha) and Follin-Arbelet (0.50 ha) totals name no parcel; private holdings are not researched.
- U14149307 to SCI Domaine Leroy 427469135 remains provisional on name and seat; no reviewed filing names AC299 or AC301. domaine-leroy.fr, reached by redirect from domaineleroy.com, publishes 0.9929 ha, but its provenance could not be verified (recently registered, no legal notice), so it is not used. Winehog’s 2015 article gives the same 0.9929 ha in two unnumbered plots; that feeds the census only.
- GFA Famille Cathiard to Domaine Sylvain Cathiard et Fils is a provisional family-holding lead on a shared recorded officer; no filing names a tenant for AL326.
- Hudelot’s AC271/AC273 reach AC357–AC360 only through the 2022 DFI division; no reviewed filing prints the current references, so they are not exact filing matches.
- No DRC filing names AC230 or AC231; only the former owner Marey-Monge’s statutes do. The 26 December 1975 lease recited in the DRC’s 1998 minutes and the October 2017 sale deed (DVF publishes no parties) are unreviewed. Winehog’s 2017 history dates the DRC’s lease to 1966 and its purchase to 1988; those dates conflict with the filings and DVF and are not used.
- The Confuron, Poisot-Piguet, Corton-Grancey and Vignoble Latour leases are recited, not filed; original instruments, renewals and current seasons are unreviewed. How Mémoire de Vignes’ 2011 lease to an individual ended is not stated.
- data.inpi.fr and pappers.fr refuse this cloud environment: filings or accounts available only there (including deposit dates missing from the free index for the 2024 Mémoire de Vignes deeds) are pending local audit.
- All 13 requested Winehog articles were supplied by the repository owner as saved webarchives and reviewed; URLs, printed dates and archive hashes are recorded, and archives and article text are not committed. Five print plot numbers whose areas match the cadastre (AL 1, AL 325, AL 326, AL 327, AC 298 and AC 300), two of them after rounding: 325 is printed as 0.170 ha and 300/298 as 0.4982 ha. Owner totals, maps and history are not parcel crosswalks.
- Source boundaries, failed notice downloads and unsearched historical intervals remain in the Tier 1 coverage. Current farming remains unconfirmed for every parcel; paid SPF copies and outreach remain Tier 3.

## Reproduce and validate

Use Python 3.12, as CI does, with
`scripts/burgundy-map-requirements.txt`. From the repository root:

```sh
python scripts/download_grand_cru_sources.py --cru romanee-saint-vivant
python scripts/build_grand_cru_parcels.py --cru romanee-saint-vivant --check
python scripts/build_grand_cru_commune_audit.py --cru romanee-saint-vivant --check
python scripts/build_grand_cru_named_plots.py --cru romanee-saint-vivant
python scripts/build_grand_cru_parcel_named_areas.py --cru romanee-saint-vivant --check
python scripts/build_grand_cru_history_rollout.py --bundle vosne-romanee --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
python scripts/audit_grand_cru_history_rollout.py --check
npm run build
python scripts/measure_grand_cru_payload.py
```

The named-area builder is deterministic; rebuilding must leave its audit report
unchanged. The browser journey uses `WINELOG_E2E_CRU=romanee-saint-vivant` with
`burgundy-village-map.spec.ts`, without expanding the normal Chromium matrix.
It covers the narrow owner/shared views, keyboard use, unknown rights, multiple
rights, download retry, holder search and producer-scoped manual links.

This delivery references #426 and tracker #420 without closing them. Tier 1 history
review remains separately tracked under #461; current farming remains under #364.
