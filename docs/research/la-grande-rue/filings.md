# La Grande Rue: public company filings

Reviewed 8 October 2026 for [Tier 2 issue #430](https://github.com/gary29024/winelogdb/issues/430), following the Richebourg (#530) and Vosne-Romanée passes (#426–#429). The one recorded holder, `397738634` (Nicole Lamarche, formerly GFV Domaine François Lamarche), was searched in the official company API and the free entreprises.lefigaro.fr index. PDFs were downloaded from actes.ccm2.net; no paid land-register copies or outreach were used. data.inpi.fr and pappers.fr refuse cloud traffic and were not used; anything only they hold is a gap for local audit.

Each of the **17 files / 591 pages** was processed with PyMuPDF embedded-text extraction; every image page was then rendered at **150 dpi** and screened with RapidOCR (ONNX Runtime, CPU, `use_cls=False`). A negative means no qualifying La Grande Rue match in these selected files, not that no such document exists.

Dates separate the deed/decision (`documentDate`) from its deposit (`filingDate`). Page numbers are PDF pages, including registry covers. Every source records the original URL, raw-byte SHA-256, byte count, retrieval time and page count in [curation](curation.json). PDFs, OCR text, article archives and full article text are not committed.

## Exact references

None. No screened filing prints AM 1, AM 2 or AM 8. The vineyard business was contributed to the GFA by an 11 August 1994 notarial deed that the later statutes recite by value only (26,387,000 francs); that deed is not in the free index.

## Company history

The GFA Domaine François Lamarche was formed on 15 June 1994 with cash, received the vineyard business by the 11 August 1994 deed, and in 2001 barred direct farming and authorised a long-term lease of its land to a family member who would make it available to the operating SARL du Domaine Lamarche. A 2010 donation deed recites that lease: signed on 29 November 2001, it let “the parcels belonging to” the GFV in four communes to two family members from 2001 to 2018, with their authorised mise à disposition to the SARL. In 2019 the GFV absorbed that operating company (353336068) — whose draft merger treaty says it benefited from mises à disposition of leased vines — and became SAS Nicole Lamarche, with an object that includes farming. In 2022 it also absorbed EARL Nicole Lamarche (538257973). These filings support the rights file’s 2022 change of recorded name for the same identifier. None is parcel-specific operation evidence.

## Holder link

`owner-company` to Domaine Nicole Lamarche, **reviewed** (recorded for Échezeaux): The official register confirms the SAS Nicole Lamarche, the company of Domaine Nicole Lamarche.

## Effort and holder findings

| Recorded holder | Filings | Pages | Outcome |
| --- | ---: | ---: | --- |
| Nicole Lamarche (`397738634`) | 17 | 591 | Filings trace the 1994 GFA, which received the whole Lamarche vineyard business by an unfiled 1994 deed, to SAS Nicole Lamarche after its 2019 merger with the operating company. No filing prints AM1, AM2 or AM8; the company link is reviewed. Farming unverified. |

## Inventory of screened filings

### lgr-lamarche-1994

[GFA Domaine François Lamarche: 15 June 1994 statutes and 16 June 1994 meeting](https://actes.ccm2.net/acte/0ab99856-abdc-4e80-bd7e-f5cdb71d1b92#page=1) — 28 PDF pages, all screened. Deed/decision **1994-06-15**; deposit **1994-07-25**. Relevant pages: 1, 2, 5, 7.

Private-deed statutes of the groupement foncier agricole, formed with 10,000 francs in cash, with an object of owning and letting agricultural land; the next day’s meeting appoints the management. No parcel schedule or lease.

SHA-256: `7036519b3a04e4a511dfcd3beb1a64c076eeb0515fcb0991a306ead2b727852f`. Retrieved: 2026-10-08T13:44:48+00:00; 619,039 bytes.

### lgr-lamarche-2001

[GFA Domaine François Lamarche: 5 July 2001 meeting and updated statutes](https://actes.ccm2.net/acte/0d595715-4a61-49be-8a26-e953652c6263#page=1) — 24 PDF pages, all screened. Deed/decision **2001-07-05**; deposit **2001-09-17**. Relevant pages: 1, 3, 4, 5, 10.

The meeting forbids direct farming, converts the capital, and authorises a long-term lease of the GFA’s land to a family member, who is to make it available to SARL du Domaine Lamarche. The updated statutes recite that an 11 August 1994 notarial deed contributed all the fixed assets of the François Lamarche vineyard business (26,387,000 francs). No parcel list is given.

SHA-256: `a4dc40ed86fb1c6d2de48799050496a0de0f81bf421a2aecd37ef177fd399d14`. Retrieved: 2026-10-08T13:44:49+00:00; 744,018 bytes.

### lgr-lamarche-2010

[GFV Domaine François Lamarche: 5 October 2010 donation of shares and updated statutes](https://actes.ccm2.net/acte/5044ad92-e033-404f-91b1-762ccb632bde#page=1) — 17 PDF pages, all screened. Deed/decision **2010-10-05**; deposit **2010-12-20**. Relevant pages: 1, 2, 3.

Notarial donation of GFV shares with updated statutes repeating the 1994 cash formation and the 11 August 1994 contribution of the whole vineyard business, by value only. No parcel schedule or lease.

SHA-256: `d2630f5e0566587bd3797a65488bf0b550ad696035e3c40d559bd4c845731938`. Retrieved: 2026-10-08T13:44:49+00:00; 309,382 bytes.

### lgr-lamarche-merger-2019

[Draft merger of SARL Domaine François Lamarche into the GFV (10 May 2019)](https://actes.ccm2.net/acte/b65c4c73-219b-4477-8856-3366b1d8c11b#page=2) — 107 PDF pages, all screened. Deed/decision **2019-05-10**; deposit **2019-05-13**. Relevant pages: 2, 3, 4, 5, 6, 7.

Draft treaty for the GFV to absorb SARL Domaine François Lamarche (353336068), the operating company. It states that the SARL benefits from mises à disposition of vines held under long, nine-year or oral leases whose tenant is a family member, continuing for the GFV; the two companies share a manager. No parcel list is given.

SHA-256: `222124108bd7c8e2954244992c309bde41128fae3c2ffca870ed6e2e39c80a15`. Retrieved: 2026-10-08T13:44:50+00:00; 3,765,636 bytes.

### lgr-lamarche-cac-2019

[Domaine François Lamarche: contribution auditor’s report on the 2019 merger](https://actes.ccm2.net/acte/19c87d3a-a618-4ad0-9f06-8dbc86aa527f#page=1) — 7 PDF pages, all screened. Deed/decision **2019-05-15**; deposit **2019-05-21**. Relevant pages: 1, 2, 5, 7.

Auditor’s report on the value of the operating company’s contribution in the merger. No parcel schedule or lease.

SHA-256: `142fc1f3d6a7a50992d287e22bb35d4a2d4945fed6ce9ec45aae58b6685add30`. Retrieved: 2026-10-08T13:44:49+00:00; 236,662 bytes.

### lgr-lamarche-cac-2019b

[Domaine François Lamarche: contribution auditor’s report on the 2019 merger (second index entry)](https://actes.ccm2.net/acte/fb5aa12f-7851-4e09-8cad-11040784fb3e#page=1) — 7 PDF pages, all screened. Deed/decision **2019-05-15**; deposit **2019-05-21**. Relevant pages: 1, 5, 7.

Auditor’s report on the merger contribution. The same deposit is indexed again under the company’s former management number; content identical apart from the registry cover.

SHA-256: `55ec758391828cd1940f2527c1c47b46447e9997572bd0f6878163fc9ac458e0`. Retrieved: 2026-10-08T13:44:50+00:00; 236,659 bytes.

### lgr-lamarche-transformation-report-2019

[GFV Domaine François Lamarche: report on the transformation into an SAS](https://actes.ccm2.net/acte/4c25b43c-1ee8-41ab-807b-8280f8e494b1#page=1) — 5 PDF pages, all screened. Deed/decision **2019-05-15**; deposit **2019-05-21**. Relevant pages: 1, 4, 5.

Transformation auditor’s report following the 14 April 2019 meeting. No parcel schedule or lease.

SHA-256: `38556d4879bc997bbca3cc3e1cd256bf960ae07b7a731b0bd11287e39b5b72ef`. Retrieved: 2026-10-08T13:44:50+00:00; 133,619 bytes.

### lgr-lamarche-transformation-report-2019b

[GFV Domaine François Lamarche: report on the transformation (second index entry)](https://actes.ccm2.net/acte/f933680f-b483-4fe3-82e7-56d3bbf45578#page=1) — 5 PDF pages, all screened. Deed/decision **2019-05-15**; deposit **2019-05-21**. Relevant pages: 1, 4, 5.

Transformation auditor’s report. The same deposit is indexed again under the company’s former management number; content identical apart from the registry cover.

SHA-256: `e46b5c1806c13f7bb8711ecaddb0e07da78db1ba60824f25665356c506cac2d1`. Retrieved: 2026-10-08T16:36:01+00:00; 133,618 bytes.

### lgr-lamarche-2019-04

[GFV Domaine François Lamarche: 14 April 2019 meeting and updated statutes](https://actes.ccm2.net/acte/7303d6ec-5916-4f26-91f9-49e2d417ee8a#page=1) — 33 PDF pages, all screened. Deed/decision **2019-04-14**; deposit **2019-06-07**. Relevant pages: 1, 2, 9, 10.

Meeting increasing the capital, with updated statutes repeating the 1994 contribution history by value. No parcel schedule or lease.

SHA-256: `77888c7dd15016081eb559c164d8369f641d344e0e09b1a22c4929336685e55d`. Retrieved: 2026-10-08T13:44:51+00:00; 1,019,995 bytes.

### lgr-lamarche-2019-04b

[GFV Domaine François Lamarche: 14 April 2019 meeting (second index entry)](https://actes.ccm2.net/acte/90e4570d-e6d2-4f1f-ad23-953239fc0778#page=1) — 33 PDF pages, all screened. Deed/decision **2019-04-14**; deposit **2019-06-07**. Relevant pages: 1, 2.

Capital increase meeting and updated statutes. The same deposit is indexed again under the company’s former management number; content identical apart from the registry cover.

SHA-256: `4e5bb0ffc6fa153b13f58f9335a0a8fdd2fc9d70f67038080f3e82839820d683`. Retrieved: 2026-10-08T16:34:41+00:00; 1,019,990 bytes.

### lgr-lamarche-2019-06

[Nicole Lamarche: 20 June 2019 meeting approving the merger and the transformation into an SAS](https://actes.ccm2.net/acte/04b743c1-1ad1-4ece-9653-bbd60e0db3eb#page=1) — 79 PDF pages, all screened. Deed/decision **2019-06-20**; deposit **2019-07-18**. Relevant pages: 1, 2, 8, 9.

Meeting approving the absorption of the operating SARL, the transformation of the GFV into SAS Nicole Lamarche and an object that now includes farming vines directly or through leases and mises à disposition. No parcel schedule or lease.

SHA-256: `45b1f55919567d3237ee66c3ead97c6e66de62bb407ad96a6ba568a96f08b90b`. Retrieved: 2026-10-08T13:44:51+00:00; 3,265,933 bytes.

### lgr-lamarche-merger-2022

[Draft merger of EARL Nicole Lamarche into SAS Nicole Lamarche (26 January 2022)](https://actes.ccm2.net/acte/b711c226-96b1-42ab-886b-4ca23d7905e6#page=2) — 37 PDF pages, all screened. Deed/decision **2022-01-26**; deposit **2022-02-04**. Relevant pages: 2, 4, 22.

Draft treaty for SAS Nicole Lamarche to absorb EARL Nicole Lamarche (538257973). No parcel schedule or lease.

SHA-256: `63bf876b132305c19f9130241d40f61289202b4a3a410764bff818a8c9ad5990`. Retrieved: 2026-10-08T13:44:52+00:00; 7,546,391 bytes.

### lgr-lamarche-2022

[SAS Nicole Lamarche: completion of the 2022 merger and statutes updated 16 March 2022](https://actes.ccm2.net/acte/fa94508a-c840-47a9-ac70-0352a7b4be0a#page=1) — 35 PDF pages, all screened. Deed/decision **2022-03-16**; deposit **2022-05-03**. Relevant pages: 1, 4, 10, 12, 35.

Completion of the EARL merger and capital increase, with updated statutes. No parcel schedule or lease.

SHA-256: `4ff6805225605383cd11a57bf2f5f94d2bec2044b4d97e31957d6a96f646d1ab`. Retrieved: 2026-10-08T13:44:51+00:00; 1,476,864 bytes.

### lgr-lamarche-merger-2019b

[Draft merger of SARL Domaine François Lamarche into the GFV (second index entry)](https://actes.ccm2.net/acte/150d7cbe-f7c5-4190-81b6-5ec8833c95d7#page=2) — 107 PDF pages, all screened. Deed/decision **2019-05-10**; deposit **2019-05-13**. Relevant pages: 2, 5.

Draft merger treaty. The same deposit is indexed again under the company’s former management number; content identical apart from the registry cover.

SHA-256: `5d00f1ef2059bcc4060e4c844c7d67aba167848e46aa395bf9f00c388b9095d6`. Retrieved: 2026-10-08T16:36:15+00:00; 3,765,632 bytes.

### lgr-lamarche-donation-2010

[GFV Domaine François Lamarche: 4–5 October 2010 notarial donation of shares](https://actes.ccm2.net/acte/252c38f7-043a-4bb9-a698-658b9620ad9c#page=2) — 29 PDF pages, all screened. Deed/decision **2010-10-05**; deposit **2010-12-20**. Relevant pages: 2, 4, 5.

Notarial donation of bare-ownership shares. It recites a 29 November 2001 notarial rural lease by the GFV to two family members, from 1 January 2001 to 31 December 2018, of “the parcels belonging to it” in Vosne-Romanée, Vougeot, Flagey-Échezeaux and Boncourt-le-Bois, and their mise à disposition, authorised by the lessor, to SARL Domaine François Lamarche (353336068). No parcel list is given.

SHA-256: `87bd8bd6ebd4e04c1f01f43805fae90fdb5f80519992690a572ef008921b938e`. Retrieved: 2026-10-08T16:44:38+00:00; 600,001 bytes.

### lgr-lamarche-2014

[GFV Domaine François Lamarche: 31 January 2014 meeting appointing managers](https://actes.ccm2.net/acte/6722d073-acb0-4d56-8587-49785c7295bc#page=1) — 19 PDF pages, all screened. Deed/decision **2014-01-31**; deposit **2014-02-07**. Relevant pages: 1, 2.

Mixed meeting appointing new managers after a founder’s death. No parcel schedule or lease.

SHA-256: `d5e6117de7bd583177375d1bc273546e5cf589ffc490dde92c5175accee77909`. Retrieved: 2026-10-08T16:41:48+00:00; 595,269 bytes.

### lgr-lamarche-2014b

[GFV Domaine François Lamarche: 31 January 2014 meeting (second index entry)](https://actes.ccm2.net/acte/5c421e1f-851d-4ab2-b7b1-68733f6b615c#page=1) — 19 PDF pages, all screened. Deed/decision **2014-01-31**; deposit **2014-02-07**. Relevant pages: 1, 2.

Mixed meeting appointing new managers. The same deposit is indexed again under the company’s former management number; content identical apart from the registry cover.

SHA-256: `c9734c7a0e69052749874952121d2dffbbda2a782fecce35ac5e3a248aede4ef`. Retrieved: 2026-10-08T16:43:22+00:00; 613,168 bytes.

## Published holdings

One producer holding is retained only in the named-area census; it names the whole cru, never a parcel. An equal area never assigns a holding to a parcel.

| Producer | Published area | Precision | Finding | Sources |
| --- | --- | --- | --- | --- |
| Domaine François Lamarche / Nicole Lamarche | 1.65 ha | are | A November 2022 capture of the domaine’s page gives La Grande Rue, monopole, 1 ha 65 a; AM 1, AM 2 and AM 8, recorded to Nicole Lamarche, measure 16,525 m² together. Census evidence only; no parcel or farming season is assigned. | [Domaine François Lamarche: La Grande Rue technical sheet (archived 27 November 2022)](https://web.archive.org/web/20221127112203/http://www.domaine-lamarche.com/pages/vins-fiches.php?rub=vins&lang=fr&vin=grande_rue) |

## Remaining gaps

- Bounded filing review: 17 of the 17 filings the free index lists for 397738634 were screened (591 pages); the rest are listed below as not screened. None prints AM 1, AM 2 or AM 8.
- The 11 August 1994 notarial deed that contributed the Lamarche vineyard business to the GFA is recited by value only and is not in the free index; its parcel list would need a paid land-register copy (Tier 3).
- The 2001 lease authorisation, the 29 November 2001 rural lease recited in 2010 (to 31 December 2018, land in four communes) and the 2019 merger treaty describe leases to family members and mises à disposition to the operating company without parcel lists; they are not parcel-specific operation evidence.
- The domaine’s current website domain hosts unrelated content; the published 1 ha 65 a comes from a November 2022 archive capture.
- data.inpi.fr and pappers.fr refuse this cloud environment: filings or accounts available only there are pending local audit.
- Winehog subscriber articles requested, not supplied: “La Grande Rue – in a Vosne-Romanee sweet spot” (2014-06-22); “Terroir Insight: Domaine Lamarche, La Grande Rue “Cuvée 1959”” (2018-12-09). No paywalled text was accessed.
- Source boundaries, failed notice downloads and unsearched historical intervals remain in the Tier 1 coverage. Current farming remains unconfirmed for all three parcels; paid SPF copies and outreach remain Tier 3.
