# La Grande Rue: public company filings

Reviewed 8 October 2026 for [Tier 2 issue #430](https://github.com/gary29024/winelogdb/issues/430), following the Richebourg (#530) and Vosne-Romanée passes (#426–#429). The one recorded holder, `397738634` (Nicole Lamarche, formerly GFV Domaine François Lamarche), was searched in the official company API and the free entreprises.lefigaro.fr index. PDFs were downloaded from actes.ccm2.net; no paid land-register copies or outreach were used. The local retry of data.inpi.fr and pappers.fr also returned HTTP 403; records available only there remain unverified.

Each of the **17 files / 591 pages** was processed with PyMuPDF embedded-text extraction; every image page was then rendered at **150 dpi** and screened with RapidOCR (ONNX Runtime, CPU, `use_cls=False`). A negative means no qualifying La Grande Rue match in these selected files, not that no such document exists.

Dates separate the deed/decision (`documentDate`) from its deposit (`filingDate`). Page numbers are PDF pages, including registry covers. Every source records the original URL, raw-byte SHA-256, byte count, retrieval time and page count in [curation](curation.json). PDFs, OCR text, article archives and full article text are not committed.

## Exact references

The executed 29 November 2001 rural lease is reproduced on PDF pages 15–29 of the 2010 donation. Its page 16 lists **AM 1: 14,207 m²; AM 2: 2,096 m²; AM 8: 222 m²**. All three current references and individual cadastral areas match, for **16,525 m²** in total. The lessor is GFV Domaine François Lamarche, SIREN 397738634, the same legal entity now recorded as SAS Nicole Lamarche. These are three parcel matches from one filing. The source is dated 2010, the annexed instrument 2001; neither date is treated as an acquisition date.

## Company history

The GFA was formed on 15 June 1994. Pages 18–19 of the annexed lease recite the 11 August 1994 contribution of these parcels, published at Beaune on 21 October 1994, volume 1994P no. 4330. The 23,514,000-franc property value is distinct from the 26,387,000-franc whole fixed-asset contribution recalled in the statutes. The original contribution instrument is not included in the reviewed files.

The July 2001 meeting merely authorised a lease. The executed 29 November lease names François Lamarche and Marie-Blanche Cebe, spouse Lamarche, as personal tenants for 1 January 2001–31 December 2018; page 24 authorises mise à disposition to operating SARL 353336068 and the 2010 donation says it occurred. The 2019 treaty names Nicole personally as tenant and the June resolutions complete the SARL merger and SAS transformation. The 2022 treaty states that the SAS became direct operator of its own vines and that the EARL/SAS lease ended on 7 November 2019; its annexes are not appended and it gives no parcel schedule. The 2022 merger completes on 16 March, deposited 3 May. These distinct historical and company-level operator records remain deferred to #364 with the owner’s approval; **verified current farming remains 0**.

## Holder link

`owner-company` to Domaine Nicole Lamarche, **reviewed** (recorded for Échezeaux): The official register confirms the SAS Nicole Lamarche, the company of Domaine Nicole Lamarche.

## Effort and holder findings

| Recorded holder | Filings | Pages | Outcome |
| --- | ---: | ---: | --- |
| Nicole Lamarche (`397738634`) | 17 | 591 | GFA/GFV Domaine François Lamarche became SAS Nicole Lamarche under SIREN 397738634. The 2001 lease annexed to the 2010 donation names AM 1, AM 2 and AM 8 with exact cadastral areas. Owner-company link reviewed; dated operator evidence deferred to #364. Current farming unverified. |

## Inventory of screened filings

### lgr-lamarche-1994

[GFA Domaine François Lamarche: 15 June 1994 statutes and 16 June 1994 meeting](https://actes.ccm2.net/acte/0ab99856-abdc-4e80-bd7e-f5cdb71d1b92#page=1) — 28 PDF pages, all screened. Deed/decision **1994-06-15**; deposit **1994-07-25**. Relevant pages: 1, 2, 5, 7, 25, 27.

Private-deed statutes forming the GFA on 15 June 1994 with 10,000 francs in cash; the original object includes operating the vineyard as well as owning and letting land. The 16 June meeting appoints management. No parcel schedule or lease is included in these 28 pages.

SHA-256: `7036519b3a04e4a511dfcd3beb1a64c076eeb0515fcb0991a306ead2b727852f`. Retrieved: 2026-10-08T13:44:48+00:00; 619,039 bytes.

### lgr-lamarche-2001

[GFA Domaine François Lamarche: 5 July 2001 meeting and updated statutes](https://actes.ccm2.net/acte/0d595715-4a61-49be-8a26-e953652c6263#page=1) — 24 PDF pages, all screened. Deed/decision **2001-07-05**; deposit **2001-09-17**. Relevant pages: 1, 3, 4, 5, 10.

The 5 July meeting forbids direct farming, converts the capital and mandates a future long-term lease to a family member for mise à disposition to SARL du Domaine Lamarche. This is an authorisation, not the executed lease. Statutes recite the 11 August 1994 contribution of all vineyard fixed assets (26,387,000 francs) without a parcel list. The executed 29 November 2001 lease is separately reproduced in lgr-lamarche-donation-2010.

SHA-256: `a4dc40ed86fb1c6d2de48799050496a0de0f81bf421a2aecd37ef177fd399d14`. Retrieved: 2026-10-08T13:44:49+00:00; 744,018 bytes.

### lgr-lamarche-2010

[GFV Domaine François Lamarche: statutes updated after the 5 October 2010 share donation](https://actes.ccm2.net/acte/5044ad92-e033-404f-91b1-762ccb632bde#page=1) — 17 PDF pages, all screened. Deed/decision **2010-10-05**; deposit **2010-12-20**. Relevant pages: 1, 2, 3.

Updated GFV statutes following the 5 October 2010 share donation, repeating the 1994 cash formation and whole-business contribution by value. This 17-page file is not the donation instrument and contains no parcel schedule or lease; the separate 29-page donation file includes the executed 2001 lease.

SHA-256: `d2630f5e0566587bd3797a65488bf0b550ad696035e3c40d559bd4c845731938`. Retrieved: 2026-10-08T13:44:49+00:00; 309,382 bytes.

### lgr-lamarche-merger-2019

[Draft merger of SARL Domaine François Lamarche into the GFV (10 May 2019)](https://actes.ccm2.net/acte/b65c4c73-219b-4477-8856-3366b1d8c11b#page=2) — 107 PDF pages, all screened. Deed/decision **2019-05-10**; deposit **2019-05-13**. Relevant pages: 1, 2, 3, 4, 5, 6, 7, 12, 13, 27.

Treaty signed 10 May 2019 for GFV 397738634 to absorb operating SARL Domaine François Lamarche (353336068). Page 5 names Nicole Lamarche personally as tenant under long, nine-year or oral leases made available to the SARL, to continue for the absorbing company. Pages 12–13 distinguish improvements to premises held for use from ownership of immovables; the treaty and accounting annexes contain no AM 1, AM 2 or AM 8 schedule. This is company-level operator evidence deferred to #364.

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

[Nicole Lamarche: 20 June 2019 meeting approving the merger and the transformation into an SAS](https://actes.ccm2.net/acte/04b743c1-1ad1-4ece-9653-bbd60e0db3eb#page=1) — 79 PDF pages, all screened. Deed/decision **2019-06-20**; deposit **2019-07-18**. Relevant pages: 1, 2, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 40, 44, 46, 79.

The 20 June 2019 resolutions complete the SARL absorption with accounting effect from 1 August 2018, transform the GFV into an SAS without a new legal person, rename it Nicole Lamarche and appoint Nicole president. The revised object allows direct farming and farming through leases or mises à disposition. No parcel schedule or executed lease is included in these 79 pages.

SHA-256: `45b1f55919567d3237ee66c3ead97c6e66de62bb407ad96a6ba568a96f08b90b`. Retrieved: 2026-10-08T13:44:51+00:00; 3,265,933 bytes.

### lgr-lamarche-merger-2022

[Draft merger of EARL Nicole Lamarche into SAS Nicole Lamarche (26 January 2022)](https://actes.ccm2.net/acte/b711c226-96b1-42ab-886b-4ca23d7905e6#page=2) — 37 PDF pages, all screened. Deed/decision **2022-01-26**; deposit **2022-02-04**. Relevant pages: 1, 2, 5, 6, 7, 9, 13, 16, 36, 37.

Treaty signed 26 January 2022 for SAS Nicole Lamarche (397738634) to absorb EARL Nicole Lamarche (538257973). Page 9 states that the SAS became direct operator of its own vines after the earlier mergers, the EARL/SAS lease ended on 7 November 2019, and the EARL then ceased harvesting. Pages 13 and 16 record no fixed assets, property origin or existing leases in this contribution. No parcel schedule or lease instrument is included in the 37-page file; the annexes listed on page 36 are not appended. Company-level operation evidence remains deferred to #364, not accepted as current parcel farming.

SHA-256: `63bf876b132305c19f9130241d40f61289202b4a3a410764bff818a8c9ad5990`. Retrieved: 2026-10-08T13:44:52+00:00; 7,546,391 bytes.

### lgr-lamarche-2022

[SAS Nicole Lamarche: completion of the 2022 merger and statutes updated 16 March 2022](https://actes.ccm2.net/acte/fa94508a-c840-47a9-ac70-0352a7b4be0a#page=1) — 35 PDF pages, all screened. Deed/decision **2022-03-16**; deposit **2022-05-03**. Relevant pages: 1, 3, 4, 5, 6, 7, 9, 10, 12, 35.

Resolutions signed 16 March 2022 complete the EARL absorption and capital increase, with accounting effect from 1 August 2021; statutes are updated on the same date. The registry deposit is 3 May 2022. No parcel schedule or lease instrument is included in these 35 pages.

SHA-256: `4ff6805225605383cd11a57bf2f5f94d2bec2044b4d97e31957d6a96f646d1ab`. Retrieved: 2026-10-08T13:44:51+00:00; 1,476,864 bytes.

### lgr-lamarche-merger-2019b

[Draft merger of SARL Domaine François Lamarche into the GFV (second index entry)](https://actes.ccm2.net/acte/150d7cbe-f7c5-4190-81b6-5ec8833c95d7#page=2) — 107 PDF pages, all screened. Deed/decision **2019-05-10**; deposit **2019-05-13**. Relevant pages: 1, 2, 5, 12, 13, 27.

Second registry entry of the 10 May 2019 merger treaty and accounting annexes. Nicole Lamarche is named personally as tenant on page 5; no AM 1, AM 2 or AM 8 schedule is included. Equivalent page images were checked against the first entry; registry covers differ. Operator evidence remains deferred to #364.

SHA-256: `5d00f1ef2059bcc4060e4c844c7d67aba167848e46aa395bf9f00c388b9095d6`. Retrieved: 2026-10-08T16:36:15+00:00; 3,765,632 bytes.

### lgr-lamarche-donation-2010

[GFV Domaine François Lamarche: 2010 share donation with executed 2001 rural lease annexed](https://actes.ccm2.net/acte/252c38f7-043a-4bb9-a698-658b9620ad9c#page=2) — 29 PDF pages, all screened. Deed/decision **2010-10-05**; deposit **2010-12-20**. Relevant pages: 1, 2, 4, 5, 8, 15, 16, 17, 18, 19, 20, 24, 25, 29.

The 4–5 October 2010 share-donation deed reproduces the executed 29 November 2001 rural lease on PDF pages 15–29. GFV Domaine François Lamarche (397738634) is lessor; François Lamarche and Marie-Blanche Cebe, spouse Lamarche, are personal tenants. Page 16 prints Vosne-Romanée AM 1 (14,207 m²), AM 2 (2,096 m²) and AM 8 (222 m²), each matching the current cadastral area. Pages 18–19 recite their 11 August 1994 contribution and publication at Beaune on 21 October 1994, volume 1994P no. 4330. The lease runs from 1 January 2001 to 31 December 2018 (page 19); page 24 authorises mise à disposition to SARL Domaine François Lamarche (353336068), and the donation recital on page 5 says it occurred. Page 25 gives La Grande Rue rent over 1 ha 65 a 25 ca. Historical lease and ownership evidence; operator acceptance is deferred to #364 and current farming remains unverified.

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
| Domaine François Lamarche / Nicole Lamarche | 1.65 ha | are | A November 2022 capture of the domaine’s page gives La Grande Rue, monopole, 1 ha 65 a; AM 1, AM 2 and AM 8, recorded to Nicole Lamarche, measure 16,525 m² together. Winehog (2014) also gives 1.65 ha. Census evidence only; no parcel or farming season is assigned. | [Domaine François Lamarche: La Grande Rue technical sheet (archived 27 November 2022)](https://web.archive.org/web/20221127112203/http://www.domaine-lamarche.com/pages/vins-fiches.php?rub=vins&lang=fr&vin=grande_rue), [Winehog: La Grande Rue – in a Vosne-Romanee sweet spot](https://winehog.org/la-grande-rue-vosne-sweetspot-20242/) |

## Winehog articles

The prior cloud pass reviewed two Winehog subscriber articles supplied as saved webarchives. Both are **not re-verified locally**, at the repository owner’s instruction; the archived bytes, dates, numbers and areas were not independently checked. Each source records the article URL, its printed date (`documentDate`), any later page-metadata modification date, and the SHA-256 and byte count of the original archive; archives and article text are not committed. A printed plot number would count only if number and area both matched the pinned cadastre.

| Article | Printed date | Printed reference | Result |
| --- | --- | --- | --- |
| [La Grande Rue – in a Vosne-Romanee sweet spot](https://winehog.org/la-grande-rue-vosne-sweetspot-20242/) | 2014-06-22 (page modified 2019-08-25) | — | no cadastral number |
| [Terroir Insight: Domaine Lamarche, La Grande Rue “Cuvée 1959”](https://winehog.org/grande-rue-1959-37050/) | 2018-12-09 | — | no cadastral number |

The following are prior cloud findings, not re-verified locally. Both articles give La Grande Rue as 1.65 ha. The 2014 article links its former Gaudichots part to the 1989 grand cru promotion, the 2018 article to a 1959 exchange of plots with the DRC. The 2018 article’s 0.2318 ha equals AM 2 + AM 8 (2,096 + 222 m²), the two parcels without a La Grande Rue lieu-dit, but no number is printed, so equal area is not a crosswalk and no lead, filing or census figure changes.

## Remaining gaps

- Local audit: all 17 PDFs in the recorded free-index inventory, 591 pages, were freshly downloaded and read in full; every PDF hash, byte count and page count matches. One file reproduces the executed 2001 lease with exact AM 1, AM 2 and AM 8 schedules; the other 16 contain no qualifying current-reference schedule.
- The original 11 August 1994 contribution instrument is not included among the reviewed files. The 2001 lease annexed to the 2010 donation identifies AM 1, AM 2 and AM 8 and cites publication at Beaune on 21 October 1994, volume 1994P no. 4330. It is not an unfiled deed: a separate original SPF copy remains Tier 3.
- The 2001 mandate, executed lease, 2010 mise à disposition recital, 2019 treaty naming Nicole Lamarche personally as tenant, and 2022 account of direct SAS operation are distinct evidence. The 2022 treaty says the EARL/SAS lease ended on 7 November 2019, but includes no parcel schedule or termination instrument. With the repository owner’s approval, operator acceptance is deferred to #364 and verified farming remains 0.
- The published 1 ha 65 a was rechecked in the November 2022 Internet Archive capture. The prior observation of unrelated content on the current domaine domain was not rechecked locally.
- Local audit 2026-10-09 retried data.inpi.fr and pappers.fr for SIREN 397738634; both returned HTTP 403. Records available only there remain unverified.
- Both Winehog archives are not re-verified locally, at the repository owner’s instruction. Original URLs, dates and archive hashes remain as prior cloud evidence. The prior 0.2318 ha comparison with AM 2 + AM 8 is area-only, not a cadastral crosswalk; the exact legal matches come from the lease schedule.
- Source boundaries, failed notice downloads and unsearched historical intervals remain in the Tier 1 coverage. Current farming remains unconfirmed for all three parcels; paid SPF copies and outreach remain Tier 3.

## Local audit (Codex CLI, Windows, Python 3.12)

On 9 October 2026, all 17 PDFs / 591 pages were freshly downloaded and read in full; all hashes, byte counts and page counts match. Embedded text and RapidOCR/DirectML at 150 dpi supported reading. Pixel-identical pages were reused only after full reading of the matching page. The cadastral schedules, lease term, signatures and low-text pages were checked as images. Original acquisition metadata above is retained.

The prior claim of no parcel list was incorrect: the 2010 donation includes the executed 2001 lease. Three exact parcel matches are now recorded, with owner, personal tenants and operating SARL kept distinct. Operator acceptance remains deferred to #364 with the owner’s approval. The API and archived estate HTML changed bytes but their identity/area findings remain supported; fresh estate metadata is in curation.json. The API recheck returned 3,209 bytes, SHA-256 `7b4089107e36f85d54aba5df6771cd8a2d39d73ccff3dd7306a796ee3f8bb370`, at 2026-10-09T03:39:18.209290+00:00; shared holder-source metadata remains unchanged. INPI/Pappers both returned 403. Two Winehog archives are not re-verified locally.

Checks and remaining platform exceptions are recorded in [README](README.md#local-audit-codex-cli-windows-python-312).

The [free filing index](https://entreprises.lefigaro.fr/nicole-lamarche-21/entreprise-397738634) was rechecked at 2026-10-09T04:57:42.523645+00:00: HTTP 200, 132,906 bytes, SHA-256 `e8c8331dd61c3a7ee488ec2bbbd1803a58cfd0ee85910149eee3110c5caaa662`. Its documents section displays the same 17 entries and filing dates. This bounds the filing inventory; it is not a claim to have reviewed every annual account.
