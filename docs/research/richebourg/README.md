# Richebourg parcels: Tier 2 (#425)

Richebourg uses INAO `inao-denom-1083`, appellation 221, and Vosne-Romanée
commune 21714. Tier 1 history reviewed 6 October 2026; Tier 2 research reviewed 8 October 2026 for season 2026 under the
[rollout playbook](../../grand-cru-parcel-rollout.md) and
[#461 history method](../grand-cru-history.md). Its shared Vosne bundle also
contains five other crus; this delivery enables only Richebourg.

**No current farmer is verified.** Recorded rights, parcel filiation, deeds and
administrative procedures are distinct evidence, and none establishes farming.

## Results

| Measure | Value |
| --- | ---: |
| Cadastral parcels | 58; 8.030866 ha of measured cru overlap |
| Parcels with recorded legal-entity rights (1 January 2025) | 26; 10 holder identifiers and 28 right records |
| Parcels without matched rights | 32 |
| Rights snapshots: available / imported years and missing releases | 2019–2025 / 2019–2025; no listed release missing; no earlier or 2026 rights file listed at the 6 October recheck |
| Parcels whose rights changed over the imported snapshot range | 15; 2019–2025 |
| Official DFI release and commune coverage | July 2026, complete department 21 member; commune 21714 records validate from 1989-05-05 to 2026-06-29 |
| Earliest / latest reachable official DFI validation date | 1995-09-18 / 2025-05-12 |
| Cadastre vintages: earliest / latest obtained and gaps | 2017-07-06 / 2026-06-01; all 35 listed vintages through the pinned map obtained; September 2026 is outside the pinned geometry range |
| Current parcels with documented predecessors / pre-2019 events | 32 / 11 |
| Distinct DFI documents / analysis lots supporting those parcels | 6 / 13 |
| Inferred-only ancestry / unresolved references or conflicting events | 0 inferred-only current parcels; 0 unresolved DFI events, traversal issues or spatial conflicts; all 58 traces end at a source boundary or unrecorded event |
| Sales and notices: available / imported date ranges and gaps | DVF+ declared 2014-01-01–2025-12-31, complete BFC 2026-1 archive imported; commune observations 2014-01-20–2025-12-17. Notices: partial departmental 2004–2015, departmental 2016–2020 and regional 2019–2026 indexes; archive gaps below |
| Parcels with an authorisation / application or suspension | 0 |
| Parcels with sale records (DVF) | 23; 5 deeds on current references, plus 2 deeds on historical references retained with original scope |
| Parcels with holder or research leads | 29; a recorded legal holder alone is not a lead |
| Parcels with no lead | 29 |
| Verified farming links | 0 |
| Official history to earliest records (#461) | Delivered for per-cru review: recursive DFI to 1995, all pinned geometry vintages and published rights; sale/notice coverage remains source-specific and qualified |
| Raw / gzip payload (parcels, evidence) | Parcels: 77,030 / 12,485 bytes. Evidence: 201,225 / 17,499 bytes |

Measurements use Python 3.12 `gzip.compress(data, mtime=0)`. The parcel download
is the shared 83-parcel Vosne bundle; the Richebourg selection contains 58 of
those parcels. Named-area GeoJSON adds 11,410 / 4,241 bytes raw / gzip when the
village map opens. Rights geometry and evidence load only after Parcel rights is
switched on. The production payload report additionally measures compiled JS.

## Geometry and named areas

The [bundle](../../../scripts/grand-crus/bundles/vosne-romanee.json) pins the
1 June 2026 cadastre, lieux-dits, rights files, licences, URLs and SHA-256 hashes.
Full parcel polygons remain unchanged; overlaps are measured separately in
EPSG:2154. The [commune audit](../../../scripts/grand-crus/reports/richebourg-commune-audit.json)
finds 1.6 m² of the 80,310.6 m² INAO outline without parcel coverage, well below
the default 0.1% limit. Flagey-Échezeaux, Nuits-Saint-Georges and Vougeot have no
contact. Eight own-commune contacts at or below 1 m² are excluded and retained
individually in the [parcel report](../../../scripts/grand-crus/reports/vosne-romanee-parcels.json).
No geometry is repaired, clipped, buffered or filled to pass this audit.

The [BIVB appellation page](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/richebourg,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9Mzc5Jnw%3D)
lists Les Richebourgs and Les Vérroilles ou Richebourgs. They match the cadastral
names `LES RICHEBOURGS` and `LES VERROILLES OU RICHEBOURGS` using only case and
accent normalization. No additional aliases or producer-holding outlines are
inferred. Their display polygons are exact intersections with INAO, measuring
5.042500 and 2.988512 ha, with all 3 and 5 polygon components retained. The
[named-area audit](../../../scripts/grand-crus/reports/richebourg-named-plots.json)
retains a 0.527 m² gap. This is distinct from the parcel-coverage gap.

The [parcel crosswalk](parcel-named-areas.json) assigns 34 parcels to Les
Richebourgs and 24 to Les Vérroilles ou Richebourgs, each with at least 99.98%
of its full polygon in that lieu-dit at stored precision. These are cadastral
named areas within one official cru. Unrecognised or blended names retain the
whole-cru outline. Selecting a named area retains Richebourg's rights context.

## Rights, history and sales

The [source recheck](source-review.json) pins freshly obtained catalogue bytes,
sizes, hashes and exact UTC retrieval times. It confirms the existing rights
years, latest DFI release/schema and geometry release inventory. The
[shared inventory](../../../scripts/grand-crus/sources/inventory-2026-10-01.json)
retains the raw member identities and original acquisition timestamps; the recheck
does not overwrite them or silently advance the current map date.

All rights join on complete parcel references. The 28 records preserve codes
P (ownership), N (bare ownership) and U (usufruct), including two parcels with
multiple rights. Recorded fiscal areas match the current cadastre's stated areas;
geometric area is measured independently. Private-person rights are absent from
this legal-entity dataset. The provisional identifier `U14149307` remains an
identifier, not a verified SIREN or an inferred person. Tier 2 now adopts the
[shared holder table](../holders/holder-links.json). Six company-record links
support domaine headings. The SAS Méo management lead, the AF-Gros lease link
and the provisional Leroy identity stay legal-holder leads; Grivot stays unlinked.
The UI says **Research link · farming unverified**. Paid SPF copies and outreach
remain Tier 3.

[Rights history](rights-history.json) preserves six documents and thirteen complete
analysis lots. The earliest is AN0177 → AN0259/AN0260/AN0261 on 18 September 1995;
later subdivisions retain intermediate references and full event paths. The 1995
event predates obtained geometry, so its predecessor has no observed polygon.
The other lots are reconciled with dated geometry. DFI validation dates are not
acquisition, creation or farming dates, and source-boundary terminal reasons do
not imply original ownership. The independent raw-source audit verifies the
complete event sets and retained rights in addition to rebuilding the files.

The older spatial rule remains separately labelled: 31 current parcels have a
next-vintage inferred predecessor; five candidate successors are rejected.
All such current ancestry also has official documentation, so inferred-only
current parcels remain zero. These spatial counts differ from the 32 current
parcels with documented predecessors.

[DVF+](sale-records.json) contains five deeds on 23 current references and two
historical-reference deeds. Two historical context paths remain unassigned;
deed scope is never promoted to individual successor ownership. Only dates,
deed types and references are retained, without prices, addresses or party names.
Available and observed intervals are not proof of uninterrupted records.

## Notices and gaps

The [notice audit](notice-audit.json) and [notice history](notice-history.json)
query all 71 current/reachable references against the three Côte-d'Or corpora.
There are zero reviewed matches and zero unreviewed candidates. The previously
image-reviewed OCR hit `bfc-2022-101:p350` concerns Flagey-Échezeaux references,
not Richebourg: the applicant's Vosne-Romanée address cannot assign the table
to this commune. Other reviewed Vosne references remain unassigned because they
are outside Richebourg's reachable reference set. No OCR-only event is promoted.

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

All ten recorded holders were researched through the shared table. Eight have
reviewed links, one has a provisional name-and-seat lead, and one remains
unlinked. The pass screened **36 filings / 1,454 pages** with embedded text and
DirectML OCR of every page, then checked the cited schedules against page images.
The [filing inventory](filings.md) records dates, exact references, page numbers,
hashes, bounded negatives and per-holder effort.

Five filing entries name **18 current parcels** with matching individual areas
and recorded company rights. Their dates run from the 1974 DRC statutes to the
2020 Héritiers AF-Gros contribution. The Méo 1961 métayage recital, the distinct
2012 usufruct, Anne Gros’s bare/full ownership split and consolidated tenancy,
and the AF-Gros 2018 lease recital remain separate. Hudelot’s retired AN65 is
not silently promoted to an exact filing match for AN290/291.

Eleven published holdings feed only the named-area census. Six official producer
publications supplement the authorized Winehog history article. Area matches,
historical ownership colours and a person’s name do not assign present parcels.
Winehog’s 24 October 2025 article names four current references with matching
combined areas, but leaves the new owner unnamed. That article names no candidate
producer or farmer.

A supplementary pass then read the filings of eight related companies that hold
no current Richebourg rights: 39 filings / 504 pages, every page OCR-screened,
recorded in the [filing inventory](filings.md#supplementary-pass-related-company-filings).
Only the Liger-Belair filings name Richebourg references. A 30 December 2015
notarial contribution, filed in 2017, transfers to Domaine Thibault Liger-Belair
(443134523) a métayage right under a 14 May 2005 lease, published at the Beaune
land registry, by which GFA Domaine Xavier Liger-Belair (353575103), owner and
lessor, let Richebourg AN170 (44 a 13 ca) and AN172 (7 a 92 ca) for 18 years from
1 January 2005. Both areas equal the April 2025 cadastre, and DGFiP records the
GFA as owner of both references from 2019 to 2025. These retired references were
divided in 2025 into the four reported plots, AN292/293 and AN294/295, so the
lease reaches them only through documented DFI lineage, as
`filing-named-cadastral-reference` research. The term ran to the end of 2022; no
renewal, and no position after the 3 April 2025 sale, is established. Winehog’s
2013 map places the Liger-Belair plot here but prints no cadastral reference.
This is a historical tenancy lead, not current farming.

Research leads rise from **0 to 29 of 58 parcels**. **29 remain without a named
candidate**: the other 28 parcels without company rights and Grivot AN247.
The legal-rights and geometry counts are unchanged; verified farming remains **0**.

| Recorded holder | Filings | Pages | Outcome |
| --- | ---: | ---: | --- |
| Bichot SA (`036380046`) | 4 | 98 | Bichot’s official sheet identifies the Clos Frantin label and 0.07 ha. Four filings (98 pages) yield no exact AN53 schedule or parcel lease. Published area remains census evidence; farming unverified. |
| GFA Jean Grivot (`318506367`) | 4 | 61 | GFA Jean Grivot’s four filings (61 pages) show cash formation and compulsory long-term letting, without AN247 or a named tenant. Names and overlapping individual officers are insufficient for a domaine crosswalk; no link asserted. |
| Domaine Méo Camuzet (`320926439`) | 4 | 271 | The 2016 filing repeats AN54/59 with exact areas and a historical 1961 métayage; 2017 accounts name their usufruct without areas. Keep the older lease separate from the 2012 usufruct and current U rights; farming unverified. |
| Anne Gros (`348024928`) | 4 | 111 | The 2019 deed names AN174/236 in bare ownership and AN180/238 in full ownership with matching areas. It recites 2013 leases to Anne Gros; ownership and tenancy consolidate for AN180/238. No current farming season verified. |
| GFV Hudelot-Noëllat (`438871279`) | 5 | 188 | Five filings repeat AN64/66 with matching areas and retired AN65. AN290/291 are not printed in those schedules. General long-term letting clauses do not name a Richebourg tenant; current farming unverified. |
| Méo-Camuzet Frère et Sœurs (`448502708`) | 4 | 73 | Four SAS filings show corporate/share changes and general vine acquisitions, without an exact Richebourg schedule. The GFA’s 2016 deed recites a separate 2012 usufruct over SAS-owned vines; N rights and management remain distinct from farming. |
| Domaine de la Romanée-Conti (`778269407`) | 3 | 325 | The 1974 notarial estate schedule names all eight current DRC Richebourg parcels with matching areas. Later share filings add no current parcel lease or farming season; legal company identity remains a research link. |
| GFA Mongeard-Mugneret (`778269498`) | 3 | 168 | Three filings (168 pages) contain no exact AN248 schedule or named Richebourg tenant. The estate publishes 0.3112 ha, but equal area is not a parcel crosswalk. Its GFA statutes require long-term letting; farming unverified. |
| GFA Héritiers AF-Gros (`885114322`) | 2 | 110 | The 2020 formation contributes AN243/245 with matching areas and recites a 2018 lease to SAS Domaine A.F Gros (383967346), 18 years from 11 November 2017. The tenant link is Richebourg-only; original lease and current farming unverified. |
| SCI DOM LEROY (provisional) (`U14149307`) | 3 | 49 | Three SCI filings (49 pages) give no exact AN57/61/168 schedule. A 2006 resolution links the SCI and SCE through Leroy SA, but U14149307 to SCI 427469135 remains provisional on name and seat; farming unverified. |

The counts above describe this pass, including re-screened shared files; previous
pass totals remain in the table’s effort notes. Shared-source updates also refresh
the existing Échezeaux, Grands-Échezeaux and Clos de Vougeot exports without
changing their parcel research categories.

### Tier 2 access and evidence gaps

- All ten free filing indexes and official registry records were checked; 36 selected filings were downloaded and all 1,454 pages screened. This is a bounded selection of formation, contribution, donation, transformation and recent statutes, not every filing ever deposited.
- Grivot AN247 has no accepted domaine crosswalk: overlapping individual names and management records are not sufficient. No exact AN53, AN247 or AN248 filing schedule was found in the selected files.
- U14149307 to SCI Domaine Leroy 427469135 remains a provisional name-and-seat match; the three reviewed filings do not name AN57/61/168.
- Hudelot’s retired AN65 is not promoted into a filing match for AN290/291. The 2017 Méo asset list lacks parcel areas; the separate SAS files provide no exact Richebourg schedule.
- Winehog subscriber text was reviewed only from two authorized user-supplied webarchives. The October 2025 article does not name the new owner of plots 292/293/294/295; colours and rumours are not an identity crosswalk.
- The Winehog history article prints 18 August 2013; its page metadata gives a 1 October 2017 modification, not a printed update date. Older ownership maps and producer totals never override the 2025 rights snapshot or later deeds.
- A supplementary pass screened 39 filings / 504 pages of eight related companies with no current Richebourg rights: Domaine Thibault Liger-Belair, its family holding, GFA Domaine Xavier Liger-Belair, Domaine A.F. Gros, Gros Frère et Sœur, SCEA Domaine de la Levrière (formed 2026), SCE du Domaine Leroy and SC Domaine Jean Grivot. Only the Liger-Belair filings name Richebourg references (former AN170/AN172). The 2005 métayage’s renewal after 2022, its position after the 3 April 2025 sale, the original lease and its land-registry copy remain unreviewed.
- Deposit dates for two Grivot 2024 files and the Leroy 2024 minutes are not established. Original lease instruments, later renewals, paid SPF copies and outreach remain unreviewed; no access restriction was bypassed.
- Source boundaries, failed notice downloads and unsearched historical intervals remain in the Tier 1 coverage. All 58 current farming identities remain unconfirmed.

## Reproduce and validate

Use Python 3.12, as CI does, with
`scripts/burgundy-map-requirements.txt`. From the repository root:

```sh
python scripts/download_grand_cru_sources.py --cru richebourg
python scripts/build_grand_cru_parcels.py --cru richebourg --check
python scripts/build_grand_cru_commune_audit.py --cru richebourg --check
python scripts/build_grand_cru_named_plots.py --cru richebourg
python scripts/build_grand_cru_parcel_named_areas.py --cru richebourg --check
python scripts/build_grand_cru_history_rollout.py --bundle vosne-romanee --check
python scripts/build_grand_cru_research.py --all --check
python scripts/build_grand_cru_app_registry.py --check
python scripts/build_grand_cru_holder_links.py --check
python scripts/audit_grand_cru_history_rollout.py --check
npm run build
python scripts/measure_grand_cru_payload.py
```

The named-area builder is deterministic; rebuilding must leave its outputs
unchanged. The browser journey uses `WINELOG_E2E_CRU=richebourg` with
`burgundy-village-map.spec.ts`, without expanding the normal Chromium matrix.
It covers the narrow owner/shared views, keyboard use, unknown rights, multiple
rights, download retry, holder search and producer-scoped manual links. Named-area
regressions also preserve the Échezeaux pilot and whole-cru fallbacks.

This delivery references #425 and tracker #420 without closing them. Tier 1 history
review remains separately tracked under #461; current farming remains under #364.
