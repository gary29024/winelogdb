# La Grande Rue parcels: Tier 2 (#430)

La Grande Rue uses INAO `inao-denom-654`, appellation 189, and Vosne-Romanée
commune 21714. Tier 1 history reviewed 7 October 2026; Tier 2 research reviewed
8 October 2026, locally audited 9 October 2026, for season 2026 under the
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
| Raw / gzip payload (parcels, evidence) | Parcels: 77,030 / 12,485 bytes. Evidence: 52,559 / 8,754 bytes |

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

The executed 29 November 2001 rural lease is reproduced on PDF pages 15–29 of the 2010 donation. Its page 16 lists **AM 1: 14,207 m²; AM 2: 2,096 m²; AM 8: 222 m²**. All three current references and individual cadastral areas match, for **16,525 m²** in total. The lessor is GFV Domaine François Lamarche, SIREN 397738634, the same legal entity now recorded as SAS Nicole Lamarche. These are three parcel matches from one filing. The source is dated 2010, the annexed instrument 2001; neither date is treated as an acquisition date.

The GFA was formed on 15 June 1994. Pages 18–19 of the annexed lease recite the 11 August 1994 contribution of these parcels, published at Beaune on 21 October 1994, volume 1994P no. 4330. The 23,514,000-franc property value is distinct from the 26,387,000-franc whole fixed-asset contribution recalled in the statutes. The original contribution instrument is not included in the reviewed files.

The July 2001 meeting merely authorised a lease. The executed 29 November lease names François Lamarche and Marie-Blanche Cebe, spouse Lamarche, as personal tenants for 1 January 2001–31 December 2018; page 24 authorises mise à disposition to operating SARL 353336068 and the 2010 donation says it occurred. The 2019 treaty names Nicole personally as tenant and the June resolutions complete the SARL merger and SAS transformation. The 2022 treaty states that the SAS became direct operator of its own vines and that the EARL/SAS lease ended on 7 November 2019; its annexes are not appended and it gives no parcel schedule. The 2022 merger completes on 16 March, deposited 3 May. These distinct historical and company-level operator records remain deferred to #364 with the owner’s approval; **verified current farming remains 0**.

The domaine’s own La Grande Rue page, captured by the Internet Archive in November 2022, gives the monopole as 1 ha 65 a, consistent with the three parcels’ 16,525 m². It feeds only the named-area census; the prior observation of unrelated content on the current domain was not rechecked locally.

The prior cloud pass reviewed two user-supplied Winehog archives (see [filings](filings.md#winehog-articles)); both are **not re-verified locally**, at the owner’s instruction. The following article findings remain qualified prior evidence. Both give 1.65 ha and neither prints a cadastral number. They link the former Gaudichots part to the 1989 promotion and to a 1959 exchange of plots with the DRC respectively; its 0.2318 ha equals AM 2 + AM 8 by area only, which is not a crosswalk.

Research leads rise from **0 to 3 of 3 parcels**. The legal-rights and geometry counts are unchanged; verified farming remains **0**.

| Measure | Tier 1 | Tier 2 |
| --- | ---: | ---: |
| Parcels with holder or research leads | 0 | 3 of 3 |
| Parcels with no named candidate | 3 | 0 |
| Holders with an applicable link | 0 | 1 of 1: reviewed `owner-company` |
| Parcels with exact-reference company filings | 0 | 3 from one filing |
| Published holdings in the named-area census | 0 | 1 |
| Verified farming links | 0 | **0** |

### Effort per holder

| Recorded holder | Filings | Pages | Outcome |
| --- | ---: | ---: | --- |
| Nicole Lamarche (`397738634`) | 17 | 591 | GFA/GFV Domaine François Lamarche became SAS Nicole Lamarche under SIREN 397738634. The 2001 lease annexed to the 2010 donation names AM 1, AM 2 and AM 8 with exact cadastral areas. Owner-company link reviewed; dated operator evidence deferred to #364. Current farming unverified. |

### Tier 2 access and evidence gaps

- Local audit: all 17 PDFs in the recorded free-index inventory, 591 pages, were freshly downloaded and read in full; every PDF hash, byte count and page count matches. One file reproduces the executed 2001 lease with exact AM 1, AM 2 and AM 8 schedules; the other 16 contain no qualifying current-reference schedule.
- The original 11 August 1994 contribution instrument is not included among the reviewed files. The 2001 lease annexed to the 2010 donation identifies AM 1, AM 2 and AM 8 and cites publication at Beaune on 21 October 1994, volume 1994P no. 4330. It is not an unfiled deed: a separate original SPF copy remains Tier 3.
- The 2001 mandate, executed lease, 2010 mise à disposition recital, 2019 treaty naming Nicole Lamarche personally as tenant, and 2022 account of direct SAS operation are distinct evidence. The 2022 treaty says the EARL/SAS lease ended on 7 November 2019, but includes no parcel schedule or termination instrument. With the repository owner’s approval, operator acceptance is deferred to #364 and verified farming remains 0.
- The published 1 ha 65 a was rechecked in the November 2022 Internet Archive capture. The prior observation of unrelated content on the current domaine domain was not rechecked locally.
- Local audit 2026-10-09 retried data.inpi.fr and pappers.fr for SIREN 397738634; both returned HTTP 403. Records available only there remain unverified.
- Both Winehog archives are not re-verified locally, at the repository owner’s instruction. Original URLs, dates and archive hashes remain as prior cloud evidence. The prior 0.2318 ha comparison with AM 2 + AM 8 is area-only, not a cadastral crosswalk; the exact legal matches come from the lease schedule.
- Source boundaries, failed notice downloads and unsearched historical intervals remain in the Tier 1 coverage. Current farming remains unconfirmed for all three parcels; paid SPF copies and outreach remain Tier 3.

## Local audit (Codex CLI, Windows, Python 3.12)

On 9 October 2026, **17 PDFs / 591 pages** were freshly downloaded and read in full. Every PDF hash, byte count and page count matches. Pixel-identical duplicate pages were reused only after full reading of the matching page; cited schedules and low-text pages were checked as images. The free-index page still displays the same 17 filing entries. The archived estate page and official company API changed bytes, but their area and identity findings remain supported; fresh retrieval details are in [filings](filings.md#local-audit-codex-cli-windows-python-312).

The prior blanket negative missed the executed 2001 lease annexed to the 2010 donation. Three exact current-reference and individual-area matches are now recorded. The 1994 publication reference, personal tenants, separate operating SARL, 2019 named tenant and 2022 operation/termination recital are distinguished. With the repository owner’s approval, operator acceptance remains deferred to #364 and verified farming remains **0**. No shared holder link, builder, schema, geometry or rights data was changed by this local correction.

INPI and Pappers were retried and both returned HTTP 403. Both Winehog archives are **not re-verified locally**, at the owner’s instruction; no disk search was made. The original 1994 instrument, underlying later lease/termination records, INPI/Pappers-only records, paid SPF copies and outreach remain open.

- Passed: research `--all --check`, holder links, app registry, independent rollout audit, lint, typecheck, production build, payload measurement and `git diff --check`. Named-area regeneration is unchanged; parcel, commune and named-area crosswalk checks pass.
- Complete raw-source history rollout `--check`: passed after all OCR stopped.
- Python CI list: **229 passed / 1 error (230 total)**, the established Windows Corton climat rounding difference (4603.0682 versus committed 4603.0683 m²).
- Vitest: **5,626 passed / 1 failed**, the known `tasteSection` English-month expectation against Windows `2026年8月`. No timed-out files.
- Chromium and mobile WebKit: **43 passed / 3 skipped / 2 failed**. Both failures are `Official history: la-grande-rue`: the shared test requires a DFI-validation event, but these parcels have none and it fails before browser interaction. Both La Grande Rue parcel journeys pass.
- Production evidence: **33 chunks, 5,619,039 raw / 506,489 gzip bytes**; zero evidence modules in initial or map static module graphs. La Grande Rue evidence: **52,559 / 8,754 bytes**. Independent audit: 451 obtained and two documented missing resources, 33 crus, 2,721 parcels, zero verified farming.

The platform and shared-test exceptions remain open; this is not an all-green local run.

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
