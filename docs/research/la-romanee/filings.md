# La Romanée: public company filings

Reviewed 8 October 2026 for [Tier 2 issue #428](https://github.com/gary29024/winelogdb/issues/428), following the Richebourg (#530), Romanée-Saint-Vivant (#426) and Romanée-Conti (#427) passes. The one recorded holder identifier, `U14132333` (SCI DU CHATEAU DE VOSNE ROMANEE), and the domaine company named on the estate’s publications were searched in the official company API and the free entreprises.lefigaro.fr index. PDFs were downloaded from actes.ccm2.net; no paid land-register copies or outreach were used. The local retry of data.inpi.fr and pappers.fr also returned HTTP 403; records available only there remain unverified.

Each of the **17 files / 518 pages** was processed with PyMuPDF embedded-text extraction; every image page was then rendered at **150 dpi** and screened with RapidOCR (ONNX Runtime, CPU, `use_cls=False`). The cited schedule was checked against the page image. A negative means no qualifying La Romanée match in these selected files, not that no such document exists.

Dates separate the deed/decision (`documentDate`) from its deposit (`filingDate`). Page numbers are PDF pages, including registry covers. Every source records the original URL, raw-byte SHA-256, byte count, retrieval time and page count in [curation](curation.json) or the [shared holder table](../holders/holder-links.json). PDFs, OCR text, article archives and full article text are not committed.

## Identity of the recorded holder

The rights file records AN 74 to `U14132333` under the name SCI DU CHATEAU DE VOSNE ROMANEE. That company registered in 2002 as RCS Beaune 408280667, constituted on 3 July 1967; its registration filing’s statutes contribute AN 74 with the recorded area, and a 2003 notarial deed turned it into a GFA renamed Groupement Foncier Viticole du Château de Vosne-Romanée under the same number. The shared table records the crosswalk `U14132333` → 408280667 with these sources; the rights file keeps the provisional identifier.

## Exact references

2 filing entries cover **1 current parcel**. In each, the printed reference and individual area agree with the pinned `cadastreAreaM2`, and the filing company is the recorded holder. Neither establishes the current farming season.

| Filing | Deed date / deposit | Exact current references and areas | Lease treatment |
| --- | --- | --- | --- |
| [SCI du Château de Vosne-Romanée: 1967 contribution of AN 74](https://actes.ccm2.net/acte/220fc960-bd3d-4aad-9e64-e20b114d13db#page=11) (pp. 11) | 1998-12-15 / 2002-10-15 | AN74: 8,452 m² | No parcel-specific lease identified. |
| [GFV du Château de Vosne-Romanée: 2021 lease schedule of AN 74](https://actes.ccm2.net/acte/d2d4586d-aea6-4028-b051-308c58b0041f#page=11) (pp. 11, 13, 23, 25) | 2021-04-14 / 2021-06-15 | AN74: 8,452 m² | Scheduled with AN 74 in the 2021 deed; 18 years to 1 November 2019, tacitly renewable by nine-year periods. The deed warrants the leases valid on 14 April 2021; the lease instrument itself is not included in this reviewed PDF. The deed states that the tenant in place makes the leased land, except that added in 2005, available to this company with the lessor’s authorisation, and that rents are paid by the tenant or this company. A dated recital, not a verified current farming season; flagged for #364. |

## Holder link

`family-holding` to Domaine du Comte Liger-Belair, **reviewed**: GFV du Château de Vosne-Romanée (408280667) and SCEA Domaine du Comte Liger-Belair (429010846) share the Château seat and two partners, and CLB Participations, a partner and manager of the SCEA, was GFV co-manager from 2019 to 2023. The GFV’s 2021 deed schedules AN 74 under a 2001 métayage to one of those partners and states that the leased land is made available to the SCEA with the lessor’s authorisation.

## Effort and holder findings

| Recorded holder | Filings | Pages | Outcome |
| --- | ---: | ---: | --- |
| GFV du Château de Vosne-Romanée (`U14132333`) | 17 | 518 | Company filings match U14132333 to GFV du Château de Vosne-Romanée (408280667): its statutes contribute AN74 and its 2021 deed lists AN74 under a 2001 métayage to a partner, with the land made available to SCEA Domaine du Comte Liger-Belair. Dated recital only; farming unverified. |

Counts include the linked SCEA’s filings, which were screened for this holder.

## Inventory of screened filings

### chateau-vosne-statutes-1998

[SCI du Château de Vosne-Romanée: statutes updated after the 15 December 1998 meeting (registration filing, 2002)](https://actes.ccm2.net/acte/220fc960-bd3d-4aad-9e64-e20b114d13db#page=11) — 38 PDF pages, all screened. Deed/decision **1998-12-15**; deposit **2002-10-15**. Relevant pages: 1, 9, 11, 12.

Deposited when the company, constituted on 3 July 1967, was registered as RCS Beaune 408 280 667, with 1991 minutes. Article six of the statutes updated after the 15 December 1998 meeting reproduces the 1967 contributions, including a vine at Vosne-Romanée, section AN no. 74, 84 a 52 ca, its lieu-dit corrected in the margin to “La Romanée” (page image checked). The object is ownership and letting; no tenant is named.

SHA-256: `7227f01bde677ceba5162c815ceef61d9066039346ce4c0594b25b2327aa40f7`. Retrieved: 2026-10-08T13:44:44+00:00; 1,486,995 bytes.

### chateau-vosne-gfa-2003

[GFV du Château de Vosne-Romanée: 8 September 2003 notarial transformation of the SCI into a GFA](https://actes.ccm2.net/acte/235abaa2-bbc1-4741-8157-a90eda8808c7#page=1) — 26 PDF pages, all screened. Deed/decision **2003-09-08**; deposit **2003-10-22**. Relevant pages: 1, 2, 3, 4, 5.

Notarial minutes of the partners of the Société Civile du Château de Vosne-Romanée (RCS 408 280 667) turn it into a GFA named Groupement Foncier Viticole du Château de Vosne-Romanée and extend its term by 50 years. They recite three long leases granted by the company to one of its partners: a bail à ferme and a métayage, both from 3 January 2000 to 3 January 2018, and a métayage from 1 November 2001 to 1 November 2019, so that the company does not farm directly. No parcel list is given for the leases; article six summarises the 1967 contributions by value only.

SHA-256: `48d3d8fbc3f340668e79ad26b5de97126a12fc5cf71424d24fc294ad63ee149c`. Retrieved: 2026-10-08T13:44:44+00:00; 875,456 bytes.

### chateau-vosne-donation-2019

[GFV du Château de Vosne-Romanée: 27 December 2019 notarial donation-partage (filed 2020)](https://actes.ccm2.net/acte/cc85d2d5-cb9c-4c56-8d2c-2705ea1782da#page=1) — 50 PDF pages, all screened. Deed/decision **2019-12-27**; deposit **2020-06-03**. Relevant pages: 1, 3, 5, 6, 7, 15, 16.

Donation-partage of the bare ownership of shares in CLB Participations (480929355), the GFV du Château de Vosne-Romanée and SCEA Domaine du Comte Liger-Belair (429010846). The deed describes the GFV as then managed by its gérante and by CLB Participations, which the register lists as a partner and manager of the SCEA. No parcel schedule or lease.

SHA-256: `23fb72688d82301f98b636fe90a596f21138ef4aebfa18efa7d526262e8f2a72`. Retrieved: 2026-10-08T13:44:46+00:00; 2,682,713 bytes.

### chateau-vosne-2021

[GFV du Château de Vosne-Romanée: 14 April 2021 share sale with lease schedule and same-day meeting](https://actes.ccm2.net/acte/d2d4586d-aea6-4028-b051-308c58b0041f#page=1) — 81 PDF pages, all screened. Deed/decision **2021-04-14**; deposit **2021-06-15**. Relevant pages: 1, 3, 4, 11, 13, 20, 22, 23, 25, 27, 45.

Notarial sale of bare-ownership parts (with SAFER substitution) and the same day’s meeting. The deed describes the GFV’s estate (3 ha 61 a 71 ca in use: 1 ha 54 a 11 ca under métayage, 2 ha 07 a 60 ca under fermage) and schedules its leases to a partner. The 8 November 2001 métayage names AN 74, La Romanée, 84 a 52 ca (page image checked), for 18 years from 1 November 2001, tacitly renewable by nine-year periods. The deed states that the leased land, except that added in 2005, is made available by the tenant to Domaine du Comte Liger-Belair with the lessor’s authorisation, that rents are paid by the tenant or that domaine, and that the leases are valid at its date.

SHA-256: `4b45dab8e46fac8f3ab12cc25713b999d161120dbfb9ac534596fbe52e012882`. Retrieved: 2026-10-08T13:44:47+00:00; 2,677,301 bytes.

### lr-chateau-2005

[GFV du Château de Vosne-Romanée: 9 February 2005 share transfer and donation, updated statutes](https://actes.ccm2.net/acte/4effdc7b-ad44-4370-81d8-2f4fda70d09e#page=1) — 43 PDF pages, all screened. Deed/decision **2005-02-09**; deposit **2005-06-02**. Relevant pages: 1, 2, 4.

Notarial share transfer and donation-partage of shares, with updated statutes whose history recites the 1967 constitution as SCI du Château de Vosne-Romanée and the 2003 transformation into the GFV (RCS 408 280 667). The statutes require long-term letting; no parcel schedule or tenant.

SHA-256: `b2f9fcab47e92eb268e653aa91c104e9875e3d56babf102fa0d425be6ae651c4`. Retrieved: 2026-10-08T13:44:45+00:00; 1,336,154 bytes.

### lr-chateau-2005-10

[GFV du Château de Vosne-Romanée: 31 October 2005 share donations and meeting (filed 2007)](https://actes.ccm2.net/acte/86decfe8-f0e5-492e-9bb1-05970b3aa367#page=1) — 55 PDF pages, all screened. Deed/decision **2005-10-31**; deposit **2007-02-15**. Relevant pages: 1, 2, 16, 17, 18, 19, 28.

Share donations and the same day’s meeting amending the capital article, with updated statutes. PDF pages 16–17 recite three long leases to Louis Michel BOCQUILLON LIGER-BELAIR and the 31 October 2005 building amendment; these are recitals, not the lease instruments. Pages 18–19 schedule a Vosne residential parcel (AL 88, 186 m²) and property in Orbey and Strasbourg, outside La Romanée. No La Romanée cadastral reference is identified. The recital of the 8 November 2001 métayage prints a 3 January 2000–3 January 2018 term, inconsistent with the 1 November 2001–1 November 2019 term in the 2003 and 2021 filings; the discrepancy is retained, not used to change the AN 74 record.

SHA-256: `f94dc398cea3cf5259e68b75eb232fb8f29f395c24cb0c19b3b0821f450bd0e0`. Retrieved: 2026-10-08T13:44:45+00:00; 1,853,962 bytes.

### lr-chateau-2016

[GFV du Château de Vosne-Romanée: 28 April 2016 meeting after a partner’s succession](https://actes.ccm2.net/acte/83c4ca58-2490-442e-8f70-fd172b06069e#page=1) — 25 PDF pages, all screened. Deed/decision **2016-04-28**; deposit **2016-07-07**. Relevant pages: 1, 2, 3, 4.

Meeting amending the capital article after a partner’s succession, with updated statutes. No parcel schedule or lease.

SHA-256: `3de629d122150ecb5cb76fc1e7847926486cfe9b1565c5c09610315c7c9650a1`. Retrieved: 2026-10-08T13:44:46+00:00; 1,309,369 bytes.

### lr-chateau-2019

[GFV du Château de Vosne-Romanée: 3 May 2019 meeting appointing a corporate co-manager](https://actes.ccm2.net/acte/609230a2-bfdc-49e4-8be1-0656ea08b5be#page=1) — 25 PDF pages, all screened. Deed/decision **2019-05-03**; deposit **2019-07-29**. Relevant pages: 1, 2, 3.

Meeting appointing CLB Participations co-manager and amending voting rules, with updated statutes. No parcel schedule or lease.

SHA-256: `1b750080791f368f1040cd06b227d96f2305d3b720e926f55c4acda92a45d802`. Retrieved: 2026-10-08T13:44:46+00:00; 875,656 bytes.

### lr-chateau-2020

[GFV du Château de Vosne-Romanée: 3 June 2020 meeting rectifying the statutes](https://actes.ccm2.net/acte/d76ae7ee-a00c-422d-b768-eac46ba489f5#page=1) — 23 PDF pages, all screened. Deed/decision **2020-06-03**; deposit **2020-06-11**. Relevant pages: 1, 2, 3, 4.

Meeting rectifying the capital article omitted after the December 2019 donation-partage. No parcel schedule or lease.

SHA-256: `8527f84e32ddca1808e4678ef7e6cb2029aefe3c937d42e50a05176821ad53b1`. Retrieved: 2026-10-08T13:44:47+00:00; 1,203,875 bytes.

### lr-chateau-2008

[GFV du Château de Vosne-Romanée: 30 June 2008 meeting after a partner’s departure (filed 2009)](https://actes.ccm2.net/acte/f7ca432e-318f-4297-b0af-1d38aadb496d#page=1) — 24 PDF pages, all screened. Deed/decision **2008-06-30**; deposit **2009-03-17**. Relevant pages: 1, 2, 3, 4, 20.

Meeting amending the capital article after a partner’s death in 2007. It recalls the existing voting rules for split ownership; it does not amend those rules. No parcel schedule or lease.

SHA-256: `05b5cc25f2e0b676f2ceee76e0a7a79e5159b2f5630ea3f46f231f263c0b4b92`. Retrieved: 2026-10-08T16:12:47+00:00; 753,163 bytes.

### lr-chateau-2019-12

[GFV du Château de Vosne-Romanée: 20 December 2019 meeting appointing a co-manager](https://actes.ccm2.net/acte/169ed24b-afb3-42b9-bfaa-91da9366cc16#page=1) — 6 PDF pages, all screened. Deed/decision **2019-12-20**; deposit **2019-12-23**. Relevant pages: 1, 2, 4, 5.

Meeting appointing Louis-Michel BOCQUILLON LIGER-BELAIR co-manager alongside Anne BOCQUILLON LIGER-BELAIR and CLB Participations; the appointment is on PDF page 4, with signatures on page 5. No parcel schedule or lease.

SHA-256: `0bc4f6579a49c3825bf3596aa2d04445f5dee91c3f0e96be6862f73089f0724b`. Retrieved: 2026-10-08T16:12:30+00:00; 146,961 bytes.

### lr-chateau-2022

[GFV du Château de Vosne-Romanée: 23 March 2022 meeting on a co-manager’s resignation](https://actes.ccm2.net/acte/34c226bb-2222-4ece-8180-48594f61478b#page=1) — 5 PDF pages, all screened. Deed/decision **2022-03-23**; deposit **2022-07-13**. Relevant pages: 1, 3, 4, 5.

Meeting noting Louis-Michel BOCQUILLON LIGER-BELAIR’s resignation effective 23 March 2022 (PDF page 4); Anne BOCQUILLON LIGER-BELAIR and CLB Participations remain from 24 March. No parcel schedule or lease.

SHA-256: `8349afeedfdced554acca75df1c83e91f45abb6ed97bdb7dbcec06e53d6328a3`. Retrieved: 2026-10-08T16:11:58+00:00; 151,830 bytes.

### lr-chateau-2023

[GFV du Château de Vosne-Romanée: 3 June 2023 meeting on CLB Participations’ resignation (filed 2024)](https://actes.ccm2.net/acte/9b46ec23-53fc-45a6-911e-42f97224e308#page=1) — 4 PDF pages, all screened. Deed/decision **2023-06-03**; deposit **2024-09-23**. Relevant pages: 1, 2, 3.

Meeting noting CLB Participations’ resignation as co-manager effective 3 June 2023, leaving Anne BOCQUILLON LIGER-BELAIR as sole manager from 4 June. No parcel schedule or lease.

SHA-256: `b506f33f30f8b8dae582dbcd6eb51f592d8dd92964d68eafba9300c9043eb8ee`. Retrieved: 2026-10-08T16:12:14+00:00; 225,516 bytes.

### lr-dclb-2005

[EARL Domaine du Comte Liger-Belair: 6 January 2005 change of name and updated statutes](https://actes.ccm2.net/acte/23672810#page=1) — 29 PDF pages, all screened. Deed/decision **2005-01-06**; deposit **2005-03-16**. Relevant pages: 1, 2, 4, 6.

Sole-partner decisions renaming the EARL Domaine du Vicomte Liger-Belair (429010846) as Domaine du Comte Liger-Belair, with updated statutes whose object includes taking land on lease and farming land its partners rent or own. No parcel, lease or lessor is named.

SHA-256: `60f52a52c2761d8a0e31bed91df5b5934fecd366b8067bb870d4dc7e08f74410`. Retrieved: 2026-10-08T13:44:47+00:00; 850,429 bytes.

### lr-dclb-2018

[Domaine du Comte Liger-Belair: 1 February 2018 transformation of the EARL into an SCEA](https://actes.ccm2.net/acte/23672812#page=1) — 31 PDF pages, all screened. Deed/decision **2018-02-01**; deposit **2018-03-23**. Relevant pages: 1, 2, 3, 4, 5, 6.

Sole-partner decisions turning the EARL into a société civile d’exploitation agricole, with the same farming object. No parcel, lease or lessor is named.

SHA-256: `48e59197547058047c39592623fcb8e20008d8737753ef35b872ab17db79aa76`. Retrieved: 2026-10-08T13:44:48+00:00; 1,440,723 bytes.

### lr-dclb-2023

[SCEA Domaine du Comte Liger-Belair: 11 January 2023 extraordinary meeting and updated statutes](https://actes.ccm2.net/acte/3156367#page=1) — 30 PDF pages, all screened. Deed/decision **2023-01-11**; deposit **2023-06-13**. Relevant pages: 1, 2, 3, 4, 6, 12.

Meeting changing how partners share profits and losses. The partners are Henry and Louis-Michel BOCQUILLON LIGER-BELAIR, CLB Participations, and SAS Bouchon Pourpre (one share); the prior summary omitted the last partner. No parcel, lease instrument or named lessor is identified.

SHA-256: `41a9fd29d3c74282aae10bf0602e50d6e3ce7813c32c5f106bb45505cde903db`. Retrieved: 2026-10-08T13:44:48+00:00; 1,975,481 bytes.

### lr-dclb-2025

[SCEA Domaine du Comte Liger-Belair: statutes updated after the 30 September 2025 meeting](https://actes.ccm2.net/acte/40100996#page=1) — 23 PDF pages, all screened. Deed/decision **2025-09-30**; deposit **2026-07-23**. Relevant pages: 1, 2, 3, 5.

Updated statutes recalling the EARL’s 7 January 2000 formation and 2018 transformation; the agricultural object is unchanged. Article 8 assigns 3,900 shares to CLB Participations, alongside the two family partners. No parcel, lease instrument or named lessor is identified.

SHA-256: `9cd886606660181402e7efb43c50d8ef34d77e4cf38b14e18e30d059d8e4fece`. Retrieved: 2026-10-08T13:44:48+00:00; 3,676,108 bytes.

## Published holdings

One producer holding is retained only in the named-area census; it names the whole cru, never a parcel. An equal area never assigns a holding to a parcel.

| Producer | Published area | Precision | Finding | Sources |
| --- | --- | --- | --- | --- |
| Domaine du Comte Liger-Belair | 0.8452 ha | square-metre | Undated climat page gives La Romanée, monopole, 0.8452 ha, equal to AN 74’s cadastral area; the history page says the domaine took it into operation in 2002. Undated producer publication: census evidence only, not a verified farming season. | [Domaine du Comte Liger-Belair: Our climats](https://www.liger-belair.fr/en/our-climats/), [Domaine du Comte Liger-Belair: history of the domaine](https://www.liger-belair.fr/histoire-du-domaine-du-comte-liger-belair/), [Domaine du Comte Liger-Belair: legal notice](https://www.liger-belair.fr/mentions-legales/) |

## Winehog articles

The prior cloud pass reviewed all 4 requested Winehog subscriber articles as saved webarchives supplied by the repository owner. Local audit: **not re-verified locally**, at the owner’s instruction; the archived bytes, printed dates, numbers and areas were not independently checked. Each source records the article URL, its printed date (`documentDate`), any later page-metadata modification date, and the SHA-256 and byte count of the original archive; archives and article text are not committed. A printed plot number would count only if number and area both matched the pinned cadastre.

| Article | Printed date | Printed reference | Result |
| --- | --- | --- | --- |
| [200 years, 72 bottles of Domaine du Comte Liger-Belair](https://winehog.org/200-years-72-bottles-of-domaine-du-comte-liger-belair-23767/) | 2015-06-12 (page modified 2015-06-14) | — | no cadastral number |
| [The Essence of La Romanee](https://winehog.org/the-essence-of-la-romanee-23847/) | 2015-06-20 (page modified 2017-10-01) | — | no cadastral number |
| [La Romanée – a hedonistic treat](https://winehog.org/on-the-table-in-la-romanee-2008-2-42558/) | 2020-08-05 (page modified 2020-12-03) | — | no cadastral number |
| [A 1928 La Romanée From the Legendary La Rôtisserie de la Reine Pédauque](https://winehog.org/a-1928-la-romanee-from-the-legendary-la-rotisserie-de-la-reine-pedauque-74420/) | 2026-06-10 | — | no cadastral number |

The following are prior cloud findings, not re-verified locally. Three articles are tasting reports on the domaine’s wine. The 1928 bottle history gives La Romanée as a 0.85 ha monopole; that rounded total is not a parcel crosswalk and changes no lead, filing or census figure.

## Remaining gaps

- Bounded filing review: 17 filings (518 pages) were screened — 13 of the 13 filings the free index lists for the GFV and 4 of the 9 for the SCEA. Unscreened filings are a bounded negative.
- `U14132333` is matched to RCS 408280667 by the rights file’s name, the company’s 2002 registration filing (whose statutes contribute AN 74 with its exact area) and the 2003 renaming deed; the 2019 MAJIC code PBCLPZ stays an unprovable identifier change in the rights file.
- The 2001 métayage over AN 74 is held by a partner personally; the 2021 deed states it is tacitly renewed and valid and that the land is made available to SCEA Domaine du Comte Liger-Belair. That dated recital (14 April 2021) is flagged for #364 as a candidate verified-operator record; it is not a current farming season, and verified farming stays 0. The lease deed and any later change are unreviewed.
- CLB Participations was GFV co-manager from 3 May 2019 until its resignation effective 3 June 2023; Anne is sole manager from 4 June. The reviewed records support shared family partners and seat, not a current shared manager.
- The domaine’s pages are undated producer publications. They give La Romanée’s area and a 2002 start of operation; they stay census evidence.
- Local audit 2026-10-09 retried data.inpi.fr and pappers.fr for SIRENs 408280667 and 429010846; all four requests returned HTTP 403. Records available only there remain unverified. The free index independently confirms the 23 September 2024 and 23 July 2026 deposits for the PDFs without registry covers.
- All four Winehog archives are not re-verified locally, at the repository owner’s instruction. Original URLs, dates and archive hashes are retained as prior cloud evidence. The prior findings of no cadastral reference and a rounded 0.85 ha cru total were not independently checked locally.
- Source boundaries, failed notice downloads and unsearched historical intervals remain in the Tier 1 coverage. Current farming remains unconfirmed; paid SPF copies and outreach remain Tier 3.

## Local audit (Codex CLI, Windows, Python 3.12)

On 9 October 2026, all 17 PDFs / 518 pages were freshly downloaded and read in full. All 17 SHA-256 hashes, byte counts and page counts match. Embedded text and RapidOCR with DirectML at 150 dpi supported the reading; the AN 74 schedules, the 2005 property schedules and low-text pages were checked as images. Original acquisition metadata above is retained.

The 2005 blanket negative was corrected to distinguish lease recitals and non-cru properties; its conflicting 2001 lease term is preserved. Management dates, actual resolution pages and the omitted Bouchon Pourpre partner were corrected. Three estate HTML responses changed bytes: area/history remain supported; the legal notice identifies a SAS publisher, not SCEA 429010846. Both company API responses match the recorded bytes. Two free-index pages confirm the coverless PDFs’ filing dates. INPI/Pappers retries failed with HTTP 403; four Winehog archives are not re-verified locally.

The 2021 deed’s PDF page 45 recites a 15 September 2006 supply agreement with SARL COMTE LIGER BELAIR for the GFV’s harvest share of La Romanée and Aux Reignots (2006–2015, tacit renewal). This is a commercial supply recital, distinct from the SCEA mise à disposition on page 25; the underlying supply and lease instruments are not included in this 81-page PDF. The page 27 SAFER undertaking is an obligation, not proof of later performance. The dated 2021 operator candidate remains deferred to #364 with the repository owner’s approval; verified farming remains 0.

Checks and remaining platform exceptions are recorded in [README](README.md#local-audit-codex-cli-windows-python-312).
