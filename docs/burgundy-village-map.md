# Burgundy village maps

Wine details and shared wine details offer **View village map** for mapped
Côte de Nuits and Côte de Beaune wines across twenty village appellations,
including the Grand Crus of Flagey-Échezeaux, Clos de Vougeot and the Montrachet
group, plus Corton, Corton-Charlemagne and Charlemagne. The dialog shows neighbouring cru boundaries, highlights
the wine's matched INAO designation, and supports selection, pan/zoom, a village
overview and returning to the wine. The renderer, the selected village's catalogue
and its geometry load on demand; other village catalogues and boundaries stay unloaded.
The existing Burgundy Atlas link remains available.

## Coverage and meaning

| Village map | Grand Crus | Named Premier Crus | Broad areas | Wine features |
| --- | ---: | ---: | ---: | ---: |
| Gevrey-Chambertin | 9 | 26 | 2 | 37 |
| Morey-Saint-Denis | 5 | 20 | 2 | 27 |
| Chambolle-Musigny | 2 | 24 | 2 | 28 |
| Vosne-Romanée / Flagey-Échezeaux | 8 | 14 | 2 | 24 |
| Fixin / Brochon | 0 | 6 | 2 | 8 |
| Vougeot | 1 | 4 | 2 | 7 |
| Nuits-Saint-Georges / Premeaux-Prissey | 0 | 41 | 2 | 43 |
| Marsannay / Chenôve / Couchey | 0 | 0 | 3 colour views | 3 |
| Côte de Nuits-Villages (five communes) | 0 | 0 | 1 | 1 |
| Meursault | 0 | 19 | 4 colour/tier views | 23 |
| Puligny-Montrachet | 4 | 17 | 4 colour/tier views | 25 |
| Chassagne-Montrachet / Remigny | 3 | 55 | 2 | 60 |
| Saint-Aubin | 0 | 30 | 4 colour/tier views | 34 |
| Blagny / Meursault / Puligny-Montrachet | 0 | 7 | 2 | 9 |
| Aloxe-Corton / Corton hill | 3 appellations + 24 Corton climats | 14 | 2 village/tier areas | 43 |
| Pernand-Vergelesses / Corton hill | 3 appellations + 24 Corton climats | 8 | 2 village/tier areas | 37 |
| Ladoix / Corton hill | 3 appellations + 24 Corton climats | 11 | 4 colour/tier views | 42 |
| Beaune | 0 | 42 | 2 | 44 |
| Pommard | 0 | 28 | 2 | 30 |
| Volnay / Meursault | 0 | 29 | 2 | 31 |

There are 489 distinct wine identities (450 vineyard targets and 39 broad areas),
plus ten colour-specific views sharing five village appellation identities.
Bonnes-Mares, Montrachet and Bâtard-Montrachet each appear in two maps and count
once in the identity registry. The Corton group's 27 boundaries appear in three
maps and likewise count once. There are 556 wine features across the twenty maps.
Corton itself is a broad Grand Cru appellation target; its 24 named climats are
separate vineyard targets, not 24 additional Grand Cru appellations. Overall,
the maps cover 395 named Premier Crus and 32 Grand Cru appellations.
The [full Burgundy coverage checklist](burgundy-map-coverage.md) tracks all 44
village appellations and the remaining Grand Cru and regional work.

- Gevrey-Chambertin and Brochon commune outlines. Gevrey's village appellation
  includes land in Brochon, so the geometry is not clipped to one commune.
- The Morey and Chambolle maps include both commune outlines.
  Bonnes-Mares (`inao-denom-361`) retains the same complete production boundary,
  identity and Atlas destination in both maps. A Bonnes-Mares wine opens the
  Chambolle map by default; it is also selectable when exploring Morey. This
  default is a navigation choice, not a claim about the bottle's commune of origin.
- The Vosne map includes Vosne-Romanée and Flagey-Échezeaux. Échezeaux and
  Grands-Échezeaux retain separate identities and geometry in Flagey. Les Beaux
  Monts and both broad Vosne areas retain their full extent across both communes.
  Flagey's En Orveaux and Les Rouges resolve under the Vosne-Romanée appellation.
- Fixin retains Clos de la Perrière across Fixin and Brochon. Nuits-Saint-Georges
  retains all 41 named Premier Crus, including the plots in Premeaux-Prissey.
  Vougeot keeps its four Premier Crus distinct from the Clos de Vougeot Grand Cru.
- Marsannay has one source denomination ID (`806`) but three source labels:
  Marsannay, Marsannay (rouge et blanc), and Marsannay (rosé). The importer
  preserves their combined overview and separate red/white and rosé unions.
  Explicit wine colour selects the corresponding area; an unknown colour uses
  the labelled overview. An explicit Marsannay Rosé name also selects rosé,
  unless it conflicts with the recorded colour. None identifies a single plot.
- Côte de Nuits-Villages includes all five source communes and both disconnected
  production areas. Its map can zoom out far enough to show the whole extent.
- Meursault and Puligny retain different red and white village production areas
  under their original INAO denomination IDs. Saint-Aubin also has two colour
  identities, though their source geometry is equal. Explicit colour (or a
  red/white wine style when colour is blank) selects the corresponding boundary.
  Unknown colour opens a labelled combined overview, with no single plot inferred.
- Chassagne includes Remigny. Montrachet (`927`) and Bâtard-Montrachet (`273`)
  retain their complete boundaries across Puligny and Chassagne in both maps.
  A wine bearing either shared Grand Cru opens Puligny by default; that does not
  determine its commune. Bienvenues and Chevalier remain distinct from Criots.
- Blagny is a red-wine appellation across Meursault and Puligny. Its seven named
  Premier Cru boundaries coincide with white-wine designations in those two
  appellations, but keep separate identities. Meursault Premier Cru Blagny
  (`2373`) is also distinct from the Blagny village appellation (`352`). Explicit
  white/rosé Blagny records do not receive a map target; the app does not guess
  whether they mean Meursault or Puligny.
- The three Corton maps retain all shared Grand Cru boundaries in full, with
  Aloxe-Corton as the default navigation context. Corton (`549`) and
  Corton-Charlemagne (`550`) span all three communes; Charlemagne (`476`)
  spans Aloxe and Pernand. Charlemagne is a smaller, separate identity inside
  Corton-Charlemagne, allowing for tiny source-edge discrepancies. Named Corton
  denominations (`2348`–`2371`) keep their original IDs and geometry.
- A named Corton wine can select a local INAO climat without an Atlas page.
  An unnamed, blended, unsupported or explicitly white Corton keeps appellation
  scope. The current snapshot does not distinguish Corton's red/white broad
  areas, and lacks separate geometry for some published names, including Clos
  des Cortons Faiveley and the additional Pernand Corton climats. No Premier Cru
  geometry is reused to fill those gaps. Wine records still need a Corton
  appellation anchor; names in other villages do not imply Corton.
- Aloxe's full appellation includes source land in Pernand and Ladoix. Les
  Chaillots is displayed without the source suffix "blanc": the denomination's
  CVI codes include both red and white. Ladoix preserves both official village
  colour IDs, even though the pinned geometries are equal.
- Beaune retains all 42 Premier Cru denominations and one shared red/white
  production boundary for each. Sur les Grèves contains the smaller Sur les
  Grèves - Clos Saint-Anne; both remain selectable, and a label naming both
  selects the smaller designation using the merged umbrella matching rules.
- Pommard and Volnay retain all 28 and 29 Premier Cru denominations respectively.
  Both are red-only appellations: explicit white/rosé records do not open their
  maps. Names such as Pommard Rugiens or Epenots stay at broad Premier Cru scope,
  because they do not establish which of the separately mapped areas is meant.
- Volnay includes Meursault's Santenots, with the full 29.01 ha source boundary.
  A title such as Santenots du Milieu selects that whole named area with an
  explanation that smaller Volnay subdivisions are unavailable. Meursault's
  Les Santenots Blancs and Les Santenots du Milieu retain their own identities
  and different white-wine boundaries on the Meursault map. Neither substitutes
  for Volnay's Santenots geometry. Those Meursault designations are white only,
  so a red wine recorded as Meursault Santenots opens Volnay's Santenots, whose
  note explains why; white or unknown-colour Santenots stays on Meursault.
- Clos des Ursules (Beaune) and Clos des 60 Ouvrées (Volnay) are Premier Crus
  in their own right, beside Les Vignes Franches and Les Caillerets rather than
  inside them. Labels that name both, such as Jadot's Vignes Franches Clos des
  Ursules or Pousse d'Or's Caillerets Clos des 60 Ouvrées, select the clos.
- Boundaries are INAO production areas, not producer ownership or proof that
  a particular bottle comes from one cadastral parcel.
- INAO areas overlap intentionally. Chambertin includes Clos de Bèze;
  Charmes-Chambertin and Mazoyères-Chambertin have the same production geometry
  in this source. These are retained, explained in the selection panel, and
  individually selectable. Do not turn them into disjoint vineyard shapes.
- In the pinned snapshot, Échezeaux overlaps Les Beaux Monts by approximately
  3,962 m², plus small intersections with En Orveaux (1.77 m²) and Les Suchots
  (25.62 m²). The original production geometry remains unchanged for selection,
  outlines and hit testing. A separate `contextGeometry` on those three Premier
  Cru features excludes the overlapping Grand Cru area **only for overview
  colouring**. This avoids stacking tier colours; it is not a new delimitation
  or a claim about entitlement to either designation. Selection notes explain it.
- The five southern Côte de Beaune maps have overlapping Premier Cru names,
  including umbrella designations such as Morgeot and Meursault Blagny. A derived
  union per tier supplies overview colouring so stacked polygons do not imply a
  darker classification. Every original production boundary remains intact for
  selection, outlines and clicks. Grand Cru colouring takes precedence where
  source tiers intersect; this display treatment does not change entitlement.
- Named village lieux-dits and individual cadastral parcel lines are not yet
  included. Other Burgundy villages retain their existing external Atlas links.
- The existing reviewed matching rules check geographic/tier conflicts and
  resolve named Premier Crus. A blend or unnamed Premier Cru falls back to its
  broad Premier Cru area, never to an invented single plot.

## Sources and reproduction

Each generated catalogue records source URLs, snapshot dates, SHA-256 hashes,
INAO appellation and denomination IDs, commune IDs, label points, and extents.
Atlas contributes only the existing reviewed identity crosswalk and outbound
links where available; local Corton climat identities use INAO directly. None of
Atlas's map geometry or assets is copied.

- [INAO open boundary dataset](https://www.data.gouv.fr/datasets/delimitation-parcellaire-des-aoc-viticoles-de-linao):
  21 September 2026, Licence Ouverte. The published data is informational;
  [INAO's official delimitation plans](https://www.inao.gouv.fr/portail-plans-delimitation)
  remain the authoritative legal documents.
- [Cadastre Etalab](https://cadastre.data.gouv.fr/datasets/cadastre-etalab):
  June 2026 commune outlines, Licence Ouverte 2.0.
- [BIVB Gevrey Grand Crus reference](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/gallery_files/site/321/402/79294/79886.pdf):
  context for overlapping appellation areas.
- [BIVB Morey-Saint-Denis reference](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/gallery_files/site/321/402/79294/79794.pdf):
  the five Grand Crus and twenty Premier Cru climats.
- [BIVB Bonnes-Mares reference](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/bonnes-mares%2C2458%2C9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MjI0Jnw%3D):
  its production area spans Morey-Saint-Denis and Chambolle-Musigny.
- [INAO Vosne-Romanée reference](https://www.inao.gouv.fr/en/node/663) and
  [BIVB Vosne-Romanée reference](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/gallery_files/site/321/402/57644/57720.pdf):
  two producing communes, eight Grand Crus and fourteen Premier Crus. BIVB uses
  the spelling "Les Petits Monts"; INAO's boundary snapshot and the Atlas registry
  use "Les Petis Monts". The display and reviewed matching alias use the former,
  while source names, IDs and Atlas destinations remain intact.
- [Domaine du Comte Liger-Belair](https://www.liger-belair.fr/nos-climats/)
  explicitly documents "Reignots" and "Raignots" as spelling alternatives.
  The wine matcher accepts "Aux Reignots" for Vosne's "Aux Raignots" entry,
  using the existing village and tier checks, without fuzzy matching.
- Nuits-Saint-Georges' "Les Saints-Georges" (INAO and Atlas spelling) is
  labelled "Les Saint-Georges" by producers such as Henri Gouges and by BIVB.
  The matcher accepts that spelling as a reviewed alias. The village name is
  removed before crus are sought, so "Nuits-Saint-Georges" alone never selects it.
- [BIVB Fixin reference](https://www.bourgogne-wines.com/nos-vins-nos-terroirs/tous-les-bourgognes/gallery_files/site/321/402/29684/29717.pdf),
  [BIVB Vougeot reference](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/gallery_files/site/321/402/79294/79832.pdf),
  [INAO Nuits-Saint-Georges](https://www.inao.gouv.fr/produit/nuits-saint-georges-blanc-22191),
  [INAO Marsannay](https://www.inao.gouv.fr/produit/marsannay-rouge-16406), and
  [BIVB Côte de Nuits-Villages](https://www.vins-bourgogne.fr/nos-vins-nos-terroirs/la-bourgogne-et-ses-appellations/gallery_files/site/321/402/57486/57536.pdf):
  reviewed cru counts and producing communes for the remaining Côte de Nuits maps.
- [OpenFreeMap](https://openfreemap.org/quick_start/): street-map context, with
  its source attribution retained in MapLibre. Boundaries and selection still
  work if the street-map service is unavailable.
- [INAO Meursault](https://www.inao.gouv.fr/produit/meursault-premier-cru-blagny-blanc-9112),
  [INAO Puligny-Montrachet](https://www.inao.gouv.fr/produit/puligny-montrachet-blanc-7694),
  [BIVB Chassagne-Montrachet](https://www.vins-bourgogne.fr/vins-et-terroirs/la-bourgogne-et-ses-appellations/chassagne-montrachet%2C2377%2C9170.html?args=Y29tcF9pZD0yMjA1JmFjdGlvbj12aWV3RmljaGUmaWQ9Mjc1Jnw%3D),
  [BIVB Saint-Aubin](https://www.bourgogne-wines.com/our-wines-our-terroir/bourgogne-and-its-appellations/gallery_files/site/321/402/57644/57711.pdf), and
  [BIVB Blagny](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/blagny%2C2458%2C9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MjIxJnw%3D):
  19/17/55/30/7 named Premier Crus, producing communes and Blagny's red identity.
- [Domaine Leflaive Clavoillon](https://www.leflaive.fr/fr_FR/wine/puligny-montrachet-clavoillon):
  the producer spelling is used for display and accepted as a reviewed alias for
  INAO/Atlas "Clavaillon". Source names, denomination IDs and Atlas URLs stay intact;
  the alias still requires Puligny and Premier Cru evidence.

- [BIVB Aloxe-Corton](https://www.bourgogne-wines.com/our-wines-our-terroir/the-bourgogne-winegrowing-region-and-its-appellations/gallery_files/site/321/402/57644/57646.pdf),
  [BIVB Pernand-Vergelesses](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/pernand-vergelesses%2C2458%2C9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MzY0Jnw%3D), and
  [BIVB Ladoix](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/ladoix%2C2458%2C9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MzI1Jnw%3D):
  14/8/11 Premier Crus. [INAO Les Chaillots rouge](https://www.inao.gouv.fr/node/2121/printable/print)
  corroborates the red designation despite the boundary source's "blanc" suffix.
- [BIVB Corton](https://www.bourgogne-wines.com/our-wines-our-terroir/bourgogne-and-its-appellations/gallery_files/site/321/402/57644/57676.pdf) and
  [BIVB Corton-Charlemagne / Charlemagne](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/corton-charlemagne%2C2458%2C9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MjcyJnw%3D):
  the separate appellations, producing communes, overlap, named Corton climats
  and the restriction of named Corton designations to red wines.

- [BIVB Beaune](https://www.bourgogne-wines.com/our-wines-our-terroir/bourgogne-and-its-appellations/gallery_files/site/321/402/57644/57648.pdf),
  [INAO Pommard](https://www.inao.gouv.fr/node/495), and
  [BIVB Volnay](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/volnay%2C2458%2C9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9NDA0Jnw%3D):
  42/28/29 named Premier Crus, wine colours, and Santenots' producing commune
  of Meursault. Source CVI codes confirm red/white Beaune and red-only Pommard
  and Volnay for every denomination in this batch.
- [Louis Latour's Beaune Cent Vignes](https://www.louislatour.com/pdf/en/beaune-1er-cru-les-cent-vignes-151.pdf) and
  [Domaine de Montille's Volnay Les Taillepieds](https://www.demontille.com/fr_FR/wine/volnay-1er-cru-les-taillepieds):
  reviewed label aliases for INAO/Atlas "Les Cents Vignes" and "Taille Pieds".
- Further reviewed label spellings, each confirmed on producer labels:
  [Jadot's Vignes Franches Clos des Ursules](https://www.the-buyer.net/people/producer/clos-des-ursules-200-years-jadot),
  [Pousse d'Or's Caillerets Clos des 60 Ouvrées](https://winedecoded.com.au/product/domaine-de-la-pousse-dor-volnay-1er-cru-caillerets-clos-des-60-ouvrees-2022/)
  and [Pommard Les Jarollières](https://www.decanter.com/wine-reviews/france/burgundy/domaine-de-la-pousse-dor-pommard-1er-cru-les-jarollieres-9593/),
  [Domaine Parent's Beaune Les Epenottes](https://domaine-parent.com/products/beaune-1er-cru-les-epenottes)
  (INAO: Les Epenotes), [Jean-Marc Boillot's Pommard Saucilles](https://www.comptoirdesmillesimes.com/pommard/pommard-1er-cru-2011-saucilles-jm-boillot.html)
  (INAO: Les Saussilles) and [Henri Boillot's Volnay Les Chevrets](https://www.cellartracker.com/wine.asp?iWine=3147552)
  (INAO: En Chevret). Pousse d'Or's Clos de la Bousse d'Or may be written
  Bousse d'Or alone. Red Santenots is Volnay Premier Cru; see
  [Joseph Drouhin's Volnay-Santenots](https://www.drouhin.com/en_US/wine/volnay-santenots-premier-cru/2019).
  Village and Premier Cru evidence remain required; source names and IDs stay intact.

Download the 27 distinct source URLs recorded in the twenty catalogues into a
local temporary directory. Name the INAO archive `inao-2026-09-21.zip` and each
commune file `commune-{code}.json.gz`. Required commune codes are:
`21110`, `21133`, `21166`, `21186`, `21194`, `21200`, `21265`, `21267`, `21295`,
`21390`, `21442`, `21464`, `21506`, `21714`, `21716`, `21412`, `21512`, `21150`,
`71369`, `21541`, `21010`, `21480`, `21606`, `21054`, `21492`, and `21712`. Then:

```sh
python -m pip install -r scripts/burgundy-map-requirements.txt
python scripts/build_burgundy_village_map.py --source-dir .tmp/burgundy-map
```

`scripts/burgundy-villages.json` is the reviewed map configuration: appellation
and denomination IDs, communes, name exceptions, overlap notes and shared-cru
defaults. `nameCrosswalk` maps an INAO name to a different Atlas name;
`displayNames` provides reviewed display spellings or shortens a name where INAO
records alternatives in one string (Chambolle's "Les Feusselottes ou Les Feusselotes"), while
`sourceName` and the Atlas lookup keep the full INAO name. The generator verifies the pinned INAO archive hash, refreshes extracted
members, reprojects INAO EPSG:2154 coordinates to longitude/latitude,
unions source records within each denomination, checks polygon validity,
and fails on unexpected coverage or an unmatched identity. It retains coordinate
precision and holes; no AI-generated, traced or approximate polygons are used.
Villages without Premier Crus omit the Premier Cru configuration. Non-contiguous
Premier Cru IDs use `premierDenominations` (Fixin includes denomination 2372).
Reviewed `sourceVariants` identify colour-specific source names and selection
targets. Unrecognised source labels still fail import. `expectedBounds` supplies
a reviewed geographic sanity envelope where a village extends beyond the pilot.
`colourDenominations` handles separate official red/white IDs. Each original
geometry is retained; their derived combined overview has an `inao-app-*-village`
ID, `denominationId: null` and the list of contributing `denominationIds`, so it
cannot masquerade as a new official denomination. `wineColours` can restrict a
village's map target where colour conflicts with the appellation (for example,
Blagny, Pommard and Volnay).
`grandCruClimats` declares the parent appellation, broad denomination and reviewed
named denomination range. Import fails if source coverage changes. Named features
receive local `inao-denom-*` match IDs, `parentAppellation`, and `atlasUrl: null`;
the dialog omits unavailable outbound links. Broad Corton remains selectable as
an appellation, including by clicking ground with no separately mapped climat.
Its `aliases` map a source climat name to reviewed label spellings: INAO's "Le
Rognet et Corton" is labelled "Corton Rognet" or "Corton Clos Rognet", and its
"et" would otherwise read as a blend. Another place named in the appellation or
a reference field withholds the map, as does a name built on Corton itself
(Corton-Charlemagne, Aloxe-Corton) anywhere; any other place in the wine title
is usually the producer (Domaine de la Romanée-Conti, Château de Meursault) and
keeps the map at Corton appellation scope.
Review regenerated files before publishing an update. Source archives and Python
dependencies are not shipped with the app.

The generator also checks that any designation left unfilled is actually covered
by its designated same-tier fill. It validates all villages before writing output.
Reviewed cross-tier `contextExclusions` additionally check tier ordering, remaining
polygon validity and area conservation. Only derived overview geometry is cut;
the full production geometry is preserved alongside it in the same feature.
`unionOverviewFills` derives one fill per named tier, excluding higher tiers
only from the lower tier's overview fill. These live in the GeoJSON foreign
member `overviewFills`, outside the selectable source `features`. Validity and
area conservation are checked before writing. The Corton overview includes the
broad Grand Cru area, so gaps in named-climat coverage do not disappear. A nearly
coincident projected union edge can collapse when converted to geographic
coordinates. For that display union only, the generator unions the individually
valid geographic source polygons instead and checks its area back in the source
CRS within 0.01 m² (observed difference about 0.0031 m² across 160.55 ha).
Original selectable geometries are unchanged. The generator also records
`umbrellas`: each Premier Cru lying at least 90% inside a larger one, keyed by
the wider name (Chassagne's Morgeot covers nineteen named climats; La Grande
Montagne covers La Romanée). Measured shares are either >= 97% or <= 72%, so the
threshold avoids borderline cases. The map says what a wider name covers and
which wider names a cru lies within, after any reviewed note; a cru that overlaps
nothing gets no note. Partial overlaps (Abbaye de Morgeot and Morgeot; Chassagne
with Cailleret and La Maltroie; Nuits' Les Argillières and Clos des Argillières)
are not umbrellas and carry no generated note. Reviewed label spellings also map
Chassagne's "Les Ruchottes" to Les Grandes Ruchottes and "Les Caillerets" to
Cailleret; En Cailleret keeps its own identity.
The registry repeats the umbrellas by match ID, so the wine matcher can read
a label naming a wider Premier Cru with a cru inside it as the inner cru:
"Meursault-Blagny Sous le Dos d'Ane" (the label form for Meursault Premier Crus in
Blagny) is Sous le Dos d'Ane, and "Morgeot Clos Pitois" is Clos Pitois. Two crus
that do not contain each other stay ambiguous. Château de la Maltroye's spelling
"La Maltroye" (its Clos du Château de la Maltroye) maps to La Maltroie.
An appellation in separate parts can configure `areas` (Côte de Nuits-Villages:
north for Fixin and Brochon, south for Premeaux-Prissey, Comblanchien and
Corgoloin). The generator assigns every polygon of the village area, by its
centroid, to exactly one group of communes and records each group's bounds; the
map names each part on its overview and adds a toolbar button that zooms to it.
Shared designations are unioned across all source communes, never clipped to a
village boundary. The original Gevrey GeoJSON remains byte-for-byte unchanged.

The seventeen GeoJSON files under `public/maps/` are approximately 673 KB (Gevrey),
290 KB (Morey), 329 KB (Chambolle), 396 KB (Vosne/Flagey), 175 KB (Fixin),
75 KB (Vougeot), 450 KB (Nuits), 872 KB (Marsannay, including all colour views),
280 KB (Côte de Nuits-Villages), 992 KB (Meursault), 649 KB (Puligny),
742 KB (Chassagne), 764 KB (Saint-Aubin), 142 KB (Blagny), 650 KB (Aloxe),
527 KB (Pernand) and 611 KB (Ladoix), uncompressed.
There are no database migrations, research/AI calls, API keys or background Atlas
requests. Only opening the dialog requests geography and the external base map.
The browser's public tile requests contain map locations, not wine records.

## Adding a village

Add reviewed IDs, commune context and exceptions to `scripts/burgundy-villages.json`,
download its pinned commune files, and regenerate. Register the catalogue's dynamic
import in `src/lib/places/loadVillageMapCatalogue.ts`. The generated
`burgundyVillageMapRegistry.json` is the compact wine-to-map index; the detailed
catalogues contain all rendering metadata, source dates and explanatory notes.
No village-specific rendering code is required. Add coverage and matching tests,
including repeated climat names, broad/blended wines and any shared designations.
Inspect source geometry and mobile layouts before publishing.

## Validation

```sh
npx vitest run tests/unit/burgundyVillageMap.test.ts tests/unit/burgundyCortonMap.test.ts tests/unit/burgundyAtlas.test.ts tests/unit/burgundyAtlasPremierCru.test.ts tests/unit/burgundyAtlasAppellation.test.ts
npx playwright test tests/e2e/burgundy-village-map.spec.ts tests/e2e/burgundy-atlas.spec.ts --project=chromium
npm run build
npm run lint
```

Browser coverage uses the real MapLibre renderer with the street map unavailable,
checking local geometry, selection, owner/shared parity, small-screen layouts,
load-on-demand, retry, Escape and focus restoration. The source import and unit
checks cover all 450 vineyard targets, coverage in Brochon, Flagey, Premeaux and Remigny, intentional overlap,
identical Bonnes-Mares geometry in both contexts, and village-specific matches for
repeated names such as Les Gruenchers and La Romanée. They distinguish Échezeaux
from Grands-Échezeaux and verify reviewed Vosne spelling aliases and broad-area
fallbacks, Marsannay colour selection and the split Côte de Nuits-Villages area.
The southern Côte de Beaune checks cover the shared Montrachet boundaries,
separate red/white source identities, repeated En Remilly/Perrières names,
Clavoillon's reviewed spelling and the seven Blagny counterparts. An independent
comparison with the pinned shapefile verified all 151 new wine geometries and
seven derived overview fills, including matching source areas and commune IDs.
All nine previously published map datasets remain byte-for-byte unchanged.
The Corton batch independently verifies all 122 added wine features and six
overview fills against the pinned source, including matching areas and commune
IDs. All fourteen earlier maps and catalogues remain unchanged. Tests cover all
24 local climat identities, broad/white/mixed Corton fallback, repeated names
across tiers, shared Grand Cru geometry and the absence of invented Atlas URLs.
The Beaune/Pommard/Volnay batch independently verifies 105 added wine geometries
and three overview fills against the pinned source, including areas, commune IDs,
colour codes and unchanged Cadastre outlines. All seventeen earlier maps and
catalogues remain unchanged, and regenerating them reproduces the merged Corton
aliases, notes and umbrella registry. Tests cover all 99 added Premier Crus,
Santenots across Meursault, red-only guards, reviewed label aliases, repeated names,
underspecified Pommard wines and Beaune's umbrella. Owner and shared dialogs are
checked at 320, 390 and 1280 pixels with lazy loading and no live street map.
Browser tests also exercise delayed successful
base-style loading and verify that opening a village never requests another map's
catalogue or geometry.
Boundary download failures offer an in-dialog retry. A failed catalogue module
offers a page reload, because browsers can cache a failed dynamic import.
