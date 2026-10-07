# Corton: public company filings and leases

Reviewed 7 October 2026 for [Tier 2 issue #451](https://github.com/gary29024/winelogdb/issues/451). Every recorded holder with a SIREN was looked up in the official company register (recherche-entreprises.api.gouv.fr) and in the free filing index of entreprises.lefigaro.fr. From those indexes, 349 filings of 105 companies (founding deeds, contributions, mergers and the latest statutes) were downloaded from actes.ccm2.net and screened by OCR for Corton communes, climats and each holder’s own cadastral references, about 8,400 PDF pages in all. Fourteen operating-company filings without contribution or merger content were not screened. Schedules and lease recitals cited below were read from page images or the PDF text layer. Original PDFs, OCR text and page images are not committed.

Dates separate the deed (the date of the contribution or meeting) from the deposit. Page numbers count PDF pages, including covers. SHA-256 hashes cover the downloaded raw bytes; the machine-readable [curation](curation.json) and the [shared holder table](../holders/holder-links.json) also store UTC retrieval times and byte counts.

## Exact references: parcels named with matching areas

95 filing rows name 82 current Corton parcels by reference with the cadastral area of today’s snapshot. Contributions and leases are ownership and tenure history; none establishes who farms a parcel today.

| Filing (deed date) | Recorded holder | Parcels and printed areas | Lease or tenancy |
| --- | --- | --- | --- |
| [Corton-Grancey GFA: founding contributions and Latour lease](https://actes.ccm2.net/acte/8a38b685-0c70-4954-ad15-eb55e25d155f#page=3) (1972) | GFA DOM CORTON GRANCEY (U21852238) | A 0046 (7,933 m²), A 0047 (3,967 m²), A 0049 (4,252 m²), A 0050 (8,145 m²), A 0051 (290 m²), B 0026 (6,387 m²), B 0029 (9,180 m²), B 0033 (8,483 m²), B 0034 (7,218 m²), B 0035 (1,540 m²), B 0036 (3,512 m²), C 0010 (5,700 m²), C 0056 (3,184 m²), D 0030 (5,040 m²), D 0062 (11,353 m²), N 0050 (14,923 m²) | existing lease recital: Société Civile Domaine Louis Latour, to 2031-10-31 |
| [Vignoble Latour: 2011 contribution of one-third shares](https://actes.ccm2.net/acte/b395bdda-43cc-467b-885d-c30ad373c068#page=1) (2011-09-28) | VIGNOBLE LATOUR (528291362) | A 0046 (7,933 m²), A 0047 (3,967 m²), A 0049 (4,252 m²), A 0050 (8,145 m²), A 0051 (290 m²), B 0026 (6,387 m²), B 0029 (9,180 m²), B 0036 (3,512 m²), C 0010 (5,700 m²), C 0056 (3,184 m²), D 0030 (5,040 m²), D 0062 (11,353 m²), D 0105 (19 m²), D 0106 (31 m²), D 0109 (7,825 m²), N 0050 (14,923 m²) | none recited |
| [Latour Immeubles: 2011 contribution of the Aloxe-Corton cellar](https://actes.ccm2.net/acte/10f5e549-5947-4c60-be23-9d6aa45aae75#page=1) (2011-09-28) | LATOUR IMMEUBLES (528291479) | B 0028 (2,428 m²) | none recited |
| [Belgrand-Latour GFA: founding contribution and Latour lease](https://actes.ccm2.net/acte/4a921f53-c95f-439c-bc02-43f219827e10#page=5) (1974-11) | DU DOMAINE BELGRAND LATOUR (427468962) | A 0042 (9,031 m²), A 0055 (7,482 m²), N 0009 (1,445 m²), N 0010 (6,293 m²) | existing lease recital: Société Civile Domaine Louis Latour, to 2026-11-10 |
| [Marchal-Latour GFA: founding contribution and Latour lease](https://actes.ccm2.net/acte/e075dff5-8ee1-4eb1-ac71-af0bd65cf103#page=2) (1975) | DOMAINE MARCHAL LATOUR (427468988) | A 0041 (7,874 m²), A 0056 (11,993 m²), A 0092 (1,398 m²), D 0020 (3,700 m²) | existing lease recital: Société Civile Domaine Louis Latour, to 2026-11-10 |
| [Rolland-Latour GFA: 2005 contribution and Latour lease](https://actes.ccm2.net/acte/50ba4241-90a5-488b-b9e7-b334a719282f#page=19) (2005-12-15) | GROUPEMENT FONCIER AGRICOLE ROLLAND - LATOUR (487716805) | A 0048 (9,340 m²), B 0006 (19,580 m²) | existing lease recital: Société Civile Domaine Louis Latour, to 2026-11-10 |
| [Chandon de Briailles: 1967 founding contributions](https://actes.ccm2.net/acte/a4c8be0c-df33-4b35-be17-527bbbfc0b3f#page=9) (1967-09-23) | GFA DOMAINE CHANDON DE BRIAILLES (778256123) | A 0083 (1,168 m²), D 0003 (960 m²), D 0005 (3,505 m²), D 0027 (7,435 m²), D 0032 (1,385 m²), D 0047 (1,765 m²), D 0055 (3,233 m²), E 0098 (2,742 m²), E 0105 (1,230 m²) | none recited |
| [Ravaut GFA: 1988 founding contributions](https://actes.ccm2.net/acte/7849c27c-d998-4597-b6fc-a49ecdae83a7#page=5) (1988-10-25) | GFA DOM RAVAUT PERE ET FILS (U14137631) | AH 0121 (168 m²), AH 0122 (973 m²), AH 0123 (1,933 m²), AH 0124 (351 m²), D 0084 (2,121 m²), D 0090 (952 m²), D 0101 (1,190 m²) | none recited |
| [Vincent Rapet GFA: 2017 contributions and tenant in place](https://actes.ccm2.net/acte/509706b2-6590-45f0-9fc1-5b6ba2e423a6#page=9) (2017) | GFA DU DOMAINE VINCENT RAPET (832275333) | A 0069 (4,565 m²), A 0088 (1,250 m²), A 0121 (863 m²), N 0082 (3,800 m²), AL 0308 (8,973 m²) | tenant in place declaration: SAS du Domaine Rapet Père et Fils |
| [Marie Sordoillet GFV: 2009 contributions and lease](https://actes.ccm2.net/acte/33491379#page=8) (2009) | GROUPEMENT FONCIER VITICOLE MARIE SORDOILLET (511314635) | A 0004 (4,558 m²), A 0058 (3,635 m²), A 0120 (5,528 m²), B 0013 (5,321 m²), D 0026 (1,134 m²) | existing lease recital: Maurice Chapuis |
| [GFV Camila: 2024 contributions](https://actes.ccm2.net/acte/4fa3606a-f47c-4f06-af51-cf1845535fa3#page=3) (2024-01-24) | GFV CAMILA (983900960) | C 0061 (441 m²), C 0100 (6,019 m²) | none recited |
| [GFV Bruno et Valérie Clavelier: 2024 contributions](https://actes.ccm2.net/acte/20fba88e-752b-4750-a5d7-0a5a23ac8afe#page=6) (2024-11-20) | GFV BRUNO ET VALERIE CLAVELIER (U33360345) | AK 0149 (205 m²), AK 0151 (811 m²), AK 0152 (2,017 m²), AK 0155 (335 m²) | none recited |
| [GFV Saint Vincent Corton Les Maréchaudes: contribution and lease](https://actes.ccm2.net/acte/682cc768-a479-4982-94de-a921025010a0#page=4) (2014-12) | GFV SAINT VINCENT CORTON LES MARECHAUDES (U22208861) | E 0117 (2,880 m²) | lease mandate: a co-manager of the GFV, personally |
| [GFV Domaine Pierre et Anne-Marie Gille: Renardes C 51 and lease](https://actes.ccm2.net/acte/94d660c9-a82e-4e24-9cd7-24da1d15c748#page=3) (2002-08) | DOMAINE PIERRE ET ANNE MARIE GILLE (U12947760) | C 0051 (1,625 m²) | existing lease recital: S.C.E.V. Domaine Anne Marie Gille, to 2013-11-10 |
| [SCEA Corton Clos du Roi: 2023 contribution by Domaine de Montille](https://actes.ccm2.net/acte/9d6acf6d-1bc1-422d-8029-ac199d702955#page=1) (2023-06-21) | CORTON CLOS DU ROI (953306917) | D 0132 (2,027 m²) | none recited |
| [Mémoire de Vignes: Le Corton C 11 and Poisot-Piguet lease](https://actes.ccm2.net/acte/d1860966-223d-4e4e-841f-3e68dcc9a081#page=2) (2024-07-24) | MEMOIRE DE VIGNES (931134381) | C 0011 (5,700 m²) | existing lease recital: SCEA du Domaine Poisot-Piguet |
| [GEROUK: purchase mandate for Renardes C 74](https://actes.ccm2.net/acte/01c3688f-09eb-4b38-8bb9-dab576059ad7#page=37) (2003-11-12) | GEROUK (451042832) | C 0074 (3,129 m²) | none recited |
| [Fermière Viticole Remoissenet: 2022 merger asset list](https://actes.ccm2.net/acte/2bae0637-91bf-4311-ba7c-01b00ed80c0a#page=1) (2022-03-29) | FERMIERE VITICOLE REMOISSENET (448234492) | D 0125 (956 m²), AL 0336 (301 m²) | none recited |
| [Fermière Viticole Remoissenet: 2022 merger asset list (AL 328 and AL 332)](https://actes.ccm2.net/acte/2bae0637-91bf-4311-ba7c-01b00ed80c0a#page=1) (2022-03-29) | FERMIERE VITICOLE REMOISSENET (448234492) | AL 0328 (63 m²), AL 0332 (342 m²) | none recited |
| [GFA des Beaumonts: contributions and Maillard leases](https://actes.ccm2.net/acte/21ccf271-a107-4a80-826a-a78e3941087f#page=14) (2008-11-21) | DES BEAUMONTS (510368210) | AK 0047 (1,890 m²), AK 0049 (3,982 m²) | existing lease recital: S.A.R.L. Domaine Maillard Père et Fils, to 2008-12-31; existing lease recital: S.A.R.L. Domaine Maillard Père et Fils, to 2014-11-10 |
| [GFA de la Maladière: Le Charlemagne A 14](https://actes.ccm2.net/acte/70f2c8df-a737-401a-927d-1982c1fef343#page=5) (2013-12) | GFA DE LA MALADIERE (802390898) | A 0014 (934 m²) | none recited |
| [GFV Durst Corton-Charlemagne: En Charlemagne AL 181](https://actes.ccm2.net/acte/ff0abb88-d09d-40d9-aa27-0b087d3637c0#page=4) (2012-06-29) | GFV DURST CORTON-CHARLEMAGNE (509207429) | AL 0181 (610 m²) | none recited |
| [GFV Esprit 20 de Bourgogne: Hautes Mourottes AH 120 and lease mandate](https://actes.ccm2.net/acte/d6889836-7db4-4d91-9e07-4725a0bb919a#page=5) (2010-12) | GFV ESPRIT 20 DE BOURGOGNE (532929288) | AH 0120 (7,285 m²) | lease mandate: Vignobles Clemencet |
| [GFV L’Empereur: En Charlemagne AL 320](https://actes.ccm2.net/acte/ee653e31-7c92-46c8-933b-645a83f1d59e#page=9) (2007-05-12) | GROUPEMENT FONCIER VITICOLE L'EMPEREUR (498546258) | AL 0320 (2,432 m²) | lease mandate: a named individual |
| [GFV Vifoncier Charlemagne: En Charlemagne contributions](https://actes.ccm2.net/acte/9a2b23eb-79d0-4a2e-a22f-10dfc23e97b0#page=5) (1996-10-30) | GFV VIFONCIER CHARLEMAGNE (409988342) | AL 0130 (1,190 m²), AL 0174 (644 m²), AL 0176 (236 m²) | none recited |
| [GFV CHAPUIS: contributions and family lease](https://actes.ccm2.net/acte/ff2e83b6-a0c9-42c1-a195-540a781c8c6f#page=4) (2019-12-13) | GFV CHAPUIS (880256847) | A 0137 (767 m²), B 0075 (142 m²) | existing lease recital: a family member, personally |

Every reference above matches the pinned current reference, its cadastral area and the recorded holder. Printed references that do not match a current parcel are kept as printed: D 91, D 97 and I 141 in the Corton-Grancey schedule are listed in the curation’s `unmatchedPrintedReferences`; B 27 (a 1 a 13 ca garden) matches a current parcel that has no company record today; Chandon de Briailles’ D 34 and Vignoble Latour’s D 23 are recorded to other holders today and are not assigned.

## Holder links that rest on filings

- **Latour.** Four Latour family land companies recite leases of all their land to the Société Civile Domaine Louis Latour: the Corton-Grancey GFA (1966 lease renewed in 2013 to 31 October 2031) and the Belgrand-Latour, Marchal-Latour and Rolland-Latour GFAs (2001 leases to 10 November 2026). Vignoble Latour and Latour Immeubles are subsidiaries of Maison Louis Latour, which contributed its one-third shares and the Aloxe-Corton cellar in 2011.
- **Domaine d’Ardhuy.** The Les Chagnots GFA recites a 1970 lease of Renardes C 29 and C 50 to the company now registered as Domaine d’Ardhuy, renewed to 2010, and authorised a renewal from 2019.
- **Rapet, Maillard, Poisot-Piguet.** SAS du Domaine Rapet Père et Fils declares itself tenant in place of the Vincent Rapet GFA’s land; the Beaumonts GFA recites leases to S.A.R.L. Domaine Maillard Père et Fils ending 2008 and 2014; Mémoire de Vignes defines an 18-year lease to SCEA du Domaine Poisot-Piguet from 2024.
- **Corporate relations.** Domaine de Montille contributed Clos du Roi D 132 to SCEA Corton Clos du Roi in 2023; S2V (Domaine Jean Fery et Fils) holds 99 of SCI Les Combottes’ 100 shares; Maison Bouchard Père et Fils (now Vignoble des Cabottes) received almost all shares of the new Bouchard Père et Fils company in 2026.
- **Provisional identifiers.** Seven `U…` identifiers now have SIREN crosswalks: five through founding schedules whose references and areas match (Corton-Grancey, Les Chagnots, Ravaut, Clavelier, Saint Vincent Corton Les Maréchaudes), one through the original company name in a 2002 deed (Gille) and one by identical full name and commune only (SHVCC).
- **Leases to individuals.** Recitals naming a person rather than a company (Sordoillet to Maurice Chapuis, Gros Faiveley, Chapuis GFV, Saint Vincent Corton Les Maréchaudes, L’Empereur mandate, Grenelle) give no domaine link, or only a provisional one where the person is the namesake of a domaine company.

## Cited filings

### beaumonts-gfa-2008

[GFA des Beaumonts: 21 November 2008 founding deed](https://actes.ccm2.net/acte/21ccf271-a107-4a80-826a-a78e3941087f#page=14) — 41 PDF pages. Deed date **2008-11-21**; deposit **2009-02-12**. Pages read: 14, 15, 19, 20.

Contributions include Ladoix-Serrigny AK 47 (Corton grand cru, 18 a 90 ca) and AK 49 (39 a 82 ca). Both are recited as let to S.A.R.L. Domaine Maillard Père et Fils: AK 47 under a 1982 lease tacitly prolonged to 31 December 2008, AK 49 under a lease of 12 December 1996 for 11 November 1996 to 10 November 2014.

SHA-256: `a64a6d97a37259fe91bddd516866386aa3d7bd383c4b15d50f83e30a13fd4a13` (1,519,680 bytes).

### belgrand-latour-statutes

[GFA Domaine Belgrand-Latour: statutes updated 17 May 2025](https://actes.ccm2.net/acte/4a921f53-c95f-439c-bc02-43f219827e10#page=5) — 19 PDF pages. Deed date **1974-11**; deposit **2026-07-28**. Pages read: 1, 3, 5, 6.

Founding contribution of Aloxe-Corton A 42 (Le Charlemagne), A 55 (Les Pougets), N 9 and N 10 (Les Chaumes) with areas. All contributed land is recited as let to the Société Civile Domaine Louis Latour: the 1966 lease, then a new 25-year lease signed 6 December 2001 for 11 November 2001 to 10 November 2026.

The founding deed dates from November 1974 (term counted to 4 November 2009); this copy follows the 17 May 2025 meeting. The PDF has a text layer.

SHA-256: `8049a3ccc5434216585a8dbb5631ff6486ad96834171cb51aea712fa17c654ba` (377,846 bytes).

### camila-gfv-2024

[GFV Camila: 24 January 2024 founding deed](https://actes.ccm2.net/acte/4fa3606a-f47c-4f06-af51-cf1845535fa3#page=3) — 34 PDF pages. Deed date **2024-01-24**; deposit **2024-01-25**. Pages read: 3, 4.

Two contributors each contribute an undivided half of Aloxe-Corton Les Renardes C 61 (4 a 41 ca) and C 100 (60 a 19 ca), together 64 a 60 ca, with Les Valozières village land.

SHA-256: `bf01516b23ca2b1be955eb90e6d529168fceb006e4e36ccf0f82ffdbd5afd99a` (1,095,148 bytes).

### chagnots-agm-2020

[LES CHAGNOTS GFA: 1 July 2020 meeting and updated statutes](https://actes.ccm2.net/acte/0d62cba3-855a-4f0f-8df3-35970cfd4c1c#page=2) — 27 PDF pages. Deed date **2020-07-01**; deposit **2021-06-03**. Pages read: 2, 4, 11, 12; checked against page images: 2, 4, 11, 12.

The statutes repeat the C 29 and C 50 contributions and recite a long-term lease of 3 and 9 July 1970 to Société du Domaine Les Terres Vineuses (RCS Nuits B 325 421 634), renewed in 1993 to 1 November 2010. The meeting empowers the managers to sign an amendment renewing it for nine years from 1 November 2019.

SHA-256: `d814fd0efff66981c18e36bee85f945f8a13b558925afde9e1dc0ad960e9ec16` (1,562,011 bytes).

### chagnots-founding-2004

[LES CHAGNOTS GFA: 23 December 2004 founding deed](https://actes.ccm2.net/acte/e709ae7f-4a36-473a-8fa2-27628639e74b#page=2) — 63 PDF pages. Deed date **2004-12-23**; deposit **2005-03-29**. Pages read: 2, 5; checked against page images: 2.

Notarial founding deed (Beaune) of the GFA. Articles 10 and 11 contribute Aloxe-Corton Les Renardes C 29 (39 a 23 ca) and C 50 (45 a 46 ca), with Ladoix-Serrigny village vineyards.

SHA-256: `51c8b6f12551241c3c01119e1f5179bba84bf4636418aeb2627a70244c4d704c` (2,280,103 bytes).

### chandon-founding-1967

[Domaine Chandon de Briailles: 23 September 1967 founding statutes](https://actes.ccm2.net/acte/a4c8be0c-df33-4b35-be17-527bbbfc0b3f#page=9) — 44 PDF pages. Deed date **1967-09-23**; deposit **2002-10-31**. Pages read: 9; checked against page images: 9.

Original statutes filed on registration. Aloxe-Corton contributions: A 83 (11 a 68 c), D 3 (9 a 60 c), D 5 (35 a 05 c), D 27 (74 a 35 c), D 32 (13 a 85 c), D 34 (54 a 15 c), D 47 (17 a 65 c), D 55 (32 a 33 c), E 17, E 98 (27 a 42 c) and E 105 (12 a 30 c).

SHA-256: `8aed18d70c0afc3e1d8383cdd87608ffa0949c5da3acd3ed54b8f3e4e9f4f3d0` (1,836,940 bytes).

### chapuis-gfv-2019

[GFV CHAPUIS: 13 December 2019 founding deed](https://actes.ccm2.net/acte/ff2e83b6-a0c9-42c1-a195-540a781c8c6f#page=4) — 19 PDF pages. Deed date **2019-12-13**; deposit **2020-01-06**. Pages read: 4, 5; checked against page images: 5.

Contribution of Aloxe-Corton A 137 (7 a 67 ca), B 72 (40 a 51 ca), B 75 (1 a 42 ca) and H 92. They are recited as let to an individual family member under a lease of 4 August 2018 running 18 years, 7 months and 16 days from 26 March 2018.

SHA-256: `d1c19434d8fdfee182227f44f4a0d9aa74858f7afcaaba5c9319065ad5faa6ac` (1,414,283 bytes).

### clavelier-gfv-2024

[GFV Bruno et Valérie Clavelier: 20 November 2024 founding deed](https://actes.ccm2.net/acte/20fba88e-752b-4750-a5d7-0a5a23ac8afe#page=6) — 31 PDF pages. Deed date **2024-11-20**; deposit **2024-11-26**. Pages read: 6, 7.

Contribution of a Ladoix-Serrigny Corton parcel set in Le Rognet et Corton (AK 149, AK 151, AK 152) and Les Vergennes (AK 155), totalling 33 a 68 ca, with individual areas.

SHA-256: `eb7941cd8842e9d0bd8cc5d8986adc4e818c359b8d660460e6e17b50c65cc5e7` (5,003,442 bytes).

### combottes-2015

[SCI Les Combottes: 2015 share-transfer deed](https://actes.ccm2.net/acte/41938c28-3f4c-4ac3-a2f8-5029a6da2f9e#page=7) — 22 PDF pages. Deed date **2015-08**; deposit **2015-08-10**. Pages read: 7; checked against page images: 7.

S2V holds 99 of the SCI’s 100 shares. The SCI owns two vineyard parcels, Pernand “Les Plantes” and Corton “Les Chaumes”, both under farm leases to S2V. No cadastral references are printed.

SHA-256: `4fb8679cb425a75a6ccf1f0f3271bd56ec57fceaf4103c3ba0ddb5073c3fcb60` (1,538,031 bytes).

### corton-clos-du-roi-2023

[SCEA Corton Clos du Roi: 21 June 2023 contribution deed](https://actes.ccm2.net/acte/9d6acf6d-1bc1-422d-8029-ac199d702955#page=1) — 12 PDF pages. Deed date **2023-06-21**. Pages read: 1, 4.

Domaine de Montille (483134516) contributes Aloxe-Corton Le Clos du Roi D 132 (20 a 27 ca), split from a parcel whose remainder (21 a 49 ca) it keeps, in exchange for 33,000 new shares of SCEA Corton Clos du Roi (953306917).

SHA-256: `d965a088e3552b4fde76e4e6cc6de82f38127ba7bffe8cd20c8be71ec3964aec` (711,825 bytes).

### corton-grancey-statutes

[GFA du Domaine de Corton-Grancey: statutes updated 2025](https://actes.ccm2.net/acte/8a38b685-0c70-4954-ad15-eb55e25d155f#page=3) — 37 PDF pages. Deed date **1972**; deposit **2026-04-21**. Pages read: 3, 4, 5, 7, 8, 12, 18, 19; checked against page images: 3, 4, 5, 6, 7, 8, 18, 19.

The statutes reproduce the 1972 founding contributions: undivided two-thirds of Aloxe-Corton B 26, B 29, B 36, C 10, C 56, D 30, D 62, A 46, A 47, A 49, A 50, A 51 and N 50, and B 33, B 34 and B 35 in full, each with its area. They recite that all contributed land was let to the Société Civile Domaine Louis Latour (Château Corton-Grancey) under a 26 March 1966 lease, renewed in 1998 and again on 3 June 2013 to 31 October 2031.

The contribution schedule is the original 1972 statutes (company created 23 June 1972; contribution published 22 August 1972). This copy is the statutes updated after the 2025 meeting, filed 21 April 2026.

SHA-256: `d204eca4d234cb18efb878e467cb7e96736c77daf1d6c2985eff2d5e3d8fb372` (8,693,031 bytes).

### durst-gfv-2012

[GFV Durst Corton-Charlemagne: 29 June 2012 deed](https://actes.ccm2.net/acte/ff0abb88-d09d-40d9-aa27-0b087d3637c0#page=4) — 56 PDF pages. Deed date **2012-06-29**; deposit **2015-06-09**. Pages read: 4, 6.

The company’s only asset is Pernand-Vergelesses En Charlemagne AL 181 (6 a 10 ca), acquired by purchase. No lease is recited.

SHA-256: `a052324d7412833e3556f7ef062e21e04d4de0892970bc48c434fdd8a5dc7c7a` (3,425,536 bytes).

### empereur-gfv-2007

[GFV L’Empereur: 12 May 2007 founding deed](https://actes.ccm2.net/acte/ee653e31-7c92-46c8-933b-645a83f1d59e#page=9) — 29 PDF pages. Deed date **2007-05-12**; deposit **2007-06-26**. Pages read: 9, 25.

Contribution of Pernand-Vergelesses En Charlemagne AL 320 (24 a 32 ca, 20 a 72 ca planted). The partners mandate the manager to conclude a long-term rural lease to a named individual.

SHA-256: `6863f217fe4334f0ce02cf515861688145cb24a42e8a5b1ba3156c1d87cef2b7` (1,052,794 bytes).

### esprit20-gfv-2010

[GFV Esprit 20 de Bourgogne: founding deed](https://actes.ccm2.net/acte/d6889836-7db4-4d91-9e07-4725a0bb919a#page=5) — 19 PDF pages. Deed date **2010-12**; deposit **2011-06-16**. Pages read: 5, 19.

Contributions include Ladoix-Serrigny Hautes Mourottes AH 120 (72 a 85 ca, coppice in the Ladoix area). The partners mandate the manager to grant a long-term lease of the contributed parcels to Vignobles Clemencet.

SHA-256: `a994f8e1aacc0d8c973d4f5d7bbf3c6591f354e989e276563e32372eb1487b8a` (292,600 bytes).

### fermiere-remoissenet-2022

[Fermière Viticole Remoissenet: merger project of 29 March 2022](https://actes.ccm2.net/acte/2bae0637-91bf-4311-ba7c-01b00ed80c0a#page=1) — 51 PDF pages. Deed date **2022-03-29**; deposit **2022-04-04**. Pages read: 1, 2, 20.

The asset list transferred to Fermière Remoissenet SAS includes Les Bressandes D 125 (9 a 56 ca), En Charlemagne AL 328 and AL 332 (together 4 a 05 ca) and AL 336 (3 a 01 ca). The PDF has a text layer for the list.

SHA-256: `35736b8cdb5f6deaf446334e3e65637d133601b179e17f9a7dfac7bc35e475b3` (1,636,903 bytes).

### gerouk-2003

[GEROUK GFA: 12 November 2003 founding deed (2019 copy)](https://actes.ccm2.net/acte/01c3688f-09eb-4b38-8bb9-dab576059ad7#page=37) — 37 PDF pages. Deed date **2003-11-12**; deposit **2019-04-29**. Pages read: 37; checked against page images: 37.

The founding deed empowers a partner to buy Aloxe-Corton C 74 Les Renardes (31 a 29 ca) for €390,000 on the GFA’s behalf. The purchase deed itself is not reproduced.

SHA-256: `78748443baf1d7454825f8803fa3eaf9e6e076cbfcb787cc2e1f73e4affd0119` (2,356,099 bytes).

### gille-gfv-2002

[GFV Domaine Pierre et Anne-Marie Gille: 2002 deed](https://actes.ccm2.net/acte/94d660c9-a82e-4e24-9cd7-24da1d15c748#page=3) — 27 PDF pages. Deed date **2002-08**; deposit **2002-12-27**. Pages read: 3, 7, 13.

The deed names the GFV “Groupement Foncier Viticole Domaine Pierre et Anne-Marie Gille” (34 route nationale 74, Comblanchien). Aloxe-Corton Les Renardes C 51 (16 a 25 ca) is among its land, let with Vosne-Romanée vines to S.C.E.V. Domaine Anne Marie Gille under a 1996 lease running from 11 November 1995 to 10 November 2013.

SHA-256: `7d146dc5fb87b4caf4dd680858364c5be93261fdaf9b9b988b5613b5e12e2769` (969,339 bytes).

### latour-immeubles-2011

[LATOUR IMMEUBLES: statutes after the 28 September 2011 contribution](https://actes.ccm2.net/acte/10f5e549-5947-4c60-be23-9d6aa45aae75#page=1) — 20 PDF pages. Deed date **2011-09-28**; deposit **2011-12-30**. Pages read: 1, 3, 5, 6.

Maison Louis Latour contributes buildings, including the Aloxe-Corton cellar on Les Perrières B 28 (24 a 28 ca), and then holds 164,999 of the 165,000 shares.

The free filing index lists this document under VIGNOBLE LATOUR (528291362); its content is LATOUR IMMEUBLES’.

SHA-256: `179294fb6a74750b1b4a4b0e1eb2bdf4a3e9d85469d25f3247345fd4efa82ec5` (167,438 bytes).

### maladiere-gfa-2013

[GFA de la Maladière: December 2013 founding deed](https://actes.ccm2.net/acte/70f2c8df-a737-401a-927d-1982c1fef343#page=5) — 39 PDF pages. Deed date **2013-12**; deposit **2014-05-22**. Pages read: 5, 13.

Contribution of Aloxe-Corton A 14 Le Charlemagne (9 a 34 ca, Corton-Charlemagne) among family vineyards. No lease or tenant is recited for it.

SHA-256: `31883a63d744cde00039f0b1ba8905b62374e65cdad0a3bb34004a66f3bd33cf` (1,528,012 bytes).

### marchal-latour-statutes

[GFA Domaine Marchal-Latour: statutes updated 17 May 2025](https://actes.ccm2.net/acte/e075dff5-8ee1-4eb1-ac71-af0bd65cf103#page=2) — 20 PDF pages. Deed date **1975**; deposit **2025-12-23**. Pages read: 2, 3, 5; checked against page images: 3.

Founding contribution of Aloxe-Corton A 41 (Le Charlemagne), A 56 and A 92 (Les Pougets) and D 20 (Le Clos du Roi) with areas. All contributed land is recited as let to the Société Civile Domaine Louis Latour: the 1966 lease, then a new 25-year lease of 7 December 2001 for 11 November 2001 to 10 November 2026.

The GFA was registered on 28 March 1975; the schedule is its founding contribution.

SHA-256: `b923959e9445099e9f0a3acaf2a3e24f4fd8a12ae34ad5e8d762f8e15dc83254` (1,210,877 bytes).

### memoire-de-vignes-2024

[MÉMOIRE DE VIGNES: statutes of 24 July 2024](https://actes.ccm2.net/acte/d1860966-223d-4e4e-841f-3e68dcc9a081#page=2) — 26 PDF pages. Deed date **2024-07-24**. Pages read: 2, 3, 25.

Formed as a GFV on 15 July 2024 and converted to an SCI on 24 July 2024. Its parcel annex includes Aloxe-Corton Le Corton C 11 (57 a 00 ca). The statutes define an 18-year rural lease of the parcels, by deed of 24 July 2024, to SCEA du Domaine Poisot-Piguet (384 069 985), and record LVMH Miscellanées acquiring shares the same day. The PDF has a text layer.

SHA-256: `df26c5c3be8842164507e65ad1aa921b83e819fac6643f35c87bb5fe74da1875` (1,539,666 bytes).

### ravaut-gfa-1988

[GFA du Domaine Ravaut Père et Fils: 25 October 1988 statutes](https://actes.ccm2.net/acte/7849c27c-d998-4597-b6fc-a49ecdae83a7#page=5) — 46 PDF pages. Deed date **1988-10-25**; deposit **2020-09-10**. Pages read: 5, 16, 17; checked against page images: 16, 17.

Statutes established by notarial act of 25 October 1988. Contributions include Ladoix-Serrigny Hautes Mourottes AH 121, AH 122, AH 123 and AH 124 and Aloxe-Corton Les Bressandes D 84, D 90 and D 101, each with its area. The GFA may only let its land; no tenant is named.

SHA-256: `34e68f91ea09328466c889e863cc578148bdf0261e16e30a430dce100d2d3e79` (2,398,307 bytes).

### rolland-latour-2005

[GFA Rolland-Latour: 15 December 2005 founding deed](https://actes.ccm2.net/acte/50ba4241-90a5-488b-b9e7-b334a719282f#page=19) — 34 PDF pages. Deed date **2005-12-15**; deposit **2006-02-21**. Pages read: 19, 20; checked against page images: 19, 20.

Contribution of Aloxe-Corton A 48 (Les Pougets, 93 a 40 ca) and B 6 (Les Languettes, 1 ha 95 a 80 ca). They are recited as let to the Société Civile Domaine Louis Latour by a lease of 8 November 2001, for 25 years from 11 November 2001 to 10 November 2026.

SHA-256: `ead3b2c8d3e0607a3a207c6a0dda581f8d764b72c3fa42501f3d1e03db717811` (1,358,949 bytes).

### rue-des-chaumes-2025

[Société Civile Rue des Chaumes: 9 September 2025 contribution deed](https://actes.ccm2.net/acte/1a49750c-7adb-4a5e-98d2-0ddda22d386e#page=1) — 34 PDF pages. Deed date **2025-09-09**; deposit **2025-09-12**. Pages read: 1, 2, 9, 14.

A contribution of Aloxe-Corton buildings to the SC, with SAS Philippe Senard (380 720 227) among the parties. It recites that the SC was formed in 1978 with Senard family contributions and that building parcel I 266 is under a nine-year commercial lease to SAS Philippe Senard from 1 April 2023. It names neither of the SC’s recorded Corton parcels (I 9, I 252).

SHA-256: `56adebeb7e731b1601d152ee6e2c7a36f524488c01d02de87b7c94ad7a51e0ff` (1,959,957 bytes).

### sordoillet-gfv-2009

[GFV Marie Sordoillet: 2009 founding deed](https://actes.ccm2.net/acte/33491379#page=8) — 26 PDF pages. Deed date **2009**; deposit **2009-03-26**. Pages read: 8, 9, 12; checked against page images: 12.

Contributions of Aloxe-Corton A 4 (Le Charlemagne), A 58 (Les Pougets), A 120 (Les Chaumes et la Voie Rosse), B 13 (Les Perrières) and D 26 (Les Bressandes), with areas. The land is recited as let to Maurice Chapuis, agriculteur at Aloxe-Corton, under a deed of 20 and 21 June 2001 renewing the lease for 25 years from 1 July 1995.

SHA-256: `0d94581b5c78aa74bbcfffaef82ed329dfbba96ab766f42338f4338b8a68eebc` (1,029,535 bytes).

### st-vincent-marechaudes-2014

[GFV Saint Vincent Corton Les Maréchaudes: founding deed](https://actes.ccm2.net/acte/682cc768-a479-4982-94de-a921025010a0#page=4) — 26 PDF pages. Deed date **2014-12**; deposit **2015-01-22**. Pages read: 4, 5, 7.

Contribution of Aloxe-Corton E 117 Les Maréchaudes (28 a 80 ca), planted in pinot noir. A 2004 nine-year lease is to be terminated and replaced by a 30-year long-term lease, retroactive to 1 September 2014, to one of the GFV’s managers personally; rent half in money, half in bottles of Corton Maréchaudes.

SHA-256: `d14f3d2abb0de6e32bb5929c4cbe16a47253e1b5d433585454814c0ff0d0354a` (1,655,916 bytes).

### vifoncier-gfv-1996

[GFV Vifoncier Charlemagne: 30 October 1996 founding deed](https://actes.ccm2.net/acte/9a2b23eb-79d0-4a2e-a22f-10dfc23e97b0#page=5) — 20 PDF pages. Deed date **1996-10-30**. Pages read: 5; checked against page images: 5.

Contribution of undivided rights in Pernand-Vergelesses En Charlemagne AL 130 (11 a 90 ca), AL 174 (6 a 44 ca) and AL 176 (2 a 36 ca). No tenant is named.

SHA-256: `552ce4cac6f358d6257606a6e539cc269972df8f450dabf760c72fe7284a4df3` (782,708 bytes).

### vignoble-latour-2011

[VIGNOBLE LATOUR: statutes after the 28 September 2011 contribution](https://actes.ccm2.net/acte/b395bdda-43cc-467b-885d-c30ad373c068#page=1) — 24 PDF pages. Deed date **2011-09-28**; deposit **2011-12-30**. Pages read: 1, 3, 6, 7, 8, 9, 10.

Maison Louis Latour contributes undivided one-third shares of Corton parcels co-owned with the Corton-Grancey GFA, among them A 46, A 47, A 49, A 50, A 51, B 26, B 29, B 36, C 10, C 56, D 30, D 62, D 105, D 106, D 109 and N 50, each with its area. Maison Louis Latour then holds 54,999 of the 55,000 shares.

The free filing index lists this document under LATOUR IMMEUBLES (528291479); its content is VIGNOBLE LATOUR’s.

SHA-256: `c8b07068c9ec12aa2fa8c2ccc97714df1ac35ec3d955725396d4879af5e92544` (209,157 bytes).

### vincent-rapet-gfa-2017

[GFA du Domaine Vincent Rapet: 2017 founding deed](https://actes.ccm2.net/acte/509706b2-6590-45f0-9fc1-5b6ba2e423a6#page=9) — 54 PDF pages. Deed date **2017**; deposit **2017-09-29**. Pages read: 9, 10, 11, 14, 26, 35; checked against page images: 35.

Contributions of Aloxe-Corton A 69 (Les Pougets), A 88 and A 121 (Les Chaumes et la Voierosse), N 82 (Les Combes) and Pernand-Vergelesses AL 308 (En Charlemagne), with areas. Leases of 1985 and 1999 are recited, and SAS du Domaine Rapet Père et Fils (319 775 417) declares itself the tenant in place of the contributed parcels (printed page 31).

SHA-256: `d0b5bcf6de47434a013a48deb93b528099505232ac74de8c4fdcb96e08ff21ef` (3,029,671 bytes).

## Screened filing inventory

All filings downloaded and OCR-screened, by holder. “Hits” lists PDF pages whose OCR text names a Corton climat or two of the holder’s own references; a hit is a page to read, not a finding. Filings without a cited finding were screened only.

| Holder | Deposit | Filing | Pages | Hits | SHA-256 |
| --- | --- | --- | ---: | --- | --- |
| BICHOT SA (036380046) | 27/07/2022 | [Procès-verbal d'assemblée générale mixte / Statuts mis à jour / Procès-verbal du conseil d](https://actes.ccm2.net/acte/22570176) | — | not screened | `383884876ab39260e10efec4bdbabf49263c6a99e043c2dc5dbda474f015b7c3` |
| BICHOT SA (036380046) | 15/05/2007 | [Rapport du commissaire à la fusion](https://actes.ccm2.net/acte/22570243) | 8 | — | `bd2cc574774920b0e95824f9d95874bc82a8e5619d0ef5f2ba15111134ad958f` |
| BICHOT SA (036380046) | 19/06/2007 | [Projet de traité de fusion](https://actes.ccm2.net/acte/22570244) | 58 | 13 | `7fd51fdfc87736c5e24d0ab5721d1c4c80a7f3f051fc117cdec3fe837682d154` |
| BICHOT SA (036380046) | 04/07/2007 | [Déclaration de conformité / Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/22570219) | 19 | — | `708124e5f20351fa4ad93692f6e50a6faa4d776e731c07f5f17245a0523603d2` |
| BICHOT SA (036380046) | 31/07/2025 | [Décision de modification certifiée conforme par le représentant légal](https://actes.ccm2.net/acte/36885353) | 2 | — | `eb70ad1291161f7c89d42b348d0c9eaf18f0077efafefd9792afefea58d15efa` |
| DOMAINES BERTAGNA (037180015) | 16/02/2026 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/99a389e5-0455-4dc4-b6a4-003ec4285310) | 8 | — | `d94e880c46373b154b7f3a7f5b872a5f989369e89537aa82154fceed154c3577` |
| DOMAINES BERTAGNA (037180015) | 13/11/1998 | [Divers / Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/17a03779-9472-43d3-809b-096ca416cb13) | 22 | — | `9f2e638377e267e88af76610f2d8f1b1822f71721b122cff9b66cd19dac0fbef` |
| DOMAINES BERTAGNA (037180015) | 31/05/2018 | [Extrait de procès-verbal d'assemblée générale ordinaire](https://actes.ccm2.net/acte/d7583a74-96ab-4090-8fc8-e9405fe72c71) | 2 | — | `bfb40ed5c9ba67d6d344a4890cdb567b096ec4c0b0c6cd229b9c7c51684a4726` |
| DOMAINES BERTAGNA (037180015) | 21/11/2019 | [Traité de fusion](https://actes.ccm2.net/acte/af17a043-6f5d-40bf-b4c2-ff4460c86290) | 19 | 8 | `41ffa85b20d1ea476650cf355f0519d76bf09021c4c23083b0cc3cc4876d8265` |
| DOMAINES BERTAGNA (037180015) | 25/02/2020 | [Procès-verbal d'assemblée / Projet de traité de fusion](https://actes.ccm2.net/acte/d0a79b25-5cd3-4001-bde5-109a45f4fac1) | 21 | 3, 10 | `167045c03d775a8c245f4330940444bd363fcd4808f53acec57556beb6eda29a` |
| SOCIETE DE GESTION DU DOMAINE DU CHATEAU DE MEURSAULT (300461761) | 13/12/2013 | [Procès-verbal d'assemblée générale extraordinaire / Statuts mis à jour](https://actes.ccm2.net/acte/3e0abffc-e574-4558-866a-0c87dc5a7522) | 16 | — | `5322dd80dec0a879e0a233d15bd39ccce01007a9ee24efcc8e47d482d7d39421` |
| SOCIETE DE GESTION DU DOMAINE DU CHATEAU DE MEURSAULT (300461761) | 11/03/2003 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/5c6e9ed1-06a1-4448-9cb3-554792c140e0) | 20 | — | `76edf6841b2a580ea45cbf2baa5724d450ec3ce0ee4d6576a755ec1f191df641` |
| SOCIETE DE GESTION DU DOMAINE DU CHATEAU DE MEURSAULT (300461761) | 16/07/2012 | [Extrait de procès-verbal d'assemblée générale ordinaire](https://actes.ccm2.net/acte/dfe724a7-0239-4a27-ae50-b9f48581663f) | 1 | — | `e97359504955ce413dc096ff13bc0ac54d2d97e5e4fe94e6e3806e11f4f2cf97` |
| SOCIETE DE GESTION DU DOMAINE DU CHATEAU DE MEURSAULT (300461761) | 03/12/2018 | [Extrait de décision(s) de l'associé unique](https://actes.ccm2.net/acte/5bbbc5db-9b03-41e0-95d0-109db2018720) | 3 | — | `21a6defa434d332ea9c8b22a25cba4dff12ac9748f2f045e1ac0e73937d9b916` |
| SOCIETE DE GESTION DU DOMAINE DU CHATEAU DE MEURSAULT (300461761) | 23/02/1996 | [Acte sous seing privé / Procès-verbal d'assemblée / Procès-verbal du conseil d'administrat](https://actes.ccm2.net/acte/18bc2eeb-c55c-490d-8850-c9ee0a1a0092) | 29 | — | `f6b76fc9ad0b56b2bdb14fd9f99dd3b74a867d6e3a12fd4e6e8193ba3795cb45` |
| SOCIETE D'EXPLOITATION DU DOMAINE PARENT (302572094) | 01/04/2025 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/8bf91907-e998-4e7f-8730-df376981c1a5) | 22 | — | `738f47b31b4a6b938757f4bbcccb60471476ee30f3635f7ae3be5fd4573250c6` |
| SOCIETE D'EXPLOITATION DU DOMAINE PARENT (302572094) | 20/01/2006 | [Procès-verbal d'assemblée](https://actes.ccm2.net/acte/511fe606-27f8-4c10-a4c0-ddb27079b10a) | 3 | — | `bdb9564bb5fa3e13fc709d6c17ca60890eb08b967bfce6115ca36cf2a57dc1b4` |
| SOCIETE D'EXPLOITATION DU DOMAINE PARENT (302572094) | 12/02/2007 | [Rapport du commissaire aux comptes](https://actes.ccm2.net/acte/28a20c02-5ff9-4032-9afb-7ba381e4366c) | 3 | — | `f96c62de24b7d4925080c4bedbfc2a1f6c62e749b1d9fe3632f11b88ba847e3a` |
| SOCIETE D'EXPLOITATION DU DOMAINE PARENT (302572094) | 16/05/2007 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/574cae62-4194-414f-a025-e51792f0c85e) | 28 | — | `f6fed4647aad9e112d668437367d95ffbf436f70a4389fbb75894eaba61dcd09` |
| SOCIETE D'EXPLOITATION DU DOMAINE PARENT (302572094) | 01/04/2025 | [PV ayant décidé et constaté la modification enregistrée, certifié conforme par le représen](https://actes.ccm2.net/acte/20ea9f1c-fbc8-40b7-91ca-21a110bdcdd5) | 2 | — | `0436709c20539a9c47c8d4cb14efb1de3851b0d91552afe96157a37cbbd1f5ab` |
| SOC CIV DOMAINE HERITIERS LOUIS JADOT (312990021) | 01/04/2025 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/b1f78f51-8b4d-4a76-aa69-80e19882be46) | 19 | — | `8b1aca4eeb998497dfd567412adf8443fc2246a19ca6422c2273f5cba800c401` |
| SOC CIV DOMAINE HERITIERS LOUIS JADOT (312990021) | 31/10/2002 | [Acte notarié / Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/81e58521-dcd2-451a-8aff-c806e2f7fd3a) | 42 | — | `b52b9bba982a1b32a32bddb0be4e34933b4103793eced88278d459c7048e5924` |
| SOC CIV DOMAINE HERITIERS LOUIS JADOT (312990021) | 12/03/2025 | [PV ayant décidé et constaté la modification enregistrée, certifié conforme par le représen](https://actes.ccm2.net/acte/3ac857de-bab6-4a8b-9344-33126239c63a) | 1 | — | `eeda4f0784ce5f7209a75a4db0c7490cab245585fad170ae36816c6bd0022763` |
| SOC CIV DOMAINE HERITIERS LOUIS JADOT (312990021) | 28/03/2025 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/860f1268-ec38-4ad0-8ec0-70b468908c32) | 19 | — | `8b1aca4eeb998497dfd567412adf8443fc2246a19ca6422c2273f5cba800c401` |
| SOC CIV DOMAINE HERITIERS LOUIS JADOT (312990021) | 28/03/2025 | [PV ayant décidé et constaté la modification enregistrée, certifié conforme par le représen](https://actes.ccm2.net/acte/ef077b6f-f6c9-4a4c-868e-3385f42b011a) | 5 | — | `73564e9e5328f435bc513e33d8b4e1a5b9380f2252b922cf85de7499f1aa2453` |
| DOMAINE JOSEPH DROUHIN (314306747) | 09/03/2023 | [Procès-verbal d'assemblée générale / Statuts mis à jour](https://actes.ccm2.net/acte/2c2f6a93-a6a4-4e84-837c-a14c2ad98b0a) | — | not screened | `698f29022e4df2e9688e92469d44db9fab20db598c6fb9807f6610be1d33bfe0` |
| DOMAINE JOSEPH DROUHIN (314306747) | 21/03/1995 | [Acte notarié / Divers / Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/a1e30b4f-0b81-4469-8549-c970f14921a4) | 35 | — | `782bc16ff360f8826377da28e967c7d25be0be70550667014b9e120f5d0c5a66` |
| SOCIETE CIVILE RUE DES CHAUMES (314722661) | 10/12/2025 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/cadac728-b30b-4620-b1f8-f1f463c31bc0) | 28 | — | `cd2a080b07c6dda2a9978979c20c42fa14b18c7ed290dbfded5848028d8cc055` |
| SOCIETE CIVILE RUE DES CHAUMES (314722661) | 12/09/2025 | [PV ayant décidé et constaté la modification enregistrée, certifié conforme par le représen](https://actes.ccm2.net/acte/1a49750c-7adb-4a5e-98d2-0ddda22d386e) | 34 | 6, 8 | `56adebeb7e731b1601d152ee6e2c7a36f524488c01d02de87b7c94ad7a51e0ff` |
| SOCIETE CIVILE RUE DES CHAUMES (314722661) | 17/09/2025 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/2cb3cfeb-fa90-446b-8cc3-77c113b0d5f4) | 28 | — | `3f5c009fcd134ef2b86f0e5fdee126c4eea5fa36e6a6d22f58019c65f7a69e06` |
| SOCIETE CIVILE RUE DES CHAUMES (314722661) | 10/12/2025 | [Procès verbal de décision d'assemblée générale](https://actes.ccm2.net/acte/886fb1a6-0b35-4381-a36e-1414c2266402) | 5 | — | `b5989c392bd4f745657d51558b555008df49bf8c31ff37fc199ff9a3c2d65493` |
| SOCIETE CIVILE RUE DES CHAUMES (314722661) | 26/07/2001 | [Acte notarié / Statuts mis à jour](https://actes.ccm2.net/acte/4d01dacb-fe78-4ea7-baf3-15e6eccbe30e) | 49 | 10, 14, 16 | `b9932c7c8693b8957fa928c302a11299945dd5dc7b5aae2bc7242a1bba422256` |
| DOMAINE ROBERT RAPET (319775433) | 28/05/2025 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/c5758fce-3d02-4930-a7f7-425b2f6377e7) | 40 | — | `facba87875caa40cea1d0a295da7b91bdda7f4a4dacd986ea324d17341ff0973` |
| DOMAINE ROBERT RAPET (319775433) | 04/03/2010 | [Acte sous seing privé / Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/9e596a61-c711-4d2c-b9ff-2a9b94b487c9) | 7 | — | `248042e650768bfed2b032aaa94de1c56de906b560294f2f427d1ca1783bc596` |
| DOMAINE PAVELOT (322463894) | 13/09/2012 | [Procès-verbal d'assemblée / Acte notarié / Statuts mis à jour](https://actes.ccm2.net/acte/90d1807e-b4bf-4653-b048-539e2f5616bc) | 17 | — | `e605a962a43017f53bd3ae1a8104c50b68716b5414282e523d398b54baa6b8c8` |
| DOMAINE PAVELOT (322463894) | 29/01/2001 | [Acte notarié / Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/9ae5532a-5560-4993-a672-1e28ba219a39) | 23 | — | `5d007342485f66f40ff805ea8f51b1390c091175123ee1beb71dabf30dd1ae6a` |
| SCA CHARLEMAGNE (322826686) | 22/01/2019 | [Procès-verbal d'assemblée générale extraordinaire / Statuts mis à jour / Acte sous seing p](https://actes.ccm2.net/acte/9c261459-adca-435d-9df2-2bcc09c4dbb8) | 30 | 1, 2, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 17, 23, 24 | `0ef5089c8cf27c58c998fb15aad37071a3d01679a8e6d52108d9e90a64843262` |
| SCA CHARLEMAGNE (322826686) | 04/05/2018 | [Liste des sièges sociaux antérieurs / Procès-verbal d'assemblée générale extraordinaire / ](https://actes.ccm2.net/acte/e26ee48c-843d-4e4b-9980-5e83accecec7) | 47 | 4, 10, 12, 19, 20, 21, 22, 24, 25, 27, 29, 31, 39 | `593ababe34d1716aff679cee331e1809074464c561a1af7416eb60faff7240c1` |
| SCA CHARLEMAGNE (322826686) | 08/12/2017 | [Procès-verbal d'assemblée / Acte notarié / Statuts mis à jour](https://actes.ccm2.net/acte/a5d64dc6-3c88-46f0-a66a-d710e4fb6e64) | 60 | 29, 33, 41, 44 | `69b39ec3a0088c60fd01591ead46491ea22e56cf5e9d2da23ca15045922497f7` |
| MICHEL MALLARD ET FILS (323178111) | 11/02/2021 | [Statuts mis à jour / Procès-verbal d'assemblée générale extraordinaire](https://actes.ccm2.net/acte/791ed369-affa-4449-a41d-671a14b9d690) | — | not screened | `05cdb7453d051a6549ff23956f0eb5fb7e4ad74485a440c3774a5b74729124a2` |
| MICHEL MALLARD ET FILS (323178111) | 29/08/1996 | [Acte sous seing privé / Divers / Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/f3e0d2da-ce27-4ba7-ab5e-c8b822ec5025) | 41 | — | `d6d7020e4811d855644aeccd4873ad27a36978bc6d8c29b1fdb7e50cb514cb09` |
| MICHEL MALLARD ET FILS (323178111) | 18/12/2020 | [Rapport du commissaire à la transformation](https://actes.ccm2.net/acte/c8e15883-3a10-4687-b6d7-9230de9476b3) | 5 | — | `2fa03ca35251866eaabb3ee192a245ba9f1fdbfa20adce5b923ae37532e33e19` |
| MICHEL MALLARD ET FILS (323178111) | 16/11/1993 | [Acte sous seing privé / Divers / Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/eac1d74a-6dd2-49af-9fa2-e08f97e1ac72) | 56 | 47 | `086a94844375d2f071fbfe0b9f1b40a40234044e9bf4f238e494ba05b2a993f4` |
| DOMAINE DES CROIX (324989359) | 13/09/2022 | [Procès-verbal d'assemblée générale extraordinaire / Statuts mis à jour](https://actes.ccm2.net/acte/c1a07e4d-882e-4330-8b84-ac5c0a1d08b0) | 20 | — | `8717494c0ec8bb5a2276eabc65426106b686fe10b7979bc9555d6b42254c10f8` |
| DOMAINE DES CROIX (324989359) | 09/05/2006 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/ec95666b-80cc-4641-901e-1eeda808e8a5) | 43 | — | `d72a3dfc08103337af35b9d0cfdb5381baa9406e2fac66066ed620a530b35b61` |
| DOMAINE DE LA JUVINIERE (325421634) | 02/09/2026 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/ae9363a9-4a7f-4e5d-8ab1-75ab24be57fc) | 18 | — | `878466a9273d45b9869785f9fc1f97db42fbebad24a5acb82bd8077eda158078` |
| DOMAINE DE LA JUVINIERE (325421634) | 13/01/2011 | [Procès-verbal d'assemblée / Acte sous seing privé / Statuts mis à jour](https://actes.ccm2.net/acte/adc5ef3a-ba96-48f1-a2f1-ab19042f0e67) | 3 | — | `aeb5158f7212b1fca2e07b10b757e61b9b18fc9081a3aea58944ea3f2c638cfc` |
| DOMAINE DE LA JUVINIERE (325421634) | 29/07/2013 | [Traité de fusion](https://actes.ccm2.net/acte/08ed7a1b-dc12-4900-aec4-43ce9a7ea04d) | 47 | 13 | `f7d539647b4c6de201ad1013e22a6ea79073132ba0ea2f4a6a8467f62c3831c7` |
| DOMAINE DE LA JUVINIERE (325421634) | 29/08/2013 | [Rapport du commissaire à la fusion](https://actes.ccm2.net/acte/0ec78ad2-74e4-427f-9a6e-236dc27b9398) | 13 | — | `f9b93d52039ed01a1c06a3555d4440b978f939c0eaaab2c1b0485566eb52d7bf` |
| DOMAINE DE LA JUVINIERE (325421634) | 17/12/2013 | [Procès-verbal d'assemblée générale extraordinaire / Déclaration de conformité / Statuts mi](https://actes.ccm2.net/acte/db343cc9-8f7e-4529-ae87-7ea2a6e0bfaa) | 75 | 19 | `60503ace0c1b597e9b77139c5338a80688fee4def4de843f2f6b0df46f92ca3f` |
| EARL GASTON ET PIERRE RAVAUT (326781853) | 02/06/2017 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/a73c6006-9887-4461-a82f-c3ca0f02ef5d) | 39 | — | `91c4a7b64cf425febda0fd173fc7c687ab2991329d9fac8a4622f28c66f3427c` |
| EARL GASTON ET PIERRE RAVAUT (326781853) | 03/07/1995 | [Acte sous seing privé / Divers / Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/705bd679-44d4-49c0-bb84-f30bef367f51) | 41 | — | `d831e2c5a102b2c82fd144722cb472633df1111d3d391e6907b91b0df2e01bc0` |
| EARL GASTON ET PIERRE RAVAUT (326781853) | 21/02/1995 | [Acte notarié / Statuts mis à jour](https://actes.ccm2.net/acte/ed61b6b8-9e4f-4151-8996-cec6e0f764ce) | 13 | — | `2aa88da8cff3045e80385b1153b57fde4018573cfa4a3241f7f643e4e17bb10a` |
| GFA JAVILLIER (326791548) | 04/02/2026 | [Copie des statuts](https://actes.ccm2.net/acte/61ab5813-fbf6-41b1-9905-3cc87409d3c8) | 29 | — | `431ec3c73ecc6a25d4d572ee9a852a84266c661fb51fd24d9b3d5bc8c8a0decd` |
| GFA JAVILLIER (326791548) | 12/06/2025 | [Le projet de fusion (intranationale ou transfrontalière)](https://actes.ccm2.net/acte/d41bfb8d-31a2-4c9b-8d99-ea904c21fdb7) | 94 | 17 | `c62ffdec2855854447b4d78e133691fb50312f6125710c56450cc989076f6d35` |
| GFA JAVILLIER (326791548) | 16/06/2025 | [Le rapport du commissaire à la transformation](https://actes.ccm2.net/acte/44864ada-2c7e-4638-bcea-535c62bfba58) | 4 | — | `ec5bfe43236bdf74e30a28f252ab4ce95dc6c87da79c0dd790d5114665b00524` |
| GFA JAVILLIER (326791548) | 29/07/2025 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/f98adac3-dac5-464c-9c51-3ecd77472062) | 29 | — | `431ec3c73ecc6a25d4d572ee9a852a84266c661fb51fd24d9b3d5bc8c8a0decd` |
| GFA JAVILLIER (326791548) | 29/07/2025 | [PV ayant décidé et constaté la modification enregistrée, certifié conforme par le représen](https://actes.ccm2.net/acte/9a05eb9b-854c-45a2-a8dd-fe0948021784) | 11 | — | `43cdac42ccfc3fdcfe281b366278e23569fca3fb3d57c7d546cb8b153492a51b` |
| SOC CIVILE DE LA JUVINIERE (327166898) | 16/01/2009 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/1273ac84-9aad-4c03-91fc-158a9e41820e) | 27 | — | `bbd4b74596656048c34adfc427b3a05dc5238085e7775518ba0a0d3459c17186` |
| SOC CIVILE DE LA JUVINIERE (327166898) | 12/07/2001 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/a6d9def3-f7ad-4bcf-8d7d-545c7d93b6f3) | 25 | — | `df60b40774c4e3449d2392cb8099a1dc7806ae32dbdfa2b980fb14a0c74d1adc` |
| DOMAINE FRANCOISE ANDRE (328061346) | 21/09/2020 | [Acte sous seing privé / Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/4f48da5e-e139-41fd-b0c6-009138295bc7) | 69 | — | `f72dc74d7445b592dab4c92b8a27c143c95f9154a2fb1d2959267944e186cacd` |
| DOMAINE FRANCOISE ANDRE (328061346) | 23/03/2000 | [Divers / Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/9c88808b-6563-47d4-b5ca-cdbd29523d64) | 29 | — | `b1bdbd8acae564a428675832b57677f2837c48362a0b3f39723410b816239cfe` |
| DOMAINE BONNEAU DU MARTRAY (328186416) | 19/07/2022 | [Statuts mis à jour / Décision(s) des associés](https://actes.ccm2.net/acte/257abe6c-0e80-46cf-a187-cf6e3e2eae31) | 11 | — | `8ce700a0b60ae5003f060013f54a0347857876e747eb04313376cc92d4ee09e1` |
| DOMAINE BONNEAU DU MARTRAY (328186416) | 06/12/2016 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/7feee376-c220-4a5c-89fa-b21b4b49b278) | 16 | — | `a03ec36663c0fc9bbfc9d66d6c2681c29ec63c0943e09c5c96aa18a51b903eaa` |
| DOMAINE BONNEAU DU MARTRAY (328186416) | 12/06/1997 | [Divers / Liste des sièges sociaux antérieurs / Procès-verbal d'assemblée / Statuts mis à j](https://actes.ccm2.net/acte/687cdf06-b6f9-44a0-b938-89411cce77cc) | 13 | — | `e623c4f65cbb5da79c0dd3feef7864d99318e5cbe5089cfe4d28951a742cea81` |
| SOC CIV AGRIC  DOMAINE DE LA VOUGERAIE (330713074) | 20/12/2024 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/e7c55c16-4889-4311-adb2-051e88e0b123) | 19 | — | `729fca8702f2136c54b0630e72b283a6964ab907dec768d60f1f2e0dd2c3f79e` |
| SOC CIV AGRIC  DOMAINE DE LA VOUGERAIE (330713074) | 20/12/2024 | [PV ayant décidé et constaté la modification enregistrée, certifié conforme par le représen](https://actes.ccm2.net/acte/6cec5c20-e814-452a-a962-d712e13e0e3c) | 3 | — | `70e4c4cbc6fe4d7cf6a841004e2ae5d431fbcf2b9599ed1e892a54f4595f95e9` |
| SOC CIV AGRIC  DOMAINE DE LA VOUGERAIE (330713074) | 28/07/1998 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/43db538b-995e-4f66-aad9-5d8402e1c8d8) | 4 | — | `9e3664c68fd5dff75b85fd0883b74867d9f51701504b81321698321c51a0233c` |
| SAS DOMAINE PHILIPPE CHARLOPIN PARIZOT (334354859) | 31/01/2020 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/1ad4bee7-0606-4c03-9d17-78bc9a6e4547) | 28 | 3 | `cc8409a2b842fdd98a0b54e5bb3cca3bd2267ee69e2a954d59a2c6ec14598a7b` |
| SAS DOMAINE PHILIPPE CHARLOPIN PARIZOT (334354859) | 16/12/2019 | [Rapport du commissaire à la transformation](https://actes.ccm2.net/acte/2af2ca4b-fb1f-47a2-8baa-0f5dd7f09ae5) | 5 | — | `1687198cfff022acdb243c9f2146a069d622f91eb1879fd6ef94a3b601233bb0` |
| SAS DOMAINE PHILIPPE CHARLOPIN PARIZOT (334354859) | 20/03/2002 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/f44f0843-c060-492e-b7f9-adf0ff4a49bb) | — | not screened | `681f63cec4d853e288896a9552e00829d0b3fb690f400d410cd880e714e66fac` |
| GFA DU DOMAINE RAVAUT PERE ET FILS (348852237) | 10/09/2020 | [Acte notarié / Statuts mis à jour](https://actes.ccm2.net/acte/7849c27c-d998-4597-b6fc-a49ecdae83a7) | 46 | 16, 17, 18 | `34e68f91ea09328466c889e863cc578148bdf0261e16e30a430dce100d2d3e79` |
| DOMAINE LOUIS VIOLLAND (349583500) | 21/10/2011 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/6f6dd7d7-1f96-4970-898c-4b3ce21ae35b) | 8 | — | `b435813d43298d27e0813504f6e4949aa8c04e20286f96eeae30538bc5c5a454` |
| DOMAINE LOUIS VIOLLAND (349583500) | 28/12/1993 | [Acte sous seing privé / Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/e69c4630-0b78-4df7-bc87-893f74dd9423) | 22 | — | `b98e9164029c4b8070865193e8a45b9b2c4ed578282772e6fe752c8f1d3ea1f6` |
| CLOS DE LA BUSSIERE (377495288) | 04/06/2026 | [Copie des statuts](https://actes.ccm2.net/acte/8e5f36f6-1b7e-44ab-9a79-a3e46d24ed98) | 30 | — | `e7937341ef8db621aad794a7f21027ad500ddf1387d97118bc639026eb576df4` |
| CLOS DE LA BUSSIERE (377495288) | 04/06/2026 | [Procès verbal de décision d'assemblée générale](https://actes.ccm2.net/acte/2d777d41-7dc7-4852-af8c-2ae29d6aaba7) | 3 | — | `31a268e1f94ae96f213a81d7df95e6422e88fbdbbf26ceac2ee10614c5d98473` |
| CLOS DE LA BUSSIERE (377495288) | 30/03/2012 | [Acte notarié / Statuts mis à jour](https://actes.ccm2.net/acte/eb94ec4c-414f-4aca-a965-f70efe4fd778) | 13 | 6 | `500e85b1bae1582caf9a5446aa40c2a66a3c60f65d8165a31b9ce29d732118bf` |
| SARL MAURICE CHAPUIS (378948053) | 29/01/2026 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/ce6f890a-581f-4bcb-9c7b-ab81e6468875) | 21 | — | `587d608e37cc9a5a67193c0296e96b131a2c9f27864f44fd7f10664bd1fe1a66` |
| SARL MAURICE CHAPUIS (378948053) | 03/02/2025 | [Le projet de fusion (intranationale ou transfrontalière)](https://actes.ccm2.net/acte/808c0e04-fcb6-4825-815d-578585da51c5) | 15 | 11 | `01efc5884ef2785df88b90bd4927500857c97ed428bd602214f6bf30e05b326e` |
| SARL MAURICE CHAPUIS (378948053) | 04/02/2025 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/6d6f9ac7-b68d-48f9-91a8-ec4f580fec4e) | 1 | — | `613662f8b20672e7006e78ec77ad1619439658626b4504c8f366d42d02298765` |
| SARL MAURICE CHAPUIS (378948053) | 03/04/2025 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/c1ac95a1-bf8f-4a5f-8cb2-ec3461df989a) | 21 | — | `65c1df4af191a2fa5dfece5e49c6b1d1fa075c03ba6b747e4dadf8ee2fae4e29` |
| SARL MAURICE CHAPUIS (378948053) | 03/04/2025 | [Décision de modification certifiée conforme par le représentant légal](https://actes.ccm2.net/acte/547a2218-975b-40d6-bf4d-2ad3fdb86b29) | 7 | — | `b217b47560effaec2251aa415d493454f71204ae87f9a671d92f3e74815209d6` |
| SCEA DOMAINE MICHEL VOARICK (384916870) | 15/03/2023 | [Procès-verbal d'assemblée générale extraordinaire / Statuts mis à jour / Acte notarié / Pr](https://actes.ccm2.net/acte/4803790) | 17 | — | `abe39f0db8f856559a8fcf19be5257c259e4c3bd53285269717f68d438dfcad5` |
| SCEA DOMAINE MICHEL VOARICK (384916870) | 19/11/2012 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/20393480) | 17 | — | `fa067042fe262ccb205ee74864845b0d4883c51bfbd25e37fd4ab7b92335c570` |
| DOMAINE TAUPENOT MERME (388212649) | 20/03/2025 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/aeaa3d00-884e-4ec9-9ecf-4da096a7458a) | 16 | — | `c2cb26b7b89c75e38255397743c9b946205b8cb899a35233cf6c765cbbe69fc8` |
| DOMAINE TAUPENOT MERME (388212649) | 11/03/2025 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/ccbc632b-b073-46a7-b116-76f532e76980) | 16 | — | `791909a5d8876aec13f0836025bfffccf2d4e5b37b82cfdd38164a7ef2578e75` |
| DOMAINE TAUPENOT MERME (388212649) | 11/03/2025 | [PV ayant décidé et constaté la modification enregistrée, certifié conforme par le représen](https://actes.ccm2.net/acte/c73676cf-6eb3-4759-b4a7-9a552dcc00e8) | 3 | — | `efc2804ae1dda2ee9b3617ce7808244499823ebe376686229b2dac9d32824122` |
| DOMAINE TAUPENOT MERME (388212649) | 20/03/2025 | [PV ayant décidé et constaté la modification enregistrée, certifié conforme par le représen](https://actes.ccm2.net/acte/afdffe02-69e6-4e18-a7a0-9028fe7b70ea) | 5 | — | `fb8d66ce4caf73826de89065cec611a9bd76cc13f4031508d238784df7772bef` |
| DOMAINE TAUPENOT MERME (388212649) | 14/04/1993 | [Acte sous seing privé / Statuts mis à jour](https://actes.ccm2.net/acte/1536f036-f0b0-453a-bccb-a321428086df) | 26 | — | `753de9c44adca130f7b6693ee9cc13ff3aeb3a6819afbe202ff212574116ed7c` |
| DOMAINE LE CLOS DU PAVILLON (392477600) | 21/10/2019 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/19968951) | 27 | — | `14372edbadbf664ea5bdbb37f60d321fd2291be9e01208979d7ce1bfe9e9f17a` |
| DOMAINE LE CLOS DU PAVILLON (392477600) | 04/10/1993 | [Acte sous seing privé / Attestation de dépôt des fonds et liste des souscripteurs / Déclar](https://actes.ccm2.net/acte/19968954) | 34 | — | `829b5fa9ea535147e056a95d3abc96897c96700d3ea124e81795bf4640178b7e` |
| DOMAINE LE CLOS DU PAVILLON (392477600) | 29/08/1996 | [Procès-verbal d'assemblée / Procès-verbal du conseil d'administration / Statuts mis à jour](https://actes.ccm2.net/acte/19968953) | 11 | — | `64893112ef0a615e938c9284b93d05494cc535064844bf0fd772f92882ddab43` |
| GROUP FONCIER VITICOLE PRESTIGE BOURG (398805366) | 18/06/2021 | [Statuts mis à jour / Procès-verbal d'assemblée générale extraordinaire](https://actes.ccm2.net/acte/e895ca7e-f27f-4328-b33c-a7a7357bd541) | 24 | — | `da2703029fc49bfa9a6174fa561f8d5d103a16864259a82959a6033ef5d76e35` |
| GROUP FONCIER VITICOLE PRESTIGE BOURG (398805366) | 09/11/1994 | [Acte notarié](https://actes.ccm2.net/acte/50f10ca3-c148-4e35-9576-787b7b8da5ec) | 25 | — | `ee1f9727d60429c5b1472665317fe1ef2b2eb7100bba583a81f75f26062fd286` |
| GROUP FONCIER VITICOLE PRESTIGE BOURG (398805366) | 13/03/2001 | [Acte sous seing privé](https://actes.ccm2.net/acte/f4341e2e-31fd-4519-b593-787f90dbdb09) | 3 | — | `a848c6b64f92b27f96d28eea34f09c16df22de589b5104b7dee1101b61ab5bab` |
| GROUP FONCIER VITICOLE PRESTIGE BOURG (398805366) | 11/08/2006 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/8a956979-08e3-45db-b029-3ad65b19fb6a) | 28 | — | `ad25460ea4971fc198c952940d9efe5b96dda4488d216d545a5606fe2fa7e415` |
| DE LA GRENELLE (400737938) | 23/10/2019 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/02d6e64a-28e8-4366-bcc7-4b53bdc52233) | 13 | — | `8cc2771baef591f83c6699b4683f74b091b70fe3317a7a617e283399ea2829f6` |
| DE LA GRENELLE (400737938) | 25/04/1995 | [Acte notarié](https://actes.ccm2.net/acte/3b59e268-33d9-49cf-9159-d394d96642b4) | 25 | 5, 8, 10 | `b9dafa50cd2b56bad1dc8b42471f7be3e09326f380f390e86cf5a09cb06118e2` |
| DE LA GRENELLE (400737938) | 13/02/1996 | [Acte notarié / Statuts mis à jour](https://actes.ccm2.net/acte/fd46394e-b784-40b4-b52c-87b6895862ca) | 47 | — | `2fe2e988f00c74e042786e001c6132cfcb4ef8d9ef593c52f612a47937b79c83` |
| LES COTEAUX DE SANTENAY (402345144) | 12/01/2025 | [Copie des statuts](https://actes.ccm2.net/acte/16131401-1395-4413-85f1-d28024657d17) | 31 | — | `ed18871afab7c71131e4b96a4069e59546d447c9956d67fa0c9e9ee8595accc4` |
| LES COTEAUX DE SANTENAY (402345144) | 22/09/1995 | [Statuts constitutifs](https://actes.ccm2.net/acte/17d4dde2-8f2d-4eb3-b209-e768ebdf4489) | 47 | 7 | `50c26d33d37a137ef99f690b8c07cdb3eed7538433b6e05294cc40bf0b8c0daa` |
| LES COTEAUX DE SANTENAY (402345144) | 22/01/1996 | [Divers](https://actes.ccm2.net/acte/eb26b834-9f34-4020-bfc1-e85215c42d6f) | 76 | 7, 21, 33 | `761488b8c3e7f8b7bfc47faab55d39459ad24589ea8db2fab5fd658a11e5d883` |
| GROUPEMENT FONCIER VITICOLE PIERRELIANNE (403405764) | 21/01/2022 | [Statuts mis à jour / Acte notarié / Procès-verbal d'assemblée générale extraordinaire](https://actes.ccm2.net/acte/32704708-afac-467c-878d-d792217eb15b) | 53 | 27, 42 | `2055821b62244c47281b3907f3da3dcb01971ef63d90abcaec18729a00fd48e5` |
| GROUPEMENT FONCIER VITICOLE PIERRELIANNE (403405764) | 18/01/1996 | [Acte notarié](https://actes.ccm2.net/acte/49845b9e-dcd5-45ee-a09b-987cbf70aad3) | 22 | 8 | `cccf4d00e9a5f9df1036425228a964a99eef7cfaf2f89d909394c9848c70eef6` |
| GROUPEMENT FONCIER VITICOLE PIERRELIANNE (403405764) | 24/11/2021 | [Acte notarié / Statuts mis à jour / Procès-verbal d'assemblée générale extraordinaire / Ex](https://actes.ccm2.net/acte/533db43a-2e6f-4620-a2a9-a7eacf299415) | 9 | — | `b9500ad8311723fe3aaa4848bff83f77fa9e16bea813ecfd20388b210073ee2c` |
| GROUPEMENT FONCIER VITICOLE PIERRELIANNE (403405764) | 24/11/2021 | [Acte notarié / Extrait de procès-verbal d'assemblée générale ordinaire / Statuts mis à jou](https://actes.ccm2.net/acte/dc5e6de1-1764-48b5-9e0a-d68059951a2a) | 23 | — | `29036d172011268b9be93140fa46c6606ccbb54f96345a2f16593d65947559c1` |
| GROUPEMENT FONCIER VITICOLE PIERRELIANNE (403405764) | 17/09/1996 | [Acte notarié / Divers / Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/3b9e19c6-a9db-4141-bd24-344b4f79672a) | 26 | 15 | `88fe2c6b7fa54efeb3b02dd577843ef3cf227815986497fd9ec9c0be81d7cdbd` |
| DOMAINE PIERRE MAREY PERE ET FILS (407881291) | 13/09/2019 | [Procès-verbal d'assemblée générale / Statuts mis à jour](https://actes.ccm2.net/acte/76dd8571-4cea-46c7-b5ec-5780b340de6a) | 21 | — | `bfd4e6f46f7865c373294d35076f071c369d3a221d393d633da6aa97bae1e3d4` |
| DOMAINE PIERRE MAREY PERE ET FILS (407881291) | 05/07/1996 | [Acte notarié / Procès-verbal d'assemblée](https://actes.ccm2.net/acte/75489d50-0220-417f-a5ba-a424bbb5946c) | 16 | — | `c569fb069386ed8c83b83c341d90cca02a0fc0ced2cdff3ab130b030f76fb9e3` |
| DOMAINE PIERRE MAREY PERE ET FILS (407881291) | 13/11/1998 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/1123bf7c-b87c-4ac4-a761-431994e9a412) | 18 | — | `09a14d488ee2332624282dcdd46cdc156677581e557974f59b24380e127e0fa9` |
| MAURICE CHAPUIS (408975357) | 04/02/2025 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/fb1af68b-7645-4774-bbfb-b30e03cafd98) | 1 | — | `5a841a4e9dab6a9e6c1786ba1b939d52e8589ad8f9457a807158fd8cf66ca878` |
| MAURICE CHAPUIS (408975357) | 24/09/1996 | [Acte sous seing privé / Divers](https://actes.ccm2.net/acte/d80e8665-c031-4ae6-91df-d1aa79a2a756) | 24 | — | `90a9ce36748889ce23c83d1f1ec4cb4736140a042e5e398fb3f871673ca2381d` |
| MAURICE CHAPUIS (408975357) | 03/02/2025 | [Le projet de fusion (intranationale ou transfrontalière)](https://actes.ccm2.net/acte/a65f6a78-7d42-4b7b-a050-3c5716a53bec) | 15 | 11 | `01efc5884ef2785df88b90bd4927500857c97ed428bd602214f6bf30e05b326e` |
| MAURICE CHAPUIS (408975357) | 18/03/2025 | [Déclaration de régularité et de conformité](https://actes.ccm2.net/acte/de3ad50f-683a-481a-a20c-c330f5e9f31a) | 1 | — | `8ca24aed6028d6737c4f2b9c32366785fafa30047ddd1e29ad8792cbf0022628` |
| MAURICE CHAPUIS (408975357) | 18/03/2025 | [Procès-verbal d'Assemblée Générale extraordinaire de la société absorbée constant l'approb](https://actes.ccm2.net/acte/993dc0b9-ae8b-4de8-adb2-fc879e614195) | 5 | — | `9780f8e3f7adb1c3a49ff7857a9ab6f8482cfacc92e1fbfd80cb1cbc2357d7bc` |
| GFV VIFONCIER CHARLEMAGNE (409988342) | 05/12/2019 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/58f87eb8-bcba-4708-9c29-0d555b4a4fd5) | 23 | 1, 2, 4, 7 | `6fd11ae5d942b012b09c81cca04c3477c7437df2a22280beb5cfbbb0bae0d188` |
| GFV VIFONCIER CHARLEMAGNE (409988342) | 05/12/1996 | [Acte notarié](https://actes.ccm2.net/acte/9a2b23eb-79d0-4a2e-a22f-10dfc23e97b0) | 20 | 1, 4, 5 | `552ce4cac6f358d6257606a6e539cc269972df8f450dabf760c72fe7284a4df3` |
| GFV VIFONCIER CHARLEMAGNE (409988342) | 19/01/2004 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/1a3b0dcf-239d-4e57-b5c8-938d4a2fc799) | 25 | 1, 2, 7, 10, 11 | `8858a65851c16686656cb1f5d0bb3057008ac0d864973514b2ad05e6ffa10229` |
| SCEV DOMAINE PAVELOT (420088387) | 19/04/2013 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/b9897297-e42d-4dc4-a4e8-926228f24ab3) | 36 | 21 | `09a206101fafcc78ac59e7b80367a6fb467d8ef4993111aebca69d1eb663a952` |
| SCEV DOMAINE PAVELOT (420088387) | 15/09/1998 | [Acte sous seing privé / Procès-verbal d'assemblée](https://actes.ccm2.net/acte/89c0ba8b-c006-4a59-8959-b6ec4dfe72c3) | 38 | 6, 26, 27, 34 | `4486294418bed9921c48f4c59c9994217576d666a5bb983d44cbb11d718658b1` |
| SCEV DOMAINE PAVELOT (420088387) | 03/12/1998 | [Acte sous seing privé / Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/305cb29a-50f2-4eb0-8d0d-0969e14e6d5e) | 50 | 19, 38, 39, 40, 46, 49 | `3cac9ad2d486b401a9cb07947f08b14bcdf8570013258c6f8f5b9a5be3512f88` |
| SCI LES COMBOTTES (422190785) | 07/07/2022 | [Statuts mis à jour / Décision(s) de l'associé unique](https://actes.ccm2.net/acte/c7f18823-028f-419f-b5c7-8362f3ad501d) | 17 | — | `732cf7754ab95da138e0c044dfd3eb200a35f91c94520f981f9498074652f58f` |
| SCI LES COMBOTTES (422190785) | 16/03/1999 | [Acte sous seing privé / Procès-verbal d'assemblée](https://actes.ccm2.net/acte/6fb2a56b-6533-41fb-8a6f-1d0a5053052e) | 15 | — | `32aae215fa902915d8a96f825111a6a0ba45b0f6f4c31433261c239093aa8af4` |
| SCI LES COMBOTTES (422190785) | 10/08/2015 | [Décision(s) de l'associé unique / Acte sous seing privé / Statuts mis à jour](https://actes.ccm2.net/acte/41938c28-3f4c-4ac3-a2f8-5029a6da2f9e) | 22 | 7 | `4fb8679cb425a75a6ccf1f0f3271bd56ec57fceaf4103c3ba0ddb5073c3fcb60` |
| HERITIERS LATOUR (423237361) | 08/08/2014 | [Procès-verbal d'assemblée / Acte notarié / Statuts mis à jour](https://actes.ccm2.net/acte/4dd0c34a-47d6-4e14-b20a-77233789dbb4) | 57 | — | `8e68808bb8826b51d919b604c6bc82572f4cede41debb5b485d3930d59815436` |
| HERITIERS LATOUR (423237361) | 16/06/1999 | [Acte notarié](https://actes.ccm2.net/acte/b4a59b66-b0f1-4fd5-ae59-74028466a4d5) | 21 | — | `b05990f4f8606ad3be719053f7e2b4843cf71feb75eb843c0898f7c9be7b03d6` |
| HERITIERS LATOUR (423237361) | 10/09/1999 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/45317f42-8482-4e6f-910a-e706f58c3ea0) | 30 | — | `7f5172ef9185dfef9db79e6eed93c0b492e96048a2b05855cda3f4d469d4d1a3` |
| GFA GAY THIRIAT ET FILS (423743657) | 14/09/2022 | [Statuts mis à jour / Procès-verbal d'assemblée générale ordinaire / Acte notarié](https://actes.ccm2.net/acte/9cbb7016-f097-40fd-9363-1badcfef809f) | 45 | 45 | `35620a4b4c6c7ca80cd102e98940a5fed7fe294bab4dd2de826a9464a001d1ef` |
| GFA GAY THIRIAT ET FILS (423743657) | 28/07/1999 | [Acte notarié](https://actes.ccm2.net/acte/6a55ef51-c593-4b7d-b16a-877d7756183e) | 17 | 16 | `153e2bad334126c36ebd2d2a4bc53913805f7f08a91e0256697932d0e67665d3` |
| GFA GAY THIRIAT ET FILS (423743657) | 02/08/2005 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/7530ab6b-7ebd-44dc-a192-c15d78696036) | 22 | 22 | `05aea81bb744b785e5fe19e7a5232e2d53ba77acd934d1a340148edb4493dae7` |
| MAIGNE OCQUIDANT (424927424) | 27/10/2023 | [Statuts mis à jour / Procès-verbal d'assemblée générale extraordinaire / Expédition d'un a](https://actes.ccm2.net/acte/c2e2d7aa-ab59-41b5-9585-d598fd0cdf4c) | 44 | 12, 31 | `426c3e28aaf22706875c9f762ccc71d52a5916361753af4fb6b0eb3018eab098` |
| MAIGNE OCQUIDANT (424927424) | 31/10/2002 | [Divers / Statuts mis à jour](https://actes.ccm2.net/acte/1dfd4617-7a57-4176-9625-36e5c0aa2d7c) | 47 | 6, 10, 28 | `f6fe7324e764f62fd7bfc8cd3e3012b712f62a76f558829e6a760be155ea9b7a` |
| ROYLAND (425000429) | 10/04/2020 | [Statuts mis à jour / Décision(s) des associés](https://actes.ccm2.net/acte/8a9ccfb6-c5fd-4991-8971-dbdbe7f893e6) | 28 | — | `8d07c5e8641a8f2ef5bc9df06bd2900ce06a076f4288584ad12fcc2de0fdac95` |
| ROYLAND (425000429) | 02/01/2018 | [Procès-verbal d'assemblée générale ordinaire et extraordinaire / Statuts mis à jour](https://actes.ccm2.net/acte/63a32dbb-606e-415f-8f60-82c100a0c6af) | 22 | — | `e032cd4039039aedad4b97c6437df1a7589d4c2538526cf65b64a46f77532d20` |
| DU DOMAINE BELGRAND LATOUR (427468962) | 31/07/2026 | [Procès-verbal décidant de la mise à jour des statuts](https://actes.ccm2.net/acte/b27b81ec-15ae-4c08-acf3-203180f2fd9e) | 1 | — | `aded1ad3b42139e609abfe426546e4d38003cb2c696711091f470e1183e353a6` |
| DU DOMAINE BELGRAND LATOUR (427468962) | 22/10/2002 | [Acte notarié / Acte sous seing privé / Divers / Procès-verbal d'assemblée](https://actes.ccm2.net/acte/2ff2e7b2-473e-419c-aec7-53400d9fa999) | 73 | 3, 4, 40, 42, 56, 57 | `4f261d2f02ab312fe86837a72f61a7991ccc579ad776ca8264b7380f80c50648` |
| DU DOMAINE BELGRAND LATOUR (427468962) | 28/07/2026 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/4a921f53-c95f-439c-bc02-43f219827e10) | 19 | 3, 4 | `8049a3ccc5434216585a8dbb5631ff6486ad96834171cb51aea712fa17c654ba` |
| DU DOMAINE BELGRAND LATOUR (427468962) | 27/07/2006 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/bdb4d176-374a-4eda-8c0c-cd030e008adf) | 23 | 7, 8 | `241214047a12c5c9eb772a280f6b79a0dc44b272d068fa851229aa4baf54cae2` |
| GFA  DOMAINE DE CORTON GRANCEY (427468970) | 21/04/2026 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/8a38b685-0c70-4954-ad15-eb55e25d155f) | 37 | 4, 7, 11, 14, 15, 16, 18 | `d204eca4d234cb18efb878e467cb7e96736c77daf1d6c2985eff2d5e3d8fb372` |
| GFA  DOMAINE DE CORTON GRANCEY (427468970) | 21/04/2026 | [Procès verbal de décision d'assemblée générale](https://actes.ccm2.net/acte/4670eb2b-8aea-49e5-b55c-fcca46f7d472) | 3 | — | `85847f048b3fea9c92d7c3a5d95c3e3111975fcb53e9a9cc63489359f716507e` |
| GFA  DOMAINE DE CORTON GRANCEY (427468970) | 27/07/2006 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/5dc15621-e068-4845-ad13-73105d881bc7) | 27 | 8, 9, 11, 13, 14 | `625366ba51a770fc8c00c7abe9d5bc07a36450c8f80bb334ffb230a61106d7fe` |
| DOMAINE MARCHAL LATOUR (427468988) | 23/12/2025 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/e075dff5-8ee1-4eb1-ac71-af0bd65cf103) | 20 | 2, 3 | `b923959e9445099e9f0a3acaf2a3e24f4fd8a12ae34ad5e8d762f8e15dc83254` |
| DOMAINE MARCHAL LATOUR (427468988) | 22/10/2002 | [Divers / Procès-verbal d'assemblée](https://actes.ccm2.net/acte/fdc0edf1-2ab9-45a0-9072-a8c4d2aa354b) | 117 | 3, 4 | `12cb18b416a8a3026592a48808e63711ece6552bc2a381e43ade06c0c808590b` |
| DOMAINE MARCHAL LATOUR (427468988) | 23/12/2025 | [Procès verbal de décision d'assemblée générale](https://actes.ccm2.net/acte/baa52c54-6577-454c-abaa-c50ee4fcca8e) | 5 | — | `1ff8fec512ca996245f4cd72e179a32c0572a00c601af9e009d1bad7d2378507` |
| DOMAINE MARCHAL LATOUR (427468988) | 27/07/2006 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/1c558a7e-3e6c-4e4e-84e5-471e79eaf5d1) | 25 | 9, 10 | `d52cb8e8861bcd3f0d51cbcd74cf1a79afe89e509aa5878e90c8ddcb0ea978b6` |
| LES RENARDES (428680011) | 07/05/2026 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/62ed37bd-d250-4498-b6f0-a785e5e92afc) | 12 | 1, 2, 8 | `f130d87a4185b1663572d105d2d857da1bc13d5832e3fe6379f78504bc7bb34c` |
| LES RENARDES (428680011) | 23/12/1999 | [Acte notarié](https://actes.ccm2.net/acte/66cd93db-a2bb-421f-9d8d-807f9d742b80) | 15 | 1, 4, 10 | `a449bff460a4eae662145b370a99523f2225c67d8a4f635930edf90260a6f4e3` |
| LES RENARDES (428680011) | 01/03/2012 | [Acte notarié / Statuts mis à jour](https://actes.ccm2.net/acte/49662d34-80b8-437a-9693-7c35e3552ded) | 10 | — | `d00201d16a7fa0eaac3271227660c07597fe39b620b48c51cf222a206d468c11` |
| SOC HOTEL VINEUSE COLLINES CORTON (SHVCC) (434794996) | 27/12/2019 | [Rapport du commissaire aux comptes relatif à la transformation / Procès-verbal d'assemblée](https://actes.ccm2.net/acte/595ee456-80ba-40ee-a78e-247709b24a92) | 28 | 5 | `824641460ed328aba74b1d1eac92baa065dca06f94a701f78731d7b9c52910d5` |
| SOC HOTEL VINEUSE COLLINES CORTON (SHVCC) (434794996) | 06/03/2001 | [Acte sous seing privé / Attestation de dépôt des fonds et liste des souscripteurs](https://actes.ccm2.net/acte/2d5cd7f4-18e6-4241-8cfb-3cfb8a5bd383) | 16 | — | `37e36287c75254dc2a2001f2b9666e328c442dd825d2a98019199f53c0a6f57b` |
| SOC HOTEL VINEUSE COLLINES CORTON (SHVCC) (434794996) | 20/11/2019 | [Rapport du commissaire aux comptes relatif à la transformation](https://actes.ccm2.net/acte/ade3c110-11a2-4c4b-a26c-9267b453fb5e) | 3 | — | `a1ff9f4d4f9096b04c235ebfdea98240b0201aac38070ec5cf86393cd0211f6c` |
| SOC HOTEL VINEUSE COLLINES CORTON (SHVCC) (434794996) | 30/04/2012 | [Procès-verbal d'assemblée générale ordinaire et extraordinaire / Acte sous seing privé / S](https://actes.ccm2.net/acte/c7a0a9b1-107f-4e4e-a93e-e03448bbef86) | — | not screened | `c6ad29a19b1a0db5afbe7c77008c2c1558de7c881a595f96f147190ef0d49e7f` |
| GFV DU DOMAINE HENRI GILLE (439779604) | 17/03/2021 | [Procès-verbal d'assemblée générale ordinaire](https://actes.ccm2.net/acte/9381a81f-cf28-48ae-b68b-c8540b712e17) | 5 | — | `8ac8332edef1379a9735989bb957fa7326f9210f95fb622635bc1a30950d0f8b` |
| GFV DU DOMAINE HENRI GILLE (439779604) | 31/03/2020 | [Procès-verbal d'assemblée / Acte notarié](https://actes.ccm2.net/acte/21edf745-3187-4681-99d2-5afac0e871a8) | 11 | — | `ad12f902dc7d45edf0a31864c03dcc372f7054cd086df8165d120114f9f774c1` |
| GFV DU DOMAINE HENRI GILLE (439779604) | 28/06/2005 | [Acte notarié](https://actes.ccm2.net/acte/53859798-dde1-4210-adf4-f0d97120a0ba) | 18 | 12, 14 | `1b8e1e88ea62f05d4080e2c2b9b61e6c7d8aa25dd982d60c62fd86955ff90ead` |
| GFV DU DOMAINE HENRI GILLE (439779604) | 19/11/2001 | [Acte notarié / Divers](https://actes.ccm2.net/acte/ecc2e433-6bac-447c-9b84-d65a980f2969) | 49 | 29, 43 | `7656221c51fcbb9440b87baab3790b967a1d566e366ecb2f5c196d52162c475b` |
| GFA TOLLOT BEAUT ET FILS (440712529) | 21/05/2012 | [Acte notarié / Statuts mis à jour](https://actes.ccm2.net/acte/9e0ef931-7cfd-4da3-b503-5bdc9edfda9f) | 66 | 7, 9, 16, 19, 24, 36 | `d5eeeeeedd3c990e10f9a929d846b84acb967151eabcfe4dc6bcbf32bbb1e5f3` |
| GFA TOLLOT BEAUT ET FILS (440712529) | 31/10/2002 | [Acte notarié / Statuts mis à jour](https://actes.ccm2.net/acte/57412d3a-1b48-4482-9a4d-ba3f4623f672) | 127 | 12, 14, 21, 47, 73, 76, 82, 90, 102 | `014fed6a13d7da233f36c2bc523d7280bf2c1997802d90aef6286f4924c0ba86` |
| SOC CIVILE PHYSALIS (442062527) | 03/12/2024 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/555ec346-12ab-4c62-9b0f-4a2a47ab7cc0) | 16 | — | `912a78f3e628b095eee3c42cb57215377827f976616e358ac425abe66d303cd3` |
| SOC CIVILE PHYSALIS (442062527) | 27/05/2002 | [Acte notarié](https://actes.ccm2.net/acte/a1babab0-7d8c-4600-b1b0-5620dd7a660b) | 21 | — | `2206a5114502a2097b2182f0f485138b977166f2456c82b9385f8a106395fc35` |
| SOC CIVILE PHYSALIS (442062527) | 18/09/2015 | [Procès-verbal d'assemblée / Acte sous seing privé / Statuts mis à jour](https://actes.ccm2.net/acte/7f7b7905-1965-4689-93c5-e1f68fa3acc9) | 27 | — | `6b02715dc2c39152c11dca18d26ac7829573b4f03e0f52204c979f5dca6a7314` |
| SOC CIVILE PHYSALIS (442062527) | 03/12/2024 | [Projet de traité d'apport](https://actes.ccm2.net/acte/ce51af98-6ed8-4883-8581-9e38e0f2f8da) | 26 | — | `4f51e8dc849b0db054b3a04e012a44bb95652c200c942cb65e17a7e2622aebf5` |
| SOC CIVILE PHYSALIS (442062527) | 03/12/2024 | [PV ayant décidé et constaté la modification enregistrée, certifié conforme par le représen](https://actes.ccm2.net/acte/195ecc71-398a-4c65-b51e-cd8a97726320) | 20 | — | `8359b2e7d1036147f96233947839e17fe2b0877f08366d6f5a60bcf0c4f3e1b4` |
| GFV DU DOMAINE GILLE-POUDOU (444606594) | 29/05/2020 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/d964200a-99fa-4418-97ce-b6c107b5cf59) | 29 | 12, 15 | `041687ba5b61010e79181cffad67cf3d78478d6af0234fa3fd32565f42d90903` |
| GFV DU DOMAINE GILLE-POUDOU (444606594) | 27/12/2002 | [Acte notarié](https://actes.ccm2.net/acte/94d660c9-a82e-4e24-9cd7-24da1d15c748) | 27 | 13, 16 | `7d146dc5fb87b4caf4dd680858364c5be93261fdaf9b9b988b5613b5e12e2769` |
| GFV DU DOMAINE GILLE-POUDOU (444606594) | 28/06/2005 | [Acte notarié / Statuts mis à jour](https://actes.ccm2.net/acte/e706485f-605b-4fdc-9c6f-444440983db2) | 29 | 8 | `2a78e7f37fb5a30105fa678fbc4625af2426970a0f1539f689e736bb5ccad7f1` |
| FERMIERE VITICOLE REMOISSENET (448234492) | 16/05/2022 | [Acte sous seing privé / Procès-verbal d'assemblée générale mixte / Statuts mis à jour](https://actes.ccm2.net/acte/a741117a-0881-46d4-a1fe-4b6a821633b2) | 25 | — | `466a861551b1f64517fa44ca021b9984e1ee48beddc69200a34f0f94c7ea68c8` |
| FERMIERE VITICOLE REMOISSENET (448234492) | 04/04/2022 | [Projet de traité de fusion](https://actes.ccm2.net/acte/2bae0637-91bf-4311-ba7c-01b00ed80c0a) | 51 | 14, 20, 27, 36, 39, 43 | `35736b8cdb5f6deaf446334e3e65637d133601b179e17f9a7dfac7bc35e475b3` |
| FERMIERE VITICOLE REMOISSENET (448234492) | 05/04/2006 | [Procès-verbal d'assemblée générale ordinaire / Statuts mis à jour](https://actes.ccm2.net/acte/929b31a1-2fe5-4a6a-8e75-3b4cb609df91) | 23 | — | `749ffcdbc9d7703b8392349063e81e0b50697e40f8a153a2855a5cea809d3ded` |
| MEO CAMUZET FRERE ET SOEURS (448502708) | 03/04/2023 | [Statuts mis à jour / Décision(s) du président](https://actes.ccm2.net/acte/0b44fdea-e60a-4e7d-895b-686d08f666a2) | 15 | — | `2e9676fcd9ffd443e00ec4a347d6de595c78b9dc87f2e9aa039dbeac1886f0e7` |
| MEO CAMUZET FRERE ET SOEURS (448502708) | 15/05/2003 | [Acte sous seing privé / Attestation de dépôt des fonds et liste des souscripteurs](https://actes.ccm2.net/acte/8a1e3870-0fa4-4778-bce6-ceacd0da2a42) | 20 | — | `19cd39ba434a9ce456b74661347260a2ee0fa48fd14cbeb2ea9881d8e58c4af7` |
| MEO CAMUZET FRERE ET SOEURS (448502708) | 25/08/2017 | [Rapport du commissaire aux apports](https://actes.ccm2.net/acte/89a66d3c-ef5f-4149-a8c2-662cec393496) | 7 | — | `f4555f629a545e7a40840046f745ccc17fe487af92d8dbce891ad9a767d9c0ca` |
| MEO CAMUZET FRERE ET SOEURS (448502708) | 07/12/2017 | [Décision(s) des associés / Contrat d'apport / Décision(s) du président / Extrait de procès](https://actes.ccm2.net/acte/57fe983c-3cc9-4b77-85b1-66960aa6a295) | 88 | — | `78ffbd0556aad8397c42996b09ad4ff64466f19bfcec8a51962632db9dba4df6` |
| MEO CAMUZET FRERE ET SOEURS (448502708) | 07/12/2017 | [Décision(s) des associés / Contrat d'apport / Décision(s) du président / Extrait de procès](https://actes.ccm2.net/acte/5fc776e7-7f47-4192-9b3b-abd6089933ca) | 20 | — | `6cb465e8fa5909a54533a11f6eb28fcfd634e5b8e6bdbef0139ee9c73740ba34` |
| CLAUDE CHEVALIER (449347426) | 22/07/2003 | [Acte notarié](https://actes.ccm2.net/acte/1bacb15e-b6b8-4863-a254-12ecd6a8b779) | 17 | — | `9a4301c81ae698acdcc9a144b2cb1212d5df86c835d71d92aa6d0804833ee9fe` |
| GEROUK (451042832) | 29/04/2019 | [Acte notarié / Statuts mis à jour](https://actes.ccm2.net/acte/01c3688f-09eb-4b38-8bb9-dab576059ad7) | 37 | 37 | `78748443baf1d7454825f8803fa3eaf9e6e076cbfcb787cc2e1f73e4affd0119` |
| GEROUK (451042832) | 01/12/2003 | [Acte notarié](https://actes.ccm2.net/acte/87fcd79f-471e-4a7e-8585-d84a907c57e8) | 17 | 15 | `1c1d64f89a2b74d800c6af42f7eb9e6dbabdc664a90ea398e5645cefc2e6d1b6` |
| GFA LE CLOS DE LA BARRE (478499098) | 16/12/2024 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/8353c598-5b8d-4448-86a3-4ec3ed271f6a) | 20 | — | `af3ddce7dc0ac2f87ea64d6d40065a957af505598e2683d94b7089818397c451` |
| GFA LE CLOS DE LA BARRE (478499098) | 09/09/2004 | [Acte notarié](https://actes.ccm2.net/acte/a76ba35e-2d5c-4839-8068-e7019fb54c8b) | 21 | — | `6c8180b3fb4c24715029851d95373918b4b989c564315932fdfe48c5c66f06cb` |
| GFA LE CLOS DE LA BARRE (478499098) | 16/12/2024 | [PV ayant décidé et constaté la modification enregistrée, certifié conforme par le représen](https://actes.ccm2.net/acte/19a11820-484d-4dcd-9c46-1e3104e24164) | 6 | — | `f3addb52e43bb304ed247b17ca501acae20f75e696203b0b18b62ce3462b88aa` |
| DOMAINE DE LA POUSSE D'OR (480400407) | 04/06/2024 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/a6b534c2-0e0e-4556-9932-f945720439ce) | 4 | — | `2b81211c41b54cdd04dc342922986957ef2743229c0e80016950b15b5c28df6b` |
| DOMAINE DE LA POUSSE D'OR (480400407) | 20/01/2005 | [Acte sous seing privé / Procès-verbal d'assemblée](https://actes.ccm2.net/acte/e20fd324-4ec7-472a-accb-e2ae693d091d) | 15 | — | `d39ac53b5c9018379972062429d7a91ba06020bd8c5bdb77a39c3cda323c1695` |
| DOMAINE DE LA POUSSE D'OR (480400407) | 25/08/2008 | [Rapport du commissaire à la transformation](https://actes.ccm2.net/acte/d52e5740-bbe0-45c7-ac5a-f74827216631) | 4 | — | `9af957f0f198d06df7b5dfc806bdfe2fff1bbca23c14eeed467a2a0e72ea4b50` |
| DOMAINE DE LA POUSSE D'OR (480400407) | 10/09/2008 | [Acte notarié / Statuts mis à jour](https://actes.ccm2.net/acte/a0dc46fb-ed31-497d-86fb-ff0d85880f51) | 51 | — | `b49eb511ac69d2b952bed35a1326af12239a5b12e4c06b18448a153a79832770` |
| DOMAINE DE LA POUSSE D'OR (480400407) | 05/10/2009 | [Ordonnance](https://actes.ccm2.net/acte/81244788-ae10-4d2f-ba59-d8f49746983b) | 2 | — | `43a13d520aacae6f5e094dfb1f8f5a3a9b12ef2e0de80e94ab5fad73f762e8f3` |
| GFA HERITIERS BELIN NAIGON (481279297) | 08/07/2019 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/b2eb360d-df71-4244-a20f-e7778811a6e8) | 35 | 12 | `6282578b176d419b9f851156abc3523e2573318e45d0163f2fbd8c661106e4fc` |
| GFA HERITIERS BELIN NAIGON (481279297) | 15/03/2005 | [Acte notarié](https://actes.ccm2.net/acte/87e85c26-9c4e-4f4c-9253-a23930afc159) | 22 | 5, 19 | `a2c32dd3f010680260ca8112bfe9e9ab76610440940692fb305e7bf9791eba9f` |
| GFA HERITIERS BELIN NAIGON (481279297) | 01/08/2011 | [Acte notarié / Statuts mis à jour](https://actes.ccm2.net/acte/9afeb83f-f3b0-41df-b79b-a1527c2e4b59) | 17 | 3 | `8a4c82f50ef3832ce77da3f524d51a2571e7992e35c8d4ce03bf815f34dc8b1e` |
| LES CHAGNOTS (481575827) | 03/06/2021 | [Procès-verbal d'assemblée générale extraordinaire / Statuts mis à jour](https://actes.ccm2.net/acte/0d62cba3-855a-4f0f-8df3-35970cfd4c1c) | 27 | 4, 11 | `d814fd0efff66981c18e36bee85f945f8a13b558925afde9e1dc0ad960e9ec16` |
| LES CHAGNOTS (481575827) | 29/03/2005 | [Statuts constitutifs / Expédition d'un acte authentique / Statuts mis à jour](https://actes.ccm2.net/acte/e709ae7f-4a36-473a-8fa2-27628639e74b) | 63 | 5, 46, 47 | `51c8b6f12551241c3c01119e1f5179bba84bf4636418aeb2627a70244c4d704c` |
| SCEA DOMAINE DUBLERE (482807393) | 20/09/2022 | [Procès-verbal d'assemblée générale extraordinaire / Statuts mis à jour](https://actes.ccm2.net/acte/8cdc404a-897e-45d7-a95e-357ee35eb5b8) | 17 | — | `9d3fb8674ec838db1ebe2892ac6b028b863957732bf491518012dfda85354538` |
| SCEA DOMAINE DUBLERE (482807393) | 16/06/2005 | [Acte notarié / Procès-verbal d'assemblée](https://actes.ccm2.net/acte/c821d5b2-db09-4609-9ff5-ed604563edfc) | 22 | — | `1fa7c14c437f550cdd31ce7ca41650ddc15afb4fea919742438b2558071208fe` |
| SCEA DOMAINE DUBLERE (482807393) | 16/03/2007 | [Acte sous seing privé / Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/96069b6f-1b77-4c7e-acbb-42187f55d5d8) | 22 | — | `94e8442ddae8e6108e297783306da667cb128345bf2cfded6a8a50acfc2e1e17` |
| DOMAINE DE MONTILLE (483134516) | 09/03/2019 | [Procès-verbal d'assemblée / Projet de traité de fusion / Statuts mis à jour](https://actes.ccm2.net/acte/50828d0a-9cd0-408e-af5e-00133f8d2525) | 35 | — | `322d6344f329244d4ad1f0ab92d5f18ad63e29a14d8e540ce169389895fad529` |
| DOMAINE DE MONTILLE (483134516) | 06/07/2005 | [Acte sous seing privé](https://actes.ccm2.net/acte/4ae88615-eee4-41e3-bf03-d5308ca81a08) | 18 | — | `972b8305fc2a4155c18359843ddc048ea03ad9f0e2aac8c682f91c7ae4ee3edf` |
| DOMAINE DE MONTILLE (483134516) | 12/06/2006 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/bd63fd42-b6cb-450c-b31a-49b4acba939b) | 26 | — | `a4fb6e40cac7d5509d86d1245c9bbb7c480f4c3a7efa0b6ad6b22f1c4fdf8d6a` |
| DOMAINE DE MONTILLE (483134516) | 29/08/2008 | [Extrait de procès-verbal d'assemblée](https://actes.ccm2.net/acte/552c367e-7dba-4fb6-80d2-797dc66f27ff) | 2 | — | `24c9e33c429299a211bbfa59b029012a150a0bc98ab9f3b4203835efedcb83c0` |
| DOMAINE DE MONTILLE (483134516) | 20/06/2023 | [Rapport du commissaire à la transformation](https://actes.ccm2.net/acte/94acb0c0-c632-49cc-bfd1-cf1f37676bd1) | 5 | — | `566c7897bdb78a446861cf0ccfca584dd8d0ca1dfa2baf2ad3ae7f9b7c9e3045` |
| GROUPEMENT FONCIER AGRICOLE ROLLAND - LATOUR (487716805) | 21/02/2006 | [Expédition / Statuts mis à jour](https://actes.ccm2.net/acte/50ba4241-90a5-488b-b9e7-b334a719282f) | 34 | 19 | `ead3b2c8d3e0607a3a207c6a0dda581f8d764b72c3fa42501f3d1e03db717811` |
| LES CHAGNOTS (491174108) | 09/01/2007 | [Acte sous seing privé / Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/d15e973e-4314-4f68-b7c0-5f4840f83c22) | 34 | — | `91a6a99178ccc4c7bc9dc9d19dfd3ec5076be2b40c93d0c56aba2d4901b11f19` |
| LES CHAGNOTS (491174108) | 17/08/2006 | [Acte sous seing privé / Procès-verbal d'assemblée / Attestation de dépôt des fonds et list](https://actes.ccm2.net/acte/1f7d7a18-c69a-4612-b896-c22d24a170f6) | 25 | — | `5d2d416b756891898f369484a4b4e281f556b742fe17a55ce77ded854303b863` |
| SCI CHATEAU CORTON GRANCEY (497642017) | 29/11/2023 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/0d0648f0-b972-4306-8592-be1865216947) | 6 | — | `0038f801484a1422dc716cc6e350011c9a9757a1cdbd3da4bbb015e687b9584d` |
| SCI CHATEAU CORTON GRANCEY (497642017) | 04/05/2007 | [Acte sous seing privé](https://actes.ccm2.net/acte/071809dc-23d0-4cab-91b3-1d4260d08986) | 20 | — | `7e17a147be45a107b75c2615d6c6ebe4c1e97bd073b4e6a0dd5698914f33e7be` |
| SCI CHATEAU CORTON GRANCEY (497642017) | 29/11/2023 | [PV ayant décidé et constaté la modification enregistrée, certifié conforme par le représen](https://actes.ccm2.net/acte/6eafb5ba-b283-4d7b-9704-c75aa67b1dd7) | 6 | — | `0038f801484a1422dc716cc6e350011c9a9757a1cdbd3da4bbb015e687b9584d` |
| SCI CHATEAU CORTON GRANCEY (497642017) | 28/02/2008 | [Acte sous seing privé / Statuts mis à jour](https://actes.ccm2.net/acte/8294b47a-d9dc-4542-8abd-b3f4cfac0778) | 20 | — | `16118580afb12362199fa3aa0fa7e4da65ed7cedfc3d2b5e00b1aaef88813c6d` |
| SCI DESCENDANTS LOUIS-NOEL LATOUR (497642249) | 23/12/2025 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/03aabe49-2feb-40b5-937f-ea75d549da3e) | 16 | — | `295e9d28c5326a3e3a19be9c92877704bc02f8e86ace0fc4ea10811690e51e84` |
| SCI DESCENDANTS LOUIS-NOEL LATOUR (497642249) | 03/05/2007 | [Acte sous seing privé](https://actes.ccm2.net/acte/fa8cb794-84bc-4675-a897-cbb24d883c5d) | 20 | — | `d37015fe4be5d28c2142565d10c48228745102d94e91471555d4a2fa7ba815c6` |
| SCI DESCENDANTS LOUIS-NOEL LATOUR (497642249) | 23/12/2025 | [Procès verbal de décision d'assemblée générale](https://actes.ccm2.net/acte/a0bcaad6-ca31-4a2c-a877-6e82da9cd8af) | 4 | — | `32b5e4657168213f3c6a63daeca7a7df00ee7f7756c2c485c7baa8ea85bd259e` |
| SCI DESCENDANTS LOUIS-NOEL LATOUR (497642249) | 28/07/2022 | [Procès-verbal d'assemblée générale extraordinaire / Statuts mis à jour](https://actes.ccm2.net/acte/bc8dc7b6-4954-41b4-a622-a5c0d06dde47) | 22 | — | `0b9664fe36bf6e1808ce50461075d037599888355f86a444483ce7b0d5c45d6e` |
| GROUPEMENT FONCIER VITICOLE L'EMPEREUR (498546258) | 14/06/2023 | [Procès-verbal d'assemblée générale mixte / Acte notarié / Statuts mis à jour](https://actes.ccm2.net/acte/a0534ac7-7fbe-408b-b1f7-da4f8946c8e5) | 26 | 10 | `5cc381fa1b91f580ba5d9bce7d7d4ba406351c0006cf4c773e500fd4cbcc1cc6` |
| GROUPEMENT FONCIER VITICOLE L'EMPEREUR (498546258) | 26/06/2007 | [Acte notarié](https://actes.ccm2.net/acte/ee653e31-7c92-46c8-933b-645a83f1d59e) | 29 | 9 | `6863f217fe4334f0ce02cf515861688145cb24a42e8a5b1ba3156c1d87cef2b7` |
| GROUPEMENT FONCIER VITICOLE L'EMPEREUR (498546258) | 22/02/2021 | [Procès-verbal d'assemblée générale ordinaire / Statuts mis à jour](https://actes.ccm2.net/acte/eac77121-9401-4b9c-9349-7d7c759acfee) | 25 | 5, 9 | `8d065453d7ac4d4fa3e703035e2c90005a225b8152af38fe85fc60dfc663838c` |
| GFV DURST CORTON-CHARLEMAGNE (509207429) | 23/03/2021 | [Statuts mis à jour / Acte notarié](https://actes.ccm2.net/acte/0c3e9d20-c9a8-416a-96ad-1ffe386d49b3) | 23 | 1, 3, 4, 5, 6, 7 | `203104267626070bb16b48a8026822d06bcbfcc84119e83cb0710159e095ffe5` |
| GFV DURST CORTON-CHARLEMAGNE (509207429) | 09/06/2015 | [Acte notarié / Liste des sièges sociaux antérieurs / Statuts mis à jour](https://actes.ccm2.net/acte/ff0abb88-d09d-40d9-aa27-0b087d3637c0) | 56 | 1, 2, 4, 5, 6, 9, 22, 28, 29, 33, 41, 42, 43 | `a052324d7412833e3556f7ef062e21e04d4de0892970bc48c434fdd8a5dc7c7a` |
| DES BEAUMONTS (510368210) | 07/05/2009 | [Acte notarié / Statuts mis à jour](https://actes.ccm2.net/acte/e4d4bf84-9c66-4f44-83cc-7958eaf07544) | 70 | 47, 68 | `001bc1a91ecf520ad51b756746280791d7ac235c2fd82d814bb9ea23f846ee72` |
| DES BEAUMONTS (510368210) | 12/02/2009 | [Acte notarié](https://actes.ccm2.net/acte/21ccf271-a107-4a80-826a-a78e3941087f) | 41 | 13, 14, 15, 37 | `a64a6d97a37259fe91bddd516866386aa3d7bd383c4b15d50f83e30a13fd4a13` |
| GROUPEMENT FONCIER VITICOLE MARIE SORDOILLET (511314635) | 20/06/2022 | [Acte sous seing privé / Procès-verbal d'assemblée générale extraordinaire / Statuts mis à ](https://actes.ccm2.net/acte/33491376) | 31 | 13 | `4a877baefedcee7ea76ac68404aea5442b42ad1f964417f69934af2fe4c8b13f` |
| GROUPEMENT FONCIER VITICOLE MARIE SORDOILLET (511314635) | 26/03/2009 | [Acte notarié](https://actes.ccm2.net/acte/33491379) | 26 | 8, 9, 10 | `0d94581b5c78aa74bbcfffaef82ed329dfbba96ab766f42338f4338b8a68eebc` |
| GROUPEMENT FONCIER VITICOLE MARIE SORDOILLET (511314635) | 03/10/2017 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/33491380) | 33 | 15, 16 | `f23f468d29e5f18d5e370c21b2b5202d095350165031580879d540de0e441988` |
| DOMAINE TAWSE (515045292) | 28/05/2013 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/bfdbf870-ace4-40ff-9100-cedc073968a9) | 14 | — | `a5567bf46aafec9cb7b23441766f21ddc79bce80655330e61f6ba354fcd668ea` |
| DOMAINE TAWSE (515045292) | 28/09/2009 | [Procès-verbal d'assemblée / Acte sous seing privé](https://actes.ccm2.net/acte/86e7ea11-18b2-4bde-88fd-23e85a23fe89) | 2 | — | `78105ee9e39baa75cfc04bae223ac2fc5c05a841ecefb532547d2c71b34a677b` |
| DOMAINE TAWSE (515045292) | 07/01/2013 | [Procès-verbal d'assemblée / Acte sous seing privé / Statuts mis à jour](https://actes.ccm2.net/acte/175149f3-acf4-4c5b-91e4-d2bb737176d8) | 26 | — | `47c23dc1477d97e3e6868aeaee62b190fdaae2570ad1933bd6c4dfa0e3bb8631` |
| DOMAINE TAWSE (515045292) | 04/02/2010 | [Acte sous seing privé / Statuts mis à jour](https://actes.ccm2.net/acte/668507d8-0292-427a-b413-12f22c837765) | 12 | 10, 11, 12 | `da955e53ce976db20074c18791891ee6be7b963a1ee70ae7a3abe78a540e22a5` |
| MAISON BOUCHARD PERE ET FILS (515420255) | 07/04/2026 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/39072485) | 21 | — | `e49d415536e71f8f8a56d7e7dc5822b955a25d1c6de9825a3981b75cba179c3f` |
| MAISON BOUCHARD PERE ET FILS (515420255) | 31/01/2002 | [Divers / Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/21613071) | 36 | 3 | `e141e387d367f9d548667aad5e21462a295967971fd76c0da4a46d5e011b513b` |
| MAISON BOUCHARD PERE ET FILS (515420255) | 05/11/2004 | [Divers](https://actes.ccm2.net/acte/21613105) | 29 | 13 | `4683eb0f004d664dab59ed63d343c1753bb24637c21b900d29091784abba088d` |
| MAISON BOUCHARD PERE ET FILS (515420255) | 09/12/2004 | [Divers](https://actes.ccm2.net/acte/21613072) | 17 | — | `784a5733d9aa5317a3e8eb19aa95c07d98bba04d4ed8134acdbf9c7e36a9e65a` |
| MAISON BOUCHARD PERE ET FILS (515420255) | 14/12/2004 | [Divers](https://actes.ccm2.net/acte/21613074) | 3 | — | `26bcc1049124f5be69f707a44bb6cd11211723c8e1e6753971329b36961e7e6c` |
| SCEV DOMAINE CAROLINE FREY (515520369) | 09/12/2025 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/de3eb02f-c2f7-4ac0-995e-1427649581f8) | 11 | — | `ab3c715543772e05d63c482ff0ebf956ea679cddcb39b234e35f4f01703d768e` |
| SCEV DOMAINE CAROLINE FREY (515520369) | 05/04/2005 | [Procès-verbal d'assemblée / Rapport du commissaire aux comptes / Statuts mis à jour](https://actes.ccm2.net/acte/94af807d-ee09-4772-9dc6-221ae89b313a) | 23 | — | `e36489284483aa5785f3eab1223eb81486fd9824582a44b04b25feb10fa6063e` |
| SCEV DOMAINE CAROLINE FREY (515520369) | 24/10/2014 | [Acte sous seing privé](https://actes.ccm2.net/acte/a5c9280e-5de3-4653-b2af-2b534d4d0d93) | 136 | 26, 125, 126, 131 | `55327030b18255682ffcb6ce678c949f7f0c68e4fbc61e1e112dfa9071497a41` |
| SCEV DOMAINE CAROLINE FREY (515520369) | 14/11/2014 | [Rapport du commissaire aux apports](https://actes.ccm2.net/acte/fc264072-3766-4fba-a152-5e93f86fa30b) | 13 | — | `310d4faddac5f32698e373de5f0af3bb095c415104b1707ba4f37b26972ff80e` |
| SCEV DOMAINE CAROLINE FREY (515520369) | 16/03/2015 | [Décision(s) de l'associé unique / Procès-verbal d'assemblée / Statuts mis à jour / Acte so](https://actes.ccm2.net/acte/443da391-fdf4-4534-83b8-7944e1f43ff7) | 49 | — | `c00d774952497073fb2abb3ed915658a2f676a4d5989c0fa82b33df0d881ac9c` |
| LEROY S A (515520385) | 03/08/2021 | [Procès-verbal d'assemblée générale / Statuts mis à jour](https://actes.ccm2.net/acte/21616210) | — | not screened | `b269eeb20a043cc0acba3d39659ac9178547a52c8a1bfce1e05b77d86ceed9fd` |
| LEROY S A (515520385) | 26/08/1993 | [Déclaration de conformité / Divers / Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/21616241) | — | not screened | `bb47f77dbc2d2c3d8e198a60c3090f3d74183382138c4f316cc4ae05da38f984` |
| LES PETITS FILS DE PIERRE PONNELLE (515620193) | 21/05/2013 | [Décision(s) du président / Statuts mis à jour](https://actes.ccm2.net/acte/c673d9b6-b4b8-44f5-8577-d43ed515028d) | — | not screened | `98ac3e459b94dcec489b46653c4557ddd59a05984266957a54ef6f1a6191b6f6` |
| LES PETITS FILS DE PIERRE PONNELLE (515620193) | 28/01/2002 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/75a45ebd-f08f-4648-a03e-66ccfc6ccdac) | 18 | — | `60dffbef81af066a64871ae0560b053b4f92d75fcd3215a587761dea415bcaf5` |
| LES PETITS FILS DE PIERRE PONNELLE (515620193) | 29/08/1995 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/92238c01-74d7-43f5-9b2c-c4ea62779b3d) | — | not screened | `2405b916ac82de50a042a83dfb869d7c0c48ba5b30fba2a9dd777d87436ba68e` |
| SARL CAPITAIN GAGNEROT (515620466) | 28/01/2020 | [Acte sous seing privé / Statuts mis à jour](https://actes.ccm2.net/acte/645095a7-fb7a-4297-9478-5ea83787a34b) | 38 | 2 | `1a5a2496e427fe43bc23bbdaea6e747c37b3700e9ae2f2fd15128c202b76fdc1` |
| SARL CAPITAIN GAGNEROT (515620466) | 07/11/2014 | [Rapport du commissaire aux comptes relatif à la transformation](https://actes.ccm2.net/acte/73d5a92f-36db-45f3-8cd0-a7f766766250) | 4 | — | `569e077bbb3d3e8715b7615da570ea7df93153ec1136983d366a8a08df8e301c` |
| SARL CAPITAIN GAGNEROT (515620466) | 20/05/2019 | [Acte sous seing privé](https://actes.ccm2.net/acte/c3d354be-4c25-41f2-9b7d-d51bae789682) | 111 | 21, 86, 87, 91, 92, 102, 104 | `daf58e07355991e10c7033f1ae164b9574e6a5fef5bd223b7d32869aa9bf2736` |
| SARL CAPITAIN GAGNEROT (515620466) | 01/07/2019 | [Procès-verbal d'assemblée générale extraordinaire](https://actes.ccm2.net/acte/8bba1cd5-475a-4b31-a78e-da2359da4ddb) | 5 | — | `341de619a6619287737fc2aba185e9789b875a5ed565e28cf25695b463e18294` |
| SARL CAPITAIN GAGNEROT (515620466) | 26/07/2019 | [Traité de fusion](https://actes.ccm2.net/acte/5b51c67c-ed25-47b5-b625-8bb1162ced5d) | 89 | 20, 68, 69, 74, 75, 82, 84 | `f7732a5767ccd95b6ee5ea69be1823c6cd7c7de17db8880e19cdac9a74c33a58` |
| MAISON LOUIS LATOUR (515720076) | 13/06/2025 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/36133198) | 22 | — | `2372486bb9d2d632316ad7449aa888fe00364ab2feebfcb12cc6bef28093bbbf` |
| MAISON LOUIS LATOUR (515720076) | 17/06/1999 | [Rapport du commissaire aux comptes](https://actes.ccm2.net/acte/32556873) | 12 | — | `10f7fa43412c59612fb1ccc4fe732d9bed13f5786bdabe948209705e3b847f28` |
| MAISON LOUIS LATOUR (515720076) | 10/09/1999 | [Divers / Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/32556871) | 58 | — | `d438ebf0c1f125b8975982e81d86b921131eaa61b2d3fa15a4d2a1620cb34695` |
| MAISON LOUIS LATOUR (515720076) | 15/11/2010 | [Extrait de procès-verbal du conseil de surveillance](https://actes.ccm2.net/acte/32556914) | 1 | — | `261de21176399495fd2cc85e31ff002b15d505a8dbe6436c323713a78b5f0529` |
| MAISON LOUIS LATOUR (515720076) | 23/06/2011 | [Extrait de procès-verbal du conseil de surveillance / Procès-verbal d'assemblée / Statuts ](https://actes.ccm2.net/acte/32556913) | 4 | — | `0b0e741e3e2787eba92b517cd25d6f3fad025bbe44efef68e6e09e10fec97566` |
| SAINT VINCENT LA VIGNE AU SAINT (518310024) | 06/09/2019 | [Acte notarié / Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/e4bf525b-ca84-4a86-8d96-0433b667edf0) | 32 | 1, 2, 8, 9, 10, 15, 20 | `acd58df703f214eea880e2318044cd0ffe211648241c057af9e41163ef9d2725` |
| SAINT VINCENT LA VIGNE AU SAINT (518310024) | 24/11/2009 | [Acte sous seing privé](https://actes.ccm2.net/acte/d7d4a3a1-40d4-4f19-b0e6-2645be13c603) | 14 | 1, 3 | `135678f09001632231cd382811c2e3231e31e6d51ea71b22031aaae1d3ba65bf` |
| SAINT VINCENT LA VIGNE AU SAINT (518310024) | 22/01/2010 | [Acte sous seing privé / Procès-verbal d'assemblée / Attestation de dépôt des fonds et list](https://actes.ccm2.net/acte/f4f1865e-60f6-4ff8-9ef9-55869975c76b) | 3 | 1, 2 | `a8db9fa82d08b2c8f7a98eb59ea270fb046277b7010717153b656869e7e3e745` |
| CORTON INVESTISSEMENT (518966478) | 22/12/2009 | [Acte sous seing privé](https://actes.ccm2.net/acte/787162f9-c3fb-43d3-86be-176fae1e3aa8) | 14 | — | `402aba68b95ee9a993c719e2a9743c3ef388dde487d06c3d18e005a5a4d2cdf1` |
| PERNAND'OR (521056788) | 22/03/2022 | [Acte sous seing privé / Statuts mis à jour / Procès-verbal d'assemblée générale extraordin](https://actes.ccm2.net/acte/2f5e82ca-4ce9-4d89-876f-30341189a238) | 35 | — | `d797e11fe10ae596560c283609080e4e17582a1d584692d717a926fec8730320` |
| PERNAND'OR (521056788) | 18/03/2010 | [Acte notarié](https://actes.ccm2.net/acte/6caa93b6-c9c8-4ea0-8812-6739cf3f48af) | 32 | 22 | `7d9b4d0ab79c24da06818a2533db54f52d3032164d5a106d80e588c5d47c580b` |
| PERNAND'OR (521056788) | 04/06/2019 | [Document relatif au bénéficiaire effectif / Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/da739a14-5944-40a4-8b42-8ef1ab91c344) | 25 | — | `31ce6cd8435e6afa02ff27214f29aa3e1ba04b11ff72e4a9ed046c58bd82ea23` |
| GFA QUOTE D' OR (521440776) | 05/06/2013 | [Procès-verbal d'assemblée générale extraordinaire / Statuts mis à jour](https://actes.ccm2.net/acte/eab82792-08ab-43d6-9acc-0dd3bc98935c) | 40 | — | `1dfc414fbb45e432acc89f951ecb90f69abd5db4b070205bf86b6a5d0be9313e` |
| GFA QUOTE D' OR (521440776) | 01/04/2010 | [Statuts constitutifs](https://actes.ccm2.net/acte/5b5ba07f-f894-41e9-8a2b-d759fae7adfd) | 73 | — | `fc71f2c11e1430a3ac5ea470b2eb6ff03d0e088e6a329a3b2ffa6b0cd9e8ff3e` |
| VIGNOBLE LATOUR (528291362) | 30/12/2011 | [Acte notarié / Statuts mis à jour](https://actes.ccm2.net/acte/10f5e549-5947-4c60-be23-9d6aa45aae75) | 20 | 5 | `179294fb6a74750b1b4a4b0e1eb2bdf4a3e9d85469d25f3247345fd4efa82ec5` |
| VIGNOBLE LATOUR (528291362) | 17/11/2010 | [Acte sous seing privé](https://actes.ccm2.net/acte/b15187a6-37ae-4687-a3fc-e7abca8bb0f5) | 20 | — | `3a94a467fa29f74f3980ad03d926abbc07bebd59aee47538edff0248d77468d8` |
| LATOUR IMMEUBLES (528291479) | 30/12/2011 | [Acte notarié / Statuts mis à jour](https://actes.ccm2.net/acte/b395bdda-43cc-467b-885d-c30ad373c068) | 24 | 4, 5, 6, 7, 8 | `c8b07068c9ec12aa2fa8c2ccc97714df1ac35ec3d955725396d4879af5e92544` |
| LATOUR IMMEUBLES (528291479) | 17/11/2010 | [Acte sous seing privé](https://actes.ccm2.net/acte/10746d09-56ef-42ed-b74a-674a2db6cb7b) | 20 | — | `1f132c237afa00ed24a2f29b3da21143bf2c58c66f6992b0118882830981460d` |
| GFV ESPRIT 20 DE BOURGOGNE (532929288) | 31/03/2026 | [Procès-verbal décidant de la mise à jour des statuts](https://actes.ccm2.net/acte/883b62f0-bcd9-4a30-b5d7-fe91cce95794) | 2 | — | `d215af63a7153df11a0897330e0db79bb0c8da478d063b8ea0ecd3c76c3da46a` |
| GFV ESPRIT 20 DE BOURGOGNE (532929288) | 16/06/2011 | [Acte notarié / Statuts mis à jour](https://actes.ccm2.net/acte/d6889836-7db4-4d91-9e07-4725a0bb919a) | 19 | 3, 5 | `a994f8e1aacc0d8c973d4f5d7bbf3c6591f354e989e276563e32372eb1487b8a` |
| GFV ESPRIT 20 DE BOURGOGNE (532929288) | 17/03/2026 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/c2f81ef2-a0fe-484e-a83f-2c2492425459) | 36 | 16 | `2e6abe7a9ecb58abc75f2ed5b55df543585071e390f5353c1b341cfa7b5ede70` |
| GFV ESPRIT 20 DE BOURGOGNE (532929288) | 17/03/2026 | [Décision de modification certifiée conforme par le représentant légal](https://actes.ccm2.net/acte/b9c2e932-b1e8-4eeb-9eb6-9430153be87b) | 1 | — | `abbd757834df6a94f97e4ea140a479f9ea3f8cc40727cb092afb282ec9bc452b` |
| GFV ESPRIT 20 DE BOURGOGNE (532929288) | 17/03/2026 | [Copie du procès-verbal de l'assemblée constitutive](https://actes.ccm2.net/acte/769efa20-9d04-4eb5-88cd-7e5b1cebf0a4) | 2 | — | `10ceace0ec434dfdbd3cbb50069afe1352f03ecbb68ffaeb2544ae923f9daa7f` |
| GFV DOMAINE GROS FAIVELEY (533960894) | 24/04/2026 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/2d58b884-cd42-4698-888d-69a5c256cd00) | 24 | 4, 5 | `f598d001afcdcb6906f766baf0ed0f91cf06785bec3ec2fcb3f8d17321b942cf` |
| GFV DOMAINE GROS FAIVELEY (533960894) | 05/08/2011 | [Acte notarié](https://actes.ccm2.net/acte/4603f7bc-a9f4-4bb8-a5ee-d1ccfe85120f) | 25 | 4, 5, 7 | `30d390ee6f76202740b12c43f9eafe99d0fcf62b8e2ccdd30bcef4400ee4a978` |
| GFV DOMAINE GROS FAIVELEY (533960894) | 14/01/2026 | [Procès verbal de décision d'assemblée générale](https://actes.ccm2.net/acte/540f95e5-517d-4235-b3ca-9ead83b82d75) | 4 | — | `8227160ea99f0667812856d872193cf66293af36f179572e8f8ccee1eb692b26` |
| GFV DOMAINE GROS FAIVELEY (533960894) | 14/01/2026 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/7d8aee10-e17b-4684-abcf-cf7418c319f6) | 24 | 4, 5 | `c10b2382b35caebf69e63ad4aabd5f7129e4785f30c2d3c6c8178b74e0578269` |
| GFV DOMAINE GROS FAIVELEY (533960894) | 24/04/2026 | [Procès verbal de décision d'assemblée générale](https://actes.ccm2.net/acte/24d78f25-bc3e-482e-964c-4af0d3f0a727) | 4 | — | `8465f8f1b7fdf00d374e0f03d00643af166a7cc91c5a1cde052b718066f54a4e` |
| CONSORTIUM VITICOLE VINICOLE BOURGOGNE (775567928) | 20/05/2026 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/9593542c-324c-4c89-b6c7-9a6ce1f376a5) | 14 | — | `27fb8d4a13a6d44256570daf781363b90aea19e25391e089232b2202651dbafb` |
| CONSORTIUM VITICOLE VINICOLE BOURGOGNE (775567928) | 01/10/2002 | [Divers](https://actes.ccm2.net/acte/7d940a63-44cc-46a8-9d03-984a50b48655) | 15 | — | `e055a52912f5fb2827f2e7f20220083d4ff4e3a65df9f4b4f1bac6338c139e9c` |
| CONSORTIUM VITICOLE VINICOLE BOURGOGNE (775567928) | 16/12/2002 | [Divers / Procès-verbal d'assemblée / Procès-verbal du conseil d'administration / Statuts m](https://actes.ccm2.net/acte/2f2c4c61-2ce1-4c97-9ddb-b2e95cd83e52) | 24 | — | `cf9a2beea8847faf18cf3ece48c8bd762f4c7ed3f77d1d6b2f77e801a819cffb` |
| CONSORTIUM VITICOLE VINICOLE BOURGOGNE (775567928) | 06/10/2020 | [Extrait de procès-verbal d'assemblée](https://actes.ccm2.net/acte/3daf04cd-49ca-4448-b480-aa2c9364e00f) | 2 | — | `9de611bd30a4460a5d4dbc57c357246c55d1087b9926b7250cce48ef7285e127` |
| CONSORTIUM VITICOLE VINICOLE BOURGOGNE (775567928) | 16/12/2021 | [Rapport du commissaire aux comptes / Statuts mis à jour / Décision(s) du président](https://actes.ccm2.net/acte/3a939b08-2a24-467d-8f19-fc6a776232e8) | 27 | — | `8f61e028bdb829f8450652bf08dc1f12abfad5b7d54e48cf42cefdbfc6d00954` |
| SOC CIVILE DOMAINE LOUIS LATOUR (778159715) | 10/07/2025 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/71076e52-66b3-41e7-a569-89e94d367dbd) | 20 | — | `c0f83c5b3e7fc0b7763b2e9ac77ceabac83a20b50af578b278f8f3a16c182bb1` |
| SOC CIVILE DOMAINE LOUIS LATOUR (778159715) | 10/07/2025 | [PV ayant décidé et constaté la modification enregistrée, certifié conforme par le représen](https://actes.ccm2.net/acte/d191621e-6a8a-4cfd-a7a7-efb72f70c3c7) | 7 | — | `91802aa8bf94241c1675d8f3d6827ad3f2f7bc1b98da7db64964e4b1c568a231` |
| SOC CIVILE DOMAINE LOUIS LATOUR (778159715) | 13/04/2026 | [Procès verbal de décision d'assemblée générale](https://actes.ccm2.net/acte/45a4d782-d834-4687-9485-3249d81145a8) | 3 | — | `d8cc93eb6fa9d02737df0a283e752df7cab87a7022f3ff35b7ef38a9424abe10` |
| SOC CIVILE DOMAINE LOUIS LATOUR (778159715) | 22/05/2000 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/9e55978a-b9ea-4b63-8dc6-b8d3698ffadf) | 47 | — | `c551cbd90b54ea6748ac2635fe7e56b3aad179ccaa74d2a663f6db2c16e1f682` |
| DOMAINE ANTONIN GUYON (778159731) | 16/03/2012 | [Procès-verbal d'assemblée / Acte notarié / Statuts mis à jour](https://actes.ccm2.net/acte/bc2a9220-09d2-4d24-a0a1-9a4fe5677f42) | 44 | — | `2cc1b333a69d75af0c424082b8f233f41334e6dfad5151209d8196f8000e7fbc` |
| DOMAINE ANTONIN GUYON (778159731) | 22/10/2002 | [Acte sous seing privé / Statuts mis à jour](https://actes.ccm2.net/acte/39bd0e05-bb93-4b94-9707-5be8aa051f3a) | 41 | — | `55e2c33f495cf9ab5f32b0cdab6991608e5fdc4723192b99b879c38a0b4c930d` |
| DOMAINE ANTONIN GUYON (778159731) | 23/03/2009 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/a13d42ec-e78b-449e-bc37-a60078a88eda) | 51 | — | `98fcb82f5020dbb7a35cdb9e57161c5279a1556cb534712a44af95d8dd4f19ac` |
| DOMAINE ANTONIN GUYON (778159731) | 23/03/2009 | [Traité de fusion](https://actes.ccm2.net/acte/e3283969-36fd-4a62-87eb-dbeb0029975e) | 17 | 13 | `7107a4445ac929d13ed7cae578b1bba511667e9c089e40dfa0ea34718ae4e363` |
| ARNOUX PERE ET FILS (778179846) | 02/02/2026 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/e110ac6d-3f56-4a8b-b621-8444c524599b) | 12 | — | `a94af4b7bc1ea7d98cdf6bf7636492742b56e565056ba09f625a0ada95d8760e` |
| ARNOUX PERE ET FILS (778179846) | 22/11/2007 | [Rapport du commissaire aux comptes](https://actes.ccm2.net/acte/1e33619f-5a0c-40b1-829b-dec00685979d) | 3 | — | `f992098473eef33dd9efe851d911a23af5e414d6327d5d2e6a3339cc8a1c2a6a` |
| ARNOUX PERE ET FILS (778179846) | 05/12/2007 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/b5811f6a-932c-4e56-b57f-50f5182871ac) | 17 | — | `992a76730edc643b4f97823a32c5671229fb6bb22cc1bd17091cb7bfb90bfe17` |
| ARNOUX PERE ET FILS (778179846) | 02/02/2026 | [Décision de modification certifiée conforme par le représentant légal](https://actes.ccm2.net/acte/75b7e9d2-50ba-42a6-b5c4-1ec17728e886) | 2 | — | `f90f8f07eb9a93f55700b36e9a51fe00a71ee14176dd2be09f9d4b87c6917767` |
| ARNOUX PERE ET FILS (778179846) | 23/12/1997 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/c9a25c1c-5d57-437f-b7eb-2326629bf866) | 23 | — | `c78af79c33b0911b0eb2d8ed611f87334bea2b70f665a6021581e999e6b7b584` |
| DOMAINE CLAIR DAU (778230359) | 25/11/2003 | [Divers / Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/457335fa-9186-4225-9eec-2989fd672e34) | — | not screened | `e52649916efc83bef34b629f149f4f63ac54afc8e51200653bdf012b7177401a` |
| DOMAINE CLAIR DAU (778230359) | 08/01/2001 | [Acte sous seing privé / Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/9d7f64ee-94ca-417f-8a52-3f7e2d98f0bc) | 21 | — | `138cbaf29612c44c638de2041717a9f2c4e16282afcea88b15d273853baa11e3` |
| DOMAINE CLAIR DAU (778230359) | 22/06/1995 | [Acte sous seing privé / Statuts mis à jour](https://actes.ccm2.net/acte/dc37d002-6b5d-4f51-a62c-c8c0fe2177ce) | — | not screened | `194ada96d6c40e993c1fadfe1954b703b93d45685eca686156361eeca7b453a4` |
| GFA DOMAINE CHANDON DE BRIAILLES (778256123) | 17/03/2026 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/7c3b94b4-879e-459a-a0a5-ce0f9aa9068f) | 28 | — | `63f6afeba148b459adc1a775c6a6e7476c1ea238c51250691afa4edfd26fc3de` |
| GFA DOMAINE CHANDON DE BRIAILLES (778256123) | 31/10/2002 | [Divers](https://actes.ccm2.net/acte/a4c8be0c-df33-4b35-be17-527bbbfc0b3f) | 44 | 9 | `8aed18d70c0afc3e1d8383cdd87608ffa0949c5da3acd3ed54b8f3e4e9f4f3d0` |
| GFA DOMAINE CHANDON DE BRIAILLES (778256123) | 19/08/2024 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/d790d995-12c0-43d3-b74e-5426bc40a5c7) | 13 | — | `e9a6992429797178805158d26b39a076bc61e188e73a221a22e63bf6c749528b` |
| GFA DOMAINE CHANDON DE BRIAILLES (778256123) | 19/08/2024 | [PV ayant décidé et constaté la modification enregistrée, certifié conforme par le représen](https://actes.ccm2.net/acte/7cfe0814-dce2-4c80-94c6-99c6abad2c5d) | 3 | — | `f34fe05d1e35be769dcaf657f55d96e0d709c053739ef5c15c0c2e15d73af3c4` |
| GFA DOMAINE CHANDON DE BRIAILLES (778256123) | 26/09/2025 | [PV ayant décidé et constaté la modification enregistrée, certifié conforme par le représen](https://actes.ccm2.net/acte/dc079eae-3cce-439d-9085-e64ede31a39e) | 2 | — | `007f192e079e4518f779cc3ac6582b7b63af91a9d00839e3f31798c2c3dc2ea0` |
| SCI DU DOMAINE THENARD (778586172) | 23/07/2026 | [Copie des statuts](https://actes.ccm2.net/acte/34757813-2fa0-4e36-9308-a15b674c68eb) | 23 | — | `9eb5d5bddbc720d6e85e57f0c558b2a9f4751a9a15b3f7d4448f5880740b4daf` |
| SCI DU DOMAINE THENARD (778586172) | 03/11/2025 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/68a461ee-5989-4909-8aa4-2b030322b6f3) | 22 | — | `6157b7b4b542ad64921050ee692dc02ca5b94e23c532d13c635648c00bae2ab4` |
| SCI DU DOMAINE THENARD (778586172) | 10/03/2026 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/77305c02-feaa-4ffd-adbd-4341eed5e49e) | 22 | 6 | `1235bfc5b90f37ddcb6667abfc98e54f322987a43e7a7811ed0e9edad772831b` |
| SCI DU DOMAINE THENARD (778586172) | 02/07/2026 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/6a62764e-8437-4d4f-a7cc-a2a0dfd443a1) | 23 | — | `9eb5d5bddbc720d6e85e57f0c558b2a9f4751a9a15b3f7d4448f5880740b4daf` |
| SCI DU DOMAINE THENARD (778586172) | 20/07/2026 | [Copie des statuts](https://actes.ccm2.net/acte/38dc8a11-616c-40bb-aaf9-6f11e3828897) | 23 | — | `9eb5d5bddbc720d6e85e57f0c558b2a9f4751a9a15b3f7d4448f5880740b4daf` |
| TERRES DE BOURGOGNE (793920448) | 16/06/2022 | [Statuts mis à jour / Procès-verbal d'assemblée générale extraordinaire](https://actes.ccm2.net/acte/e4089539-f6a3-4f31-9308-db20a40d85bf) | 14 | — | `c3bde173d7a3a42205558961fa61ea836b07ca7bfc3fc58d7e8604e6f55966b3` |
| TERRES DE BOURGOGNE (793920448) | 01/07/2013 | [Acte sous seing privé](https://actes.ccm2.net/acte/7276002e-d485-4844-b769-e2880da396db) | 27 | — | `d5fb92df3a596861c6ca34b0c699cf13277b245e82b12a234316f5a996e7af47` |
| TERRES DE BOURGOGNE (793920448) | 27/10/2014 | [Procès-verbal d'assemblée / Acte sous seing privé / Statuts mis à jour](https://actes.ccm2.net/acte/2c9267b1-1f3c-4ced-b654-5adb4f453375) | 35 | — | `eb82e0453e635550b9ba73002bd3f02d6a3594667e2c0fd49fcb802332043256` |
| SCEV DOMAINE GILLE (797421971) | 15/04/2026 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/658c5a43-f32a-4e40-913b-34b99a993320) | 15 | — | `72e5c756ef187a9b90880b2c1f8e110e26664c2d4de98d52748bc335f22f4f5d` |
| SCEV DOMAINE GILLE (797421971) | 26/09/2013 | [Acte sous seing privé / Procès-verbal d'assemblée générale ordinaire](https://actes.ccm2.net/acte/3c9e8945-cdc5-4b6a-b8f9-e797d7a026a8) | 22 | — | `34b85da9cd9c93b23f05a69b2eda98676b06ada1a720c6821d7baeba9776d15e` |
| SCEV DOMAINE GILLE (797421971) | 01/10/2020 | [Acte sous seing privé / Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/e4845495-db23-4087-a161-2c7b7c1f2dcf) | 28 | — | `0ff29ed62034fc6d23d3aea851148f908c9271eef556a2ea917d330afe65d460` |
| SCEV DOMAINE GILLE (797421971) | 15/04/2026 | [Procès verbal de décision d'assemblée générale](https://actes.ccm2.net/acte/01dc751f-07ff-4d64-b96c-0b68bef841cc) | 3 | — | `47b04adc66193b5ec9d8e2c1a10e3ef280f2fa474110253d152f41159a6b43d9` |
| SCEV DOMAINE GILLE (797421971) | 07/07/2016 | [Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/89b6d6a3-355c-450e-8869-2d3b96613ef2) | 25 | — | `c81d5d6b6028ad013c10bbe987eb3a9f61a81648fec3bcb946932dfe8691278e` |
| SCI LES CLIMATS (798977476) | 10/12/2013 | [Acte sous seing privé](https://actes.ccm2.net/acte/efb332c6-b892-46b8-a494-a57a193908ee) | 15 | 9 | `8ad56c004d9b7b9bba6f0b40e522936657ee1e344b0d47afba2903c7322db3e7` |
| GFA DE LA MALADIERE (802390898) | 26/08/2020 | [Acte notarié / Procès-verbal d'assemblée / Statuts mis à jour](https://actes.ccm2.net/acte/aaa76f9e-d43b-4093-8559-3b9369e9a0b0) | 12 | — | `392aa882fea79a532b365af882eeae32fbf514d18d2260b95ef66afd31d8bd6f` |
| GFA DE LA MALADIERE (802390898) | 22/05/2014 | [Expédition d'un acte authentique](https://actes.ccm2.net/acte/70f2c8df-a737-401a-927d-1982c1fef343) | 39 | 5, 7, 22 | `31883a63d744cde00039f0b1ba8905b62374e65cdad0a3bb34004a66f3bd33cf` |
| GFA DE LA MALADIERE (802390898) | 26/08/2020 | [Procès-verbal d'assemblée / Statuts mis à jour / Acte notarié](https://actes.ccm2.net/acte/3d963e96-a8a9-47b7-a9cb-485ca175eb2a) | 71 | 20, 43 | `0ba61988452062ca2592c9c00c3f3db5e16ffed55bac47a78e5ffa612be57eb9` |
| GFV SAINT VINCENT CORTON LES MARECHAUDES (808909774) | 07/07/2026 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/5abd15b0-f632-4d7c-8c3b-29c54c1b9a05) | 20 | 1, 2 | `4d3ce2610ec4f9181663a389e9baf97e5b13f2fc6528218f1221cc9430015f63` |
| GFV SAINT VINCENT CORTON LES MARECHAUDES (808909774) | 22/01/2015 | [Expédition d'un acte authentique](https://actes.ccm2.net/acte/682cc768-a479-4982-94de-a921025010a0) | 26 | 4, 5, 7, 15, 25, 26 | `d14f3d2abb0de6e32bb5929c4cbe16a47253e1b5d433585454814c0ff0d0354a` |
| GFV SAINT VINCENT CORTON LES MARECHAUDES (808909774) | 05/01/2026 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/40928a0c-66e6-4a56-979a-f731f6e6bdc7) | 26 | 1, 7, 10, 19 | `bff97ea8eec7c6c83464f79c7672456559a382ca14e9aff309ca331c62da7f88` |
| GFV SAINT VINCENT CORTON LES MARECHAUDES (808909774) | 27/04/2015 | [Acte notarié / Statuts mis à jour](https://actes.ccm2.net/acte/01d741fc-cbaf-43bd-aafd-779266a66d37) | 166 | 3, 4, 5, 6, 7, 9, 11, 14, 15, 16, 17, 19, 20, 21, 23, 24, 25, 26, 27, 29, 30, 31, 33, 34, 35, 36, 37, 39, 40, 43, 44, 45, 46, 47, 49, 51, 54, 55, 56, 57, 59, 60, 63, 64, 65, 66, 67, 71, 72, 73, 74, 75, 77, 78, 80, 81, 82, 83, 84, 86, 88, 90, 91, 92, 93, 94, 96, 97, 98, 99, 103, 105, 106, 107, 108, 109, 111, 112, 115, 116, 117, 118, 119, 121, 122, 123, 126, 127, 128, 129, 131, 132, 135, 136, 137, 138, 139, 141, 142, 143, 145, 148, 149, 151, 159 | `15a91aca9f055a8940ccb6d81dc2a89c6b2fd673865c35842f1dcb10620165c4` |
| VICTOR VOARICK (812786549) | 04/09/2025 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/e5d2aa37-57a6-4a77-9607-109a9099d524) | 16 | — | `48f7845184342491fdfceca2ccaa8773a68c4e2ac2076ca8bb249b2c7fff8a24` |
| VICTOR VOARICK (812786549) | 31/07/2015 | [Acte sous seing privé](https://actes.ccm2.net/acte/5a0110a4-da7d-4c36-a195-b95d79492687) | 20 | — | `6c22461617c47dc1deffaebef7d32af623e13ef803e41f5c9a3f7345c8da9f55` |
| VICTOR VOARICK (812786549) | 06/11/2020 | [Décision(s) de l'associé unique](https://actes.ccm2.net/acte/b7698590-11b6-4dbf-a98a-1ce769314496) | 2 | — | `771115ecc7cf84ee2a98f31a82545da51d173eb9906841df6a722697136d9e5e` |
| VICTOR VOARICK (812786549) | 04/09/2025 | [Décision de modification certifiée conforme par le représentant légal](https://actes.ccm2.net/acte/beb113ad-730d-45fe-a5c5-d49194a0c029) | 2 | — | `73144b657505bfe79e17ad91ad98702528dda7dcde2de2e7c4e43bf71a5b8da1` |
| HBM VIGNOBLES (824253181) | 30/11/2022 | [Décision(s) de l'associé unique / Statuts mis à jour](https://actes.ccm2.net/acte/0f9fcbcb-8b4e-4d62-8559-2536c81fe95e) | 22 | — | `855cf62947ed6bb4c1422e9c137e188cc78ebb178abef06ff6d25d2082a9a3b7` |
| HBM VIGNOBLES (824253181) | 15/12/2016 | [Acte notarié / Attestation de dépôt des fonds et liste des souscripteurs](https://actes.ccm2.net/acte/63095bfc-fdf2-4d90-9b36-4c6fab0e5a45) | 51 | — | `a3813cf67aa1ad7c5632efd0b26783b4d1a183838f89e87305c1d84bd120c97b` |
| HBM VIGNOBLES (824253181) | 04/09/2017 | [Liste des sièges sociaux antérieurs / Extrait de décision(s) de l'associé unique / Statuts](https://actes.ccm2.net/acte/96a4c5f4-cf5c-4cd8-8fbb-85ea0a4201d2) | 25 | — | `f44201029ed19d5f3e535989dcec7c082b8ea32827964e95d300331d022d65de` |
| GFA DU DOMAINE VINCENT RAPET (832275333) | 29/09/2017 | [Acte notarié](https://actes.ccm2.net/acte/509706b2-6590-45f0-9fc1-5b6ba2e423a6) | 54 | 9, 10, 11, 14 | `d0b5bcf6de47434a013a48deb93b528099505232ac74de8c4fdcb96e08ff21ef` |
| LE CHARLEMAGNE (833027865) | 22/09/2022 | [Procès-verbal d'assemblée générale extraordinaire / Acte sous seing privé / Statuts mis à ](https://actes.ccm2.net/acte/57af8f6d-c352-40d9-bb16-6d9a7e0aeba5) | 33 | 1, 2, 3, 4, 6, 8, 9, 10, 11, 16, 17, 19 | `824f519f80edd0362101731886b88216f4f503bbd96c4833ffc0f881ee11dcdb` |
| LE CHARLEMAGNE (833027865) | 31/10/2017 | [Document relatif au bénéficiaire effectif / Statuts constitutifs / Acte](https://actes.ccm2.net/acte/a5568764-775a-4d17-ae9f-a33b08913565) | 4 | 2, 3, 4 | `4c28c49bab0b36735c75072ccc1c91c6350824f8fc6b34e52348dd98f1fe64ea` |
| LE CHARLEMAGNE (833027865) | 31/10/2017 | [Acte / Document relatif au bénéficiaire effectif / Statuts constitutifs](https://actes.ccm2.net/acte/c7129cbf-ae53-45eb-a93a-9bc6ff5ee846) | 23 | 2, 5, 6, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23 | `83a7e460a2125839057d3b68afa7e831fda7ee0f9d70d290463948e0026585c9` |
| LE CHARLEMAGNE (833027865) | 19/03/2018 | [Document relatif au bénéficiaire effectif / Extrait de procès-verbal / Statuts mis à jour](https://actes.ccm2.net/acte/17c79dc5-1dff-46a6-b7e3-ced87015002b) | 26 | 2, 9, 10, 12, 13, 14, 15, 18, 20, 21, 22, 23, 24, 25, 26 | `4295984914ee9163ab5dbe8464dfd2e1131cabed34f87846481bde5e1c45b32d` |
| SUR ROCHES (834914756) | 15/01/2025 | [Procès-verbal décidant de la mise à jour des statuts](https://actes.ccm2.net/acte/522d2bdd-6519-457a-a9e7-e0fe7202af62) | 2 | — | `1404f11b8fb3d3f05d6ffc6cda4393d229836fe469d74c83649602a07087261d` |
| SUR ROCHES (834914756) | 29/01/2018 | [Acte notarié](https://actes.ccm2.net/acte/4a5cb38e-311d-4218-8e44-da67800ada4b) | 32 | — | `6f66cac4f60d353477173d8e73cfb68ededbf0867a7563f8daecbdc26dc2d425` |
| SUR ROCHES (834914756) | 15/01/2025 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/37136cad-eb65-4922-a509-5c228df0ad3a) | 22 | — | `ba7774def6778690e1b7edd54678cfbb205574b0cccc5267276d1c1a0e88fd06` |
| HBM II (851405357) | 30/11/2022 | [Décision(s) de l'associé unique / Statuts mis à jour](https://actes.ccm2.net/acte/65eb6d3d-e686-4728-ac02-c1f560117a88) | — | not screened | `6842c5c95a446b5b0ad54a5c12a07fae784260333c58a722e18580bf9b589fca` |
| HBM II (851405357) | 11/06/2019 | [Document relatif au bénéficiaire effectif / Acte notarié / Attestation de dépôt des fonds ](https://actes.ccm2.net/acte/f4b9f005-afd8-49b9-af58-d0691bf6fc3a) | 38 | — | `bfa6ea2ea52e78d576f4c89da90bde8e08d511ea6e1243bad6842c039496f909` |
| HBM II (851405357) | 06/01/2022 | [Décision(s) de l'associé unique](https://actes.ccm2.net/acte/c2a8d16a-fbfc-4f5b-a11b-7390991f60c9) | 2 | — | `5aed29010e62f4c49d7a2a0088fcb9785723c0e6ffc29955a5feee1b60ecaf90` |
| HBM II (851405357) | 07/10/2021 | [Décision(s) de l'associé unique / Statuts mis à jour / Décision(s) du président](https://actes.ccm2.net/acte/36a5f1c8-6e67-492e-b534-c37fe58414dc) | — | not screened | `5907a6fc49c07ff2196c2dd7d528c636a3bf55eb270bf69838e8407894bb441b` |
| GFV CHAPUIS (880256847) | 07/04/2026 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/488e3d72-0612-44db-ba6f-c8415b99c0f0) | 22 | 6 | `f9d4d1674c35a96116721928a5400cd7640ce2093ed2fcbc4d5e4f0c2dc6f07a` |
| GFV CHAPUIS (880256847) | 06/01/2020 | [Acte notarié](https://actes.ccm2.net/acte/ff2e83b6-a0c9-42c1-a195-540a781c8c6f) | 19 | 5 | `d1c19434d8fdfee182227f44f4a0d9aa74858f7afcaaba5c9319065ad5faa6ac` |
| GFV CHAPUIS (880256847) | 10/10/2025 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/f369262f-83de-4589-a4af-2f0cf5f4d5be) | 22 | 7 | `1c0ba6211781f6b8583043407e9f9420b92978776c841611161ed2b02fc9ceaa` |
| GFV CHAPUIS (880256847) | 10/10/2025 | [Décision de modification certifiée conforme par le représentant légal](https://actes.ccm2.net/acte/16bf04b7-22d2-43cf-b376-cedfa1213fcf) | 3 | — | `4226e7fef2b5d6353f7ec084b6dc33809668b205f1ee95377b05e332bb28eab8` |
| GFV CHAPUIS (880256847) | 10/10/2025 | [Procès-verbal de transformation](https://actes.ccm2.net/acte/8a6c2436-9180-4dad-827e-a5fbb626f7e5) | 3 | — | `4226e7fef2b5d6353f7ec084b6dc33809668b205f1ee95377b05e332bb28eab8` |
| REMUS VIGNOBLES (885311902) | 13/01/2025 | [Copie des statuts](https://actes.ccm2.net/acte/b9b7903d-9c02-442e-818d-c170b6da60f6) | 5 | — | `81c1d6d5d4c9d22050f65543a09ef87c6ab0a16e8926b9751beb1bb1212888d0` |
| REMUS VIGNOBLES (885311902) | 22/07/2020 | [Attestation de dépôt des fonds / Liste des souscripteurs / Acte notarié](https://actes.ccm2.net/acte/e27c1843-0a3a-473d-aeac-2aed5d8787f2) | 6 | — | `4bec495bf8bdd3c223f3cbbd7360390f2dab426a4df5980c68bf9a32a1f06c54` |
| REMUS VIGNOBLES (885311902) | 13/01/2025 | [Décision de modification certifiée conforme par le représentant légal](https://actes.ccm2.net/acte/d8d26033-388d-462e-b3a9-461ed5748490) | 1 | — | `1eee4e3837072e36fe1e0f0958f2f68f35803c7e611efe4b64f9aaaef44e65a8` |
| REMUS VIGNOBLES (885311902) | 30/05/2022 | [Décision(s) de l'associé unique / Statuts mis à jour](https://actes.ccm2.net/acte/ae8234b9-0c6e-4d32-a859-5945e10eee88) | — | not screened | `7621d55bb612ff33842b1956c35505b5a8054c396e532b40cbf4fb41b96a6a6b` |
| GFV DES 4 SOLEILS (891743239) | 04/02/2026 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/47b20bd5-532a-4a28-afc8-c9c8ae2d2b8a) | 48 | 45 | `90f8e8d60781098b2fe494ee2848be1be1c7b66cf34b241f5547470bd901eef2` |
| GFV DES 4 SOLEILS (891743239) | 07/12/2020 | [Statuts constitutifs](https://actes.ccm2.net/acte/86e274d4-1ce8-4a12-91f6-f319ddb07050) | 26 | — | `9262b92651af1fb12b18ab17cbc83b2f14e7414f00a4b097bab51432c9678f95` |
| GFV DES 4 SOLEILS (891743239) | 04/02/2026 | [Décision de modification certifiée conforme par le représentant légal](https://actes.ccm2.net/acte/c2ca4707-370c-43ce-8145-d76398be1bb2) | 9 | 2 | `2ebcd87bff2421cf5fd22eff01210e3f1f189c749c3a88afaf2107ed7d1d112c` |
| GFV DES 4 SOLEILS (891743239) | 04/02/2026 | [Procès verbal de décision d'assemblée générale](https://actes.ccm2.net/acte/1a6fe5f1-9638-4a44-bdaf-3acb91b529fd) | 9 | — | `fca0fd71f53dd896458de75cf815cce8313bcdb59c65ab90e4f4abf76da9480c` |
| LES GARUDAS D'OR 2022 (921219176) | 08/11/2022 | [Statuts constitutifs](https://actes.ccm2.net/acte/df6018ff-298c-48f8-a583-e0789f0f16d4) | 19 | — | `d8f8753e10c0dade1bcc3229b07e584baf822c9bafa9164553d2465e5fe79fd5` |
| MEMOIRE DE VIGNES (931134381) | 17/07/2024 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/d1860966-223d-4e4e-841f-3e68dcc9a081) | 26 | 6, 7, 25 | `df26c5c3be8842164507e65ad1aa921b83e819fac6643f35c87bb5fe74da1875` |
| MEMOIRE DE VIGNES (931134381) | 17/07/2024 | [Copie des statuts](https://actes.ccm2.net/acte/58034acf-fb09-42a5-a3fb-068b5b219de4) | 28 | 3, 6 | `e60f31bb529cfa64b960c96018ac16b9916d7371a7426881e8c1368133b8d6b3` |
| MEMOIRE DE VIGNES (931134381) | 17/07/2024 | [PV ayant décidé et constaté la modification enregistrée, certifié conforme par le représen](https://actes.ccm2.net/acte/2e5fef5e-bf14-4758-909c-90f7d022df49) | 28 | 3, 6 | `e60f31bb529cfa64b960c96018ac16b9916d7371a7426881e8c1368133b8d6b3` |
| GFV BRUNO ET VALERIE CLAVELIER (937952174) | 26/11/2024 | [Copie des statuts](https://actes.ccm2.net/acte/20fba88e-752b-4750-a5d7-0a5a23ac8afe) | 31 | 6, 7, 11 | `eb7941cd8842e9d0bd8cc5d8986adc4e818c359b8d660460e6e17b50c65cc5e7` |
| GFV BRUNO ET VALERIE CLAVELIER (937952174) | 26/11/2024 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/b7b5d9ef-5fb4-4176-a9b5-6fe393ece550) | 30 | 7, 8, 12 | `3f65fd1bf84ab571806838aae93c6bc99c65ac9f6eb6c3e8c245e2928ada7d97` |
| CORTON CLOS DU ROI (953306917) | 06/06/2023 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/7b32f3b1-0009-4e7b-b360-c7359ac66d55) | 17 | 1, 3, 10, 17 | `71ea3f4a071596e186f2db95b3b58aac03ea74975a8983abdfdd01f7ad9cb827` |
| CORTON CLOS DU ROI (953306917) | 06/06/2023 | [Copie des statuts](https://actes.ccm2.net/acte/66b30275-40ca-4690-a00d-204ffb0a9000) | 24 | 1, 3, 9, 15, 17, 19, 21, 23 | `3880824cdb775dbf8ee08f2f160cb2cad1e0e9ce913cc28aa06c9e72efa80d56` |
| CORTON CLOS DU ROI (953306917) | 06/06/2023 | [PV ayant décidé et constaté la modification enregistrée, certifié conforme par le représen](https://actes.ccm2.net/acte/4cdbe1d6-9736-4abf-b78e-7cadb363452e) | 2 | 1, 2 | `a94a6af6f08aed2c6f0fdd6f3d8c93a56a24f74c6eae85e01c5a3d9222160909` |
| CORTON CLOS DU ROI (953306917) | 06/06/2023 | [L’ampliation* de la décision de l’ordre professionnel, en copie. *Copie authentifiée d’un ](https://actes.ccm2.net/acte/9d6acf6d-1bc1-422d-8029-ac199d702955) | 12 | 1, 2, 4 | `d965a088e3552b4fde76e4e6cc6de82f38127ba7bffe8cd20c8be71ec3964aec` |
| SCEV DOMAINE JACOB FREREBEAU (977634369) | 10/07/2023 | [Procès-verbal décidant de la mise à jour des statuts](https://actes.ccm2.net/acte/82d44ebd-573f-4efc-9342-a50770178958) | 2 | — | `80bb2e4243547708b6152efa0a38599194b9a1030d5e510a6e8e98f6f6da8889` |
| SCEV DOMAINE JACOB FREREBEAU (977634369) | 10/07/2023 | [Copie des statuts](https://actes.ccm2.net/acte/91a7fc06-a044-40c4-9712-193ceb8ba8f9) | 2 | — | `e24afb6e9c3ee8c4b2c31c83cc528be4aef2d8880970209bbee3c9d1c444bf91` |
| SCEV DOMAINE JACOB FREREBEAU (977634369) | 10/07/2023 | [Copie des statuts mis à jour](https://actes.ccm2.net/acte/6dcb3e5f-9b41-4934-b429-86701525c9a0) | 2 | — | `e24afb6e9c3ee8c4b2c31c83cc528be4aef2d8880970209bbee3c9d1c444bf91` |
| SCEV DOMAINE JACOB FREREBEAU (977634369) | 10/07/2023 | [PV ayant décidé et constaté la modification enregistrée, certifié conforme par le représen](https://actes.ccm2.net/acte/e0238594-d642-4608-97ac-c00298a7a480) | 2 | — | `e24afb6e9c3ee8c4b2c31c83cc528be4aef2d8880970209bbee3c9d1c444bf91` |
| SCEV DOMAINE JACOB FREREBEAU (977634369) | 10/07/2023 | [Déclaration de régularité et de conformité](https://actes.ccm2.net/acte/8d006084-1161-4ff3-ab92-b7a1263c2dc3) | 4 | — | `70add4bba200b95792fadd9f272fae460beb1c60b9b6a9db85fb1057a1561d1b` |
| GFV CAMILA (983900960) | 25/01/2024 | [Copie des statuts](https://actes.ccm2.net/acte/4fa3606a-f47c-4f06-af51-cf1845535fa3) | 34 | 3, 4, 5, 6 | `bf01516b23ca2b1be955eb90e6d529168fceb006e4e36ccf0f82ffdbd5afd99a` |
| GFV CAMILA (983900960) | 25/01/2024 | [PV ayant décidé et constaté la modification enregistrée, certifié conforme par le représen](https://actes.ccm2.net/acte/3bcb223e-5255-4d99-a15c-1c707bac387a) | 34 | 3, 4, 5, 6 | `bf01516b23ca2b1be955eb90e6d529168fceb006e4e36ccf0f82ffdbd5afd99a` |

## Remaining source requests

A dated, shareable lease or equivalent parcel-specific record plus evidence of actual operation is still needed for every candidate. In particular: the 2013 Corton-Grancey renewal deed and any 2026 renewal of the Belgrand-, Marchal- and Rolland-Latour leases; the signed 2019 Les Chagnots amendment; renewals of the Beaumonts, Gille and Sordoillet leases; which vineyards moved in Bouchard’s 2026 contribution; and filings for the five provisional identifiers still without a SIREN. No current farmer passes the #364 gate. Paid registry copies and outreach remain Tier 3.
