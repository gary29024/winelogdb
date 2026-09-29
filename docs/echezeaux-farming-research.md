# Échezeaux: linking parcels to farming domaines

Checked 28 September 2026 for [#376](https://github.com/gary29024/winelogdb/issues/376), following merged [pilot #374](https://github.com/gary29024/winelogdb/pull/374). Current-operation research continues under [#364](https://github.com/gary29024/winelogdb/issues/364); unresolved named areas remain under [#344](https://github.com/gary29024/winelogdb/issues/344).

## Findings

A cadastral parcel can be joined to a dated legal right holder. Today's farmer needs a second, independently evidenced relationship. A manual link to the app's producer catalogue solves identity/navigation, not that evidence gap.

Échezeaux has **276 parcels, 119 with recorded rights and 157 without a matched record**. Records cover **21.54 ha** of mapped cru overlap. **Zero parcel-specific current operators are verified.** Exact-reference administrative notices now cover 18 Échezeaux parcels: 2 with an authorisation decision and 16 with an application or a suspended application (some through accepted cadastral lineage); further references lie in Grands-Échezeaux. None enters `domaineLinks` or verified colouring.

### Expanded investigation: every mapped Échezeaux parcel

The [parcel research register](echezeaux-farming-parcel-register.md) now inventories **all 276 parcels** and records investigations for **all 36 right-holder groups**, with a source log of **118 records**. The log distinguishes inspected sources, indexed excerpts, public previews, owner-supplied Premium articles and unavailable material. This is not an exhaustive search of every cadastral reference: **109 parcels have inventory records only**.

The resulting categories are **126 parcels with holder-derived or independent-research leads**, **16 with an exact-reference application or suspension**, **2 with an authorisation decision**, **1 sale lead** and **131 without a named candidate**. (The first version of this register, before the rights history, notice scan and Winehog research, had 54 sources, 155 inventory-only parcels, 100 holder leads, two applications and 174 unresolved.) All current-farmer fields remain unconfirmed. Candidate strength varies; a management connection or bottler name is much weaker than an independently described operating relationship. The register states the basis for each lead instead of treating all names as equally plausible farmers.

Useful findings beyond the original examples:

- **CVVB → Faiveley:** the domaine's own legal notice gives SIREN **775567928**, resolving the brand/entity identity for D0331, D0335 and D0653. Its Échezeaux sheet provides estate context, but no exact operating-parcel list. [Legal notice](https://domaine-faiveley.com/mentions-legales/), [wine sheet](https://domaine-faiveley.com/fiche-vin/echezeaux-en-orveaux-grand-cru/).
- **François Feuillet → David Duband:** a report hosted by Duband describes entrusted vines. D0674–D0677 are the holder's research targets, not confirmed current Duband parcels. [Hosted report](https://www.domaine-duband.com/f/news/received-our-3rd-star-5.pdf).
- **Daniel Rion → Jean-Charles Rion:** the latter's site describes the expanded family vineyard and Échezeaux following its 2023 move. D0665–D0667 need an exact succession/lease crosswalk; keeping the old holder name as today's farmer would miss this lead. [Estate history](https://www.domaine-jean-charles-rion.fr/).
- **Traversins → Georges Roumier:** company management and a report of added Champs Traversins vines support further investigation of D0295–D0299. Neither source proves that those exact parcels are operated by the domaine. [Company record](https://www.pappers.fr/entreprise/sas-traversins-911887461), [2023 estate visit report](https://oldvinenotes.com/2024/12/30/2023-a-large-crop-of-variable-reds-and-somewhat-better-whites/).
- **Gerbet Sirugue → Berthaut-Gerbet:** the estate history explicitly describes taking over only part of the Gerbet vines. Do not assign all three recorded parcels from this succession alone. [Estate history](https://www.berthaut-gerbet.com/).
- **ORIGINE → LC:** an official same-SIREN lookup resolves a changed legal name, but no current farmer for D0313. This is an identity correction, not a new operation claim. [Official lookup](https://recherche-entreprises.api.gouv.fr/search?q=883067134&per_page=5).

The DDT notice index and several full filings could not be retrieved. Public CartoBio parcels are anonymised; a spatial join cannot supply the missing farmer names. No private CVI records were accessed and no outreach was sent. Completing the farmer census requires further exact-reference documents or dated, shareable confirmations of actual operation. The register provides the parcel lists for those requests, including holders whose identities remain unresolved.

Reproduce with `python scripts/build_echezeaux_farming_research.py`; verify with `--check`. Rebuild the rights history first when its inputs change: `python scripts/build_echezeaux_rights_history.py --source-dir .tmp/echezeaux-sources --download` (needs `scripts/burgundy-map-requirements.txt`). The builder checks the pinned parcel hash (normalising Windows checkout line endings), exact holder coverage and source references. It rejects attempts to convert this lead register into confirmed-operation data. [Curation](research/echezeaux-farming-curation.json) and the [generated per-parcel JSON](research/echezeaux-farming-parcels.json) are documentation artifacts. The same builder also writes `src/lib/places/echezeauxParcelEvidence.json`, a short per-parcel list of dated records that the app shows as "History and evidence"; it is not a farming overlay and states no farmer.

### Rights history 2019–2025 and parcel lineage

The pilot used one rights file (1 January 2025). The same DGFiP legal-entity files exist for **1 January 2019–2024**, and Etalab publishes older cadastre vintages. Comparing them shows **when** each company record began, changed or ended, and which of today's references came from dividing an older parcel. [`scripts/build_echezeaux_rights_history.py`](../scripts/build_echezeaux_rights_history.py) reads only the Côte-d'Or member of each yearly archive by HTTP range, verifies every pinned hash and writes [the yearly records and lineage](research/echezeaux-rights-history.json). The register builder refuses a history built from a different parcel snapshot.

**76 of 276 parcels** had a recorded-rights change since 2019. **35 current references** did not exist in the 2019 vintage; **13 retired references** overlapped the cru, and 35 current parcels have an accepted predecessor (a successor must first appear in the next vintage and lie almost entirely inside the retired reference; boundary slivers are rejected). Results that change the research:

- **Nicole Lamarche:** SIREN 397738634 was recorded as **FONCIER VITI DOM FRANCOIS LAMARCHE** in 2020–2021 and as NICOLE LAMARCHE from 2022. Same SIREN, so one renamed legal entity; this strengthens the identity link to the Lamarche domaine for D0168, D0169 and D0519.
- **Anne Gros application:** D0177, D0178 and Grands-Échezeaux D0093 have identical geometry and area in the January 2022 vintage and today, so the receipt's printed references denote today's parcels. D0177/D0178 never carry a company record (consistent with private owners). No vintage contains a D1776. Anne Gros's company rights on D0183/D0709 begin on 1 January 2021.
- **D0673 left Mongeard-Mugneret during 2024:** held by Assurances du Crédit Mutuel Vie until 2020, Domaine Mongeard Mugneret 2021–2024, then **Bouchon Pourpre** in 2025.
- **HOR Vignobles → SCI Les Climats:** D0815 changes holder between the 2022 and 2023 files while D0813/D0814 stay with HOR. This places the transfer seen only in an indexed filing excerpt on an exact reference.
- **Traversins** rights begin on 1 January 2024, matching the 2023 report of additional Roumier vines in Champs Traversins (timing only, not scope).
- **Capitain → Capitain-Gagnerot (2020)** and **Clerget GFV → SCEV du Domaine Christian Clerget (2023)** are transfers between different SIRENs, not renames.
- **U22079769 is not a company:** "Propriétaires du BND 267 D0143" is the undivided-ownership record of former D0143, which the 2025 cadastre divided into D0898–D0902.
- **New family land companies:** Forey, Orveaux and Les Cruots groups first appear in 2025 on references that existed without a company record, consistent with family land moving into GFA/GFV structures during 2024.
- **29 split references** (for example former D0708 → D0871/D0872 and D0905–D0911) have no company record in any year: private owners, whom these files cannot identify.

The legal-entity files never list private individuals, so most of the 157 unmatched parcels are best explained by private ownership rather than missing research. A rights change is ownership evidence only; it does not date or establish farming. The generated register lists every change and lineage row.

### Farm-structure notices 2019–2026: the Gros division and the Rion decision

The Côte-d'Or DDT publishes receipts, authorisations and refusals under the farm-structure rules in the regional *recueils des actes administratifs*. These notices can name an applicant, the previous operator and exact cadastral references; company filings can separately document ownership and tenancy. Every Côte-d'Or DDT notice in the regional bulletins for 2019–2026 was read (about 1,280 bulletins; contents list first, then OCR of the listed acts), and every Flagey-Échezeaux match was checked against the page image. The notice index is kept as a separate, reusable dataset for other grand crus.

- **Rion (Les Treux):** a decision of 4 July 2022 authorises **SAS Domaine RC Les Grandes Vignes** (Quincey) to farm **D0665 and D0666**, taken over from Domaine Daniel Rion et Fils. This is the only explicit authorisation found for an Échezeaux parcel. D0666's printed area (0.0799 ha) is smaller than the parcel (0.1157 ha), and D0667, held by the same right holder, is not in the decision. The link between the applicant and Domaine Jean-Charles Rion is not established.
- **Gros Frère et Sœur (Les Loächausses):** in 2022 the former estate's parcels were the subject of three applications naming it as previous operator: **Michel Gros** (D0184, D0558, D0774), **AF Gros** (D0181, D0775) and **Anne Gros** (D0177, D0178, Grands-Échezeaux D0093). D0774 and D0775 were later divided; their current successors inherit the application only through the recorded lineage. Receipts are not authorisations. No decision on these applications was found in the regional bulletins searched; the 2016–2020 departmental bulletins predate these applications, so a decision may exist only in later bulletins.
- **Liger-Belair (2026):** an order of 7 April 2026 suspends, for eight months from 29 April 2026, SCEA Domaine du Comte Liger-Belair's application to farm **D0673** (Bouchon Pourpre) and **D0628, D0764–D0767** (GFA Domaine Bouchy et Amis), with Grands-Échezeaux D615/D616 and parcels in three other communes, as an excessive enlargement. Anyone may apply for the same land meanwhile. The application confirms the Bouchon Pourpre → Liger-Belair lead as an intention to farm, and shows that no authorisation existed in April 2026.
- Farm-structure notices appear regularly in the regional bulletins only from 2021. The 2016–2020 Côte-d'Or departmental bulletins were searched in full (PR #412). Their only Flagey-Échezeaux vineyard decision (Maison Louis Bouillot, signed 18 November 2015) names section A references, not the mapped section D parcels, so no parcel link is made.

### Sale records 2014–2025 (DVF+) and why size-matching was not adopted

Checked 29 September 2026. DVF lists every registered transfer for a fee, by deed and parcel, with no party names. The data.gouv.fr files keep only five years, so the register uses Cerema's [DVF+ open-data](https://datafoncier.cerema.fr/donnees/autres-donnees-foncieres/dvfplus-open-data) release of April 2026, which keeps every deed since **January 2014**. [`scripts/build_echezeaux_sale_records.py`](../scripts/build_echezeaux_sale_records.py) reads the hash-pinned regional file and writes [the deeds touching the cru](research/echezeaux-sale-records.json). Prices and addresses are dropped, because DVF reuse must not help identify private parties. **26 deeds touch 45 Échezeaux parcels** (2014-01-17 to 2025-11-20).

- Sale dates and later company records sometimes line up, but an intervening contribution or transfer can explain the sequence. The Les Cruots deed proves this: the Rouget brothers bought its four contributed parcels in March 2024 and contributed them in July. D0313 was sold in July 2021 but ORIGINE first appears in 2023; D0671/D0673 were co-sold on 24 December 2019 and appear under Mongeard-Mugneret in 2021. The annual record alone does not name a deed buyer.
- **D0146** (Les Cruots ou Vignes Blanches, 2,801 m² cadastral, no company record) was co-sold with D0144, D0145, D0511 and D0512 in March 2024. Only those other four appear in the later Les Cruots contribution tables. D0146 remains a co-sale lead through a later holder, with no buyer, ownership contribution or tenancy assigned from the founding deed.
- Earlier deeds date known changes: **D0631** (with D0706 and 25 parcels outside the cru) on 2 May 2017, the Jayer-Gilles holding now recorded to Domaine Hoffmann-Jayer; **D0822** sold and **D0821** exchanged on 17 July 2018, matching Berthaut-Gerbet's first vintage from these vines; **D0709** on 19 June 2019, before Anne Gros's first company record (2021); **D0820** in August 2017 (Arnoux-Lachaux).
- Several parcels without company records changed hands: D0701 (2017 and 2020), D0329/D0737/D0746 (December 2020), D0155 (2025), and D0301–D0304 (2016, 2018 and 2023). Their absence from the company files does not establish the buyers' identities.
- Exchanges (the 2024 swaps of former Gros parcels D0830/D0833 and D0832/D0835, D0903, D0821) move land both ways and give no lead. A sale with several dispositions may split parcels between buyers, so it gives no lead either.
- Gifts and inheritances are not in DVF. Deeds before 2019 are matched by today's parcel number only; lineage before 2019 is not traced.

**Size-matching was tested and not adopted.** Matching a domaine's published Échezeaux area against sums of unmatched parcels in the same named area only works when the published figure is exact to the square metre, as Winehog's are. Published figures are usually rounded (for example "0.83 ha" or "about 1 acre"). For a 0.44 ha En Orveaux holding, about 12,600 combinations of unmatched parcels come within 50 m², 41 of them made of adjacent parcels. Such matches would be noise, not leads. Exact published areas remain welcome, and each can be tested in the same way as the Winehog reconstructions. D0362 has an exact cadastral-area match; Vigot D0195 differs by 2 m² and is explicitly a near-area reconstruction.

The small parcels without records are not boundary slivers: all but five unmatched parcels lie more than 96% inside the cru. Only D0354, D0364 and D0802–D0804 straddle its boundary.

### Producer holdings and the named-area census

Checked 29 September 2026. Producers' own pages, importer sheets, merchant texts and guide entries were searched for the size and named area of each Échezeaux holding. Only figures read on a citable page were recorded; several merchant pages refused automated reading, and figures seen only in search summaries were left out (for example, Guyon's 34 ares of "En Orveaux" turned out to be its Vosne-Romanée premier cru). The results are `producerHoldings` in [the curation](research/echezeaux-farming-curation.json). Each parcel is now labelled with its cadastral lieu-dit ([`build_echezeaux_parcel_named_areas.py`](../scripts/build_echezeaux_parcel_named_areas.py), from the pinned lieux-dits snapshot), and the register adds a **named-area census**.

- **Exact and near-area reconstructions.** Gérard Mugneret states it sharecrops 0.6462 ha owned by Mugneret-Gibourg in Les Quartiers de Nuits, exactly D0362's cadastral area. Vigot's [1997 review, reposted 17 November 2006](https://www.domainevigot.com/Echezeaux-1997), gives 5,963 m² in Les Rouges du Bas, versus D0195's **5,965 m² cadastral** (5,963.3611 m² geometry). Vigot is a **near-area reconstruction**, not an exact cadastral match or current technical sheet. Mugneret-Gibourg reports taking back the vines for the 2017 harvest.
- **En Orveaux, the largest gap:** 41 parcels (4.24 ha) have no company record. Producers without matching company records publish at least **2.38 ha** there (Jean-Yves Bizot added 0.5 ha): Christian Clerget (1.09 ha farmed against 0.22 ha recorded), Bouchard Père & Fils (39 ares, owner), Dominique Mugneret (40 ares) and Jean-Pierre Guyon (22 ares). Jacques Cacheux (about 1 ha across En Orveaux, Les Cruots and Les Poulaillères) and Jean-Yves Bizot (En Orveaux and Les Treux, size unpublished) add more that cannot be split by named area.
- **Les Rouges du Bas:** Méo-Camuzet's 0.44 ha has no company record, against 0.86 ha of unrecorded land. **Les Cruots:** Georges Noëllat's 0.07 ha, and possibly 0.25 ha of Lamarche land (1.35 ha published in 2009 against 1.10 ha now recorded).
- **Consistency checks:** Domaine d'Eugénie (0.94 ha published; 0.93 ha recorded, including D0340 bought in November 2023), Jean Tardy (0.34 ha in Les Treux; 0.35 ha recorded to Domaine Bouchy et Amis) and Anne Gros (0.76 ha) match their company records.

The census compares areas only: it never places a holding on particular parcels, because a rounded figure can fit thousands of parcel combinations. It shows where the remaining gaps are and which producers to ask. Les Poulaillères is shown under its cadastral name `LES POULA`, whose crosswalk is still unreviewed.

### Court rulings, Liger-Belair's exact areas and the old guides

Checked 29 September 2026; public sources only, no outreach.

- **Court rulings** (searched on [Juricaf](https://juricaf.org/); the Cour de cassation search soon required a CAPTCHA, which was not bypassed). A Dijon appeal ruling of 10 May 2007 lists "section D no 152, Clos Saint Denis, 3 a 13 ca": exactly **D0152** (313 m², no company record). It was then part of an undivided family estate and had been farmed since 25 December 1982 by one heir under a long-term rural lease. The ruling is pseudonymised and the family is not identified here. A 2009 Lyon tax ruling records that SCE du Domaine Dujac sharecropped its vines, including Flagey-Échezeaux, to Société Domaine Dujac SA from 1997 to 2015: owning and farming entities of one domaine can differ.
- **Liger-Belair** publishes its Échezeaux to the square metre: Cruots 0.3299 ha, Champs Traversins 0.2546 ha, Clos Saint-Denis 0.0312 ha. **D0793 + D0795** total exactly 3 299 m²; among parcels in Les Cruots without a company record, the only other exact combination includes Grivot's named plots. The two parcels alternate with Grivot's former D0792 and D0794, which fits Winehog's account of the 2006 Lamadon division between Liger-Belair (métayage), the Lamarche family and Grivot. **D0155** (312 m²) matches the Clos Saint-Denis figure, but D0152 is only 1 m² larger, so that lead is weak. Five parcel sets match the Champs Traversins figure, so none is recorded. These are area reconstructions; the estate names no parcel.
- **A.-F. Gros** "exploite 26 ares" in Champs Traversins (Guide Hachette), with no company record there.
- **Old guides.** Danguy & Aubertin (1892) and Camille Rodier (first edition, c. 1920), read from Internet Archive scans (filed there under each other's titles), list owners by climat. Many families are still present: Camuzet (Méo-Camuzet) and Confuron-Bornot in Les Rouges du Bas; Gros-Renaudot in Les Loächausses, Cruots and Treux; Gouroux (still owning Millot's Dessus plots) in Loächausses, Cruots and Clos Saint-Denis; Lamarche, Liger-Belair, Faiveley, Grivot and Arnoux. The register shows both lists per named area as historical context only.

With these additions, 139 parcels have no named candidate. The main remaining gaps are En Orveaux (4.24 ha without a company record or lead), Les Treux (1.55 ha) and Les Loächausses (0.82 ha).

### Reverse search of land companies without a domaine name

Checked 29 September 2026 in [BODACC](https://bodacc-datadila.opendatasoft.com/explore/dataset/annonces-commerciales/) legal notices and the [official company search](https://recherche-entreprises.api.gouv.fr/). Nine right-holder groups carried no recognisable domaine name. For each one, the registry gives the registered office, the family that manages it and the registration date, and these were compared with domaine companies. Registry management is summarised by family. The subsequently reviewed founding deeds name parties only where relevant to the parcel contributions or leases. A land company is not itself proof of farming.

| Holder in rights file | Parcels | Registry or filing finding | Lead |
| --- | --- | --- | --- |
| LES CRUOTS | D0144, D0145, D0511, D0512 | July 2024 deed names the four contributions, individual tenants and permitted use by EARL 809967854 | Domaine Emmanuel Rouget; current farming unverified |
| GFA FAMILLE FOREY BJ | D0128, D0154, D0156, D0157 | November 2024 deed directly names SCE 326589686 as oral-lease tenant | Domaine Forey Père et Fils; current farming unverified |
| GROUPEMENT FONCIER VITICOLE DE ORVEAUX | D0316, D0323, D0633, D0636 | February 2024 deed names the contributions and Laurent Jousset-Drouhin personally as tenant, with partial scope | Drouhin family tenancy; operating-company arrangement unresolved |
| GFV GRANDS CRUS INVESTISSEMENT | D0650, D0651, D0652 | Abbreviated registry name matches SIREN 413823873, office 11 rue des Grands Crus, Vosne: the Méo-Camuzet family's address | Domaine Méo-Camuzet (0.44 ha published in Les Rouges du Bas; these parcels cover 0.45 ha there) |
| ORIGINE, now LC | D0313 | Paris office shared with SAS Domaine de la Pousse d'Or; one person became manager of both in 2022 | Domaine de la Pousse d'Or (a quarter-acre in the Poulaillères, held by its owner's holding company) |
| GFA HERITIERS COUDRAY | D0635, D0714, D0719 | Family GFA, registration moved to Hérault in 2024 | None found |
| HOR VIGNOBLES | D0813, D0814 | Chaired by a foreign holding company | None found |
| SCI LES CLIMATS | D0815 | Beaune SCI managed by a member of the Follin-Arbelet family; the name alone is not a domaine link | None found |
| PROPRIETAIRES DU BND 267 D0143 | D0898–D0902 | Undivided co-owners, not a company | Not searchable |

The first three were created in 2024, and their parcels first appear in the January 2025 rights file, which supports matching the U-numbered holders (no SIREN) to these companies. The Méo-Camuzet and Pousse d'Or leads also agree with the area each estate publishes in that named area. The eight parcels move from "no named candidate" to holder leads, leaving **131** without a candidate.

The other public sources were tried again. The [SAFER legal-notice site](https://annonces-legales.saferbfc.com/commune/21267) is now reachable, but it lists only notices still open, and none concern Flagey-Échezeaux or Vosne-Romanée. The prefecture site still rate-limits, the Cour de cassation search now puts up a JavaScript and cookie check, and Gallica still refuses automated reading. None of these checks was bypassed.

### Reviewed 2024 founding deeds

The three user-supplied Pappers copies explicitly name **twelve parcels**, whose cadastral areas all match the pinned snapshot. Their contribution dates are **9 February (Orveaux), 2 July (Les Cruots), and 22 November 2024 (Forey)**, distinct from the dates on their filing labels. [Detailed reading, source pages, hashes and next document requests](echezeaux-statutes-research.md).

- **Les Cruots:** four parcels, 0.3669 ha. Nicolas and Guillaume Rouget bought them in March and contributed them in July. The deed recites the old lease and a concurrent new lease to the brothers, with permission for use by **EARL 809967854**, distinct from the other Rouget company used in the earlier office comparison. D0146 is not in the contribution tables.
- **Orveaux:** four parcels, 0.5263 ha cadastral; 0.4147 ha plantable/planted. The lease recital to **Laurent Jousset-Drouhin personally** enumerates 0.4550 ha, with only parts of D0316, D0323 and D0633. Its annex broadly calls the lease total; the detailed partial areas are retained. Neither scope nor tenant is silently replaced by the domaine brand.
- **Forey:** four parcels, 0.3005 ha. The deed names **SCE du Domaine Forey Père & Fils (326589686)** as oral-lease tenant. It separately mandates a 2025–2048 lease; the signed new lease has not been reviewed. The 1992 lease elsewhere in the deed excludes these four parcels.

The app shows these as dated **Company filings and leases**, alongside ownership, notices and research. Contributions, lease recitals and mandates remain separate from verified current farming. Historical research uses an explicitly selected date source; an undated guide or estate page cannot inherit a supporting registry's date.

### Unofficial sources: company aggregators and the wine press

Checked 29 September 2026.

- **Company aggregators.** Pappers company pages load, but direct filing requests met Cloudflare checks. The owner subsequently supplied the Les Cruots, Orveaux and Forey copies; their exact contribution and lease pages were visually reviewed. Links, dates, pages and hashes are recorded without republishing the PDFs. Coudray and HOR remain unread in full. Other blocked services remain access gaps.
- **Guide Hachette** has 218 Échezeaux entries dating back to the 2001 edition. Two published areas equal exact cadastral sums:
  - Guide Hachette 2001 describes **52 a 63 ca in En Orveaux** for Joseph Drouhin's 1998 vintage. The 2024 ORVEAUX deed independently names the four parcels totalling **5,263 m² cadastral**, while explicitly giving **4,147 m² plantable and planted**, consistent with the importer's rounded 0.41 ha. The historical guide stays separate from this later deed; its date is not backfilled from a 2024 company notice.
  - François Gerbet had **18 a 76 ca in Les Quartiers de Nuits and Les Treux** (2006 vintage). **D0360 + D0508** total exactly 1 876 m². Winehog lists only part of D0508 for Berthaut-Gerbet in 2019, so the plot's use has changed since.
- **Méo-Camuzet.** The three Grands Crus Investissement parcels total **0.4389 ha** in the cadastre, which matches the estate's 0.44 ha in Les Rouges du Bas to the hundredth.
- **New holdings with no company record:**
  - Michel Gros: 0.38 ha in Les Loächausses, first vintage 2022, previously part of the Gros Frère et Sœur cuvée (Vinous, quoted by a merchant).
  - Gros Frère et Sœur: 92 ares.
  - Nudant: 66 ares.
  - Charlopin: 33 ares.
  The last three name no area, so they are research targets only.
- **A.-F. Gros conflict.** The 2025 guide places its 26 ares in Les Loächausses; the 2012 edition gives Champs Traversins. Both are modeled as disputed alternatives, and the area is excluded from both climat totals until the location is resolved.

### Independent research: Winehog

[Winehog's Flagey-Échezeaux vineyard articles](https://winehog.org/vineyards/flagey-echezeaux-vineyard-articles/) (Steen Öhman) map holdings by climat. Public articles were used in full. Premium articles were used only where the repository owner supplied them (Grivot, Arnoux-Lachaux, Millot, Berthaut-Gerbet), recording facts and links only; other Premium articles contributed their public preview. Three plots are named by cadastral number and all agree with the recorded rights: **D0510** (Hospices de Beaune, Cuvée Jean-Luc Bissey, donated 2011), **D0631** (Jayer-Gilles; recorded holder Domaine Hoffmann-Jayer) and **D0632** (Niquet-Jayer; no company record, consistent with private owners).

A Premium article supplied by the repository owner (facts only) names Domaine Jean Grivot's seven plots: Les Cruots **D0172, D0176, D0599** and former **D0792, D0794** (divided in 2022 into D0826–D0829), and Champs Traversins **D0590, D0593**. The published areas equal the cadastral sums exactly, and none of the plots has a company owner, consistent with private family ownership farmed by Grivot. It also dates the division of the Lamadon holdings in 2006 between Liger-Belair (métayage), the Lamarche family and Grivot.

A second supplied article names Domaine Arnoux-Lachaux's four Les Rouges du Bas plots, **D0818–D0820** (formerly 206) and **D0677**, with exact area matches. D0677 is recorded to François Feuillet, so this implies Arnoux-Lachaux farmed a Feuillet-owned parcel in 2019, which conflicts with the Feuillet → Duband lead for that parcel; the conflict is recorded, not resolved.

Two further supplied articles name **Jean-Marc Millot's D0798–D0800** (0.5981 ha, owned through the Gouroux family; a 1986 court case against Mongeard-Mugneret gave Millot the right to vinify them) and **Berthaut-Gerbet's D0360, D0821, D0822 and part of D0508** (0.2126 ha from 2018; the rest of D0508 is presumably farmed by another domaine). All areas match the cadastre.

Winehog's 2014 Échezeaux du Dessus areas also equal exact sums of current parcels: Perdrix = D0620 + D0621, Millot = D0798–D0800 (since confirmed by name), Tremblay = D0189 + D0190, Mongeard = D0668–D0670. These parcel sets are this register's reconstruction, recorded as weak leads. The Michel Noëllat area matches D0191, D0192 and D0671–D0673, which conflicts with Mongeard and Bouchon Pourpre rights and is left unresolved. Winehog's 2020 report that Liger-Belair added an Échezeaux du Dessus plot is compatible with, but does not identify, D0673's 2024 transfer to Bouchon Pourpre.

### Nicole Lamarche: three exact candidate parcels

The pinned DGFiP file records `NICOLE LAMARCHE`, SIREN **397738634**, right code `P` (ownership), on these parcels as of **1 January 2025**:

| June 2026 cadastral ID | Reference | Area inside Échezeaux |
| --- | --- | ---: |
| 212670000D0168 | D 0168 | 664.4411 m² |
| 212670000D0169 | D 0169 | 5,806.9552 m² |
| 212670000D0519 | D 0519 | 4,537.2814 m² |
| Total | 3 parcels | 11,008.6777 m² / 1.1009 ha |

The [official business-search API](https://recherche-entreprises.api.gouv.fr/search?q=397738634), retrieved successfully on 28 September 2026, returns this SIREN with the same company name, active status and registered address at 9 rue des Communes, Vosne-Romanée. That corroborates the legal entity; an active company or vinification activity code does not establish parcel operation. The [directory page](https://annuaire-entreprises.data.gouv.fr/entreprise/nicole-lamarche-397738634) required JavaScript in the text browser. The domaine website timed out.

**Actionable result:** associate this right holder with the correct existing Nicole Lamarche producer. To verify farming, obtain dated confirmation covering the three exact IDs, actual operation and season. Do not extrapolate to other Lamarche entities: the Grands-Échezeaux snapshot includes `NATHALIE PACAREAU LAMARCHE`, SIREN **538257932**, a different entity.

### Anne Gros: historical application with an unknown outcome

The [official regional archive, pages 74–75](https://www.prefectures-regions.gouv.fr/irecontenu/telechargement/106030/671617/file/recueil-bfc-2023-055-recueil-des-actes-administratifs-special.pdf#page=74) was downloaded and both scanned pages visually inspected. The receipt dated **24 November 2022**, dossier **2022-204**, entry **BFC-2022-11-24-00025**, identifies applicant **GROS ANNE** and previous operator **DOMAINE GROS FRERE ET SOEUR**. It explicitly does not authorise cultivation.

| Printed Flagey-Échezeaux reference | Exact June 2026 join | Appellation | 2025 rights |
| --- | --- | --- | --- |
| D0093 | 212670000D0093 | Grands-Échezeaux | ANNE GROS; bare ownership (`N`) |
| D0177 | 212670000D0177 | Échezeaux | No matched record |
| D0178 | 212670000D0178 | Échezeaux | No matched record |
| D01776 | Unresolved | Unknown | No guessed correction |

No explicit decision, outcome attestation or current-operation confirmation was located. Failure to find a refusal does not establish implicit approval. Even approval would need confirmation of actual operation. The modern reference matches do not establish unchanged historical boundaries. Parcel details therefore show a historical application, source pages and unknown outcome. Vosne-Romanée references in the annex are outside this pilot's two crus.

Reproduction metadata: **30,832,964 bytes**, SHA-256 **`6c2a930a5e6d3de70b72af5bbe8b1afb9d8996506dda017574e141aca48b52df`**. The PDF text layer contains page footers, not the substantive scanned text: text-only extraction misses the names and annex. [the curation](research/echezeaux-farming-curation.json) records the checked references and source metadata. Browser retrieval failed, but direct HTTPS succeeded; a French VPN was not needed in this session. Redistribution terms for scans were not independently established, so the app links to the official document without bundling scans.

Anne Gros's own [Échezeaux page](https://www.anne-gros.com/products-category/echezeaux/) describes a **0.76 ha** Les Loachausses plot returning in **2007** after a **25-year lease** to Gros Frère et Sœur. This supports a producer/lieu-dit relationship and historical lease, but supplies no cadastral IDs or current verification date. It cannot resolve the 2022 annex or assign all Les Loachausses parcels to the domaine.

## Sources and the relationships they support

| Source | Supported claim | Limitation |
| --- | --- | --- |
| Cadastre Etalab | Reference and geometry at a snapshot | No operator identity; preserve the full polygon and measure cru overlap separately |
| DGFiP legal-entity rights | Entity and right codes at 1 January of the reference year | Incomplete coverage, dated rights and possible leases |
| Business register / SIREN | Legal identity | A landholding company, operator, domaine brand and bottler can differ |
| DDT applications and decisions | Applicant, previous operator, and documented authorised operator | Event records, not a farmer census; an outcome and actual operation still need checking |
| Producer confirmation or appropriately shared CVI extract | Dated operation of specifically identified parcels | Validate issuer, date, scope, permission to use, identity and geometry history |
| Producer wine sheet or lieu-dit description | Producer/appellation or named-area context | Similar acreage, a bottle or approximate map cannot identify a cadastral holding |

The Douane's [Fiche de compte](https://www.douane.gouv.fr/service-en-ligne/exploitation-viti-vinicole-fiche-de-compte) provides an authorised exploitation's CVI parcel information and CSV exports. It requires a Douane account and enrolment. A domaine-supplied, appropriately shareable extract is a practical exact-reference source; this is not a public bulk operator lookup.

[CADA opinion 20222631](https://www.data.gouv.fr/explore/cada/20222631) rejected the requested release of detailed CVI parcel data, citing fiscal confidentiality. Open cadastral geometry does not imply an openly publishable farmer register. Seek producer cooperation or another lawful, shareable source.

## Verification workflow proposed for #364

1. Start with **all geometry**, including parcels without DGFiP records. Join the official cru separately. Retain snapshot date, source hash and overlap measurements.
2. Resolve entities and producer identities separately. Use SIREN where available and review domaine aliases against primary evidence. Never derive an operator from a business name alone.
3. Collect parcel-specific evidence. Store **applicant**, **previous operator**, **authorised operator**, and **actual operator** as different claims. Keep the printed reference alongside normalised commune/prefix/section/number. Never repair a typo by proximity or acreage.
4. Establish scope: full parcel, explicitly described partial parcel or unresolved. Support multiple operators and competing claims. An undocumented part must remain unknown rather than colouring the entire parcel.
5. Establish time: document date, operation start/end if known, verified-as-of date, reviewer and source vintage/season. Historical applications and undated webpages cannot assert current operation.
6. Review cadastral continuity. Splits, merges and area changes need explicit predecessor/successor evidence. An ID match is not a historical geometry audit.
7. Publish the farming overlay only after review of actual operation, labelled **“Verified as of [date]”**, with source and scope. Show historical, authorised-only, stale or unknown status elsewhere. Reverify for the displayed season; preserve superseded claims and withdrawal reasons.

Minimum future claim record: relation type; printed reference; resolved parcel IDs and geometry snapshot/hash; whole/partial scope; legal entity and producer crosswalk evidence; document/page/dossier IDs; URL/hash/retrieval date/reuse terms; effective interval; verified-as-of date; reviewer; supersession/withdrawal reason. A review date must not substitute for an operation date. These verification features remain proposed work under #364.

The smallest useful evidence request is dated confirmation for **D0168, D0169 and D0519** from Nicole Lamarche, plus the outcome/current operation of **D0177, D0178 and D0093** from Anne Gros. No outreach was sent.

## Implemented behaviour and deployment

- Possible matches use **blue 58% fill and dark-blue 2.8 px dashed outlines**, distinct from crimson wine boundaries and ochre chosen holders. The legend/card use the same palette. “Show possible matches on map” zooms and returns the map to view, respecting reduced motion.
- A possible match, selected holder or parcel can be linked explicitly to an existing app producer. The editor searches names/localities, labels shared producers and supports save/change/remove/profile navigation. No suggestion is accepted automatically.
- D1 stores links per signed-in account, cru, **rights snapshot** and exact holder. They say **“Manually linked · farming unverified”**. Their map action highlights recorded rights, never verified holdings. They change neither wine identity nor `domaineLinks`.
- Reads/writes recheck producer visibility. Revoked shared producers disappear from links. Another account cannot read/overwrite them. Producer deletion cascades to associations; a merge that deletes its source producer requires relinking to the retained producer.
- `build_echezeaux_parcels.py` generates the holder allowlist from the same snapshot, preventing arbitrary holder IDs. Older rights snapshots are never silently promoted to a refreshed snapshot.
- Link reads start after enabling/downloading parcels; catalogue reads start only when editing. Retry controls keep failures independent of the map. Existing INAO and parcel assets/hashes are unchanged. Research and holder metadata are small JSON modules, not additional map downloads.

- **History and evidence.** Selecting a parcel lists its dated records: official notices (authorisations, applications, suspensions), company filings and leases, published research, ownership changes and parcel divisions, with weak leads folded away. Each record carries its date, a short caveat and a source link. Wording states that none shows who farms the parcel today, and a parcel with no records says so without implying nobody farms it. Colours stay neutral: wine red remains the verified producer and blue the possible match. The data is `src/lib/places/echezeauxParcelEvidence.json` (including Grands-Échezeaux D0093, D0615 and D0616), generated by `build_echezeaux_parcel_evidence.py` from the curation and loaded on demand as its own chunk, so the map is no heavier. Each event and research item needs a short `appNote`; inherited references are labelled "Inherited from former parcel …". See [mockups](mockups/echezeaux-evidence-panel.png).
- **Map stays in view.** The map is pinned under the dialog header while the side panel scrolls (both on a phone and beside the panel on a wide screen), so choosing an owner or parcel no longer means scrolling back up. A parcel picked from the finder scrolls its details into the space below the pinned map. On a phone the map is shorter (30% of the screen height) and the legend more compact to leave room; on very short windows it is not pinned. See [before and after](mockups/echezeaux-map-pinned.png).

Apply **`0087_parcel_producer_links.sql`** through the normal deployment migration process before enabling the API. This change does not deploy or close #376/#364/#344; current-farming verification remains incomplete.
