# La Tâche: public company filings

Reviewed 8 October 2026 for [Tier 2 issue #429](https://github.com/gary29024/winelogdb/issues/429), following the Richebourg (#530), Romanée-Saint-Vivant (#426) and Romanée-Conti (#427) passes. The one recorded holder, the Société Civile du Domaine de la Romanée-Conti (778269407), was searched in the official company API and the free entreprises.lefigaro.fr index. PDFs were downloaded from actes.ccm2.net; no paid land-register copies or outreach were used. data.inpi.fr and pappers.fr refuse cloud traffic and were not used; anything only they hold is a gap for local audit.

The bounded selection covers the 1974 statutes with their estate schedule, the 2003 recast statutes (deposited twice) and the later statutes. It is not an exhaustive download of the DRC’s filings, most of which are share donations. Each of the **7 files / 548 pages** was processed with PyMuPDF embedded-text extraction; every image page was then rendered at **150 dpi** and screened with RapidOCR (ONNX Runtime, CPU, `use_cls=False`). Pages with only a born-digital text layer were read from that layer. The cited schedule was checked against page images. A negative means no qualifying La Tâche match in these selected files, not that no such document exists.

Dates separate the deed/decision (`documentDate`) from its deposit (`filingDate`). Page numbers are PDF pages, including registry covers. Every source records the original URL, raw-byte SHA-256, byte count, retrieval time and page count in [curation](curation.json). PDFs, OCR text, article archives and full article text are not committed.

## Exact references

1 filing entry covers **2 current parcels**. Each printed reference and individual area agrees with the pinned `cadastreAreaM2`, and the filing company is the recorded holder. The schedule is historical estate evidence; it does not establish the current farming season.

| Filing | Deed date / deposit | Exact current references and areas | Lease treatment |
| --- | --- | --- | --- |
| [DRC: 1974 notarial estate schedule](https://actes.ccm2.net/acte/5409256#page=36) (pp. 36, 38, 74) | 1974-12-21 / 2002-07-31 | AM9: 46,275 m²; AM16: 14,345 m² | No parcel-specific lease identified. |

## Effort and holder findings

| Recorded holder | Filings | Pages | Outcome |
| --- | ---: | ---: | --- |
| Domaine de la Romanée-Conti (`778269407`) | 7 | 548 | The 1974 notarial estate schedule names AM9 and AM16 with their exact areas. 6 later DRC filings add no cadastral schedule or lease; legal company identity remains a research link. Farming unverified. |

These counts describe the La Tâche pass and re-screen DRC files read for earlier crus. They must not be added to earlier pass totals; previous recorded effort remains in the shared table’s effort note.

## Inventory of screened filings

### lt-drc-statutes-1974

[DRC: 21 December 1974 notarial statutes and estate schedule (filed 2002)](https://actes.ccm2.net/acte/5409256#page=38) — 125 PDF pages, all screened. Deed/decision **1974-12-21**; deposit **2002-07-31**. Relevant pages: 36, 38, 39, 74.

La Tâche review: the 21 December 1974 notarial statutes describe the Domaine de la Romanée-Conti as then composed, including 20°) AM 9 “Les Gaudichots” or “La Tâche”, 4 ha 62 a 75 ca, and 22°) AM 16 “La Tâche”, 1 ha 43 a 45 ca, both matching today. Schedule checked against the page images. The 2002 deposit bundles other decisions; it is not a 2002 land transfer.

SHA-256: `f8fb4eaac7409838a0c7563da3df61544a39e9e641ae0f163b83ef97066cbe68`. Retrieved: 2026-10-08T13:44:42+00:00; 3,706,675 bytes.

### lt-drc-2003

[DRC: 27 November 2003 meeting and recast statutes](https://actes.ccm2.net/acte/5409358#page=1) — 63 PDF pages, all screened. Deed/decision **2003-11-27**; deposit **2004-01-29**. Relevant pages: 1, 2, 32, 33.

Recast statutes reciting the 1942 contribution of the whole estate and its brands, including the Clos de La Tâche label; no cadastral reference or La Tâche schedule.

SHA-256: `8490ca607cdfb6ded3aae9dc22f92226f64ea6a7922d50d02590bf98aefb2c9e`. Retrieved: 2026-10-08T13:44:42+00:00; 2,082,952 bytes.

### lt-drc-2003-first

[DRC: 27 November 2003 extraordinary meeting and updated statutes (first deposit)](https://actes.ccm2.net/acte/5409357#page=1) — 62 PDF pages, all screened. Deed/decision **2003-11-27**; deposit **2003-12-02**. Relevant pages: 1, 2, 3, 32.

Meeting simplifying the statutes, with updated statutes reciting the 1942 contribution of the whole estate and its brands, including the Clos de La Tâche label. No cadastral reference or parcel schedule. The same meeting’s recast statutes were deposited again on 29 January 2004.

SHA-256: `d0e1c017dc40652a98d1ee00d7626023bd5ff85c00199edee5460ecbdf70efc3`. Retrieved: 2026-10-08T15:15:01+00:00; 2,107,504 bytes.

### lt-drc-2009

[DRC: 15 April 2009 extraordinary meeting and updated statutes](https://actes.ccm2.net/acte/5409238#page=1) — 41 PDF pages, all screened. Deed/decision **2009-04-15**; deposit **2009-05-25**. Relevant pages: 1, 2, 7, 8.

Meeting changing the voting rights of usufructuaries and bare owners. The updated statutes recite the 1942 contribution of the whole estate and its brands, including the Clos de La Tâche label. No cadastral reference or parcel schedule.

SHA-256: `dd0eeaa91e31c1766bdad78c0c1fb9f36caa621872c3f0782b195bcb0fcfec9d`. Retrieved: 2026-10-08T15:44:48+00:00; 1,103,977 bytes.

### lt-drc-2018

[DRC: 26 January 2018 completion of the December 2017 capital increase](https://actes.ccm2.net/acte/5409360#page=2) — 57 PDF pages, all screened. Deed/decision **2018-01-26**; deposit **2018-06-21**. Relevant pages: 2, 3, 4.

Records the capital increase decided on 20 December 2017 and updated statutes. No cadastral reference or La Tâche schedule.

SHA-256: `1e587daa78a0c37ea9e71f7d8778cf83d94ed5b926b67d41e8edd29e1c80a51a`. Retrieved: 2026-10-08T13:44:05+00:00; 2,554,683 bytes.

### lt-drc-2022

[DRC: 21 March 2022 share donation and statutes](https://actes.ccm2.net/acte/5409233#page=2) — 65 PDF pages, all screened. Deed/decision **2022-03-21**; deposit **2022-04-15**. Relevant pages: 2, 31, 32.

Share donation and updated statutes reproducing the brand wording; no cadastral reference.

SHA-256: `5f0b832a6e2c6c1d7cb388b9a33fecdd84b407c6cee3ed91670f985130f79708`. Retrieved: 2026-10-08T13:32:21+00:00; 2,655,931 bytes.

### lt-drc-2024

[DRC: 14 November 2024 management declaration and bundled share deeds](https://actes.ccm2.net/acte/34207319#page=6) — 135 PDF pages, all screened. Deed/decision **2024-11-14**; deposit **2024-11-14**. Relevant pages: 6, 45, 46.

Share deeds and statutes updated 27 July 2024, which recite the 1942 contribution of the whole Domaine de la Romanée-Conti and its brands, including the Clos de La Tâche label. No cadastral reference or parcel schedule.

SHA-256: `f69a58a9d77a91e96a7dc6de3c803d3871c49d7766467a49238c1844dc8af0dc`. Retrieved: 2026-10-08T13:07:24+00:00; 8,473,781 bytes.

## Published holdings

One producer holding is retained only in the named-area census; it names the whole cru, never a parcel. An equal area never assigns a holding to a parcel.

| Producer | Published area | Precision | Finding | Sources |
| --- | --- | --- | --- | --- |
| Domaine de la Romanée-Conti | 6.062 ha | square-metre | Undated estate page gives 6.0620 ha, equal to the summed cadastral areas of AM 9 (46,275 m²) and AM 16 (14,345 m²) recorded to the DRC. Winehog (2014) gives 6.06 ha in two named parts. Census evidence only; no farming season inferred. | [Domaine de la Romanée-Conti: La Tâche](https://www.romanee-conti.fr/fr/9-grand-crus/5/la-tache), [Winehog: La Tâche – a historic view on a legendary grand cru](https://winehog.org/la-tache-historic-view-legendary-grand-cru-20756/) |

## Winehog articles

The repository owner supplied all 4 requested Winehog subscriber articles as saved webarchives. Each source records the article URL, its printed date (`documentDate`), any later page-metadata modification date, and the SHA-256 and byte count of the original archive; archives and article text are not committed. A printed plot number would count only if number and area both matched the pinned cadastre.

| Article | Printed date | Printed reference | Result |
| --- | --- | --- | --- |
| [Domaine de la Romanée-Conti – Producer Profile](https://winehog.org/domaine-de-la-romanee-conti-producer-profile-7374/) | 2012-09-27 (page modified 2012-11-02) | — | no cadastral number |
| [Vosne-Romanee Les Gaudichots – History, owners & wines – update](https://winehog.org/vosne-romanee-les-gaudichots-16919/) | 2014-07-01 (page modified 2017-10-01) | — | no cadastral number |
| [La Tâche – a historic view on a legendary grand cru](https://winehog.org/la-tache-historic-view-legendary-grand-cru-20756/) | 2014-08-17 (page modified 2026-05-14) | — | no cadastral number |
| [The Story Behind The 1923 La Tâche Bottled by Maison Nicolas](https://winehog.org/the-story-behind-the-1923-la-tache-bottled-by-maison-nicolas-74167/) | 2026-05-28 (page modified 2026-05-29) | — | no cadastral number |

The history articles give La Tâche’s two named parts as 1.43 ha and 4.63 ha (6.06 ha). Those rounded totals agree with the 1974 schedule and the estate page but print no cadastral number, so they stay census context and change no lead or filing. The ownership history is the critic’s account, not company evidence.

## Remaining gaps

- Bounded filing review: 7 DRC filings (548 pages) were screened, chosen for statutes and estate schedules. The free index lists 55 DRC filings, mostly share donations and management changes; unscreened filings are a bounded negative, not proof that no later schedule exists.
- The 1974 schedule is historical estate evidence: no screened filing records a later lease, operator or farming season for AM 9 or AM 16. The same schedule’s AM 10 and AM 14 (Les Gaudichots) lie outside this cru.
- data.inpi.fr and pappers.fr refuse this cloud environment: filings or accounts available only there are pending local audit.
- All 4 requested Winehog articles were supplied by the repository owner as saved webarchives and reviewed; URLs, printed dates and archive hashes are recorded, and archives and article text are not committed. None prints a La Tâche cadastral number; their 1.43 ha and 4.63 ha named-area totals are rounded and stay census context.
- Source boundaries, failed notice downloads and unsearched historical intervals remain in the Tier 1 coverage. Current farming remains unconfirmed for both parcels; paid SPF copies and outreach remain Tier 3.
