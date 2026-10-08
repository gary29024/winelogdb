# Richebourg: public company filings

Reviewed 8 October 2026 for [Tier 2 issue #425](https://github.com/gary29024/winelogdb/issues/425), following the Clos de Vougeot precedent (#528). All ten recorded holders were searched in the official company API and the free entreprises.lefigaro.fr indexes. PDFs were downloaded from actes.ccm2.net; no paid land-register copies or outreach were used.

The bounded selection covers formation/original statutes, contributions, donations, transformations and recent statutes. It is not an exhaustive download of every filing. Each of the **36 files / 1,454 pages** was processed with PyMuPDF embedded-text extraction, then rendered at **150 dpi** and screened using RapidOCR with ONNX Runtime DirectML (`EngineConfig.onnxruntime.use_dml=True`, `Global.use_cls=False`). Three independent shards were started seconds apart, without a process pool. Positive schedules and lease passages were checked against page images. A negative means no qualifying Richebourg match in these selected files, not that no such document exists.

Dates separate the deed/decision (`documentDate`) from its deposit (`filingDate`). Page numbers include registry covers. Every source below records the original URL, raw-byte SHA-256, byte count, retrieval time and page count in [curation](curation.json) or the [shared holder table](../holders/holder-links.json). PDFs, OCR, article archives and full article text are not committed.

## Exact references

Five filing entries cover **18 current parcels**. Each printed reference and individual area agrees with the pinned `cadastreAreaM2`, and the filing company is a recorded holder. Historical rights and lease recitals do not establish the current farming season.

| Filing | Deed date / deposit | Exact current references and areas | Lease treatment |
| --- | --- | --- | --- |
| [DRC: 1974 notarial estate schedule](https://actes.ccm2.net/acte/5409256#page=1) (pp. 36, 38, 39, 74) | 1974-12-21 / 2002-07-31 | AN56: 9,370 m²; AN60: 3,195 m²; AN68: 2,245 m²; AN69: 2,144 m²; AN71: 53 m²; AN169: 9,573 m²; AN171: 792 m²; AN173: 7,738 m² | No parcel-specific lease identified. |
| [GFV Hudelot-Noëllat: founding contribution](https://actes.ccm2.net/acte/0cd2477b-6c77-42d4-a9b2-1b4400611014#page=2) (pp. 2, 3, 4) | 2001-06-28 / 2001-08-09 | AN64: 1,222 m²; AN66: 808 m² | No parcel-specific lease identified. |
| [Méo-Camuzet: annexed 1980 schedule and historical lease](https://actes.ccm2.net/acte/5b35a47b-a310-44b8-8c6f-0175473db175#page=7) (pp. 21, 24, 33, 34) | 2016-12-29 / 2017-01-09 | AN54: 3,061 m²; AN59: 462 m² | Historical recital in annexed 1980 statutes; no original lease or renewal reviewed. Not the separate 2012 usufruct. |
| [Anne Gros: contribution of bare and full ownership](https://actes.ccm2.net/acte/af5aa267-d231-4ca0-a66d-2ff68a677a38#page=3) (pp. 9, 10, 11, 13, 14) | 2019-11-27 / 2019-12-04 | AN174: 4,384 m²; AN236: 1,066 m²; AN180: 338 m²; AN238: 214 m² | Recited lease of the bare-ownership contributions; original lease and current farming season not reviewed. The deed expressly consolidates ownership and tenancy at the 2019 contribution. Do not present this as a continuing separate lease. |
| [GFA Héritiers AF-Gros: contribution and recited lease](https://actes.ccm2.net/acte/de0997df-6924-4dcb-b213-a7a17418aa28#page=2) (pp. 6, 8, 9) | 2020-07-01 / 2020-07-16 | AN243: 949 m²; AN245: 332 m² | The founding deed recites an existing executed lease; the original instrument and later amendments were not reviewed. No current farming confirmation. |

The DRC schedule is a 1974 description of the then estate, filed in a 2002 bundle; it is not a 2002 acquisition. Méo’s exact schedule and 1961 métayage occur in annexed 1980 statutes within the 2016 filing. The separately recited 2012 usufruct and the 2017 asset list must not be merged with that historical lease. Anne Gros’s deed distinguishes bare ownership of AN174/236 from full ownership of AN180/238, and expressly consolidates ownership and tenancy for the latter pair.

Hudelot’s AN65 (787 m²) is retired. Official filiation to AN290/291 remains in rights history, but those current references are not printed in these filings and receive no exact filing record. No qualifying filing naming an unrecorded current parcel was found; the four unrecorded plots discussed below come from a critic article, not a company filing.

## Effort and holder findings

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

These are counts for the Richebourg pass, including files re-screened after earlier cru research. They must not be added to earlier pass totals as if all files were unique. Previous recorded effort remains in the shared table’s effort notes. Eight holders have reviewed links, one has a provisional name-and-seat lead, and Grivot remains searched without an accepted link.

## Inventory of screened filings

### ric-bichot-2022

[Bichot SA: 28 June 2022 governance and statutes](https://actes.ccm2.net/acte/22570176#page=1) — 8 PDF pages, all screened. Deed/decision **2022-06-28**; deposit **2022-07-27**. Relevant pages: 1, 3.

Governance and updated statutes; no exact Richebourg reference or parcel lease found.

SHA-256: `383884876ab39260e10efec4bdbabf49263c6a99e043c2dc5dbda474f015b7c3`. Retrieved: 2026-10-07T16:17:09.113648+00:00; 278,812 bytes.

### ric-bichot-2014

[Bichot SA: 28 August 2014 location-gérance termination](https://actes.ccm2.net/acte/22570320#page=1) — 14 PDF pages, all screened. Deed/decision **2014-08-28**; deposit **2014-11-07**. Relevant pages: 1, 3, 5, 9.

Termination of a location-gérance arrangement; no AN53 schedule or Richebourg parcel tenant identified.

SHA-256: `6ce243a2e112960de49860dd14b4720e74642cc7238fb1d066473ac31199098d`. Retrieved: 2026-10-07T16:17:13.331872+00:00; 1,297,628 bytes.

### ric-bichot-2007

[Bichot SA: 15 March 2007 merger project](https://actes.ccm2.net/acte/22570244#page=1) — 58 PDF pages, all screened. Deed/decision **2007-03-15**; deposit **2007-06-19**. Relevant pages: 1, 20.

Merger project includes leases elsewhere; no exact Richebourg parcel reference or tenant found.

SHA-256: `7fd51fdfc87736c5e24d0ab5721d1c4c80a7f3f051fc117cdec3fe837682d154`. Retrieved: 2026-10-07T16:17:17.124449+00:00; 2,514,196 bytes.

### ric-bichot-1995

[Bichot SA: 29 June 1995 governance and statutes](https://actes.ccm2.net/acte/22570272#page=1) — 18 PDF pages, all screened. Deed/decision **1995-06-29**; deposit **1995-11-09**. Relevant pages: 1, 3.

Governance and statutes; no exact Richebourg reference or parcel lease found.

SHA-256: `e5539f087b107c2c9e29f953398db38f7512ec0edc8d770e3314fba601fc336f`. Retrieved: 2026-10-07T16:17:20.160208+00:00; 523,365 bytes.

### ric-grivot-2025

[GFA Jean Grivot: statutes updated 29 January 2025](https://actes.ccm2.net/acte/260b4e13-ce3d-4c08-9909-19fec99a7cb9#page=1) — 22 PDF pages, all screened. Deed/decision **2025-01-29**; deposit **2025-02-04**. Relevant pages: 1, 2, 3.

GFA statutes reproduce cash formation and require long-term leasing, without AN247 or a named tenant.

SHA-256: `4f138095acdd3e6fa1315cc20e4def2305a5d0657a8a1861a33c3b6a4594e6c4`. Retrieved: 2026-10-07T16:17:25.270210+00:00; 1,682,423 bytes.

### ric-grivot-2011

[Jean Grivot: 12 March 2011 share donation](https://actes.ccm2.net/acte/2781e896-2b03-40df-8b89-cfa70326ea5f#page=2) — 11 PDF pages, all screened. Deed/decision **2011-03-12**; deposit **2012-03-26**. Relevant pages: 2, 3.

Donation of company shares; no AN247 schedule or named parcel tenant found.

SHA-256: `2847c2bb31a272721d84dc0f14b561eac4866c27a5b2ae0188e76b567a46ead4`. Retrieved: 2026-10-07T16:17:27.853932+00:00; 163,365 bytes.

### ric-grivot-transformation-2024

[Jean Grivot: 31 January 2024 GFA transformation](https://actes.ccm2.net/acte/2df01b5f-26a1-4a45-a3e5-5e3d6522a64e#page=1) — 5 PDF pages, all screened. Deed/decision **2024-01-31**; deposit **not established**. Relevant pages: 1, 4.

Transformation into a GFA; long-term leasing is a statutory requirement, not an executed lease. Deposit date is not printed in the index.

SHA-256: `703f1b3f320cf9d1bfa600bf7d737e03b1c6aa08b8647ff3a9b01ddb3481e505`. Retrieved: 2026-10-07T16:17:31.024776+00:00; 316,504 bytes.

### ric-grivot-statutes-2024

[GFA Jean Grivot: 31 January 2024 statutes](https://actes.ccm2.net/acte/515d7f4c-32c3-49bd-84ad-b5e1119571c6#page=1) — 23 PDF pages, all screened. Deed/decision **2024-01-31**; deposit **not established**. Relevant pages: 1, 2, 3.

GFA statutes; no AN247 schedule or named tenant. Deposit date is not printed in the index.

SHA-256: `21b5218027270849505b3878535f15f194d9cd7a7385b1f91a1950738f27ac17`. Retrieved: 2026-10-07T16:17:34.621722+00:00; 1,616,284 bytes.

### ric-meo-transformation-2017

[Domaine Méo Camuzet: 21 July 2017 transformation and asset list](https://actes.ccm2.net/acte/4a5bf72b-2d2e-4580-9a88-2a333b582f7e#page=2) — 123 PDF pages, all screened. Deed/decision **2017-07-21**; deposit **2017-10-30**. Relevant pages: 2, 85.

Transformation into an agricultural civil company. The asset list names usufructs of AN54 and AN59 but supplies no cadastral areas, so it is holder-level context only.

SHA-256: `caef80d8c148ce911757977270d3676fd651df0774087683ebab0e110a6cd22f`. Retrieved: 2026-10-07T16:17:42.602003+00:00; 6,424,809 bytes.

### meo-gfa-withdrawal-2016

[GFA du Domaine Méo Camuzet: 29 December 2016 withdrawal and capital reduction](https://actes.ccm2.net/acte/5b35a47b-a310-44b8-8c6f-0175473db175#page=7) — 47 PDF pages, all screened. Deed/decision **2016-12-29**; deposit **2017-01-09**. Relevant pages: 7, 8, 12, 21, 24, 33, 34.

Records the GFA’s 20-year usufruct, from 29 December 2012, of vines owned by SAS Méo-Camuzet Frère et Sœurs, and withdraws Vougeot A548 (15 a 68 ca) to the partners. Richebourg review: The annexed 22 December 1980 statutes print AN54 (3,061 m²) and AN59 (462 m²), and recite a nine-year 1961 métayage to an individual. The separately recited 2012 usufruct is not that lease.

SHA-256: `883626d125b98f4a2252ab4a84706bed562304697fb8c753aeb94a72af212ab5`. Retrieved: 2026-10-07T16:17:47.346780+00:00; 2,682,202 bytes.

### ric-meo-statutes-2012

[GFA du Domaine Méo Camuzet: 20 December 2012 statutes](https://actes.ccm2.net/acte/2d95e7e6-8831-4a7e-880c-4d1e9aa25f20#page=2) — 28 PDF pages, all screened. Deed/decision **2012-12-20**; deposit **2013-01-28**. Relevant pages: 2, 6, 15.

Updated statutes repeat AN54 (3,061 m²), AN59 (462 m²), and the historical nine-year métayage from 11 November 1961; no current farming season established.

SHA-256: `7be91196efe0d1fb9fdf0954301524536369cf3b559d68b7efd1893137ddbf53`. Retrieved: 2026-10-07T16:17:51.112750+00:00; 1,300,854 bytes.

### ric-meo-donation-1997

[GFA du Domaine Méo Camuzet: 12 April 1997 share donation and annexes](https://actes.ccm2.net/acte/a00e2e27-6266-4c25-ae4b-c0c1de30d6cc#page=1) — 73 PDF pages, all screened. Deed/decision **1997-04-12**; deposit **1997-09-02**. Relevant pages: 1, 35, 51.

Donation and annexed statutes repeat AN54 (3,061 m²), AN59 (462 m²), and the historical 1961 métayage. This predates creation of SAS Méo-Camuzet Frère et Sœurs.

SHA-256: `de531fac7d37eadaf2f76fb2e5efa3905504a3fd0c5f8a5cbaf01d42c1bfd955`. Retrieved: 2026-10-07T16:17:56.932986+00:00; 2,332,909 bytes.

### ric-anne-gros-2022

[Anne Gros: 28 February 2022 transformation into a SAS](https://actes.ccm2.net/acte/0cb2af7f-63a9-4385-98e1-090357247271#page=1) — 30 PDF pages, all screened. Deed/decision **2022-02-28**; deposit **2022-04-05**. Relevant pages: 1, 3.

Transformation into a SAS; no additional Richebourg schedule or lease found.

SHA-256: `b39bebb6f970a0c891f9ba47c3745b421b2b76fa270216cdd4dcf65fc4aeb9e5`. Retrieved: 2026-10-07T16:18:01.234748+00:00; 1,495,634 bytes.

### ric-anne-gros-contribution-2019

[Anne Gros: 27 November 2019 contribution of bare and full ownership](https://actes.ccm2.net/acte/af5aa267-d231-4ca0-a66d-2ff68a677a38#page=3) — 40 PDF pages, all screened. Deed/decision **2019-11-27**; deposit **2019-12-04**. Relevant pages: 3, 9, 10, 11, 13, 14.

Contribution of bare ownership of AN174 (4,384 m²) and AN236 (1,066 m²), and full ownership of AN180 (338 m²) and AN238 (214 m²). Recites 2013 leases to SARL Anne Gros; ownership and tenancy consolidate for AN180/238 at contribution.

SHA-256: `b8dc58de10557da901b6c746d698d887f3c19de7d7c7d9a42406b2af7a2757dd`. Retrieved: 2026-10-07T16:18:05.435002+00:00; 2,110,770 bytes.

### ric-anne-gros-2014

[Anne Gros: 31 January 2014 capital increase](https://actes.ccm2.net/acte/7e3f47c5-5290-40c6-82dc-67f4db6b7740#page=1) — 13 PDF pages, all screened. Deed/decision **2014-01-31**; deposit **2014-06-06**. Relevant pages: 1, 3.

Capital increase from reserves; no exact Richebourg schedule or parcel lease found.

SHA-256: `b563de722d7563f0b8311c5c5403eeb07ee2981e820f93d284dbd7e971c63c38`. Retrieved: 2026-10-07T16:18:08.502448+00:00; 428,690 bytes.

### ric-anne-gros-1996

[Anne Gros: 28 August 1996 name change and statutes](https://actes.ccm2.net/acte/7d38b907-63f5-4748-8db8-cd5c930ec693#page=1) — 28 PDF pages, all screened. Deed/decision **1996-08-28**; deposit **1996-10-30**. Relevant pages: 1, 2.

Renames SCE Domaine Anne et François Gros as Anne Gros; no exact Richebourg schedule or parcel lease found.

SHA-256: `f9e292433071b4bab4c004ca58a9ede691e5d237dca7f4fb7c311d98fb06aa3b`. Retrieved: 2026-10-07T16:18:12.294279+00:00; 927,872 bytes.

### ric-hudelot-2025

[GFV Hudelot-Noëllat: statutes updated 31 March 2025](https://actes.ccm2.net/acte/5ff9138f-e952-4667-96c1-7baf1d83fe09#page=1) — 23 PDF pages, all screened. Deed/decision **2025-03-31**; deposit **2025-05-05**. Relevant pages: 1, 3.

Updated statutes reproduce the original contribution of AN64 (1,222 m²), AN65 (787 m²; retired) and AN66 (808 m²). They do not print the current AN290/291 successors.

SHA-256: `8b4666d6ace8f594a7ccd8a290f6e3b6747049ea27d036cd6861a75f5230918f`. Retrieved: 2026-10-07T16:18:19.250992+00:00; 6,137,682 bytes.

### ric-hudelot-2021-contribution

[GFV Hudelot-Noëllat: 12 November 2021 contribution and statutes](https://actes.ccm2.net/acte/5fabcf7e-46f5-4d8e-bc31-eaab70de6f21#page=2) — 55 PDF pages, all screened. Deed/decision **2021-11-12**; deposit **2021-12-21**. Relevant pages: 2, 10, 36.

Contribution deed and annexed statutes repeat AN64 (1,222 m²), AN65 (787 m²; retired) and AN66 (808 m²); no exact Richebourg tenant identified.

SHA-256: `53fefeb7d83edf5c8fb62644030a8ddbc3641b473f3e8d026b74159bbd71fef4`. Retrieved: 2026-10-07T16:18:24.069580+00:00; 3,001,835 bytes.

### ric-hudelot-2021-donation

[GFV Hudelot-Noëllat: 19 March 2021 share donation and statutes](https://actes.ccm2.net/acte/1cf9b694-194a-41c0-a266-2b3e07fa69c9#page=3) — 45 PDF pages, all screened. Deed/decision **2021-03-19**; deposit **2021-04-20**. Relevant pages: 3, 5, 27.

Share donation and statutes repeat the historical AN64/65/66 contribution; no current AN290/291 schedule or exact Richebourg tenant identified.

SHA-256: `b8a6bb6689343fb0df298032fc1397be027c52a2e1f0521ab36840f04b65cf81`. Retrieved: 2026-10-07T16:18:28.675398+00:00; 2,204,673 bytes.

### ric-hudelot-2012

[GFV Hudelot-Noëllat: 11 June 2012 share donation and statutes](https://actes.ccm2.net/acte/6e7eded3-7acb-4f3f-829c-52e74d54819f#page=3) — 44 PDF pages, all screened. Deed/decision **2012-06-11**; deposit **2015-03-27**. Relevant pages: 3, 7, 11, 27.

Share donation and statutes reproduce AN64/65/66. Historical leases elsewhere and general leasing clauses do not identify a Richebourg parcel tenant.

SHA-256: `f8d737a37918afa1625ac51bf6884cd98ffdc55bb4a645d71a8ff4b616331307`. Retrieved: 2026-10-07T16:18:34.515242+00:00; 2,871,321 bytes.

### ric-hudelot-formation-2001

[GFV Hudelot-Noëllat: 28 June 2001 founding contribution](https://actes.ccm2.net/acte/0cd2477b-6c77-42d4-a9b2-1b4400611014#page=2) — 21 PDF pages, all screened. Deed/decision **2001-06-28**; deposit **2001-08-09**. Relevant pages: 2, 3, 4.

Founding contribution prints AN64 (1,222 m²), AN65 (787 m²; retired) and AN66 (808 m²). Article 2 requires long-term letting, without a named executed Richebourg lease.

SHA-256: `ab55eeb5b1b4d790260f0e9b91913834c647e872a1c846e6e1e0750dd3f265b1`. Retrieved: 2026-10-07T16:18:37.686579+00:00; 911,376 bytes.

### ric-meo-sas-2022

[Méo-Camuzet Frère et Sœurs: 15 November 2022 capital reduction](https://actes.ccm2.net/acte/0b44fdea-e60a-4e7d-895b-686d08f666a2#page=1) — 15 PDF pages, all screened. Deed/decision **2022-11-15**; deposit **2023-04-03**. Relevant pages: 1, 2.

Capital reduction and statutes; no exact Richebourg schedule or parcel tenant found.

SHA-256: `2e9676fcd9ffd443e00ec4a347d6de595c78b9dc87f2e9aa039dbeac1886f0e7`. Retrieved: 2026-10-07T16:18:41.375881+00:00; 1,136,491 bytes.

### ric-meo-sas-2017

[Méo-Camuzet Frère et Sœurs: 25 August 2017 share contribution](https://actes.ccm2.net/acte/5fc776e7-7f47-4192-9b3b-abd6089933ca#page=2) — 20 PDF pages, all screened. Deed/decision **2017-08-25**; deposit **2017-12-07**. Relevant pages: 2, 3.

Contribution of shares in Domaine Méo Camuzet; corporate relationship only, without an exact Richebourg land schedule or parcel tenant.

SHA-256: `6cb465e8fa5909a54533a11f6eb28fcfd634e5b8e6bdbef0139ee9c73740ba34`. Retrieved: 2026-10-07T16:18:45.070297+00:00; 911,144 bytes.

### ric-meo-sas-2012

[Méo-Camuzet Frère et Sœurs: 20 December 2012 decisions](https://actes.ccm2.net/acte/3df01297-7f22-4814-8ec2-3e1c2b20ee6e#page=2) — 18 PDF pages, all screened. Deed/decision **2012-12-20**; deposit **2013-01-31**. Relevant pages: 2, 3.

Decision refers generally to acquisition of vines and removes a distribution requirement; no exact Richebourg reference or area.

SHA-256: `1ced3e65aa7b62332967f10f70f0e22bdd664747c6b4ed594ce7669fceb75b12`. Retrieved: 2026-10-07T16:18:48.320950+00:00; 628,985 bytes.

### ric-meo-sas-formation-2003

[Méo-Camuzet Frère et Sœurs: 15 April 2003 formation](https://actes.ccm2.net/acte/8a1e3870-0fa4-4778-bce6-ceacd0da2a42#page=1) — 20 PDF pages, all screened. Deed/decision **2003-04-15**; deposit **2003-05-15**. Relevant pages: 1, 2, 3.

Cash formation and subscribed capital; no exact Richebourg schedule or parcel tenant found.

SHA-256: `19cd39ba434a9ce456b74661347260a2ee0fa48fd14cbeb2ea9881d8e58c4af7`. Retrieved: 2026-10-07T16:18:51.506871+00:00; 627,527 bytes.

### ric-drc-2024

[DRC: 14 November 2024 management declaration and bundled share deeds](https://actes.ccm2.net/acte/34207319#page=6) — 135 PDF pages, all screened. Deed/decision **2024-11-14**; deposit **2024-11-14**. Relevant pages: 6, 41, 42, 44, 46, 103.

Management declaration concerning share transfers and statutes updated 27 July 2024; Richebourg labels and company history are not an exact parcel schedule.

SHA-256: `f69a58a9d77a91e96a7dc6de3c803d3871c49d7766467a49238c1844dc8af0dc`. Retrieved: 2026-10-07T16:18:58.475155+00:00; 8,473,781 bytes.

### ric-drc-2022

[DRC: 21 March 2022 share donation and statutes](https://actes.ccm2.net/acte/5409233#page=2) — 65 PDF pages, all screened. Deed/decision **2022-03-21**; deposit **2022-04-15**. Relevant pages: 2, 31, 32.

Share donation and statutes reproduce Richebourg label wording, without an exact current cadastral schedule.

SHA-256: `5f0b832a6e2c6c1d7cb388b9a33fecdd84b407c6cee3ed91670f985130f79708`. Retrieved: 2026-10-07T16:19:02.981355+00:00; 2,655,931 bytes.

### ric-drc-statutes-1974

[DRC: 21 December 1974 notarial statutes and estate schedule (filed 2002)](https://actes.ccm2.net/acte/5409256#page=1) — 125 PDF pages, all screened. Deed/decision **1974-12-21**; deposit **2002-07-31**. Relevant pages: 1, 36, 38, 39, 74.

The 21 December 1974 notarial statutes list the then estate, including AN56, AN60, AN68, AN69, AN71, AN169, AN171 and AN173 with individual areas matching today. The 2002 deposit bundles other decisions; it is not a 2002 land transfer.

SHA-256: `f8fb4eaac7409838a0c7563da3df61544a39e9e641ae0f163b83ef97066cbe68`. Retrieved: 2026-10-07T16:19:07.382879+00:00; 3,706,675 bytes.

### ric-mongeard-2022

[GFA Mongeard-Mugneret: 25 May 2022 share donation and statutes](https://actes.ccm2.net/acte/cd4e3ee0-5b96-49fe-ab25-fe4bdcf4c098#page=2) — 31 PDF pages, all screened. Deed/decision **2022-05-25**; deposit **2022-06-17**. Relevant pages: 2, 12, 14.

Share donation and statutes updated 30 May 2022; no exact AN248 schedule or named Richebourg tenant found.

SHA-256: `36b403704aa63d30b73d968bbb89609b1cd67a4ba915fc88406fc192db2665e0`. Retrieved: 2026-10-07T16:19:12.500955+00:00; 2,110,638 bytes.

### ric-mongeard-2017

[GFA Mongeard-Mugneret: 20 March 2017 share and statutory changes](https://actes.ccm2.net/acte/0fb79a93-c4a6-42ee-a72f-403c1c88cbcc#page=2) — 63 PDF pages, all screened. Deed/decision **2017-03-20**; deposit **2017-11-21**. Relevant pages: 2, 3.

Share and statutory changes; no exact AN248 schedule or named Richebourg tenant found.

SHA-256: `a05e03b6ec118bc642102e0c13432a4329fc3e14120da951723d4a2a5e432396`. Retrieved: 2026-10-07T16:19:16.807832+00:00; 3,215,590 bytes.

### mongeard-gfa-1964

[Mongeard-Mugneret: founding contribution and 1997 GFA statutes](https://actes.ccm2.net/acte/5cd69d1a-b284-4aa8-85fc-5ea04e0d26e5#page=1) — 74 PDF pages, all screened. Deed/decision **1964-02-12**; deposit **2002-10-22**. Relevant pages: 1, 2, 7, 48, 65.

The founding contribution schedule and its reproduction in the 1997 statutes print D535 (5,575 m²), D105 (290 m²), D104 (750 m²), total 6,615 m². Article 2 requires long-term leasing and forbids direct exploitation by the GFA; it does not identify an executed lease or tenant. Richebourg review: The original contribution and 1997 statutes name other vineyards, not current AN248. Mandatory long-term letting does not name a tenant; the estate’s 0.3112 ha publication remains census evidence only.

SHA-256: `4bb2a3e2d7753a75d511193e13fec2fbfbb4c2c1ec62b4b0add5674923c64ef9`. Retrieved: 2026-10-07T16:19:21.821495+00:00; 3,121,196 bytes.

### ric-af-gros-donation-2020

[GFA Héritiers AF-Gros: 22 July 2020 share donation](https://actes.ccm2.net/acte/44e2969c-e634-44a3-85b5-b5376e45ca12#page=2) — 61 PDF pages, all screened. Deed/decision **2020-07-22**; deposit **2020-10-07**. Relevant pages: 2, 37, 39, 40.

Share donation reproduces the founding AN243/245 schedule and existing lease recital to Domaine A.F Gros; it is not a second land purchase.

SHA-256: `7c91dae2e9ca52d3913b6a0d26e5c1b5337fbb261a3468045b7a2c35fd03379a`. Retrieved: 2026-10-07T16:19:26.636810+00:00; 3,359,951 bytes.

### ric-af-gros-formation-2020

[GFA Héritiers AF-Gros: 1 July 2020 founding contribution and lease recital](https://actes.ccm2.net/acte/de0997df-6924-4dcb-b213-a7a17418aa28#page=2) — 49 PDF pages, all screened. Deed/decision **2020-07-01**; deposit **2020-07-16**. Relevant pages: 2, 6, 8, 9.

Contributes AN243 (949 m²) and AN245 (332 m²), already let to SAS Domaine A.F Gros (383967346) for 18 years from 11 November 2017 under a notarial lease dated 12 June 2018. Only the recital, not the lease instrument, was reviewed.

SHA-256: `cd56a3854557ceed5ef4a37be4fa638eaf76d4ac214b8dd3460e6f8ddff4843e`. Retrieved: 2026-10-07T16:19:32.852991+00:00; 3,194,067 bytes.

### ric-leroy-representative-2006

[Leroy SA: 15 September 2006 representative appointment for SCI and SCE](https://actes.ccm2.net/acte/49ab5756-3546-4877-bc89-56c14ff55243#page=1) — 3 PDF pages, all screened. Deed/decision **2006-09-15**; deposit **2007-03-22**. Relevant pages: 1, 2, 3.

Leroy SA appoints its representative in both the SCE and SCI Domaine Leroy. This corporate connection does not resolve the provisional DGFiP identifier by a parcel schedule.

SHA-256: `e49b4183fb1cc88cb6fbc23f9a4d4da90227d2a3f0217bf54f90f4f0eac7f675`. Retrieved: 2026-10-07T16:19:35.748927+00:00; 58,707 bytes.

### sci-domaine-leroy-2001

[SCI Domaine Leroy: 10 December 2001 minutes and original statutes](https://actes.ccm2.net/acte/1f10cb0c-c858-465c-b3ac-1d1c0b8cc1f8#page=1) — 43 PDF pages, all screened. Deed/decision **2001-12-10**; deposit **2001-12-27**. Relevant pages: 1, 2, 33.

The SCI, formed in 1947 and registered in 2001, has Leroy SA and an individual as partners. Its original statutes value a Clos Vougeot vine under pre-renovation references; no current cadastral reference. Richebourg review: All pages screened for Richebourg: no exact AN57, AN61 or AN168 schedule. The match of SCI Domaine Leroy to U14149307 remains provisional on abbreviated name and seat.

SHA-256: `52d3b534091b92c7e6b5d097f6042b1bbbeadd45af6ff8367fb6dc6b9e2a62af`. Retrieved: 2026-10-07T16:19:43.841172+00:00; 1,498,220 bytes.

### ric-leroy-2024

[SCI Domaine Leroy: 3 June 2024 annual meeting](https://actes.ccm2.net/acte/a3452a10-c2a8-4f91-98cc-1b52889a43cf#page=1) — 3 PDF pages, all screened. Deed/decision **2024-06-03**; deposit **not established**. Relevant pages: 1, 2, 3.

Annual meeting and manager replacement; no parcel schedule. Deposit date is not established by the free index or PDF.

SHA-256: `c1dc242187c3f0a08f0c25675cee53815048d6e52435a4c0897691131d91a196`. Retrieved: 2026-10-07T16:19:47.463515+00:00; 111,546 bytes.

## Supplementary pass: related-company filings

Reviewed 8 October 2026, after the holder pass, to look for parcel-numbered leases or contributions covering the 32 parcels without company rights. Eight related companies hold no current Richebourg rights: Domaine Thibault Liger-Belair, its family holding, GFA Domaine Xavier Liger-Belair, Domaine A.F. Gros, Gros Frère et Sœur, the 2026 SCEA Domaine de la Levrière, SCE du Domaine Leroy and SC Domaine Jean Grivot. Their free entreprises.lefigaro.fr indexes were read and 40 files downloaded from actes.ccm2.net. One file is byte-identical to another, so **39 files / 504 pages** count. Each page's embedded text was extracted with PyMuPDF, and each page was also rendered at 150 dpi and OCR-screened with RapidOCR (ONNX Runtime, CPU). The text was searched for Richebourg, Verroilles, every current Richebourg reference and every documented predecessor, including printed lists such as “section AN, numéros 170, 172”. As a positive control, the same pipeline found AN243, AN245 and Richebourg on the schedule page (p. 6) of the GFA Héritiers AF-Gros 2020 filing. The cited schedule and the lessor's identification in the 2015 deed were checked against page images (pp. 3–4).

**Result.** Only the Liger-Belair filings name Richebourg references. A 30 December 2015 notarial contribution, filed on 17 May 2017, transfers to Domaine Thibault Liger-Belair (443134523) the tenant's métayage right under a notarial lease of 14 May 2005, published at the Beaune land registry on 20 June 2005. By that lease GFA Domaine Xavier Liger-Belair (SIREN 353575103), named as owner and lessor and intervening to approve, let Richebourg AN170 (44 a 13 ca) and AN172 (7 a 92 ca), with other vines, for 18 years from 1 January 2005. The deed states that the leases had been made available to the company since its formation. The GFA's own statutes reproduce the 1989 contribution of the same two references, and the company's 2025 statutes still recite the 2015 contribution.

The references are checked independently:

- The 1 April 2025 Etalab cadastre gives AN170 4,413 m² and AN172 792 m², the printed areas.
- DGFiP records SIREN 353575103 with full ownership of both references in every snapshot from 2019 to 2025.
- DFI document 389, lots 1 and 2, validated on 12 May 2025, divides AN170 into AN292/AN293 and AN172 into AN294/AN295.
- DVF records one deed dated 3 April 2025 for AN292–AN295 with nine other parcels. Winehog's 24 October 2025 article reports these plots' new owner without naming it.
- Winehog's 2013 owner map places the Liger-Belair plot below Grivot and Hudelot-Noëllat and above the southern DRC section. That is where AN292–AN295 lie, but the article prints no cadastral reference.

The curation records one `filing-named-cadastral-reference` entry, `ric-tlb-metayage-2005`, on retired AN170/AN172. It reaches AN292/AN293 and AN294/AN295 only through accepted DFI lineage. It names a candidate, not an owner or current farmer. The lease term ran to the end of 2022. No renewal, and no position after the 3 April 2025 sale, is established; the lease instrument and its land-registry copy were not reviewed. The unnamed-owner Winehog entries are unchanged.

No other file names a Richebourg reference. The Grivot statutes contain only a dividend formula, as the Clos de Vougeot research found, and the A.F. Gros filings recite only a Clos de Vougeot lease. The 2015 deed also names Clos de Vougeot A75 under the same lease; that cru's records are not changed here. Personal names in these filings are not recorded. Index dates below are the free index's deposit dates, not deed dates. Files were retrieved between 2026-10-07T23:49Z and 2026-10-08T00:19Z; the two cited filings' exact retrieval times are in the [curation](curation.json).

| Company | Filing | Index date | Pages | Bytes | SHA-256 | Result |
| --- | --- | --- | ---: | ---: | --- | --- |
| Domaine Thibault Liger-Belair (443134523) | [Notarial formation deed](https://actes.ccm2.net/acte/59d0e620-6a60-4451-b3e3-915a81fbc87f) | 2002-08-23 | 12 | 461,849 | `2451107803fce041f5a894e16e8f8f9d4253594ba2af5f37a9abd0d3235233ff` | Cash formation; no Richebourg reference. |
| Domaine Thibault Liger-Belair (443134523) | [Contribution auditor’s report](https://actes.ccm2.net/acte/74ac880c-67c5-4458-9146-a9fa65e2e9fc) | 2016-04-04 | 9 | 440,011 | `611cc0aa6d99f9a1cb474e361f5e8649e1cd180d46e16883f8e3529b7aa187bd` | Share contribution; no land. |
| Domaine Thibault Liger-Belair (443134523) | [Contribution auditor’s report](https://actes.ccm2.net/acte/879d0407-d937-46ac-8e36-05245eea61c3) | 2016-04-04 | 9 | 440,011 | `ab8194cd3f77f9c53b2a07fe43998ea7093bd0fba66a52469a29aeb2469aaf32` | Share contribution; no land. |
| Domaine Thibault Liger-Belair (443134523) | [Contribution auditor’s report](https://actes.ccm2.net/acte/f0bbd603-716a-407b-a01e-7831715f4310) | 2016-04-04 | 9 | 439,976 | `998aebac64f3d2a9e89664fb7319b05e4b42d53729d12b21b6a8662f4bedb1d4` | Share contribution; no land. |
| Domaine Thibault Liger-Belair (443134523) | [Contribution agreement and capital increase](https://actes.ccm2.net/acte/9f940436-9870-4867-84bd-e793f344c096) | 2016-05-24 | 24 | 949,393 | `eb1adff9c55a2420f3f46b73cfac4510eabe59dbbd114e0c333517318036d653` | Shares of a related company; no land schedule. |
| Domaine Thibault Liger-Belair (443134523) | [30 December 2015 notarial contribution of lease rights](https://actes.ccm2.net/acte/2118907a-ffa5-4235-8242-fc415cbb75c3) | 2017-05-17 | 25 | 1,136,504 | `682d099d7fa4551c213f175c5818b80220f48678b574c3096eb7c48df11dcb8f` | **Names AN170 (44 a 13 ca) and AN172 (7 a 92 ca)**, Richebourg, under the 2005 métayage from the GFA (pp. 3–6, 8). Cited as `ric-tlb-lease-contribution-2015`. |
| Domaine Thibault Liger-Belair (443134523) | [Transformation auditor’s report](https://actes.ccm2.net/acte/07d5f629-e273-4c34-bd76-0f24ad3ccb70) | 2025-02-18 | 3 | 859,848 | `098e54dedf87fc771dab1124beb155a917d64e64315c21419c0800c0a5773978` | No land. |
| Domaine Thibault Liger-Belair (443134523) | [Transformation auditor’s report](https://actes.ccm2.net/acte/4329273b-f42e-41c2-9836-84d10654466d) | 2025-03-21 | 1 | 73,037 | `d189d32eab26bdd7191d108815f8c25b4d3297a0f545323c7b73dcfb4d0c89d9` | No land. |
| Domaine Thibault Liger-Belair (443134523) | [Transformation minutes and statutes](https://actes.ccm2.net/acte/748ac0eb-9ed0-4750-aaf5-54c3736689f3) | 2025-03-21 | 10 | 451,155 | `0814ec408052bdc7f9d0bcadf56db3d2700f162081ba4d5e45b6f185232bb09a` | Recites the 2015 contribution, AN170/AN172 (p. 2). |
| Domaine Thibault Liger-Belair (443134523) | [Statutes updated after 12 March 2025 decisions](https://actes.ccm2.net/acte/f532696b-c319-4330-9f15-1b9b024d4ee7) | 2025-03-21 | 15 | 641,648 | `88e45fd84c2008758d46666365e20c39af0c880c95c60aaa655708d63f85dcff` | Article 6.3 recites AN170/AN172 (p. 4). |
| Domaine Thibault Liger-Belair (443134523) | [Statutes updated after 3 April 2025 decisions](https://actes.ccm2.net/acte/ad237e6f-66db-4ae4-a17a-b2485263e6d2) | 2025-07-07 | 18 | 487,409 | `e86988e3fa9d2dabf109e05e4a630414c9dfcebed6907aff5df1f819058e877c` | Article 6.3 recites AN170/AN172 (p. 4). Cited as `ric-tlb-statutes-2025`. |
| Domaine Thibault Liger-Belair (443134523) | [Decision minutes](https://actes.ccm2.net/acte/689327f0-6641-4fd6-a77c-08d4b068128d) | 2025-07-07 | 2 | 301,940 | `247290512c0d749ead44ef7e3e4bd0472fb9fb7c289ae5ed6185dc3fd73b4eea` | Capital and governance; no land. |
| Domaine Thibault Liger-Belair (443134523) | [Decision minutes](https://actes.ccm2.net/acte/947bc948-f18e-4818-8210-b328ea113369) | 2025-07-07 | 4 | 355,338 | `f907ab8dc624c75d701869d991ff9fba8994c0981fad5f4f205290a734f9c814` | Capital and governance; no land. |
| Domaine Thibault Liger-Belair (443134523) | [Decision minutes](https://actes.ccm2.net/acte/8e0e966b-8cc2-44c9-b6b6-cd56ac5c3757) | 2025-07-07 | 3 | 308,004 | `cc0e236923eaa364cf461b0ccf60ee83e58d48437c58e04a97efd346b00cd8f7` | Capital and governance; no land. |
| Domaine Thibault Liger-Belair (443134523) | [Decision minutes](https://actes.ccm2.net/acte/5dba54c8-effc-457c-ab81-38a43474d422) | 2025-07-07 | 6 | 393,698 | `69c5bd2651766f602b1d3532480b2de331d03e0c41b39283602c51ae89a539b4` | Capital and governance; no land. |
| Familiale TLB, family holding (934273798) | [Contribution auditor’s report](https://actes.ccm2.net/acte/c6dac778-f9de-46cc-bf71-c5eea21e6544) | 2025-03-14 | 3 | 195,742 | `780e9cf7db32133a823315fb8bbd02d6ef2fcb2e535e162626d6f0802aa0c389` | Share contribution; no land. |
| Familiale TLB, family holding (934273798) | [Contribution auditor’s report](https://actes.ccm2.net/acte/9414b4b1-1d2c-415b-b9e9-0a5e7c9814b0) | 2025-03-25 | 5 | 175,864 | `14c56670cfc398cf81da36cb128211aea652f774d0f56514355bd620bf991b37` | Share contribution; no land. |
| Familiale TLB, family holding (934273798) | [Updated statutes](https://actes.ccm2.net/acte/48fce14f-5df0-40c6-a471-614f3bc50b2e) | 2025-07-04 | 14 | 411,132 | `cb76953c3933b7996c42bcf2a08656344310ba9c1d9e3dbb7ed3309d27867f16` | Holding company; no land. |
| GFA Domaine Xavier Liger-Belair (353575103) | [Minutes and updated statutes](https://actes.ccm2.net/acte/19bdd460-9a96-44ba-8689-7bb58985aaf1) | 2014-08-27 | 18 | 1,688,934 | `685415d9ce915f3b90bb7d764acef62a177724cd22f480cf786e90ffd754711d` | Reproduces the 1989 founding contribution of “les Richebourg” AN170 and AN172, 52 a 05 ca (pp. 8, 9, 17); two-column scan read with the 2019 copy. |
| GFA Domaine Xavier Liger-Belair (353575103) | [Extension and updated statutes](https://actes.ccm2.net/acte/05ff4b1e-c486-4f98-83de-9a0738529def) | 2019-04-05 | 30 | 1,377,041 | `84234f9694a50930c015c5fa9c7406298ebb17b3844879399df24b81dd4c413f` | Same 1989 contribution: AN170 (44 a 13 ca) and AN172 (7 a 92 ca) (p. 13), with their property origin (p. 14). Already the Clos de Vougeot source `xavier-liger-belair-statutes-2019`, recorded there for A75 only. |
| Domaine A.F. Gros (383967346) | [Transformation report and minutes](https://actes.ccm2.net/acte/05f2351f-f256-49ed-9046-9e9c3d355e06) | 2004-04-06 | 23 | 673,584 | `9eb6cf02e2734997ce95cce72526a02f1977972e9293e3cbbcc9c945502fa87c` | No Richebourg reference. |
| Domaine A.F. Gros (383967346) | [Contribution auditor’s report](https://actes.ccm2.net/acte/008660d2-8c7b-4003-a8ba-1e17954feb1c) | 2020-07-10 | 9 | 508,924 | `bc5338f7f631da29caeb1df574178289e7a26133f639b82636a4de00721f2ac8` | Recites a Clos de Vougeot A524 lease only; no Richebourg reference. |
| Domaine A.F. Gros (383967346) | [Contribution auditor’s report](https://actes.ccm2.net/acte/1a0e1794-ce80-4b1e-a7a6-88e5c650bc6b) | 2025-03-12 | 7 | 248,393 | `e320f8b3dbe06f99c24f7a5e359dcdd31a757e1913f42dcd7a2983f38839c352` | Share contribution; no land. |
| Domaine A.F. Gros (383967346) | [Updated statutes](https://actes.ccm2.net/acte/d810b575-e45a-473b-af96-4b005801d003) | 2025-03-12 | 18 | 1,283,706 | `d80c2b9c68a8fae60704dc605098a95c2db89c972ac0b72d8bf23933d1084fde` | Recite the Clos de Vougeot A524 lease only; no Richebourg reference. |
| Domaine A.F. Gros (383967346) | [Updated statutes](https://actes.ccm2.net/acte/34e0dc62-0131-4134-8dc3-ee2c6a9d1322) | 2025-07-09 | 18 | 6,966,239 | `10df3724d5ce0fc948c2086e9216329e8b88129728866382d7f1627aeabcb70f` | Recite the Clos de Vougeot A524 lease only; no Richebourg reference. |
| Gros Frère et Sœur (778269373) | [Capital-increase minutes and statutes](https://actes.ccm2.net/acte/d70bd877-ce2d-45dd-aac2-46b89c3742b3) | 1999-11-26 | 21 | 666,451 | `82104c495e5fdf2405b4c13b99cab9bd6dc1b1fadb45fc8dca72bab7cf8b80f9` | No Richebourg reference. |
| Gros Frère et Sœur (778269373) | [Transformation auditor’s report](https://actes.ccm2.net/acte/ee34d5b3-41ac-4f17-8326-c84b58c2c8a4) | 2022-06-21 | 3 | 117,676 | `4974c9b165d2f7bf825c8afab9f26262f3e59407cf3021a29324f3202dc12485` | No land. |
| Gros Frère et Sœur (778269373) | [Updated statutes](https://actes.ccm2.net/acte/b001c30e-cfb0-4fb4-ae93-01454b6276f8) | 2025-03-26 | 18 | 8,130,387 | `bb9188964db516b5a7ddcb98248600c8efb75e103e78c3d181f6f1f6cc26bceb` | Byte-identical to `47cd0f1c`; not counted twice. |
| Gros Frère et Sœur (778269373) | [Notarial share transfer](https://actes.ccm2.net/acte/2971849f-2c5c-4a90-93c0-5ff306d51d26) | 2026-05-21 | 2 | 575,288 | `4d74e15781f8cb00077770f5be514beb07ecd1ec30ff23090e98bfaa3d58bf77` | Share transfer; no land. |
| Gros Frère et Sœur (778269373) | [Statutes](https://actes.ccm2.net/acte/47cd0f1c-111d-4d12-9489-b8c8a30d2657) | 2026-05-22 | 18 | 8,130,387 | `bb9188964db516b5a7ddcb98248600c8efb75e103e78c3d181f6f1f6cc26bceb` | No land schedule. |
| SCEA Domaine de la Levrière (107321457) | [Formation statutes](https://actes.ccm2.net/acte/4846e717-f1b2-4384-9cda-ab5530c6bccd) | 2026-07-07 | 16 | 5,668,042 | `88703044ac46bad5419fe4c2573d030f152f6c47873c2f2dc02b485d6dfe2559` | Cash contributions, including from Gros Frère et Sœur; no land. |
| SCEA Domaine de la Levrière (107321457) | [Constitutive minutes](https://actes.ccm2.net/acte/b186d6ab-97d9-4f30-956b-b6e65af0a23f) | 2026-07-07 | 3 | 720,790 | `eacd63b6cf161773d0d38530b4c5407e6d1bcc850ff254cf02fbdf6763a773f5` | No land. |
| SCE du Domaine Leroy (778269365) | [Certified decision](https://actes.ccm2.net/acte/f811c990-4eb1-442b-8489-4f1e0951ad33) | not shown | 4 | 154,684 | `e0986d701aaeb4148bf1f72edfaf0e6c11b292b34e71cfcb1d50e08accea7d5f` | No land. |
| SCE du Domaine Leroy (778269365) | [Registration filing with statutes](https://actes.ccm2.net/acte/e40cdccb-316c-448d-826c-850cb7e32137) | 2001-12-27 | 48 | 1,556,915 | `84ccfda57c26d3ffe70b97300eb5c1265b7999b789c79f87bd70e0946c3d2739` | No parcel schedule. |
| SCE du Domaine Leroy (778269365) | [Unclassified filing](https://actes.ccm2.net/acte/69b6ee34-067b-4b38-9ce5-45af7754ccb2) | 2023-07-17 | 5 | 166,975 | `30a3b258b85ce5a983bde71c6dce28592cef4cca3d5919c882482b309fc7cba8` | Governance; no land. |
| SC Domaine Jean Grivot (353981475) | [Updated statutes](https://actes.ccm2.net/acte/505e3afa-735c-4d59-92bb-403f5e09d0dc) | not shown | 15 | 946,796 | `3592afee0641000f3c89fb66f6c67557c436a97abac619433d9062cc33b0e48e` | Dividend formula only; no parcel or Richebourg reference. |
| SC Domaine Jean Grivot (353981475) | [Updated statutes](https://actes.ccm2.net/acte/cb9b357c-e140-4901-bab7-3053709f02c9) | not shown | 15 | 1,384,787 | `b2c408b9e2f7521b0468ab54e2e3e0e0aec7868c45292bb475d0a7551b2fd126` | Dividend formula only; no parcel or Richebourg reference. |
| SC Domaine Jean Grivot (353981475) | [Notarial deed and co-manager decision](https://actes.ccm2.net/acte/25ab7306-2181-4610-8cfc-1bcb2b11282c) | 2022-03-23 | 42 | 1,929,990 | `81c12dd0b558f0642fdc0349e490c455a6517923903960002b61ab3cd8a67364` | No parcel or lease. |
| SC Domaine Jean Grivot (353981475) | [Updated statutes](https://actes.ccm2.net/acte/4c278361-6dee-418f-ae6d-38fa32232d9c) | 2025-02-12 | 15 | 1,167,764 | `4fc049b2a2478cdaf13ef58bdd2039c6541b07c25d92c088dd8bfa8a346fcc7d` | Dividend formula only; no parcel or Richebourg reference. |
| SC Domaine Jean Grivot (353981475) | [Notarial share transfer](https://actes.ccm2.net/acte/aa40f70e-deb4-47cc-b6cb-233788833e59) | 2025-02-12 | 2 | 2,808,187 | `e9df01cbd42aa71fd4d797d2e6dea40c3df1b813e9a0144df9455983e4ff65d4` | Share transfer; no land. |

## Published holdings and authorized articles

Eleven producer holdings are retained only in the named-area census. Six official estate publications supply additional area evidence. Different totals are preserved (Méo approximately 0.34 versus 0.35 ha, Hudelot 0.29 versus 0.28 ha, Mongeard 0.3112 versus 0.31 ha); equal area alone never assigns a holding to a parcel. Anne Gros’s estate page places its 0.60 ha in Les Verroilles, whereas the article and later contribution show both named areas. This discrepancy stays qualified. The Gros-family article itself cautions that its producer distribution is not a simple ownership map.

The repository owner supplied authorized saved copies of [Winehog’s history and owners article](https://winehog.org/richebourg-history-plots-and-owners-10692/) and [New owner of Richebourg!](https://winehog.org/new-owner-of-richebourg-70980/). The first prints 18 August 2013; its page metadata gives a 1 October 2017 last modification, which the text does not print. Older maps are not used to override current legal rights or later filings.

The 24 October 2025 article prints northern plots 292/294 (2,167 m² combined) and southern plots 293/295 (3,083 m² combined). Both sums agree with the current cadastre. It deliberately leaves the new owner unnamed. Two external-research entries retain that dated context on the four references, with no named candidate, owner assignment or current farmer. The separate filing lead for the same parcels is described in the supplementary pass above. Colours and rumours are not decoded into an identity.

Archive hashes cover the exact user-supplied webarchive bytes: history `f1d65b87d64864ae12e7a75cc1abd4d1a03e5c1d39a75cdafea094f6ef91ac87`; new owner `ff7632ac454272841cdc2095996c9f35db32d93c5d015aa1f906e4649f290dd9`. Only factual findings are published.

The repository owner also supplied four Winehog “Terroir Insight” articles. Only factual findings and hashes are kept:

| Article | Published / page edited | Cadastral findings | SHA-256 |
| --- | --- | --- | --- |
| [Domaine Jean Grivot Richebourg](https://winehog.org/terroir-insight-domaine-jean-grivot-richebourg-28264/) | 2016-05-31 / 2018-09-27 | Grivot on 247 (0.3199 ha, bought 1984); Mongeard-Mugneret on 248; Thibault Liger-Belair on 172 and 170, shown on a 2016 cadastral map | `09d7c7705df9aa178fba610bcce979b3236bd105e7a8a14c9e19c1418129d276` |
| [Domaine Mongeard-Mugneret Richebourg](https://winehog.org/terroir-insight-domaine-mongeard-mugneret-richebourg-36803/) | 2018-10-05 / 2018-10-05 | Mongeard-Mugneret on 248 (0.3112 ha, bought 1984); Grivot on 247; Thibault Liger-Belair on 172 and 170 | `cdcc950a39455aecf43e3a6be9bd2d02ec00e05af901e5cb22b1c2076410c54d` |
| [Domaine Leroy Richebourg](https://winehog.org/terroir-insight-domaine-leroy-richebourg-25047/) | 2015-10-11 / 2016-04-06 | Leroy on 57 (0.5522 ha) and 61 (0.1321 ha); a third plot printed as 69 (0.0922 ha) stays unmatched | `9fc812389374a66a759eef8b99b849ab2f3b5a13bb91e871fab5189ca3fa52b4` |
| [Domaine Méo-Camuzet Richebourg](https://winehog.org/terroir-insight-domaine-meo-camuzet-richebourg-23896/) | 2015-06-28 / 2017-10-01 | No cadastral numbers; 0.0462 and 0.3061 ha, equal to the filed AN59 and AN54; métayage ended 1987 | `7630ea959885c16678ddc18eb121f1dba6d5d5f9396877bb339965abe917c323` |

Printed numbers reach a current parcel only when number and area both match, or through documented DFI lineage (170 and 172). AN247 thereby gains Domaine Jean Grivot as a named candidate; the article does not identify GFA Jean Grivot, so no holder-to-domaine link is made. The other references add independent support to existing leads. The printed 69 is not corrected to AN168 on area alone. Page-edit dates come from page metadata and are not printed.

## Remaining gaps

- All ten free filing indexes and official registry records were checked; 36 selected filings were downloaded and all 1,454 pages screened. This is a bounded selection of formation, contribution, donation, transformation and recent statutes, not every filing ever deposited.
- Grivot AN247 has no accepted domaine crosswalk: overlapping individual names and management records are not sufficient. No exact AN53, AN247 or AN248 filing schedule was found in the selected files. Winehog names AN247 and AN248 by cadastral number; these are critic leads, not company crosswalks.
- U14149307 to SCI Domaine Leroy 427469135 remains a provisional name-and-seat match; the three reviewed filings do not name AN57/61/168. Winehog names AN57 and AN61 as Leroy plots; its third printed number, 69 (0.0922 ha), stays unmatched.
- Hudelot’s retired AN65 is not promoted into a filing match for AN290/291. The 2017 Méo asset list lacks parcel areas; the separate SAS files provide no exact Richebourg schedule.
- Winehog subscriber text was reviewed only from six authorized user-supplied webarchives. The October 2025 article does not name the new owner of plots 292/293/294/295; colours and rumours are not an identity crosswalk.
- The Winehog history article prints 18 August 2013; its page metadata gives a 1 October 2017 modification, not a printed update date. Older ownership maps and producer totals never override the 2025 rights snapshot or later deeds.
- The supplementary pass is a bounded selection of 39 related-company filings. The 2005 métayage’s renewal after 2022, its position after the 3 April 2025 sale, the original lease and its land-registry copy remain unreviewed.
- Deposit dates for two Grivot 2024 files and the Leroy 2024 minutes are not established. Original lease instruments, later renewals, paid SPF copies and outreach remain unreviewed; no access restriction was bypassed.
- Source boundaries, failed notice downloads and unsearched historical intervals remain in the Tier 1 coverage. All 58 current farming identities remain unconfirmed.
