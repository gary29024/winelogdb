# Clos des Lambrays Tier 2 filing and source review

Reviewed 9 October 2026 for #434. All page numbers are one-based PDF pages. Every selected PDF page was OCR-screened at 150 dpi with RapidOCR and DirectML before recording negative findings. Exact filing evidence requires the recorded holder, current reference and individual area. None of the selected filings meets that three-part test. Raw sources stay outside Git.

## Selected filings

| Source / SIREN | Document / deposit date | Pages screened / cited | Finding |
| --- | --- | ---: | --- |
| [cl-lambrays-1996](https://actes.ccm2.net/acte/5356165) / 410725691 | 1996-12-11 / 1997-01-31 | 9 / 1, 2, 3, 4, 9 | Cash formation of Societe Nouvelle du Domaine des Lambrays. The object names acquisition and wine production at Clos des Lambrays, but no individual cadastral property schedule. The handwritten 11 December 1996 signature date and registry cover agree; January 1997 is the deposit. |
| [cl-lambrays-2004](https://actes.ccm2.net/acte/5356160) / 410725691 | 2004-05-24 / 2004-06-28 | 10 / 1, 2, 3, 5, 6 | The assembly removes Nouvelle from the company name, retaining SIREN 410725691, and recalls the earlier asset acquisition from a separate old company. No individual cadastral schedule or new parcel transfer. |
| [cl-lambrays-2005](https://actes.ccm2.net/acte/5356167) / 410725691 | 2005-07-28 / 2005-08-12 | 9 / 1, 2, 3, 5, 6, 7 | Civil-company to SARL conversion effective 1 August 2005, with capital changes and generic authority for real-estate and lease transactions. No individually identified current property schedule or executed parcel lease. |
| [cl-lambrays-2014](https://actes.ccm2.net/acte/5356214) / 410725691 | 2014-04-14 / 2014-06-11 | 18 / 1, 3, 6, 8, 10, 11, 13, 18 | Share acquisition by LVMH Finance 380097881, followed by the 17 April sole-shareholder decisions. Annex 6 is described as property titles and cadastral extracts, but is not present in the downloaded 18-page filing. Corporate share ownership does not supply exact parcel evidence. |
| [cl-lambrays-2018](https://actes.ccm2.net/acte/5356169) / 410725691 | 2018-04-30 / 2018-06-01 | 15 / 1, 2, 4, 5, 6 | The sole shareholder converts the company into a SAS without a new legal person; the object explicitly names the Clos des Lambrays wine estate. No individual current cadastral schedule or parcel tenancy evidence. |
| [cl-lambrays-2021](https://actes.ccm2.net/acte/5356127) / 410725691 | 2021-02-01 / 2021-03-05 | 14 / 1, 2, 3, 4, 5 | Updated wine-company objects extend geographic scope and trading activity. The exact SIREN and denomination support the company identity; generic objects do not prove present parcel operation. |
| [cl-merme-1997](https://actes.ccm2.net/acte/fb2a43b3-b470-4091-8972-4f5aeac1d18c) / 778237206 | 1997-05-21 / 1997-06-12 | 19 / 1, 2, 3, 4, 5, 6, 19 | The deed identifies the old Societe Civile d Exploitation du Domaine Merme Morizot, SIREN 778237206, and explicitly converts it into the non-operating GFA Merme Morizot. It recites existing long-term rural leases but names no tenant, parcel references or individual areas. No Taupenot-Merme producer link inferred from shareholders. |
| [cl-merme-1994](https://actes.ccm2.net/acte/df6d09bc-9d5c-4940-87af-ad457ea342ea) / 778237206 | 1994-01-25 / 1994-03-14 | 20 / 1, 3, 4, 13, 15, 16, 17, 19 | Share transfer and retained historical statutes identify Societe Civile d Exploitation Merme Morizot and SIREN 778237206. No AP96/103/104 individual schedule or independently identified tenant appears in the selected filing. |
| [cl-sci-candidate-2008](https://actes.ccm2.net/acte/07c94d3a-939a-46d1-a6e2-a7d391ac7e75) / 505373852 | 2008-07-21 / 2008-07-23 | 14 / 1, 3, 4, 13, 14 | Rennes SCI 21-23 is a same-name candidate only. Cash formation and generic property-management objects contain no Morey AP178/180/182 schedule, former local identity or wine-producer relation. Signatures are dated 16 and 21 July 2008; the last date is retained. |
| [cl-sci-candidate-2018](https://actes.ccm2.net/acte/27aa7d26-d780-4529-b3e6-11c1139be06d) / 505373852 | 2018-05-26 / 2019-05-29 | 20 / 1, 3, 4, 5, 6, 8, 9, 10, 19, 20 | Voting and financial-rights changes signed 19 and 26 May 2018, deposited 29 May 2019. The free index calls the decisions 2019, contrary to the signed pages and statute cover. No exact Morey parcel identity or producer relationship; the Rennes company is not equated with the U-id. |

**Total: 10 PDFs / 148 pages**, covering formation, company-name changes, conversions, share acquisitions and recent statutes. This is not a claim to have reviewed every deposited document. SHA-256, byte count, page count and complete OCR-page coverage were checked for every selected file. The missing 2014 Annex 6 remains an access gap.

## Original-byte provenance

| Source | Bytes | SHA-256 |
| --- | ---: | --- |
| cl-lambrays-1996 | 213,965 | `cc3c9dd32c6f0da14c0aac127aa51751c6a59bd258c3fb931e5f6102bd4c7b43` |
| cl-lambrays-2004 | 219,552 | `b04848e667bb780aee4687bd397d686ddca8e67a5e4bd184a73c5d87b2170491` |
| cl-lambrays-2005 | 190,756 | `9c11863ebfab3c280430c1e3eaf2e5cbd42dc532e4f552043f683739d3a7758c` |
| cl-lambrays-2014 | 414,052 | `0cb4ebee72187800f360ce076c5e8d463761930a5ef809c4ec4cbedebf4af0a5` |
| cl-lambrays-2018 | 5,633,021 | `f7f86c491d9955f0bd8533c64449ab479dee30ae6c6605434bf494109bb3e7b8` |
| cl-lambrays-2021 | 795,808 | `60c09517f47c0ea3e4405b5904e850c5b0b35d5acb00a43c77d2644bbe54e666` |
| cl-merme-1997 | 580,468 | `3c3945685f71f0bade3a1387af8d57b51a189a64cb1ddc5bb4cc6d5ae5eb9cce` |
| cl-merme-1994 | 727,363 | `4ed007e3a68bf151388a1dfbe809764b72fd335ff84bfb13f9bcb235736d6e77` |
| cl-sci-candidate-2008 | 392,402 | `fb2e3753411c53bab4cce12c529b9f8aa46fd571712727426c48af9003a134ae` |
| cl-sci-candidate-2018 | 665,404 | `ff76d157afcf42df73d964a6cc91b7053d70bac4436e0fe7fa4a5d26f3e96c8d` |

## Holder coverage

| Holder | Parcels | Filing effort | Finding |
| --- | ---: | --- | --- |
| 410725691 | 8 | 6 filings / 75 pages | The registered wine company, filed 2004 name change and 2018/2021 statutes establish Domaine des Lambrays corporate identity. The 2014 acquisition concerns company shares. Its referenced property annex is missing from the downloaded filing; no exact individual parcel schedule located. |
| U21078600 | 3 | 2 filings / 39 pages | The filed 1994 identity and explicit 1997 conversion crosswalk the recorded old Societe Civile d Exploitation Merme-Morizot to GFA Merme Morizot 778237206. The conversion recites long-term leases without identifying tenants or individual parcels. Shared Taupenot names do not establish a producer link. |
| U21465754 | 3 | 2 filings / 34 pages | Exact-name and local registry searches yielded Rennes SCI 21-23 as a candidate, but no company-record crosswalk to the three Morey parcels. Its formation and later statutes provide no exact references or areas. The local department-filter hit is a differently named company at a 21-23 street address, not this identity. No SIREN or producer link assigned. |

## Critic and public sources

| Source | Publication date | Original-byte SHA-256 | Finding |
| --- | --- | --- | --- |
| [Domaine des Lambrays: Le Clos des Lambrays](https://www.lambrays.com/en/le-clos-des-lambrays/) | undated | `c0feec286f61a24892837332c215723ca6ca72a80d94d901c8397db372160a35` | The undated estate page publishes 8.66 ha owned across the three named areas. A named-area census only, without individual parcel allocation. |
| [LVMH: Domaine des Lambrays](https://www.lvmh.com/en/our-maisons/wines-spirits/domaine-des-lambrays) | undated | `f0ac40dfae0ed3797cd5fc3201a666ff0825f197c1dac05de499b3a2645bd408` | The group page identifies the estate and dates its acquisition to 2014. Company-group context, not an exact parcel schedule or present operation finding. |
| [Winehog: Clos des Lambrays – Monopole or not? – update](https://winehog.org/clos-des-lambrays-close-monopole-19659/) | 2014-04-21 | `ba7d75b125a4e3d3d1174ead69238bf8972d65b0781252ece1e668c7bcc091bc` | The 2014 article reports a 420 m2 Taupenot-Merme holding in Meix Rentier without an individual numbered reference. Its garden map labels 99/181/182 without individual areas; the suggested descent from 100 is speculative. No current parcel match is made. |

The supplied Winehog MHTML and all four maps were read; no continuation is missing from this article. Its 420 m² value remains a dated census. AP104 is not matched from image position or rounded area. Public estate pages were downloaded directly. The article's 8.8394 ha is the entire cru, not a new holding assigned to one producer.

## Remaining limits

- Source boundaries, failed notice downloads and unsearched intervals are reported in the history coverage; none means no historical record.
- Current farming remains unconfirmed for every parcel.
- Ten selected public company filings (148 pages) were fully OCR-screened at 150 dpi with RapidOCR and DirectML before negative findings. Six Domaine des Lambrays filings cover 75 pages, two Merme-Morizot filings 39 pages, and two Rennes SCI candidate filings 34 pages. This is a bounded selection, not every filing deposited.
- The 2014 company-share sale refers to Annex 6 with property titles and cadastral extracts; that annex is absent from the downloaded 18-page filing. No exact current references and individual areas can be extracted from the selected Lambrays company records.
- Merme-Morizot company identity is documented by the old legal name, SIREN and express GFA conversion. Its long-term leases are recited without a tenant or parcel schedule. A Taupenot-Merme company relation is not inferred from shared officers or the critic map.
- SCI 21 23 U21465754 remains unresolved. Same-name Rennes company 505373852 lacks an independent Morey parcel/company-record crosswalk; it is a candidate, not an assigned SIREN. Name and local-address searches are not exhaustive proof of absence.
- The supplied Winehog article is available in full and its maps were reviewed. Numbered garden references lack areas; the 420 m2 Taupenot-Merme description lacks a number and differs from current AP104 at 430 m2. No forced match or inferred successor.
- The SCI candidate signed decision dates are 19/26 May 2018, while the free filing index describes 2019 decisions and the deposit is 29 May 2019. Source-date discrepancy retained, with operative dates taken from the signed pages.
- Original property annexes, executed leases and renewals, paid SPF records and present-season confirmation remain unreviewed. Company identity, historical share sales and undated estate totals do not verify current farming.

The active parallel Vosne branches (#426–#430) were checked before adding holders. No overlapping new entry or changed relied-on holder was found. PRs stay separate and unmerged.
