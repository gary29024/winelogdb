# Romanée-Saint-Vivant: public company filings

Reviewed 8 October 2026 for [Tier 2 issue #426](https://github.com/gary29024/winelogdb/issues/426), following the Richebourg precedent (#530). All eleven recorded holders were searched in the official company API and the free entreprises.lefigaro.fr indexes. PDFs were downloaded from actes.ccm2.net; no paid land-register copies or outreach were used. data.inpi.fr and pappers.fr refuse cloud traffic and were not used; anything only they hold is a gap for local audit.

The bounded selection covers formation and original statutes, contributions, donations, transformations and recent statutes. It is not an exhaustive download of every filing. Each of the **45 files / 1,686 pages** was processed with PyMuPDF embedded-text extraction; every image page was then rendered at **150 dpi** and screened with RapidOCR (ONNX Runtime, CPU, `use_cls=False`). Pages with only a born-digital text layer were read from that layer. Positive schedules and lease passages were checked against page images. A negative means no qualifying Romanée-Saint-Vivant match in these selected files, not that no such document exists.

Dates separate the deed/decision (`documentDate`) from its deposit (`filingDate`). Page numbers are PDF pages, including registry covers. Every source records the original URL, raw-byte SHA-256, byte count, retrieval time and page count in [curation](curation.json) or the [shared holder table](../holders/holder-links.json). PDFs, OCR text, article archives and full article text are not committed.

## Exact references

5 filing entries cover **5 current parcels**. Each printed reference and individual area agrees with the pinned `cadastreAreaM2`, and the filing company is a recorded holder. Historical rights and lease recitals do not establish the current farming season.

| Filing | Deed date / deposit | Exact current references and areas | Lease treatment |
| --- | --- | --- | --- |
| [Les Héritiers Confuron: 2024 contribution and lease](https://actes.ccm2.net/acte/fc2b3982-9fde-4224-8f6d-8fa79471eef6#page=5) (pp. 5, 9, 10) | 2024-09-27 / 2024-10-09 | AC298: 1,718 m²; AC300: 3,266 m² | The lease is recited and was delivered to the GFV; its text was not reviewed. |
| [Mémoire de Vignes: 2024 contribution and lease](https://actes.ccm2.net/acte/d1860966-223d-4e4e-841f-3e68dcc9a081#page=2) (pp. 2, 6, 7, 25) | 2024-07-24 / not established | AL330: 2,457 m² | Recited in the 24 July 2024 contribution deed as the lease then in place, to run to 31 October 2029; the deed does not say how it ended before the new lease. Defined in the statutes and recited in the same-day share transfer as signed just before; the lease deed itself is not filed. |
| [GFA Famille Cathiard: 1996 founding contribution](https://actes.ccm2.net/acte/988500b3-97d3-45ab-80b3-e21c28eda13e#page=9) (pp. 9) | 1996-04-05 / 1996-05-30 | AL326: 1,673 m² | No parcel-specific lease identified. |
| [GFA du Domaine de Corton-Grancey: 1972 contribution of two-thirds](https://actes.ccm2.net/acte/8a38b685-0c70-4954-ad15-eb55e25d155f#page=7) (pp. 7, 17, 18, 19) | 1972 / 2026-04-21 | AL1: 7,630 m² | The statutes recite that all contributed land is let under the 1966 lease, renewed in 1998 and in 2013 to 31 October 2031; the renewal deeds are not filed. The GFA holds undivided two-thirds; the other third is Vignoble Latour’s. |
| [Vignoble Latour: 2011 contribution of one-third](https://actes.ccm2.net/acte/4a8f6bd4-ba8b-43f4-81d5-d843c58db695#page=6) (pp. 6, 7, 14) | 2011-09-28 / 2011-12-30 | AL1: 7,630 m² | The deed recites an oral lease since each parcel’s acquisition; no written lease or current season is filed. |

AL 1 appears in two filings because two companies hold it: GFA du Domaine de Corton-Grancey contributed its undivided two-thirds in 1972 and Maison Louis Latour contributed its undivided third to Vignoble Latour in 2011. Both filings recite a lease or oral lease to the Société Civile Domaine Louis Latour; neither is a current-season farming record.

### References reached only through official lineage

GFV Hudelot-Noëllat’s founding deed of 28 June 2001 contributes AC 271 (17 a 84 ca) and AC 273 (29 a 93 ca); its filings of 2005, 2012, 2021 and 2025 repeat both, and the 2021 donation recites long leases of 1972, 2001 and 2005 without naming tenants or allocating parcels. Two survey documents validated on 16 May 2022 divided them into AC 357/358 and AC 359/360, whose cadastral areas sum to the printed ones (900 + 884 = 1,784 m²; 1,551 + 1,442 = 2,993 m²). The filings never print the current references, so the evidence is kept as `filing-named-cadastral-reference` research on the retired references and reaches today’s parcels only through documented DFI lineage, not as an exact filing match.

### A former owner’s schedule

The 2017 updated statutes of SC de la Romanée Saint-Vivant – Domaine Marey-Monge (323426601) reproduce the 1975 contribution of AC 230 (2 ha 21 a 65 ca) and AC 231 (3 ha 06 a 93 ca), both equal to today’s areas. The company is not the recorded holder: DGFiP lists the DRC in every available year from 2019, and DVF dates a sale of both references to 28 October 2017, the day Marey-Monge’s partners added a power to sell assets. On 20 December 2017 Marey-Monge handed its partners part of a vendor-credit claim on the Société Civile du Domaine de la Romanée-Conti; the extract does not name the asset sold. The schedule is therefore `filing-named-cadastral-reference` research on the current references, not an exact filing; the DRC’s 1998 minutes recite a 26 December 1975 long-term lease from that GFA to the DRC. 5 Marey-Monge filings (165 pages) were screened; they are counted under the DRC in the effort table because they were read for its parcels.

## Effort and holder findings

| Recorded holder | Filings | Pages | Outcome |
| --- | ---: | ---: | --- |
| SCI de l’Arlot (`322235748`) | 2 | 58 | Register and filings show AXA Millésimes as partner of the SCI and of the Domaine de l’Arlot operating company; the SCI’s 1992 minutes call that company its tenant and report the 1990 Romanée-Saint-Vivant purchase. No AL328 schedule; farming unverified. |
| Domaine Arnoux-Lachaux (`328972344`) | 5 | 113 | 5 filings (113 pages) show an operating company formed with cash and capitalised reserves, without an AL327 schedule or lease. Register identity only; farming unverified. |
| GFA Famille Cathiard (`405387101`) | 4 | 128 | The 1996 founding deed contributes AL326 with its exact area; filings of 2001, 2015 and 2024 repeat it. A partner is president of SAS Domaine Sylvain Cathiard et Fils; that provisional family link names no tenant. Farming unverified. |
| GFV Hudelot-Noëllat (`438871279`) | 8 | 289 | The 2001 contribution and later statutes name retired AC271 and AC273 with areas equal to today’s AC357/358 and AC359/360, which they reach only through the 2022 DFI division. No tenant named; farming unverified. |
| NICHOLEM (`484070800`) | 2 | 44 | Both filings (44 pages) show cash formation and a 2021 GFA requiring métayage, without AL325, a tenant or a domaine. Domaine Dujac publishes AL325’s area, but equal area is not a company crosswalk; no link asserted. |
| Vignoble Latour (`528291362`) | 4 | 156 | The 2011 contribution names AL1 (76 a 30 ca) for its undivided third and recites an oral lease to the Société Civile Domaine Louis Latour. The holder is a Maison Louis Latour subsidiary; farming unverified. |
| Domaine de la Romanée-Conti (`778269407`) | 10 | 610 | 5 DRC filings give no Romanée-Saint-Vivant schedule; 1998 minutes recite a 1975 lease from GFA Marey-Monge. 5 Marey-Monge filings name AC230/231 with today’s areas and, in December 2017, a vendor-credit claim on the DRC; DVF dates a sale to October 2017. Farming unverified. |
| Mémoire de Vignes (`931134381`) | 4 | 117 | The 2024 contribution names AL330 (24 a 57 ca) and the statutes an 18-year lease to SCEA du Domaine Poisot-Piguet signed the same day; a 2011 lease to an individual is also recited. Farming unverified. |
| SCI DOM LEROY (provisional) (`U14149307`) | 4 | 99 | Four SCI and SCE filings (99 pages) give no AC299/301 schedule; both companies were formed in 1947 by the Noëllat family and now share Leroy SA. U14149307 to SCI 427469135 stays provisional on name and seat; farming unverified. |
| GFA Domaine de Corton-Grancey (`U21852238`) | 1 | 37 | The statutes reproduce the 1972 contribution of two-thirds of AL1 (76 a 30 ca) and recite that all contributed land is let to the Société Civile Domaine Louis Latour, now to 2031. Farming unverified. |
| GFV Les Héritiers Confuron (`U33201044`) | 1 | 35 | The 27 September 2024 deed contributes AC298 and AC300 (areas match), subject to a 24-year lease signed that day to the SCE du Domaine Jean-Jacques Confuron (348024712). Actual operation is not stated. |

These are counts for the Romanée-Saint-Vivant pass, including files re-screened after earlier cru research. They must not be added to earlier pass totals as if all files were unique; previous recorded effort remains in the shared table’s effort notes.

## Inventory of screened filings

### arlot-sci-minutes-1992

[SCI de l'Arlot: 1991–2000 minutes and statutes (filed 2002)](https://actes.ccm2.net/acte/c82f61af-a6e6-428b-a271-86d08586be89#page=8) — 37 PDF pages, all screened. Deed/decision **1992-03-13**; deposit **2002-10-31**. Relevant pages: 1, 8, 9, 20.

Bundle filed on 31 October 2002 for the company’s registration: minutes of 22 July 1991, 13 March 1992 and 31 March 2000 with original and updated statutes. The 13 March 1992 management report says the SCI received, for the first time, the rent of “our parcel in Romanée Saint Vivant acquired in 1990”, and calls the SCE du Domaine de l’Arlot “our subsidiary and tenant”. No cadastral reference, area or lease deed is printed.

SHA-256: `c9042f61f24bd4e5987802af16cd10c81444854355ba471cba49ce745a01cf42`. Retrieved: 2026-10-08T13:12:23+00:00; 1,087,719 bytes.

### arlot-sce-2007

[SCE du Domaine de l'Arlot: 19 January 2007 share transfer and recast statutes](https://actes.ccm2.net/acte/0755e7e3-2e88-4144-9091-ad492b6d701b#page=1) — 21 PDF pages, all screened. Deed/decision **2007-01-19**; deposit **2007-03-22**. Relevant pages: 1, 2, 5, 9, 13.

AXA Millésimes (702047424) buys the 2,450 parts held by Société des Quatre Chemins; meetings of 18 and 19 January 2007 change the manager and recast the statutes, which give the SCI de l’Arlot (322235748) the other 2,550 of 5,000 parts. No parcel schedule or lease.

SHA-256: `b3275e29badd81178a44ef636e0165b59942120cb9dd21348b72cb0652b2d324`. Retrieved: 2026-10-08T13:44:44+00:00; 569,723 bytes.

### rsv-arnoux-2000

[Domaine Robert Arnoux: 21 February 2000 capital increase (filed 2003)](https://actes.ccm2.net/acte/9d187163-4625-49a9-9d50-e8eed96771c5#page=2) — 23 PDF pages, all screened. Deed/decision **2000-02-21**; deposit **2003-10-02**. Relevant pages: 2, 3, 6.

Capital increase by incorporation of reserves and conversion to euros; the annexed statutes record cash contributions at formation. No parcel schedule or lease.

SHA-256: `e55604a559f4a9cf8b7a39a72a5822baecbb268b6f2a2f0266f05adc25fd9c6b`. Retrieved: 2026-10-08T13:44:40+00:00; 605,671 bytes.

### rsv-arnoux-2003

[Domaine Robert Arnoux: 1 July 2003 capital increase](https://actes.ccm2.net/acte/bcbfb7fb-cba2-430e-a44e-8636ea860b2d#page=2) — 22 PDF pages, all screened. Deed/decision **2003-07-01**; deposit **2003-10-02**. Relevant pages: 2, 3.

Capital increase by incorporation of reserves; partners are a family member and Société Civile Familiale Lachaux. No parcel schedule or lease.

SHA-256: `46a0d23a5cc5c19634cbff92cdc0321d60cc131ed8593bdd4684e21c231329a1`. Retrieved: 2026-10-08T13:44:40+00:00; 502,464 bytes.

### rsv-arnoux-2009

[Domaine Arnoux-Lachaux: 29 May 2009 change of name and updated statutes](https://actes.ccm2.net/acte/fa5a91b2-5ea3-4d6b-a9fc-9a14a8a1ece7#page=1) — 20 PDF pages, all screened. Deed/decision **2009-05-29**; deposit **2009-07-15**. Relevant pages: 1, 3, 4, 5.

Renames Domaine Robert Arnoux as Domaine Arnoux-Lachaux; the updated statutes give an object of farming vineyard land it leases or may own and record only cash and capitalised reserves. No parcel schedule or lease.

SHA-256: `4f563271ac27b7a57d42dae3c1dbf69811feaaaf1a02fe406b5ef2395a7bd91a`. Retrieved: 2026-10-08T13:44:40+00:00; 501,287 bytes.

### rsv-arnoux-2018

[Domaine Arnoux-Lachaux: 27 December 2018 meeting and updated statutes (filed 2019)](https://actes.ccm2.net/acte/418afa77-4d33-46b7-a892-17d6510c80fe#page=1) — 29 PDF pages, all screened. Deed/decision **2018-12-27**; deposit **2019-02-27**. Relevant pages: 1, 10, 12, 13.

Meeting records the partners’ shares after a usufruct ended, with updated statutes repeating the farming object and cash-and-reserves capital, and a 2018 succession notoriety act. No parcel schedule or lease.

SHA-256: `3da0376c492fff7960447e87c2dfb4ed8f9f2f4467173c092b8948ab59228ee3`. Retrieved: 2026-10-08T13:44:41+00:00; 1,321,605 bytes.

### rsv-arnoux-2019

[Domaine Arnoux-Lachaux: 25 November 2019 partners’ decisions and updated statutes](https://actes.ccm2.net/acte/5a29a89c-48c6-4ef4-9b25-45cce207c7a7#page=1) — 19 PDF pages, all screened. Deed/decision **2019-11-25**; deposit **2019-12-05**. Relevant pages: 1, 3, 5, 7, 8.

Unanimous decisions on the management (31 October) and the registered office (25 November 2019), signed by partners including Société Familiale Lachaux (447844796), with updated statutes repeating the object of farming vineyard land the company leases or may own. No parcel schedule or lease.

SHA-256: `e5a345dec95a9e6c6a98af8c50b3ff12ca0c38d4e3ecf53df360666229648b37`. Retrieved: 2026-10-08T13:44:41+00:00; 809,702 bytes.

### cathiard-gfa-1996

[GFA Famille Cathiard: 5 April 1996 notarial formation and contributions](https://actes.ccm2.net/acte/988500b3-97d3-45ab-80b3-e21c28eda13e#page=9) — 32 PDF pages, all screened. Deed/decision **1996-04-05**; deposit **1996-05-30**. Relevant pages: 1, 5, 9, 10.

Notarial founding deed of the GFA by Cathiard family members. Article 9 contributes Vosne-Romanée AL 326, Romanée Saint Vivant, 16 a 73 ca. Article 3 forbids direct farming and requires long-term letting; no tenant or lease deed is named. The scanned PDF has no text layer; every page was OCR-screened and the schedule checked against the page image.

SHA-256: `c465a2a99f7d0ba2324b4740b2688f0b84a5b4ffc0135c916cb9e4a38cfed463`. Retrieved: 2026-10-08T13:06:31+00:00; 989,042 bytes.

### rsv-cathiard-2001

[GFA Famille Cathiard: 6 April 2001 share transfer, share donation and manager change](https://actes.ccm2.net/acte/8f80aad2-9b35-4a1f-a2de-ecd5728ba6fa#page=1) — 34 PDF pages, all screened. Deed/decision **2001-04-06**; deposit **2001-09-06**. Relevant pages: 1, 3, 7, 8.

Notarial share transfer among family members after a donation-partage of shares, with a change of manager and registered office. The restated asset list repeats article 9, Vosne-Romanée AL 326, Romanée Saint Vivant, 16 a 73 ca (page image checked), valued with regard to its rental situation; no tenant or lease is named.

SHA-256: `c9cecf78c71be552dc785f6d923d27723a5eeaac27c2603361d5b8b6401f5813`. Retrieved: 2026-10-08T13:44:39+00:00; 1,257,882 bytes.

### rsv-cathiard-2015

[GFA Famille Cathiard: 1 July 2015 registered-office transfer with annexed statutes](https://actes.ccm2.net/acte/39ac35d5-5cb9-4574-8801-b4100ad94f7e#page=1) — 32 PDF pages, all screened. Deed/decision **2015-07-01**; deposit **2015-12-11**. Relevant pages: 1, 2, 8, 12.

Extraordinary meeting moving the registered office. The annexed statutes repeat the 1996 contribution, article 9: Vosne-Romanée AL 326, Romanée Saint Vivant, 16 a 73 ca (page image checked), and require long-term letting; no tenant or lease is named.

SHA-256: `2ad45f789f7e2242d4b0e3dae82283e2402e2d624a6d2013054e44d9233c96c1`. Retrieved: 2026-10-08T13:44:39+00:00; 1,688,784 bytes.

### rsv-cathiard-2023

[GFA Famille Cathiard: statutes updated 26–27 June 2023 (filed 2024)](https://actes.ccm2.net/acte/54a458e0-7446-45d8-9016-2942b55d6e4f#page=1) — 30 PDF pages, all screened. Deed/decision **2023-06-27**; deposit **2024-02-23**. Relevant pages: 1, 4, 8.

Updated statutes after two June 2023 extraordinary meetings. Article 9 still lists Vosne-Romanée AL 326, Romanée Saint Vivant, 16 a 73 ca (page image checked), and article 3 forbids direct farming and requires long-term letting; no tenant or lease is named.

SHA-256: `cc8f6e6c7f2d1adec5c0b8d9e8ce906ef69c8867dfd3204ef652e1d78b5c3639`. Retrieved: 2026-10-08T13:44:39+00:00; 1,463,975 bytes.

### rsv-hudelot-formation-2001

[GFV Hudelot-Noëllat: 28 June 2001 founding contribution](https://actes.ccm2.net/acte/0cd2477b-6c77-42d4-a9b2-1b4400611014#page=4) — 21 PDF pages, all screened. Deed/decision **2001-06-28**; deposit **2001-08-09**. Relevant pages: 1, 3, 4, 20.

The founding deed contributes, among other vines, Vosne-Romanée AC 271 (17 a 84 ca) and AC 273 (29 a 93 ca), Romanée Saint Vivant. The statutes forbid direct farming and give the manager a mandate to grant 18-year leases; no tenant is named. Schedule checked against the page image.

SHA-256: `ab55eeb5b1b4d790260f0e9b91913834c647e872a1c846e6e1e0750dd3f265b1`. Retrieved: 2026-10-08T13:29:06+00:00; 911,376 bytes.

### rsv-hudelot-2005

[GFV Hudelot-Noëllat: 19 December 2005 capital increase](https://actes.ccm2.net/acte/c1cc0f4f-264c-4caf-9331-cc4b6de90c44#page=1) — 31 PDF pages, all screened. Deed/decision **2005-12-19**; deposit **2006-03-24**. Relevant pages: 1, 2, 16.

Capital increase and updated statutes; the annexed statutes repeat the founding schedule with AC 271 and AC 273. No tenant named.

SHA-256: `5a7812ac39ec8ff153dbbf9dfbdf87858559d602483ea85fcf3ac898f57be7bd`. Retrieved: 2026-10-08T13:34:12+00:00; 1,126,195 bytes.

### rsv-hudelot-2012

[GFV Hudelot-Noëllat: 11 June 2012 share donation-partage](https://actes.ccm2.net/acte/6e7eded3-7acb-4f3f-829c-52e74d54819f#page=7) — 44 PDF pages, all screened. Deed/decision **2012-06-11**; deposit **2015-03-27**. Relevant pages: 7.

Donation of shares; the recital of contributions repeats AC 271 (17 a 84 ca) and AC 273 (29 a 93 ca). No parcel lease or tenant.

SHA-256: `f8d737a37918afa1625ac51bf6884cd98ffdc55bb4a645d71a8ff4b616331307`. Retrieved: 2026-10-08T13:41:27+00:00; 2,871,321 bytes.

### rsv-hudelot-2025

[GFV Hudelot-Noëllat: statutes updated 31 March 2025](https://actes.ccm2.net/acte/5ff9138f-e952-4667-96c1-7baf1d83fe09#page=1) — 23 PDF pages, all screened. Deed/decision **2025-03-31**; deposit **2025-05-05**. Relevant pages: 1, 2, 3.

Updated statutes still recite the 2001 contribution of AC 271 and AC 273 with the same areas, although those references were divided in 2022. Long-term letting is required; no tenant named.

SHA-256: `8b4666d6ace8f594a7ccd8a290f6e3b6747049ea27d036cd6861a75f5230918f`. Retrieved: 2026-10-08T13:19:32+00:00; 6,137,682 bytes.

### rsv-hudelot-notoriety-2024

[GFV Hudelot-Noëllat: 9 July 2024 notarial act of notoriety (filed 2025)](https://actes.ccm2.net/acte/ff888784-5c03-4449-b845-941a0d2c4c95#page=1) — 20 PDF pages, all screened. Deed/decision **2024-07-09**; deposit **2025-05-05**. Relevant pages: 1, 2.

Succession formalities affecting partners’ shares; no parcel schedule or lease.

SHA-256: `f56e795273cb61bb66e6a4db32d7ef353d03355bdc1161847fad728c732937d7`. Retrieved: 2026-10-08T13:24:32+00:00; 4,044,789 bytes.

### rsv-hudelot-2021-donation

[GFV Hudelot-Noëllat: 18 June 2021 donation-partage of shares](https://actes.ccm2.net/acte/607f48de-8386-4f48-aa87-9f4bfc02937e#page=1) — 50 PDF pages, all screened. Deed/decision **2021-06-18**; deposit **2021-08-10**. Relevant pages: 1, 2, 6, 14.

Notarial donation-partage of GFV shares. The asset list repeats retired AC 271 (17 a 84 ca) and AC 273 (29 a 93 ca), Romanée Saint Vivant, and recites that the estate is let long-term under a 1972 métayage (extended, then tacitly renewed) and rural leases of 10 December 2001 and 19 December 2005, without naming tenants or allocating parcels.

SHA-256: `79b8cc53359f9fb04e251de54b3356d623aea1283f4af19aa111cea34b8b7df6`. Retrieved: 2026-10-08T13:44:36+00:00; 2,718,171 bytes.

### rsv-hudelot-2021-contribution

[GFV Hudelot-Noëllat: 12 November 2021 contribution meeting and updated statutes](https://actes.ccm2.net/acte/5fabcf7e-46f5-4d8e-bc31-eaab70de6f21#page=1) — 55 PDF pages, all screened. Deed/decision **2021-11-12**; deposit **2021-12-21**. Relevant pages: 1, 2, 3, 10, 36.

Extraordinary meeting approving a contribution of Clos de Vougeot vines (outside this cru), with updated statutes. The asset list repeats retired AC 271 (17 a 84 ca) and AC 273 (29 a 93 ca), Romanée Saint Vivant; no tenant or lease is named for them.

SHA-256: `53fefeb7d83edf5c8fb62644030a8ddbc3641b473f3e8d026b74159bbd71fef4`. Retrieved: 2026-10-08T13:44:36+00:00; 3,001,835 bytes.

### rsv-hudelot-2021-capital

[GFV Hudelot-Noëllat: 19 March 2021 notarial capital increase by property contribution](https://actes.ccm2.net/acte/1cf9b694-194a-41c0-a266-2b3e07fa69c9#page=1) — 45 PDF pages, all screened. Deed/decision **2021-03-19**; deposit **2021-04-20**. Relevant pages: 1, 3, 5, 27.

Capital increase by contribution of Gilly-lès-Cîteaux vines and land, outside this cru. The annexed statutes repeat retired AC 271 (17 a 84 ca) and AC 273 (29 a 93 ca), Romanée Saint Vivant; no tenant or lease is named for them.

SHA-256: `b8a6bb6689343fb0df298032fc1397be027c52a2e1f0521ab36840f04b65cf81`. Retrieved: 2026-10-08T13:44:36+00:00; 2,204,673 bytes.

### rsv-nicholem-2005

[NICHOLEM: 8 July 2005 notarial formation](https://actes.ccm2.net/acte/b6981ae6-b1fe-4bbf-9b96-fe339b78f5af#page=1) — 12 PDF pages, all screened. Deed/decision **2005-07-08**; deposit **2005-10-06**. Relevant pages: 1, 2, 3.

Formation of a civil property company by two individuals with 1,500 euros in cash, to acquire and operate, directly or indirectly, vineyard estates in Vosne-Romanée. No parcel, contribution, lease or tenant is named.

SHA-256: `40540527dc60aad958baff0aaadf346795c2c205976a28c3334311a711ecbb6a`. Retrieved: 2026-10-08T12:50:12+00:00; 351,452 bytes.

### rsv-nicholem-2021

[NICHOLEM: 5 November 2021 transformation into a GFA](https://actes.ccm2.net/acte/db220aed-6d72-4b3a-8a88-659f145555be#page=2) — 32 PDF pages, all screened. Deed/decision **2021-11-05**; deposit **2021-12-08**. Relevant pages: 2, 3, 6.

Unanimous decisions turn the SCI into a groupement foncier agricole; the recast statutes forbid direct farming and require letting by métayage. No parcel schedule, tenant or domaine is named.

SHA-256: `41e2cf300709eaac74ed814aad8aa5cbf0787a4095a99d8087716634f6891949`. Retrieved: 2026-10-08T13:04:42+00:00; 1,102,874 bytes.

### rsv-vignoble-latour-2010

[Vignoble Latour: 28 October 2010 founding statutes](https://actes.ccm2.net/acte/b15187a6-37ae-4687-a3fc-e7abca8bb0f5#page=1) — 20 PDF pages, all screened. Deed/decision **2010-10-28**; deposit **2010-11-17**. Relevant pages: 1, 2.

Private-deed statutes of the civil property company formed by Maison Louis Latour and GFA du Domaine de Corton-Grancey to acquire vines and let them; no parcel is contributed.

SHA-256: `3a94a467fa29f74f3980ad03d926abbc07bebd59aee47538edff0248d77468d8`. Retrieved: 2026-10-08T13:44:35+00:00; 171,190 bytes.

### latour-immeubles-2011

[LATOUR IMMEUBLES: statutes after the 28 September 2011 contribution](https://actes.ccm2.net/acte/10f5e549-5947-4c60-be23-9d6aa45aae75#page=1) — 20 PDF pages, all screened. Deed/decision **2011-09-28**; deposit **2011-12-30**. Relevant pages: 1, 3, 5, 6.

Maison Louis Latour contributes buildings, including the Aloxe-Corton cellar on Les Perrières B 28 (24 a 28 ca), and then holds 164,999 of the 165,000 shares.

SHA-256: `179294fb6a74750b1b4a4b0e1eb2bdf4a3e9d85469d25f3247345fd4efa82ec5`. Retrieved: 2026-10-07T12:57:21.864794+00:00; 167,438 bytes.

### rsv-vignoble-latour-2011

[Vignoble Latour: 28 September 2011 notarial contribution by Maison Louis Latour](https://actes.ccm2.net/acte/4a8f6bd4-ba8b-43f4-81d5-d843c58db695#page=7) — 92 PDF pages, all screened. Deed/decision **2011-09-28**; deposit **2011-12-30**. Relevant pages: 2, 3, 6, 7, 13, 14.

Maison Louis Latour contributes its undivided one-third of AL 1, Romanée Saint Vivant (76 a 30 ca), among other vines. The deed states the parcels are let to the Société Civile Domaine Louis Latour (778159715) by an oral lease since each acquisition, at 3.5 pièces per hectare from the 2008 harvest. Schedule checked against the page image.

SHA-256: `b9be636eb95742f10eefe733bc756eac42a9ecfad77a8822e5d57e228fe6a73a`. Retrieved: 2026-10-08T13:44:37+00:00; 2,005,862 bytes.

### vignoble-latour-2011

[VIGNOBLE LATOUR: statutes after the 28 September 2011 contribution](https://actes.ccm2.net/acte/b395bdda-43cc-467b-885d-c30ad373c068#page=1) — 24 PDF pages, all screened. Deed/decision **2011-09-28**; deposit **2011-12-30**. Relevant pages: 1, 3, 6, 7, 8, 9, 10.

Maison Louis Latour contributes undivided one-third shares of Corton parcels co-owned with the Corton-Grancey GFA, among them A 46, A 47, A 49, A 50, A 51, B 26, B 29, B 36, C 10, C 56, D 30, D 62, D 105, D 106, D 109 and N 50, each with its area. Maison Louis Latour then holds 54,999 of the 55,000 shares. Romanée-Saint-Vivant review: the statutes’ contribution article 10° also lists the undivided third of Vosne-Romanée AL 1, Romanée Saint Vivant (76 a 30 ca).

SHA-256: `c8b07068c9ec12aa2fa8c2ccc97714df1ac35ec3d955725396d4879af5e92544`. Retrieved: 2026-10-07T12:57:23.564768+00:00; 209,157 bytes.

### rsv-drc-statutes-1974

[DRC: 21 December 1974 notarial statutes and estate schedule (filed 2002)](https://actes.ccm2.net/acte/5409256#page=15) — 125 PDF pages, all screened. Deed/decision **1974-12-21**; deposit **2002-07-31**. Relevant pages: 15, 36, 38, 39.

Romanée-Saint-Vivant review: the 1974 estate schedule names no Romanée-Saint-Vivant parcel. The bundled 14 December 1998 meeting minutes recite a long-term lease, concluded 26 December 1975, between GFA Marey-Monge Romanée Saint-Vivant and the DRC, without cadastral references.

SHA-256: `f8fb4eaac7409838a0c7563da3df61544a39e9e641ae0f163b83ef97066cbe68`. Retrieved: 2026-10-08T13:44:42+00:00; 3,706,675 bytes.

### rsv-drc-2018

[DRC: 26 January 2018 completion of the December 2017 capital increase](https://actes.ccm2.net/acte/5409360#page=2) — 57 PDF pages, all screened. Deed/decision **2018-01-26**; deposit **2018-06-21**. Relevant pages: 2, 3, 4.

Records the capital increase decided on 20 December 2017 (154,140 new parts with a 36.7 million euro premium) and updated statutes. No cadastral reference or Romanée-Saint-Vivant schedule.

SHA-256: `1e587daa78a0c37ea9e71f7d8778cf83d94ed5b926b67d41e8edd29e1c80a51a`. Retrieved: 2026-10-08T13:44:05+00:00; 2,554,683 bytes.

### rsv-drc-2022

[DRC: 21 March 2022 share donation and statutes](https://actes.ccm2.net/acte/5409233#page=2) — 65 PDF pages, all screened. Deed/decision **2022-03-21**; deposit **2022-04-15**. Relevant pages: 2, 5, 31.

Share donations, including parts of GFA de la Romanée Saint-Vivant Domaine Marey-Monge held by DRC partners, and updated statutes. No cadastral reference.

SHA-256: `5f0b832a6e2c6c1d7cb388b9a33fecdd84b407c6cee3ed91670f985130f79708`. Retrieved: 2026-10-08T13:32:21+00:00; 2,655,931 bytes.

### rsv-drc-2024

[DRC: 14 November 2024 management declaration and bundled share deeds](https://actes.ccm2.net/acte/34207319#page=6) — 135 PDF pages, all screened. Deed/decision **2024-11-14**; deposit **2024-11-14**. Relevant pages: 6, 45, 46.

Share deeds and statutes updated 27 July 2024, which recite the 1942 contribution of the whole estate and its brands. No cadastral reference or Romanée-Saint-Vivant schedule.

SHA-256: `f69a58a9d77a91e96a7dc6de3c803d3871c49d7766467a49238c1844dc8af0dc`. Retrieved: 2026-10-08T13:07:24+00:00; 8,473,781 bytes.

### rsv-drc-2003

[DRC: 27 November 2003 meeting and recast statutes](https://actes.ccm2.net/acte/5409358#page=1) — 63 PDF pages, all screened. Deed/decision **2003-11-27**; deposit **2004-01-29**. Relevant pages: 1, 2, 32, 33.

Recast statutes reciting the 1942 contribution of the whole estate and its brands; no cadastral reference or Romanée-Saint-Vivant schedule.

SHA-256: `8490ca607cdfb6ded3aae9dc22f92226f64ea6a7922d50d02590bf98aefb2c9e`. Retrieved: 2026-10-08T13:44:42+00:00; 2,082,952 bytes.

### rsv-marey-monge-2017

[SC de la Romanée Saint-Vivant – Domaine Marey-Monge: 28 October 2017 meeting and updated statutes](https://actes.ccm2.net/acte/56104469-4c17-4f1e-b6e9-874cadd12a7f#page=1) — 49 PDF pages, all screened. Deed/decision **2017-10-28**; deposit **2017-11-21**. Relevant pages: 1, 2, 10, 11, 13.

The meeting adds a power to sell the company’s assets; the updated statutes reproduce the 1975 contribution to the former GFA of AC 230 (2 ha 21 a 65 ca) and AC 231 (3 ha 06 a 93 ca), to be let under long-term rural lease. No tenant or buyer is named.

SHA-256: `f599c3d62f24916087e861f61d6565f1aeaf7962c2a7397c23326b49ac0f2de3`. Retrieved: 2026-10-08T13:44:42+00:00; 1,648,592 bytes.

### rsv-marey-monge-reduction-2017

[SC Domaine Marey-Monge: 20 December 2017 capital reduction and updated statutes (filed 2018)](https://actes.ccm2.net/acte/0536f146-ddf4-430b-ab62-97bfa6d40cde#page=1) — 35 PDF pages, all screened. Deed/decision **2017-12-20**; deposit **2018-05-17**. Relevant pages: 1, 2, 4, 12, 14.

The capital reduction is repaid by handing partners part of the company’s vendor-credit claim on the Société Civile du Domaine de la Romanée-Conti, the balance payable by 31 January 2018; the updated statutes still reproduce the 1975 contribution of AC 230 and AC 231. The extract does not say which asset was sold.

SHA-256: `ce749ae56a981c58ba4e0d00be91dc412d1d349081f6158990324525cf705415`. Retrieved: 2026-10-08T13:44:43+00:00; 1,712,307 bytes.

### rsv-marey-monge-2014

[GFA Domaine Marey-Monge: 5 December 2014 transformation into a société civile (filed 2015)](https://actes.ccm2.net/acte/62722e2a-3c17-4a0a-842f-dd58ec33de18#page=1) — 35 PDF pages, all screened. Deed/decision **2014-12-05**; deposit **2015-02-27**. Relevant pages: 1, 3, 4, 16, 17.

Meeting turns the GFA into a société civile; the adopted statutes repeat the 1975 contribution of AC 230 (2 ha 21 a 65 ca) and AC 231 (3 ha 06 a 93 ca) and the object of letting them under long-term rural lease. No tenant is named.

SHA-256: `698a831a3764333b0a7839a3fe71f1c2745ecf644e38aeaca780a1a75a11a0c5`. Retrieved: 2026-10-08T13:44:42+00:00; 2,146,585 bytes.

### rsv-marey-monge-1994

[GFA Domaine Marey-Monge: statutes updated 9 May 1994 at registration](https://actes.ccm2.net/acte/662599dc-f64e-4cc3-a4c4-63a26a3ec331#page=1) — 42 PDF pages, all screened. Deed/decision **1994-05-09**; deposit **1994-06-20**. Relevant pages: 1, 2, 3, 6.

Statutes of the GFA formed in September 1975 and registered in May 1994. The 1975 contribution names AC 230, Romanée Saint-Vivant, 2 ha 21 a 65 ca, and AC 231, 3 ha 06 a 93 ca; the object is ownership and letting only, under long-term lease. No tenant is named.

SHA-256: `09d2498f151cf859790c1def4c6f512172ea6482b85e9f03c868ad8fa4b51846`. Retrieved: 2026-10-08T13:44:44+00:00; 966,310 bytes.

### rsv-marey-monge-2022

[SC Domaine Marey-Monge: 2 December 2022 early dissolution](https://actes.ccm2.net/acte/a6584627-7f1b-4b37-bcce-7060c5bc3de9#page=1) — 4 PDF pages, all screened. Deed/decision **2022-12-02**; deposit **2022-12-21**. Relevant pages: 1, 3, 4.

Meeting decides the company’s early dissolution and amicable liquidation. The index lists a second, byte-identical copy (same SHA-256), screened once. No parcel or lease.

SHA-256: `e4c98f0213293dfa21873487e7b921b0298bc9eb363e15e96e4df755846fc86e`. Retrieved: 2026-10-08T13:44:43+00:00; 109,829 bytes.

### memoire-de-vignes-2024

[MÉMOIRE DE VIGNES: statutes of 24 July 2024](https://actes.ccm2.net/acte/d1860966-223d-4e4e-841f-3e68dcc9a081#page=2) — 26 PDF pages, all screened. Deed/decision **2024-07-24**; deposit **not established**. Relevant pages: 2, 3, 6, 7, 25.

Formed as a GFV on 15 July 2024 and converted to an SCI on 24 July 2024. Its parcel annex includes Aloxe-Corton Le Corton C 11 (57 a 00 ca). The statutes define an 18-year rural lease of the parcels, by deed of 24 July 2024, to SCEA du Domaine Poisot-Piguet (384 069 985), and record LVMH Miscellanées acquiring shares the same day. The PDF has a text layer. Romanée-Saint-Vivant review: the 24 July 2024 capital increase contributes Vosne-Romanée AL 330, Romanée Saint Vivant (24 a 57 ca), listed again in Annex 0.

SHA-256: `df26c5c3be8842164507e65ad1aa921b83e819fac6643f35c87bb5fe74da1875`. Retrieved: 2026-10-07T12:58:02.612819+00:00; 1,539,666 bytes.

### rsv-mdv-formation-2024

[Mémoire de Vignes: 15 July 2024 GFV founding statutes](https://actes.ccm2.net/acte/58034acf-fb09-42a5-a3fb-068b5b219de4#page=1) — 28 PDF pages, all screened. Deed/decision **2024-07-15**; deposit **not established**. Relevant pages: 1, 5.

Founding statutes of the GFV with 2,000 euros in cash from five family partners; no land. The index lists a second, byte-identical copy (same SHA-256), screened once. The index date (17 July 2024) precedes the later deeds and is not used as a deposit date.

SHA-256: `e60f31bb529cfa64b960c96018ac16b9916d7371a7426881e8c1368133b8d6b3`. Retrieved: 2026-10-08T12:57:35+00:00; 1,185,088 bytes.

### rsv-mdv-contribution-2024

[Mémoire de Vignes: 24 July 2024 notarial capital increase by contribution](https://actes.ccm2.net/acte/42c11ddc-1f9c-4048-8d51-437e05ec93c2#page=6) — 28 PDF pages, all screened. Deed/decision **2024-07-24**; deposit **not established**. Relevant pages: 4, 6, 9, 10, 14, 15.

Contributes Vosne-Romanée AL 330, Romanée Saint Vivant (0 ha 24 a 57 ca), among four parcels. It recites an 18-year-6-month rural lease of the contributed land to an individual, signed 21 April 2011 and running to 31 October 2029, and a new long-term lease to be signed immediately afterwards. AL 330 came from the 5 March 1990 partition of former AL 2.

SHA-256: `ed24c779c4c78632f4645f473bea5f910891760a1612c944882898eb8df7010d`. Retrieved: 2026-10-08T13:03:00+00:00; 1,282,393 bytes.

### rsv-mdv-share-sale-2024

[Mémoire de Vignes: 24 July 2024 share transfer to LVMH Miscellanées](https://actes.ccm2.net/acte/f96f7c20-077e-4cf1-9470-37cb21be6c34#page=8) — 35 PDF pages, all screened. Deed/decision **2024-07-24**; deposit **not established**. Relevant pages: 8, 10, 11.

Share transfer deed. It repeats AL 330 (0 ha 24 a 57 ca) among the company’s assets and states that they are let for 18 years to the Société Civile d’Exploitation Agricole du Domaine Poisot-Piguet by a deed signed just before. The lease deed itself is not filed.

SHA-256: `9ab16473f379fd15ca4ee43ec472b6f436ac9244da490b29052233709bf553f3`. Retrieved: 2026-10-08T13:00:53+00:00; 1,598,619 bytes.

### sci-domaine-leroy-2001

[SCI Domaine Leroy: 10 December 2001 minutes and original statutes](https://actes.ccm2.net/acte/1f10cb0c-c858-465c-b3ac-1d1c0b8cc1f8#page=1) — 43 PDF pages, all screened. Deed/decision **2001-12-10**; deposit **2001-12-27**. Relevant pages: 1, 2, 32, 33, 34, 35, 36.

The SCI, formed in 1947 and registered in 2001, has Leroy SA and an individual as partners. Its original statutes value a Clos Vougeot vine under pre-renovation references; no current cadastral reference. Richebourg review: All pages screened for Richebourg: no exact AN57, AN61 or AN168 schedule. The match of SCI Domaine Leroy to U14149307 remains provisional on abbreviated name and seat. Romanée-Saint-Vivant review: every page screened again; the 1947 founding schedule lists Noëllat-family vines under pre-renovation section A references and names no Romanée-Saint-Vivant parcel; no AC 299 or AC 301 schedule.

SHA-256: `52d3b534091b92c7e6b5d097f6042b1bbbeadd45af6ff8367fb6dc6b9e2a62af`. Retrieved: 2026-10-07T16:19:43.841172+00:00; 1,498,220 bytes.

### rsv-leroy-2024

[SCI Domaine Leroy: 3 June 2024 annual meeting](https://actes.ccm2.net/acte/a3452a10-c2a8-4f91-98cc-1b52889a43cf#page=1) — 3 PDF pages, all screened. Deed/decision **2024-06-03**; deposit **not established**. Relevant pages: 1, 2, 3.

Annual meeting and manager replacement; no parcel schedule. Deposit date is not established by the free index or PDF.

SHA-256: `c1dc242187c3f0a08f0c25675cee53815048d6e52435a4c0897691131d91a196`. Retrieved: 2026-10-08T13:44:38+00:00; 111,546 bytes.

### rsv-leroy-sce-2001

[SCE du Domaine Leroy: 1947 statutes and 10 December 2001 minutes (filed 2001)](https://actes.ccm2.net/acte/e40cdccb-316c-448d-826c-850cb7e32137#page=2) — 48 PDF pages, all screened. Deed/decision **2001-12-10**; deposit **2001-12-27**. Relevant pages: 2, 10, 11, 29.

Registration bundle of the operating company: 31 December 1947 statutes (cash contributions by the Noëllat family; object to farm vineyards it leases or owns), statutes updated 10 December 2001 and minutes. No parcel schedule or named lease.

SHA-256: `84ccfda57c26d3ffe70b97300eb5c1265b7999b789c79f87bd70e0946c3d2739`. Retrieved: 2026-10-08T13:44:38+00:00; 1,556,915 bytes.

### rsv-leroy-sce-2023

[SCE du Domaine Leroy: 13 June 2023 annual meeting](https://actes.ccm2.net/acte/69b6ee34-067b-4b38-9ce5-45af7754ccb2#page=1) — 5 PDF pages, all screened. Deed/decision **2023-06-13**; deposit **2023-07-17**. Relevant pages: 1, 2.

Annual meeting of the operating company held at Leroy SA’s seat; no parcel schedule or lease.

SHA-256: `30a3b258b85ce5a983bde71c6dce28592cef4cca3d5919c882482b309fc7cba8`. Retrieved: 2026-10-08T13:44:38+00:00; 166,975 bytes.

### corton-grancey-statutes

[GFA du Domaine de Corton-Grancey: statutes updated 2025](https://actes.ccm2.net/acte/8a38b685-0c70-4954-ad15-eb55e25d155f#page=3) — 37 PDF pages, all screened. Deed/decision **1972**; deposit **2026-04-21**. Relevant pages: 3, 4, 5, 7, 8, 12, 18, 19.

The statutes reproduce the 1972 founding contributions: undivided two-thirds of Aloxe-Corton B 26, B 29, B 36, C 10, C 56, D 30, D 62, A 46, A 47, A 49, A 50, A 51 and N 50, and B 33, B 34 and B 35 in full, each with its area. They recite that all contributed land was let to the Société Civile Domaine Louis Latour (Château Corton-Grancey) under a 26 March 1966 lease, renewed in 1998 and again on 3 June 2013 to 31 October 2031.

SHA-256: `d204eca4d234cb18efb878e467cb7e96736c77daf1d6c2985eff2d5e3d8fb372`. Retrieved: 2026-10-07T12:58:09.581584+00:00; 8,693,031 bytes.

### heritiers-confuron-statutes-2024

[GFV Les Héritiers Confuron: 27 September 2024 founding statutes](https://actes.ccm2.net/acte/fc2b3982-9fde-4224-8f6d-8fa79471eef6#page=6) — 35 PDF pages, all screened. Deed/decision **2024-09-27**; deposit **2024-10-09**. Relevant pages: 5, 6, 9, 10.

Article five contributes Vougeot A393 (25 a 68 ca) and A406 (25 a 85 ca). Page 9 recites a 24-year rural lease signed the same day, before the statutes, to the SCE du Domaine Jean-Jacques Confuron (348024712); the GFV received the lease contract. Romanée-Saint-Vivant review: article four contributes Vosne-Romanée AC 298 (17 a 18 ca) and AC 300 (32 a 66 ca), Romanée Saint Vivant, under the same 24-year lease.

SHA-256: `2e9ff3cef2502811404c28a1db9ff4da049a4c004e97f9adc81f7d1ffe6854b8`. Retrieved: 2026-10-07T12:16:44+00:00; 605,586 bytes.

## Published holdings

9 producer holdings are retained only in the named-area census; each names the whole cru, never a parcel. Official estate pages are preferred; two exporter pages stand in where the producer publishes no sheet. An equal area never assigns a holding to a parcel.

| Producer | Published area | Precision | Finding | Sources |
| --- | --- | --- | --- | --- |
| Domaine de la Romanée-Conti | 5.2858 ha | square-metre | Undated estate page gives 5.2858 ha, equal to the summed cadastral areas of AC 230 and AC 231 recorded to the DRC. Census evidence only; no farming season inferred. | [Domaine de la Romanée-Conti: Romanée-Saint-Vivant](https://www.romanee-conti.fr/fr/9-grand-crus/8/romanee-st-vivant) |
| Domaine Hudelot-Noëllat | 0.48 ha | hundredth-hectare | Undated estate sheet gives 0.48 ha. The four GFV references descended from AC 271/273 measure 0.4777 ha; no parcel assignment inferred. | [Domaine Hudelot-Noëllat: Romanée-Saint-Vivant sheet](https://mobile.domaine-hudelot-noellat.com/assets/wine/Domaine_Hudelot-Noellat_Romanee-Saint-Vivant_Grand-Cru.pdf) |
| Maison Louis Latour | 0.8 ha | hundredth-hectare | Undated sheet: owned since 1898, today 0.8 ha (Les Quatre Journaux). AL 1 (0.7630 ha) is recorded to Vignoble Latour and the Corton-Grancey GFA jointly; the published total is not a parcel crosswalk. | [Louis Latour: Romanée-Saint-Vivant Les Quatre Journaux sheet](https://www.louislatour.com/pdf/en/romanee-saint-vivant-grand-cru-les-quatre-journaux-122.pdf) |
| Poisot Père & Fils | 0.49 ha | hundredth-hectare | Undated estate page gives 0.49 ha. It names no company or parcel; the Mémoire de Vignes lease names a different company (SCEA du Domaine Poisot-Piguet), so no holder is tied to this total. | [Poisot Père & Fils: Romanée-Saint-Vivant](https://www.domaine-poisot.fr/grands-vins-de-bourgogne/romanee-saint-vivant-grand-cru.html) |
| Domaine Dujac | 0.1656 ha | square-metre | Undated sheet gives 16 a 56 ca. That equals the cadastral area of AL 325, recorded to NICHOLEM, but equal area is not a parcel crosswalk and no company record or filing links NICHOLEM to Domaine Dujac. | [Domaine Dujac: Romanée-Saint-Vivant sheet](https://www.dujac.com/en/pdf/36-romanee-saint-vivant-grand-cru.pdf) |
| Domaine Follin-Arbelet | 0.5 ha | hundredth-hectare | Undated estate page gives 0.50 ha and says the domaine works and vinifies its wines. No owner, company or parcel is named. | [Domaine Follin-Arbelet: Romanée-Saint-Vivant](http://www.domaine-follin-arbelet.com/ROMANEE-SAINT-VIVANT-Grand-Cru.html) |
| Domaine de l'Arlot | no area printed | none | The estate page gives no area; it says another grower worked the vines until 1990 and the first domaine vintage was 1991. The SCI’s 1992 minutes report the parcel’s purchase in 1990. | [Domaine de l'Arlot: Romanée-Saint-Vivant](https://www.arlot.com/fr/vin/9/romanee-saint-vivant), [SCI de l'Arlot: 1991–2000 minutes and statutes (filed 2002)](https://actes.ccm2.net/acte/c82f61af-a6e6-428b-a271-86d08586be89#page=8) |
| Domaine Sylvain Cathiard et Fils | 0.16 ha | hundredth-hectare | Exporter page gives 0.16 ha (vines planted 1919); the GFA’s 1996 contribution of AL 326 is 16 a 73 ca. No parcel assignment inferred. | [Becky Wasserman: Sylvain Cathiard Romanée-Saint-Vivant](https://www.beckywasserman.com/domaines/sylvain-cathiard-et-fils/romanee-saint-vivant-grand-cru/) |
| Domaine Arnoux-Lachaux | 0.3 ha | approximate | Exporter page gives 0.3 ha (vines planted 1926); AL 327 recorded to the société civile measures 0.3450 ha. No parcel assignment inferred. | [Becky Wasserman: Arnoux-Lachaux Romanée-Saint-Vivant](https://www.beckywasserman.com/domaines/arnoux-lachaux/romanee-saint-vivant-grand-cru/) |

## Remaining gaps

- All eleven holders’ free filing indexes and official registry records were checked; 45 selected filings were downloaded and all 1,686 pages screened. This is a bounded selection of formation, contribution, donation, transformation and recent statutes, not every filing ever deposited.
- NICHOLEM (AL325): both filings name no parcel, tenant or domaine. Domaine Dujac publishes 16 a 56 ca, equal to AL325’s cadastral area, but equal area is not a company crosswalk; no link or candidate is asserted.
- AL329 has no legal-entity right; DFI places it with AL328 and AL330 in the 1990 division of AL2. Published Poisot (0.49 ha) and Follin-Arbelet (0.50 ha) totals name no parcel; private holdings are not researched.
- U14149307 to SCI Domaine Leroy 427469135 remains provisional on name and seat; no reviewed filing names AC299 or AC301. domaine-leroy.fr, reached by redirect from domaineleroy.com, publishes 0.9929 ha, but its provenance could not be verified (recently registered, no legal notice), so it is not used.
- GFA Famille Cathiard to Domaine Sylvain Cathiard et Fils is a provisional family-holding lead on a shared recorded officer; no filing names a tenant for AL326.
- Hudelot’s AC271/AC273 reach AC357–AC360 only through the 2022 DFI division; no reviewed filing prints the current references, so they are not exact filing matches.
- No DRC filing names AC230 or AC231; only the former owner Marey-Monge’s statutes do. The 26 December 1975 lease recited in the DRC’s 1998 minutes and the October 2017 sale deed (DVF publishes no parties) are unreviewed.
- The Confuron, Poisot-Piguet, Corton-Grancey and Vignoble Latour leases are recited, not filed; original instruments, renewals and current seasons are unreviewed. How Mémoire de Vignes’ 2011 lease to an individual ended is not stated.
- data.inpi.fr and pappers.fr refuse this cloud environment: filings or accounts available only there (including deposit dates missing from the free index for the 2024 Mémoire de Vignes deeds) are pending local audit.
- Winehog subscriber articles requested, not supplied: “Romanee Saint-Vivant – history, plots and owners – new update” (2017-04-30); “Romanee-Saint-Vivant – the wines, domaines and negociants” (2013-01-26); “New producer on Romanee-Saint-Vivant – Domaine Poisot” (2013-02-10); “Terroir Insight: Domaine Leroy Romanee Saint-Vivant” (2015-02-01); “Terroir Insight: Domaine Hudelot-Noëllat Romanée Saint-Vivant” (2017-04-27); “Terroir Insight: Arnoux-Lachaux, Romanée Saint-Vivant” (2017-05-28); “Terroir Insight: Louis Latour, Romanée Saint-Vivant Les Quatre Journaux” (2018-04-30); “Terroir Insight: Domaine Dujac, Romanée Saint-Vivant” (2018-09-27); “Terroir Insight: Domaine Cathiard, Romanée Saint-Vivant” (2018-10-11); “Terroir Insight: Domaine de l’Arlot, Romanée Saint-Vivant” (2018-10-26); “Terroir Insight: Domaine Jean-Jacques Confuron Romanée-Saint-Vivant” (2019-10-15); “Terroir Insight: The Poisot section of Romanée Saint-Vivant” (2019-10-24); “Domaine de la Romanée-Conti – Producer Profile” (2012-09-27). No paywalled text was accessed.
- Source boundaries, failed notice downloads and unsearched historical intervals remain in the Tier 1 coverage. Current farming remains unconfirmed for every parcel; paid SPF copies and outreach remain Tier 3.
