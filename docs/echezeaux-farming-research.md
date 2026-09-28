# Échezeaux: linking parcels to farming domaines

Checked 28 September 2026 for [#376](https://github.com/gary29024/winelogdb/issues/376), following merged [pilot #374](https://github.com/gary29024/winelogdb/pull/374). Current-operation research continues under [#364](https://github.com/gary29024/winelogdb/issues/364); unresolved named areas remain under [#344](https://github.com/gary29024/winelogdb/issues/344).

## Findings

A cadastral parcel can be joined to a dated legal right holder. Today's farmer needs a second, independently evidenced relationship. A manual link to the app's producer catalogue solves identity/navigation, not that evidence gap.

Échezeaux has **276 parcels, 119 with recorded rights and 157 without a matched record**. Records cover **21.54 ha** of mapped cru overlap. **Zero parcel-specific current operators are verified.** Two Échezeaux parcels now have a reviewed historical application lead; another lies in Grands-Échezeaux. None enters `domaineLinks` or verified colouring.

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

Reproduction metadata: **30,832,964 bytes**, SHA-256 **`6c2a930a5e6d3de70b72af5bbe8b1afb9d8996506dda017574e141aca48b52df`**. The PDF text layer contains page footers, not the substantive scanned text: text-only extraction misses the names and annex. `src/lib/places/echezeauxFarmingResearch.json` records the checked references and source metadata. Browser retrieval failed, but direct HTTPS succeeded; a French VPN was not needed in this session. Redistribution terms for scans were not independently established, so the app links to the official document without bundling scans.

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

Apply **`0087_parcel_producer_links.sql`** through the normal deployment migration process before enabling the API. This change does not deploy or close #376/#364/#344; current-farming verification remains incomplete.
