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

[036380046: bichot 2022](https://actes.ccm2.net/acte/22570176#page=1) — 8 PDF pages, all screened. Deed/decision **2022-06-28**; deposit **2022-07-27**. Relevant pages: 1, 3.

Governance and updated statutes; no exact Richebourg reference or parcel lease found.

SHA-256: `383884876ab39260e10efec4bdbabf49263c6a99e043c2dc5dbda474f015b7c3`. Retrieved: 2026-10-07T16:17:09.113648+00:00; 278,812 bytes.

### ric-bichot-2014

[036380046: bichot 2014](https://actes.ccm2.net/acte/22570320#page=1) — 14 PDF pages, all screened. Deed/decision **2014-08-28**; deposit **2014-11-07**. Relevant pages: 1, 3, 5, 9.

Termination of a location-gérance arrangement; no AN53 schedule or Richebourg parcel tenant identified.

SHA-256: `6ce243a2e112960de49860dd14b4720e74642cc7238fb1d066473ac31199098d`. Retrieved: 2026-10-07T16:17:13.331872+00:00; 1,297,628 bytes.

### ric-bichot-2007

[036380046: bichot 2007](https://actes.ccm2.net/acte/22570244#page=1) — 58 PDF pages, all screened. Deed/decision **2007-03-15**; deposit **2007-06-19**. Relevant pages: 1, 20.

Merger project includes leases elsewhere; no exact Richebourg parcel reference or tenant found.

SHA-256: `7fd51fdfc87736c5e24d0ab5721d1c4c80a7f3f051fc117cdec3fe837682d154`. Retrieved: 2026-10-07T16:17:17.124449+00:00; 2,514,196 bytes.

### ric-bichot-1995

[036380046: bichot 1995](https://actes.ccm2.net/acte/22570272#page=1) — 18 PDF pages, all screened. Deed/decision **1995-06-29**; deposit **1995-11-09**. Relevant pages: 1, 3.

Governance and statutes; no exact Richebourg reference or parcel lease found.

SHA-256: `e5539f087b107c2c9e29f953398db38f7512ec0edc8d770e3314fba601fc336f`. Retrieved: 2026-10-07T16:17:20.160208+00:00; 523,365 bytes.

### ric-grivot-2025

[318506367: grivot 2025](https://actes.ccm2.net/acte/260b4e13-ce3d-4c08-9909-19fec99a7cb9#page=1) — 22 PDF pages, all screened. Deed/decision **2025-01-29**; deposit **2025-02-04**. Relevant pages: 1, 2, 3.

GFA statutes reproduce cash formation and require long-term leasing, without AN247 or a named tenant.

SHA-256: `4f138095acdd3e6fa1315cc20e4def2305a5d0657a8a1861a33c3b6a4594e6c4`. Retrieved: 2026-10-07T16:17:25.270210+00:00; 1,682,423 bytes.

### ric-grivot-2011

[318506367: grivot 2011](https://actes.ccm2.net/acte/2781e896-2b03-40df-8b89-cfa70326ea5f#page=2) — 11 PDF pages, all screened. Deed/decision **2011-03-12**; deposit **2012-03-26**. Relevant pages: 2, 3.

Donation of company shares; no AN247 schedule or named parcel tenant found.

SHA-256: `2847c2bb31a272721d84dc0f14b561eac4866c27a5b2ae0188e76b567a46ead4`. Retrieved: 2026-10-07T16:17:27.853932+00:00; 163,365 bytes.

### ric-grivot-transformation-2024

[318506367: grivot transformation 2024](https://actes.ccm2.net/acte/2df01b5f-26a1-4a45-a3e5-5e3d6522a64e#page=1) — 5 PDF pages, all screened. Deed/decision **2024-01-31**; deposit **not established**. Relevant pages: 1, 4.

Transformation into a GFA; long-term leasing is a statutory requirement, not an executed lease. Deposit date is not printed in the index.

SHA-256: `703f1b3f320cf9d1bfa600bf7d737e03b1c6aa08b8647ff3a9b01ddb3481e505`. Retrieved: 2026-10-07T16:17:31.024776+00:00; 316,504 bytes.

### ric-grivot-statutes-2024

[318506367: grivot statutes 2024](https://actes.ccm2.net/acte/515d7f4c-32c3-49bd-84ad-b5e1119571c6#page=1) — 23 PDF pages, all screened. Deed/decision **2024-01-31**; deposit **not established**. Relevant pages: 1, 2, 3.

GFA statutes; no AN247 schedule or named tenant. Deposit date is not printed in the index.

SHA-256: `21b5218027270849505b3878535f15f194d9cd7a7385b1f91a1950738f27ac17`. Retrieved: 2026-10-07T16:17:34.621722+00:00; 1,616,284 bytes.

### ric-meo-transformation-2017

[320926439: meo transformation 2017](https://actes.ccm2.net/acte/4a5bf72b-2d2e-4580-9a88-2a333b582f7e#page=2) — 123 PDF pages, all screened. Deed/decision **2017-07-21**; deposit **2017-10-30**. Relevant pages: 2, 85.

Transformation into an agricultural civil company. The asset list names usufructs of AN54 and AN59 but supplies no cadastral areas, so it is holder-level context only.

SHA-256: `caef80d8c148ce911757977270d3676fd651df0774087683ebab0e110a6cd22f`. Retrieved: 2026-10-07T16:17:42.602003+00:00; 6,424,809 bytes.

### meo-gfa-withdrawal-2016

[GFA du Domaine Méo Camuzet: 29 December 2016 withdrawal and capital reduction](https://actes.ccm2.net/acte/5b35a47b-a310-44b8-8c6f-0175473db175#page=7) — 47 PDF pages, all screened. Deed/decision **2016-12-29**; deposit **2017-01-09**. Relevant pages: 7, 8, 12, 21, 24, 33, 34.

Records the GFA’s 20-year usufruct, from 29 December 2012, of vines owned by SAS Méo-Camuzet Frère et Sœurs, and withdraws Vougeot A548 (15 a 68 ca) to the partners. Richebourg review: The annexed 22 December 1980 statutes print AN54 (3,061 m²) and AN59 (462 m²), and recite a nine-year 1961 métayage to an individual. The separately recited 2012 usufruct is not that lease.

SHA-256: `883626d125b98f4a2252ab4a84706bed562304697fb8c753aeb94a72af212ab5`. Retrieved: 2026-10-07T16:17:47.346780+00:00; 2,682,202 bytes.

### ric-meo-statutes-2012

[320926439: meo statutes 2012](https://actes.ccm2.net/acte/2d95e7e6-8831-4a7e-880c-4d1e9aa25f20#page=2) — 28 PDF pages, all screened. Deed/decision **2012-12-20**; deposit **2013-01-28**. Relevant pages: 2, 6, 15.

Updated statutes repeat AN54 (3,061 m²), AN59 (462 m²), and the historical nine-year métayage from 11 November 1961; no current farming season established.

SHA-256: `7be91196efe0d1fb9fdf0954301524536369cf3b559d68b7efd1893137ddbf53`. Retrieved: 2026-10-07T16:17:51.112750+00:00; 1,300,854 bytes.

### ric-meo-donation-1997

[320926439: meo donation 1997](https://actes.ccm2.net/acte/a00e2e27-6266-4c25-ae4b-c0c1de30d6cc#page=1) — 73 PDF pages, all screened. Deed/decision **1997-04-12**; deposit **1997-09-02**. Relevant pages: 1, 35, 51.

Donation and annexed statutes repeat AN54 (3,061 m²), AN59 (462 m²), and the historical 1961 métayage. This predates creation of SAS Méo-Camuzet Frère et Sœurs.

SHA-256: `de531fac7d37eadaf2f76fb2e5efa3905504a3fd0c5f8a5cbaf01d42c1bfd955`. Retrieved: 2026-10-07T16:17:56.932986+00:00; 2,332,909 bytes.

### ric-anne-gros-2022

[348024928: anne gros 2022](https://actes.ccm2.net/acte/0cb2af7f-63a9-4385-98e1-090357247271#page=1) — 30 PDF pages, all screened. Deed/decision **2022-02-28**; deposit **2022-04-05**. Relevant pages: 1, 3.

Transformation into a SAS; no additional Richebourg schedule or lease found.

SHA-256: `b39bebb6f970a0c891f9ba47c3745b421b2b76fa270216cdd4dcf65fc4aeb9e5`. Retrieved: 2026-10-07T16:18:01.234748+00:00; 1,495,634 bytes.

### ric-anne-gros-contribution-2019

[348024928: anne gros contribution 2019](https://actes.ccm2.net/acte/af5aa267-d231-4ca0-a66d-2ff68a677a38#page=3) — 40 PDF pages, all screened. Deed/decision **2019-11-27**; deposit **2019-12-04**. Relevant pages: 3, 9, 10, 11, 13, 14.

Contribution of bare ownership of AN174 (4,384 m²) and AN236 (1,066 m²), and full ownership of AN180 (338 m²) and AN238 (214 m²). Recites 2013 leases to SARL Anne Gros; ownership and tenancy consolidate for AN180/238 at contribution.

SHA-256: `b8dc58de10557da901b6c746d698d887f3c19de7d7c7d9a42406b2af7a2757dd`. Retrieved: 2026-10-07T16:18:05.435002+00:00; 2,110,770 bytes.

### ric-anne-gros-2014

[348024928: anne gros 2014](https://actes.ccm2.net/acte/7e3f47c5-5290-40c6-82dc-67f4db6b7740#page=1) — 13 PDF pages, all screened. Deed/decision **2014-01-31**; deposit **2014-06-06**. Relevant pages: 1, 3.

Capital increase from reserves; no exact Richebourg schedule or parcel lease found.

SHA-256: `b563de722d7563f0b8311c5c5403eeb07ee2981e820f93d284dbd7e971c63c38`. Retrieved: 2026-10-07T16:18:08.502448+00:00; 428,690 bytes.

### ric-anne-gros-1996

[348024928: anne gros 1996](https://actes.ccm2.net/acte/7d38b907-63f5-4748-8db8-cd5c930ec693#page=1) — 28 PDF pages, all screened. Deed/decision **1996-08-28**; deposit **1996-10-30**. Relevant pages: 1, 2.

Renames SCE Domaine Anne et François Gros as Anne Gros; no exact Richebourg schedule or parcel lease found.

SHA-256: `f9e292433071b4bab4c004ca58a9ede691e5d237dca7f4fb7c311d98fb06aa3b`. Retrieved: 2026-10-07T16:18:12.294279+00:00; 927,872 bytes.

### ric-hudelot-2025

[438871279: hudelot 2025](https://actes.ccm2.net/acte/5ff9138f-e952-4667-96c1-7baf1d83fe09#page=1) — 23 PDF pages, all screened. Deed/decision **2025-03-31**; deposit **2025-05-05**. Relevant pages: 1, 3.

Updated statutes reproduce the original contribution of AN64 (1,222 m²), AN65 (787 m²; retired) and AN66 (808 m²). They do not print the current AN290/291 successors.

SHA-256: `8b4666d6ace8f594a7ccd8a290f6e3b6747049ea27d036cd6861a75f5230918f`. Retrieved: 2026-10-07T16:18:19.250992+00:00; 6,137,682 bytes.

### ric-hudelot-2021-contribution

[438871279: hudelot 2021 contribution](https://actes.ccm2.net/acte/5fabcf7e-46f5-4d8e-bc31-eaab70de6f21#page=2) — 55 PDF pages, all screened. Deed/decision **2021-11-12**; deposit **2021-12-21**. Relevant pages: 2, 10, 36.

Contribution deed and annexed statutes repeat AN64 (1,222 m²), AN65 (787 m²; retired) and AN66 (808 m²); no exact Richebourg tenant identified.

SHA-256: `53fefeb7d83edf5c8fb62644030a8ddbc3641b473f3e8d026b74159bbd71fef4`. Retrieved: 2026-10-07T16:18:24.069580+00:00; 3,001,835 bytes.

### ric-hudelot-2021-donation

[438871279: hudelot 2021 donation](https://actes.ccm2.net/acte/1cf9b694-194a-41c0-a266-2b3e07fa69c9#page=3) — 45 PDF pages, all screened. Deed/decision **2021-03-19**; deposit **2021-04-20**. Relevant pages: 3, 5, 27.

Share donation and statutes repeat the historical AN64/65/66 contribution; no current AN290/291 schedule or exact Richebourg tenant identified.

SHA-256: `b8a6bb6689343fb0df298032fc1397be027c52a2e1f0521ab36840f04b65cf81`. Retrieved: 2026-10-07T16:18:28.675398+00:00; 2,204,673 bytes.

### ric-hudelot-2012

[438871279: hudelot 2012](https://actes.ccm2.net/acte/6e7eded3-7acb-4f3f-829c-52e74d54819f#page=3) — 44 PDF pages, all screened. Deed/decision **2012-06-11**; deposit **2015-03-27**. Relevant pages: 3, 7, 11, 27.

Share donation and statutes reproduce AN64/65/66. Historical leases elsewhere and general leasing clauses do not identify a Richebourg parcel tenant.

SHA-256: `f8d737a37918afa1625ac51bf6884cd98ffdc55bb4a645d71a8ff4b616331307`. Retrieved: 2026-10-07T16:18:34.515242+00:00; 2,871,321 bytes.

### ric-hudelot-formation-2001

[438871279: hudelot formation 2001](https://actes.ccm2.net/acte/0cd2477b-6c77-42d4-a9b2-1b4400611014#page=2) — 21 PDF pages, all screened. Deed/decision **2001-06-28**; deposit **2001-08-09**. Relevant pages: 2, 3, 4.

Founding contribution prints AN64 (1,222 m²), AN65 (787 m²; retired) and AN66 (808 m²). Article 2 requires long-term letting, without a named executed Richebourg lease.

SHA-256: `ab55eeb5b1b4d790260f0e9b91913834c647e872a1c846e6e1e0750dd3f265b1`. Retrieved: 2026-10-07T16:18:37.686579+00:00; 911,376 bytes.

### ric-meo-sas-2022

[448502708: meo sas 2022](https://actes.ccm2.net/acte/0b44fdea-e60a-4e7d-895b-686d08f666a2#page=1) — 15 PDF pages, all screened. Deed/decision **2022-11-15**; deposit **2023-04-03**. Relevant pages: 1, 2.

Capital reduction and statutes; no exact Richebourg schedule or parcel tenant found.

SHA-256: `2e9676fcd9ffd443e00ec4a347d6de595c78b9dc87f2e9aa039dbeac1886f0e7`. Retrieved: 2026-10-07T16:18:41.375881+00:00; 1,136,491 bytes.

### ric-meo-sas-2017

[448502708: meo sas 2017](https://actes.ccm2.net/acte/5fc776e7-7f47-4192-9b3b-abd6089933ca#page=2) — 20 PDF pages, all screened. Deed/decision **2017-08-25**; deposit **2017-12-07**. Relevant pages: 2, 3.

Contribution of shares in Domaine Méo Camuzet; corporate relationship only, without an exact Richebourg land schedule or parcel tenant.

SHA-256: `6cb465e8fa5909a54533a11f6eb28fcfd634e5b8e6bdbef0139ee9c73740ba34`. Retrieved: 2026-10-07T16:18:45.070297+00:00; 911,144 bytes.

### ric-meo-sas-2012

[448502708: meo sas 2012](https://actes.ccm2.net/acte/3df01297-7f22-4814-8ec2-3e1c2b20ee6e#page=2) — 18 PDF pages, all screened. Deed/decision **2012-12-20**; deposit **2013-01-31**. Relevant pages: 2, 3.

Decision refers generally to acquisition of vines and removes a distribution requirement; no exact Richebourg reference or area.

SHA-256: `1ced3e65aa7b62332967f10f70f0e22bdd664747c6b4ed594ce7669fceb75b12`. Retrieved: 2026-10-07T16:18:48.320950+00:00; 628,985 bytes.

### ric-meo-sas-formation-2003

[448502708: meo sas formation 2003](https://actes.ccm2.net/acte/8a1e3870-0fa4-4778-bce6-ceacd0da2a42#page=1) — 20 PDF pages, all screened. Deed/decision **2003-04-15**; deposit **2003-05-15**. Relevant pages: 1, 2, 3.

Cash formation and subscribed capital; no exact Richebourg schedule or parcel tenant found.

SHA-256: `19cd39ba434a9ce456b74661347260a2ee0fa48fd14cbeb2ea9881d8e58c4af7`. Retrieved: 2026-10-07T16:18:51.506871+00:00; 627,527 bytes.

### ric-drc-2024

[778269407: drc 2024](https://actes.ccm2.net/acte/34207319#page=6) — 135 PDF pages, all screened. Deed/decision **2024-11-14**; deposit **2024-11-14**. Relevant pages: 6, 41, 42, 44, 46, 103.

Management declaration concerning share transfers and statutes updated 27 July 2024; Richebourg labels and company history are not an exact parcel schedule.

SHA-256: `f69a58a9d77a91e96a7dc6de3c803d3871c49d7766467a49238c1844dc8af0dc`. Retrieved: 2026-10-07T16:18:58.475155+00:00; 8,473,781 bytes.

### ric-drc-2022

[778269407: drc 2022](https://actes.ccm2.net/acte/5409233#page=2) — 65 PDF pages, all screened. Deed/decision **2022-03-21**; deposit **2022-04-15**. Relevant pages: 2, 31, 32.

Share donation and statutes reproduce Richebourg label wording, without an exact current cadastral schedule.

SHA-256: `5f0b832a6e2c6c1d7cb388b9a33fecdd84b407c6cee3ed91670f985130f79708`. Retrieved: 2026-10-07T16:19:02.981355+00:00; 2,655,931 bytes.

### ric-drc-statutes-1974

[778269407: drc statutes 1974](https://actes.ccm2.net/acte/5409256#page=1) — 125 PDF pages, all screened. Deed/decision **1974-12-21**; deposit **2002-07-31**. Relevant pages: 1, 36, 38, 39, 74.

The 21 December 1974 notarial statutes list the then estate, including AN56, AN60, AN68, AN69, AN71, AN169, AN171 and AN173 with individual areas matching today. The 2002 deposit bundles other decisions; it is not a 2002 land transfer.

SHA-256: `f8fb4eaac7409838a0c7563da3df61544a39e9e641ae0f163b83ef97066cbe68`. Retrieved: 2026-10-07T16:19:07.382879+00:00; 3,706,675 bytes.

### ric-mongeard-2022

[778269498: mongeard 2022](https://actes.ccm2.net/acte/cd4e3ee0-5b96-49fe-ab25-fe4bdcf4c098#page=2) — 31 PDF pages, all screened. Deed/decision **2022-05-25**; deposit **2022-06-17**. Relevant pages: 2, 12, 14.

Share donation and statutes updated 30 May 2022; no exact AN248 schedule or named Richebourg tenant found.

SHA-256: `36b403704aa63d30b73d968bbb89609b1cd67a4ba915fc88406fc192db2665e0`. Retrieved: 2026-10-07T16:19:12.500955+00:00; 2,110,638 bytes.

### ric-mongeard-2017

[778269498: mongeard 2017](https://actes.ccm2.net/acte/0fb79a93-c4a6-42ee-a72f-403c1c88cbcc#page=2) — 63 PDF pages, all screened. Deed/decision **2017-03-20**; deposit **2017-11-21**. Relevant pages: 2, 3.

Share and statutory changes; no exact AN248 schedule or named Richebourg tenant found.

SHA-256: `a05e03b6ec118bc642102e0c13432a4329fc3e14120da951723d4a2a5e432396`. Retrieved: 2026-10-07T16:19:16.807832+00:00; 3,215,590 bytes.

### mongeard-gfa-1964

[Mongeard-Mugneret: founding contribution and 1997 GFA statutes](https://actes.ccm2.net/acte/5cd69d1a-b284-4aa8-85fc-5ea04e0d26e5#page=1) — 74 PDF pages, all screened. Deed/decision **1964-02-12**; deposit **2002-10-22**. Relevant pages: 1, 2, 7, 48, 65.

The founding contribution schedule and its reproduction in the 1997 statutes print D535 (5,575 m²), D105 (290 m²), D104 (750 m²), total 6,615 m². Article 2 requires long-term leasing and forbids direct exploitation by the GFA; it does not identify an executed lease or tenant. Richebourg review: The original contribution and 1997 statutes name other vineyards, not current AN248. Mandatory long-term letting does not name a tenant; the estate’s 0.3112 ha publication remains census evidence only.

SHA-256: `4bb2a3e2d7753a75d511193e13fec2fbfbb4c2c1ec62b4b0add5674923c64ef9`. Retrieved: 2026-10-07T16:19:21.821495+00:00; 3,121,196 bytes.

### ric-af-gros-donation-2020

[885114322: af gros donation 2020](https://actes.ccm2.net/acte/44e2969c-e634-44a3-85b5-b5376e45ca12#page=2) — 61 PDF pages, all screened. Deed/decision **2020-07-22**; deposit **2020-10-07**. Relevant pages: 2, 37, 39, 40.

Share donation reproduces the founding AN243/245 schedule and existing lease recital to Domaine A.F Gros; it is not a second land purchase.

SHA-256: `7c91dae2e9ca52d3913b6a0d26e5c1b5337fbb261a3468045b7a2c35fd03379a`. Retrieved: 2026-10-07T16:19:26.636810+00:00; 3,359,951 bytes.

### ric-af-gros-formation-2020

[885114322: af gros formation 2020](https://actes.ccm2.net/acte/de0997df-6924-4dcb-b213-a7a17418aa28#page=2) — 49 PDF pages, all screened. Deed/decision **2020-07-01**; deposit **2020-07-16**. Relevant pages: 2, 6, 8, 9.

Contributes AN243 (949 m²) and AN245 (332 m²), already let to SAS Domaine A.F Gros (383967346) for 18 years from 11 November 2017 under a notarial lease dated 12 June 2018. Only the recital, not the lease instrument, was reviewed.

SHA-256: `cd56a3854557ceed5ef4a37be4fa638eaf76d4ac214b8dd3460e6f8ddff4843e`. Retrieved: 2026-10-07T16:19:32.852991+00:00; 3,194,067 bytes.

### ric-leroy-representative-2006

[427469135: leroy representative 2006](https://actes.ccm2.net/acte/49ab5756-3546-4877-bc89-56c14ff55243#page=1) — 3 PDF pages, all screened. Deed/decision **2006-09-15**; deposit **2007-03-22**. Relevant pages: 1, 2, 3.

Leroy SA appoints its representative in both the SCE and SCI Domaine Leroy. This corporate connection does not resolve the provisional DGFiP identifier by a parcel schedule.

SHA-256: `e49b4183fb1cc88cb6fbc23f9a4d4da90227d2a3f0217bf54f90f4f0eac7f675`. Retrieved: 2026-10-07T16:19:35.748927+00:00; 58,707 bytes.

### sci-domaine-leroy-2001

[SCI Domaine Leroy: 10 December 2001 minutes and original statutes](https://actes.ccm2.net/acte/1f10cb0c-c858-465c-b3ac-1d1c0b8cc1f8#page=1) — 43 PDF pages, all screened. Deed/decision **2001-12-10**; deposit **2001-12-27**. Relevant pages: 1, 2, 33.

The SCI, formed in 1947 and registered in 2001, has Leroy SA and Marcelle Bize-Leroy as partners. Its original statutes value a Clos Vougeot vine under pre-renovation references; no current cadastral reference. Richebourg review: All pages screened for Richebourg: no exact AN57, AN61 or AN168 schedule. The match of SCI Domaine Leroy to U14149307 remains provisional on abbreviated name and seat.

SHA-256: `52d3b534091b92c7e6b5d097f6042b1bbbeadd45af6ff8367fb6dc6b9e2a62af`. Retrieved: 2026-10-07T16:19:43.841172+00:00; 1,498,220 bytes.

### ric-leroy-2024

[427469135: leroy 2024](https://actes.ccm2.net/acte/a3452a10-c2a8-4f91-98cc-1b52889a43cf#page=1) — 3 PDF pages, all screened. Deed/decision **2024-06-03**; deposit **not established**. Relevant pages: 1, 2, 3.

Annual meeting and manager replacement; no parcel schedule. Deposit date is not established by the free index or PDF.

SHA-256: `c1dc242187c3f0a08f0c25675cee53815048d6e52435a4c0897691131d91a196`. Retrieved: 2026-10-07T16:19:47.463515+00:00; 111,546 bytes.

## Published holdings and authorized articles

Eleven producer holdings are retained only in the named-area census. Six official estate publications supply additional area evidence. Different totals are preserved (Méo approximately 0.34 versus 0.35 ha, Hudelot 0.29 versus 0.28 ha, Mongeard 0.3112 versus 0.31 ha); equal area alone never assigns a holding to a parcel. Anne Gros’s estate page places its 0.60 ha in Les Verroilles, whereas the article and later contribution show both named areas. This discrepancy stays qualified. The Gros-family article itself cautions that its producer distribution is not a simple ownership map.

The repository owner supplied authorized saved copies of [Winehog’s history and owners article](https://winehog.org/richebourg-history-plots-and-owners-10692/) and [New owner of Richebourg!](https://winehog.org/new-owner-of-richebourg-70980/). The first prints 18 August 2013; its update date is not established. Older maps are not used to override current legal rights or later filings.

The 24 October 2025 article prints northern plots 292/294 (2,167 m² combined) and southern plots 293/295 (3,083 m² combined). Both sums agree with the current cadastre. It deliberately leaves the new owner unnamed. Two external-research entries retain that dated context on the four references, with no named candidate, owner assignment or current farmer. Colours and rumours are not decoded into an identity.

Archive hashes cover the exact user-supplied webarchive bytes: history `f1d65b87d64864ae12e7a75cc1abd4d1a03e5c1d39a75cdafea094f6ef91ac87`; new owner `ff7632ac454272841cdc2095996c9f35db32d93c5d015aa1f906e4649f290dd9`. Only factual findings are published.

## Remaining gaps

- All ten free filing indexes and official registry records were checked; 36 selected filings were downloaded and all 1,454 pages screened. This is a bounded selection of formation, contribution, donation, transformation and recent statutes, not every filing ever deposited.
- Grivot AN247 has no accepted domaine crosswalk: overlapping individual names and management records are not sufficient. No exact AN53, AN247 or AN248 filing schedule was found in the selected files.
- U14149307 to SCI Domaine Leroy 427469135 remains a provisional name-and-seat match; the three reviewed filings do not name AN57/61/168.
- Hudelot’s retired AN65 is not promoted into a filing match for AN290/291. The 2017 Méo asset list lacks parcel areas; the separate SAS files provide no exact Richebourg schedule.
- Winehog subscriber text was reviewed only from two authorized user-supplied webarchives. The October 2025 article does not name the new owner of plots 292/293/294/295; colours and rumours are not an identity crosswalk.
- The Winehog history article prints 18 August 2013 but no established update date; older ownership maps and producer totals never override the 2025 rights snapshot or later deeds.
- Deposit dates for two Grivot 2024 files and the Leroy 2024 minutes are not established. Original lease instruments, later renewals, paid SPF copies and outreach remain unreviewed; no access restriction was bypassed.
- Source boundaries, failed notice downloads and unsearched historical intervals remain in the Tier 1 coverage. All 58 current farming identities remain unconfirmed.
