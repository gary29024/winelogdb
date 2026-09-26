# Chablis cadastral reconstruction audit — PR #349

Reviewed 26 September 2026. **Do not publish derived Premier Cru boundaries
from this method.** The review explicitly requires stopping if reconstruction
cannot reproduce the eight available INAO benchmark boundaries. It does not:
even unambiguous Côte de Jouan differs by 9.34%, and Vaupulent by 768.97%.
The existing INAO geometries, two partial-boundary safeguards and 30 missing
named-boundary fallbacks remain in place.

## Sources and method

- INAO parcel snapshot: 21 September 2026, SHA-256
  `6f84e0622c2a27d35fc1ad7b39629856bc5038aa38b9d629758c2fb873801d81`.
- Cadastre Etalab `lieux_dits`: 1 June 2026. The six benchmark communes are
  Chablis `89068`, La Chapelle-Vaupelteigne `89081`, Chichée `89104`, Courgis
  `89123`, Fleys `89168`, and Fontenay-près-Chablis `89175`. Download template:
  `https://cadastre.data.gouv.fr/data/etalab-cadastre/2026-06-01/geojson/communes/89/{code}/cadastre-{code}-lieux_dits.json.gz`.
- The review's [climat-to-lieu-dit tables](https://extranet.inao.gouv.fr/fichier/PNOCDCChablis.pdf)
  are **version 2.2 of a September 2010 consultation draft**, not the current
  approved specification. PDF pages 4, 8 and 9 were extracted and visually checked
  for the benchmark transcription. This is an investigation of the proposal,
  not acceptance of the draft as current legal authority.
- The [September 2025 approval](https://www.legifrance.gouv.fr/loda/id/JORFTEXT000052235330)
  points to a newer ministry specification. The ministry PDF endpoint failed
  retrieval during this audit. The accessible [June 2025 consultation copy](https://extranet.inao.gouv.fr/fichier/CDC-Chablis-250623-PNO.pdf),
  PDF page 2, lists 40 climats and their 17 umbrella groups, but has no detailed
  commune/lieu-dit tables. It cannot validate the old crosswalk by itself.

The audit joins names within their stated commune, normalising only accents,
case, punctuation and whitespace. It does not guess spelling equivalents or
select features by proximity. The strict gate requires exactly one matching
feature per name. For diagnostics, **all exact matches are unioned**, including
duplicate names, then intersected with INAO `438`. Missing names contribute
nothing. None of these diagnostic geometries is written to the application's
map assets or production configuration.

Areas use the INAO archive's own Lambert-93 WKT, with cadastral WGS84 geometry
transformed into that CRS. All denomination rows are unioned across all communes.
Geometry tolerance is symmetric-difference area divided by INAO benchmark area,
at most 1%. This measures both missing and extra land, not just a net area change.

## Eight benchmark results

Areas are hectares. These are comparisons with the raw INAO source, not claims
that a 2010 draft reconstructs the present legal boundary.

| Climat (INAO ID) | INAO | Diagnostic | Missing | Extra | Difference | Name gate |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Chaume de Talvat (404) | 1.1373 | 0.0000 | 1.1373 | 0.0000 | 100.0000% | Missing |
| Côte de Jouan (408) | 12.5842 | 13.6828 | 0.0383 | 1.1369 | 9.3382% | Pass |
| Les Beauregards (416) | 21.3111 | 17.7936 | 3.5176 | 0.0000 | 16.5057% | Missing/duplicate |
| Les Fourneaux (418) | 35.7769 | 24.6660 | 11.1110 | 0.0001 | 31.0566% | Missing/duplicate |
| Vaucoupin (432) | 47.3591 | 33.9116 | 13.4476 | 0.0000 | 28.3948% | Missing/duplicate |
| Vaugiraut (433) | 7.0114 | 7.0113 | 0.0001 | 0.0000 | 0.0018% | Duplicate |
| Vaupulent (435) | 2.6345 | 18.7548 | 2.0692 | 18.1895 | 768.9711% | Pass |
| Vosgros (437) | 22.5651 | 22.5586 | 0.0065 | 0.0000 | 0.0287% | Duplicate |

No benchmark passes both gates. Vaugiraut and Vosgros closely reproduce INAO
only after unioning duplicate cadastral records; that is useful evidence for
future work, but does not rescue the other six comparisons.

Specific lookup failures:

- Courgis has no `Chaumes de Talvat` or `Hauts des Chambres du Roi` exact match,
  and three `Les Corvées` records. `HAUT DES CHAMBRES DU ROI` is a possible
  spelling crosswalk to review, not an automatic replacement.
- Fleys has no `Côte des Près Girots` exact match and two `Sur la Côte` records.
  `COTE DES PRES GIROT` exists with a different spelling.
- Chichée has no `Vaucoupins` exact match; it has two `VAUCOPINS`, two
  `ADROIT DE VAUCOPINS` and two `VAUGIRAUT` records.
- Côte de Jouan and all three Vaupulent place names match uniquely. Their
  geometric discrepancies therefore cannot be solved just by spelling aliases
  or relaxing the single-feature requirement.

The broad Premier Cru area is 932.1622 ha. The union of the eight INAO benchmarks
is 143.3683 ha, leaving 788.7940 ha outside those eight. The diagnostic union
leaves 800.7949 ha. **These are benchmark remainders, not an all-40 coverage
claim.** The broad `438` area also overlaps Grand Cru `439` by 106.3753 ha, so
its full area must not be treated as a disjoint inventory of the 40 named PCs.

Likewise, umbrella climats intentionally overlap their component names. Any
future overlap check must allow reviewed parent/child relationships, rather
than fail every overlap or remove it from the official geometry.

## Reproduce

Install `scripts/burgundy-map-requirements.txt`. Download the pinned INAO archive
as `inao-2026-09-21.zip`, the 2010 draft as `chablis-cdc-2010-draft.pdf`, and the
six cadastral files as `lieux-dits-{code}.json.gz` into `.tmp/burgundy-map`.
All inputs are hash-checked against the builder and
`scripts/chablis-cadastre-audit.json`.

```sh
python scripts/audit_chablis_cadastre.py --source-dir .tmp/burgundy-map --report .tmp/burgundy-map/chablis-cadastre-audit-results.json
```

Expected exit status: **2** (publication gate failed). The JSON report contains
every lookup count, source URL/hash, area metric and pass/fail result. The script
does not download sources or change any map. It deliberately stops at the eight
benchmarks: no all-40 crosswalk, Fourchaume/Mont de Milieu completion, or new
compound-name matching is added using an unvalidated reconstruction.

To resume, obtain an approved current commune/lieu-dit or parcel crosswalk,
explain the Côte de Jouan and Vaupulent differences, then rerun the benchmarks
before preparing derived production boundaries with explicit provenance.

## La Moutonne

This independent location improvement does ship. [Domaine Long-Depaquit](https://www.albert-bichot.com/en/domaine-long-depaquit_22.html)
describes a 2.35 ha monopole, approximately 95% in Vaudésir and 5% in Les Preuses.
Both existing INAO climats are highlighted in full under **Vineyard location**,
with a note distinguishing the containing areas from the monopole itself.
The unique name can identify this location without a producer field, after
Grand Cru geography, tier and colour checks. Conflicting producers, mixed
climat names and inconsistent reference fields retain broad scope.

An exact La Moutonne boundary still requires documented parcel identifiers and
licensed cadastral geometry. Do not trace a brochure or publish the two entire
containing climats as its own polygon. Before adding a parcel union, verify
Grand Cru containment and substantiate the review's precise 2.3520 ha total /
2.2418 ha Vaudésir / 0.1102 ha Les Preuses measurements with parcel evidence.
The current UI uses the producer's published rounded figures instead.
