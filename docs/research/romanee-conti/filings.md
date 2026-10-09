# Romanée-Conti: public company filings

Reviewed 8 October 2026 for [Tier 2 issue #427](https://github.com/gary29024/winelogdb/issues/427), following the Richebourg (#530) and Romanée-Saint-Vivant (#426) passes. The one recorded holder, the Société Civile du Domaine de la Romanée-Conti (778269407), was searched in the official company API and the free entreprises.lefigaro.fr index. PDFs were downloaded from actes.ccm2.net; no paid land-register copies or outreach were used. Local retries on 9 October 2026 returned HTTP 403 from data.inpi.fr and pappers.fr; material available only there remains an access gap.

The bounded selection covers the 1974 statutes with their estate schedule, the 2003 recast statutes and the recent statutes. It is not an exhaustive download of the DRC’s filings, most of which are share donations. Each of the **7 files / 548 pages** was processed with PyMuPDF embedded-text extraction; every image page was then rendered at **150 dpi** and screened with RapidOCR (ONNX Runtime, CPU, `use_cls=False`). Pages with only a born-digital text layer were read from that layer. The cited schedule was checked against page images. A negative means no qualifying Romanée-Conti match in these selected files, not that no such document exists.

Dates separate the deed/decision (`documentDate`) from its deposit (`filingDate`). Page numbers are PDF pages, including registry covers. Every source records the original URL, raw-byte SHA-256, byte count, retrieval time and page count in [curation](curation.json). PDFs, OCR text, article archives and full article text are not committed.

## Local audit (Codex CLI, Windows, Python 3.12)

On 9 October 2026 all **7 PDFs / 548 pages** were downloaded again; SHA-256, byte size and page count match every recorded source. Five files / 445 pages are byte-identical to the DRC files read in full during the Romanée-Saint-Vivant audit; that all-page review was reused, with the Romanée-Conti cited passages checked again. The additional 2003 first deposit (62 pages) and 2009 filing (41 pages) were read in full using RapidOCR/DirectML at 150 dpi. The 1974 schedules and deed date were checked as page images (PDF 36, 38–39, 74).

The review confirms AN72 at 9 a 27 ca and retired AN73 at 1 ha 71 a 23 ca. AN258's 90 m² difference remains unresolved; only official DFI lineage connects it to the old schedule. Later filings add no cadastral schedule. The November 2024 management declaration is on PDF 41, separate from the 27 July 2024 statutes beginning on PDF 44; the source page list now includes both.

The official estate page matches its recorded SHA-256 and prints 1.8140 ha. The official company API still identifies active company 778269407; its dynamic response bytes differ from the original snapshot without changing that identity. INPI/Pappers returned HTTP 403. Both Winehog archives are **not re-verified locally**, as instructed; prior cloud findings and original hashes are retained with this limitation.

The audited Romanée-Saint-Vivant branch was merged first; conflicts in generated audit and payload reports were resolved by their builders. Exact-reference counts, the holder link, rights and geometry remain unchanged; verified farming remains zero. PR #537 records the checks and any platform exceptions.

## Exact references

1 filing entry covers **1 current parcel**. The printed reference and individual area agree with the pinned `cadastreAreaM2`, and the filing company is the recorded holder. The schedule is historical estate evidence; it does not establish the current farming season.

| Filing | Deed date / deposit | Exact current references and areas | Lease treatment |
| --- | --- | --- | --- |
| [DRC: 1974 notarial estate schedule](https://actes.ccm2.net/acte/5409256#page=36) (pp. 36, 38, 74) | 1974-12-21 / 2002-07-31 | AN72: 927 m² | No parcel-specific lease identified. |

### A reference reached only through official lineage

The same schedule lists AN 73, “La Romanée Conti”, at 1 ha 71 a 23 ca, written out in words. A one-to-one *croquis de conservation* validated on 30 May 1994 replaced AN 73 with AN 258, whose cadastral area is 17,213 m², 90 m² more than the printed 17,123 m². Because the filing never prints AN 258 and the areas differ, the evidence is kept as `filing-named-cadastral-reference` research on the retired reference and reaches AN 258 only through documented DFI lineage.

## Effort and holder findings

| Recorded holder | Filings | Pages | Outcome |
| --- | ---: | ---: | --- |
| Domaine de la Romanée-Conti (`778269407`) | 7 | 548 | The 1974 notarial estate schedule names AN72 with its exact area and retired AN73, which reaches AN258 only through the 1994 DFI croquis. 6 later DRC filings add no cadastral schedule or lease; legal company identity remains a research link. Farming unverified. |

These counts describe the Romanée-Conti pass and re-screen DRC files read for earlier crus. They must not be added to earlier pass totals; previous recorded effort remains in the shared table’s effort note.

## Inventory of screened filings

### rc-drc-statutes-1974

[DRC: 21 December 1974 notarial statutes and estate schedule (filed 2002)](https://actes.ccm2.net/acte/5409256#page=38) — 125 PDF pages, all screened. Deed/decision **1974-12-21**; deposit **2002-07-31**. Relevant pages: 36, 38, 39, 74.

Romanée-Conti review: the 21 December 1974 notarial statutes describe the Domaine de la Romanée-Conti as then composed, including 28°) AN 72 “La Romanée Conti”, 9 a 27 ca, matching today, and 29°) AN 73 “La Romanée Conti”, 1 ha 71 a 23 ca, retired in 1994 for AN 258. Schedule checked against the page images. The 2002 deposit bundles other decisions; it is not a 2002 land transfer.

SHA-256: `f8fb4eaac7409838a0c7563da3df61544a39e9e641ae0f163b83ef97066cbe68`. Retrieved: 2026-10-08T13:44:42+00:00; 3,706,675 bytes.

### rc-drc-2003

[DRC: 27 November 2003 meeting and recast statutes](https://actes.ccm2.net/acte/5409358#page=1) — 63 PDF pages, all screened. Deed/decision **2003-11-27**; deposit **2004-01-29**. Relevant pages: 1, 2, 32, 33.

Recast statutes reciting the 1942 contribution of the whole estate and its brands; no cadastral reference or Romanée-Conti schedule.

SHA-256: `8490ca607cdfb6ded3aae9dc22f92226f64ea6a7922d50d02590bf98aefb2c9e`. Retrieved: 2026-10-08T13:44:42+00:00; 2,082,952 bytes.

### rc-drc-2018

[DRC: 26 January 2018 completion of the December 2017 capital increase](https://actes.ccm2.net/acte/5409360#page=2) — 57 PDF pages, all screened. Deed/decision **2018-01-26**; deposit **2018-06-21**. Relevant pages: 2, 3, 4.

Records the capital increase decided on 20 December 2017 and updated statutes. No cadastral reference or Romanée-Conti schedule.

SHA-256: `1e587daa78a0c37ea9e71f7d8778cf83d94ed5b926b67d41e8edd29e1c80a51a`. Retrieved: 2026-10-08T13:44:05+00:00; 2,554,683 bytes.

### rc-drc-2022

[DRC: 21 March 2022 share donation and statutes](https://actes.ccm2.net/acte/5409233#page=2) — 65 PDF pages, all screened. Deed/decision **2022-03-21**; deposit **2022-04-15**. Relevant pages: 2, 31, 32.

Share donation and updated statutes reproducing the brand wording; no cadastral reference.

SHA-256: `5f0b832a6e2c6c1d7cb388b9a33fecdd84b407c6cee3ed91670f985130f79708`. Retrieved: 2026-10-08T13:32:21+00:00; 2,655,931 bytes.

### rc-drc-2024

[DRC: 14 November 2024 management declaration and bundled share deeds](https://actes.ccm2.net/acte/34207319#page=6) — 135 PDF pages, all screened. Deed/decision **2024-11-14**; deposit **2024-11-14**. Relevant pages: 6, 41, 44, 45, 46.

Share deeds and statutes updated 27 July 2024, which recite the 1942 contribution of the whole Domaine de la Romanée-Conti and its brands, including “Romanée-Conti”. No cadastral reference or parcel schedule.

SHA-256: `f69a58a9d77a91e96a7dc6de3c803d3871c49d7766467a49238c1844dc8af0dc`. Retrieved: 2026-10-08T13:07:24+00:00; 8,473,781 bytes.

### rc-drc-2003-first

[DRC: 27 November 2003 extraordinary meeting and updated statutes (first deposit)](https://actes.ccm2.net/acte/5409357#page=1) — 62 PDF pages, all screened. Deed/decision **2003-11-27**; deposit **2003-12-02**. Relevant pages: 1, 2, 3, 32.

Meeting simplifying the statutes, with updated statutes reciting the 1942 contribution of the whole Domaine de la Romanée-Conti and its brands, including “Romanée-Conti”. No cadastral reference or parcel schedule. The same meeting’s recast statutes were deposited again on 29 January 2004.

SHA-256: `d0e1c017dc40652a98d1ee00d7626023bd5ff85c00199edee5460ecbdf70efc3`. Retrieved: 2026-10-08T15:15:01+00:00; 2,107,504 bytes.

### rc-drc-2009

[DRC: 15 April 2009 extraordinary meeting and updated statutes](https://actes.ccm2.net/acte/5409238#page=1) — 41 PDF pages, all screened. Deed/decision **2009-04-15**; deposit **2009-05-25**. Relevant pages: 1, 2, 7, 8.

Meeting changing the voting rights of usufructuaries and bare owners (articles 12, 21 and 22). The updated statutes recite the 1942 contribution of the whole estate and its brands, including “Romanée-Conti”. No cadastral reference or parcel schedule.

SHA-256: `dd0eeaa91e31c1766bdad78c0c1fb9f36caa621872c3f0782b195bcb0fcfec9d`. Retrieved: 2026-10-08T15:44:48+00:00; 1,103,977 bytes.

## Published holdings

One producer holding is retained only in the named-area census; it names the whole cru, never a parcel. An equal area never assigns a holding to a parcel.

| Producer | Published area | Precision | Finding | Sources |
| --- | --- | --- | --- | --- |
| Domaine de la Romanée-Conti | 1.814 ha | square-metre | Undated estate page gives 1.8140 ha, equal to the summed cadastral areas of AN 72 (927 m²) and AN 258 (17,213 m²) recorded to the DRC. Census evidence only; no farming season inferred. | [Domaine de la Romanée-Conti: Romanée-Conti](https://www.romanee-conti.fr/fr/9-grand-crus/7/romanee-conti) |

## Winehog articles

The repository owner supplied both requested Winehog subscriber articles as saved webarchives. Each source records the article URL, its printed date (`documentDate`), any later page-metadata modification date, and the SHA-256 and byte count of the original archive; archives and article text are not committed. A printed plot number would count only if number and area both matched the pinned cadastre.

| Article | Printed date | Printed reference | Result |
| --- | --- | --- | --- |
| [Domaine de la Romanée-Conti – Producer Profile](https://winehog.org/domaine-de-la-romanee-conti-producer-profile-7374/) | 2012-09-27 (page modified 2012-11-02) | — | no cadastral number |
| [From Romanee-Conti to Vougeot in the vines](https://winehog.org/from-romanee-conti-to-vougeot-in-the-vines-46975/) | 2021-04-25 | — | no cadastral number |

Neither article prints a Romanée-Conti area, plot or cadastral reference, so neither changes a parcel lead, filing or census figure.

## Remaining gaps

- Bounded filing review: 7 DRC filings (548 pages) were screened, chosen for statutes and estate schedules. The free index lists 55 DRC filings, mostly share donations and management changes; unscreened filings are a bounded negative, not proof that no later schedule exists.
- No screened filing prints AN 258. The 1974 schedule’s AN 73 reaches it only through the 1994 DFI croquis, and the 90 m² difference between the printed and current areas is not explained by any reviewed source.
- Local audit 2026-10-09 retried data.inpi.fr and pappers.fr for SIREN 778269407; both returned HTTP 403. Filings or accounts available only there remain unverified.
- Both Winehog archives are not re-verified locally, at the repository owner’s instruction. Original URLs, dates and archive hashes are retained. The prior cloud review found no Romanée-Conti area, plot or cadastral reference; that finding was not independently checked locally.
- Source boundaries, failed notice downloads and unsearched historical intervals remain in the Tier 1 coverage. Current farming remains unconfirmed for both parcels; paid SPF copies and outreach remain Tier 3.
