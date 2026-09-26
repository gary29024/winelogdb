# Burgundy village maps

Wine details and shared wine details offer **View village map** for mapped
Côte de Nuits, Côte de Beaune, Côte Chalonnaise, Mâconnais and northern Burgundy wines across all 44 village appellations,
including the Grand Crus of Flagey-Échezeaux, Clos de Vougeot and the Montrachet
group, plus Corton, Corton-Charlemagne, Charlemagne and Chablis Grand Cru. The dialog shows neighbouring cru boundaries, highlights
the wine's matched INAO designation, and supports selection, pan/zoom, a village
overview and returning to the wine. The renderer, the selected village's catalogue
and its geometry load on demand; other village catalogues and boundaries stay unloaded.
The existing Burgundy Atlas link remains available where Atlas has a page.

## Coverage and meaning

| Village map | Grand Crus | Premier Cru source names | Broad areas | Wine features |
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
| Savigny-lès-Beaune | 0 | 22 | 4 colour/tier views | 26 |
| Chorey-lès-Beaune | 0 | 0 | 3 colour views | 3 |
| Auxey-Duresses | 0 | 9 | 4 colour/tier views | 13 |
| Monthélie | 0 | 15 | 2 | 17 |
| Saint-Romain | 0 | 0 | 3 colour views | 3 |
| Santenay / Remigny | 0 | 12 names for 11 climats | 4 colour/tier views | 16 |
| Maranges (three communes) | 0 | 7 | 4 colour/tier views | 11 |
| Côte de Beaune | 0 | 0 | 1 | 1 |
| Côte de Beaune-Villages (16 communes) | 0 | 0 | 1 | 1 |
| Bouzeron / Chassey-le-Camp | 0 | 0 | 1 | 1 |
| Rully / Chagny | 0 | 23 | 2 | 25 |
| Mercurey / Saint-Martin-sous-Montaigu | 0 | 32 | 2 | 34 |
| Givry / Dracy-le-Fort / Jambles | 0 | 37 of 38 climats | 2 | 39 |
| Montagny (four communes) | 0 | 49 | 2 | 51 |
| Pouilly-Fuissé (four communes) | 0 | 22 | 3 | 25 |
| Pouilly-Loché / Mâcon (Loché) | 0 | 1 | 2 | 3 |
| Pouilly-Vinzelles | 0 | 3 | 2 | 5 |
| Saint-Véran (seven communes) | 0 | 0 | 1 | 1 |
| Viré-Clessé (four communes) | 0 | 0 | 2 | 2 |
| Chablis (17 current communes) | 1 appellation + 7 climats | 8 named + 2 partial | 2 village/tier areas | 20 |
| Petit Chablis (17 current communes) | 0 | 0 | 1 | 1 |
| Irancy (three current communes) | 0 | 0 | 1 | 1 |
| Saint-Bris (five communes) | 0 | 0 | 1 | 1 |
| Vézelay (four communes) | 0 | 0 | 1 | 1 |

There are 778 distinct wine identities (699 named features and 79 broad areas),
plus twenty-two colour-specific views sharing eleven village appellation identities.
Bonnes-Mares, Montrachet and Bâtard-Montrachet each appear in two maps and count
once in the identity registry. The Corton group's 27 boundaries appear in three
maps and likewise count once. There are 857 wine features across the 44 maps.
Corton itself is a broad Grand Cru appellation target; its 24 named climats are
separate vineyard targets, not 24 additional Grand Cru appellations. Overall,
the maps contain 637 named Premier Cru source designations (636 climat names after
the reviewed Santenay alternative name), including two partial Chablis features
which never automatically select a wine. There are 33 Grand Cru appellations.
The [full Burgundy coverage checklist](burgundy-map-coverage.md) tracks all 44
village appellations, remaining named-plot gaps and regional work.

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
- Savigny-lès-Beaune adds 22 Premier Crus. Morot's Clos de la Bataillère and
  older La Bataillère aux Vergelesses labels select Bataillère's own boundary;
  the separately mapped Les Vergelesses stays distinct. A compound label alias
  does not create a geometric umbrella relationship.
- Auxey-Duresses adds nine Premier Crus and the full commune, including
  Petit-Auxey and Mélian. Clos du Val lies inside Climat du Val. La Chapelle
  instead overlaps Reugne (about 81%) and Les Bréterins (about 19%); neither
  contains it. All three boundaries remain intact, with one union for colouring.
- Monthélie includes all 15 Premier Crus, including IDs `1992`–`1995` outside
  the older contiguous range. Les Champs Fulliot and Clos des Champs Fulliot
  labels select the full Les Champs Fulliots denomination; its note explains
  that a producer's enclosed plot has no separate boundary in this source.
- Savigny, Chorey and Auxey have equal red/white village geometry but separate
  official colour identities, all retained. Saint-Romain's areas differ:
  143.37 ha for red and 147.05 ha for white; neither wholly contains the other.
  Unknown colour uses an explicitly labelled union. All five new appellations
  accept red and white; explicit rosé records do not open these maps.
- Chorey and Saint-Romain have no Premier Cru features in this source. Named
  village wines such as Les Beaumonts, Sous la Velle and Sous Roche keep a broad
  appellation map with an explanation that individual vineyards are unavailable.
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

- [BIVB Savigny-lès-Beaune](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/gallery_files/site/321/402/57644/57716.pdf),
  [Auxey-Duresses](https://www.bourgogne-wines.com/our-wines-our-terroir/bourgogne-and-its-appellations/gallery_files/site/321/402/57644/57647.pdf),
  [Monthélie](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/gallery_files/site/321/402/79294/79752.pdf),
  [Chorey-lès-Beaune](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/gallery_files/site/321/402/57644/57672.pdf) and
  [Saint-Romain](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/saint-romain%2C2458%2C9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MzkzJnw%3D):
  22/9/15 named Premier Crus for the first three, producing communes and colours.
- Producer-label regression sources for this batch:
  [Morot's Clos de la Bataillère](https://www.albertmorot.fr/vin-beaune/savigny-beaune-1er-cru-clos-de-bataillere-blanc-monopole/)
  and [older Bataillère aux Vergelesses labels](https://www.albertmorot.fr/cat/revue-de-presse/savigny-les-beaune-1er-cru-la-bataillere-blanc/);
  [Drouhin's Fourneaux/Fournaux](https://www.drouhin.com/fr_FR/vin/savigny-les-beaune-premier-cru-fourneaux/2020)
  and [Rapet's technical sheet](https://www.bourgogne-wines.com/theme_front/theme_front_16/javascript/vendor/vin-co/pdf/NXAXRF.pdf);
  [Bruno Clair's Les Jarrons](https://www.brunoclair.com/vins/savigny-les-beaune-les-jarrons-1er-cru/);
  [BIVB's Bretterins spelling](https://www.vins-bourgogne.fr/gallery_files/site/321/402/404.pdf);
  [Lafouge's](https://www.vin-malin.fr/16693-domaine-lafouge-auxey-duresses-1er-cru-les-ecusseaux-rouge-2022.html) and
  [Buisson's](https://www.vivino.com/US/en/domaine-henri-gilles-buisson-auxey-duresses-1er-cru-les-ecusseaux/w/1996433)
  Les Ecusseaux (INAO: Les Ecussaux); labels naming Les Bréterins or Reugne with
  [La Chapelle, formed from parts of both](https://www.wine-searcher.com/regions-auxey-duresses+la+chapelle),
  select La Chapelle;
  [Changarnier's Champs Fulliot](https://www.domainechangarnier.com/nos-vins/monthelie-1er-cru-champs-fulliot/),
  [Glantenay's label](https://www.georgesglantenay.com/Fiche?designation=premiers_crus&id=5),
  [Dujardin's sheet](https://www.domaine-dujardin.com/mesfichiers/fichiers/270225/Monthelie%20Premier%20Cru%20Les%20Champs%20Fulliots%20Red%20wine.pdf),
  [Tricot / Colin-Morey's enclosed plot](https://www.mjtricot.com/fr/nos-vins/20-monthelie-clos-des-champs-fulliots.html)
  and [Chanson's Clos Gauthey](https://www.domaine-chanson.com/vin/monthelie-1er-cru-le-clos-gauthey/).
  Broad-only examples are [Aegerter](https://www.aegerter.fr/fr/nos-vins/les-vins-du-domaine/chorey-les-beaune)
  and [Lebreuil's Les Beaumonts](https://www.domaine-lebreuil.com/vins-bourgogne/chorey-les-beaune-les-beaumonts),
  plus [Buisson's Sous la Velle](https://www.domaine-buisson.com/les-vins-blancs/saint-romain-sous-la-velle/)
  and [Sous Roche reference](https://www.domaine-buisson.com/fichiers/Saint-Romain-Sous-la-Velle-blanc.pdf).
  Tests exercise these with a recorded appellation; abbreviated "Savigny" alone
  is not a new appellation alias. Cru aliases stay scoped to the full village.

Download the 92 distinct source URLs recorded in the 44 catalogues into a
local temporary directory. Name the INAO archive `inao-2026-09-21.zip` and each
commune file `commune-{code}.json.gz`. Required commune codes are:
`21110`, `21133`, `21166`, `21186`, `21194`, `21200`, `21265`, `21267`, `21295`,
`21390`, `21442`, `21464`, `21506`, `21714`, `21716`, `21412`, `21512`, `21150`,
`71369`, `21541`, `21010`, `21480`, `21606`, `21054`, `21492`, `21712`, `21590`,
`21173`, `21037`, `21428`, `21569`, `21582`, `71122`, `71174`, `71496`,
`71051`, `71070`, `71073`, `71109`, `71182`, `71221`, `71241`, `71247`,
`71294`, `71302`, `71378`, `71459`, `71485`, `71074`, `71084`, `71108`, `71135`,
`71169`, `71210`, `71250`, `71258`, `71270`, `71305`, `71360`, `71487`, `71526`,
`71567`, `71583`, `71584`, `89021`, `89034`, `89039`, `89068`, `89081`, `89095`,
`89104`, `89108`, `89112`, `89123`, `89130`, `89168`, `89175`, `89202`, `89226`,
`89227`, `89242`, `89303`, `89315`, `89319`, `89337`, `89364`, `89409`, `89446`,
`89477`, `89479`, and `89482`. Then:

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

`incompleteDenominations` marks reviewed partial Premier Cru features. Each must
have an explanatory note; generated `incompleteTargets` redirects automatic wine
selection to that appellation's broad Premier Cru identity. The original feature
remains selectable with `coverage: "partial"`. `overviewDenominations` explicitly
includes a broad source area in a derived tier fill when named coverage is missing.
An explicitly reviewed `localIdentity` plus `regionId` allows a broad appellation
without an Atlas page. The generator emits a stable `inao-app-{id}-{tier}` match
identity and a null Atlas URL. The matcher includes these local groups in the
same geographic, classification and conflict checks as Atlas appellations.
It never turns an INAO identity into a fabricated Atlas destination. A newly
available Atlas crosswalk fails the import for review instead of silently
changing identity. Named Premier Crus without Atlas pages still need their own
reviewed crosswalk support in a later batch.
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
Reviewed `notes.sameBoundaryAs` marks an alternative climat name: the generator
requires equal source geometry and matching tiers, and rejects chains. Both
identities remain selectable; the map's climat count excludes the alternative.
Equal geometry alone does not create this relationship: two separately named
crus elsewhere can share an area and still represent distinct designations.
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
Montagne covers La Romanée). Measured shares are either >= 97% or <= 82%, so the
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

The 44 GeoJSON files under `public/maps/` range from approximately
59 KB (Pouilly-Vinzelles) to 2,391 KB (Chablis), uncompressed.
The northern batch adds 2,391 KB (Chablis), 1,791 KB (Petit Chablis), 322 KB
(Irancy), 257 KB (Saint-Bris) and 176 KB (Vézelay), each
downloaded only when its map is opened.
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

`localPremierDenominations` explicitly lists reviewed named Premier Crus with
INAO geometry but no Atlas map path. The generator preserves their source IDs,
emits `inao-denom-{id}` match identities and null Atlas URLs, and fails for review
if a named Atlas path becomes available. `unmappedPremierNames` lists reviewed
climats without source geometry; they participate in tier and ambiguity checks
but cannot select another vineyard. Givry uses both mechanisms. `coverageNote`
provides an always-visible explanation of a map's known source gap.

`localPremierIdentity` supports a missing Atlas Premier Cru tier while preserving
an existing Atlas village link. Local named groups participate in matching even
when there are no named Atlas paths for that appellation. `villageAreaDenominations`
preserves additional broad village source designations as selectable local areas;
they are never matched to an individual plot just because a wine has a climat name.

Review actual producer labels before opening each PR. Include the producer's
spelling, article omissions, compound names and older labels in regression cases,
with primary sources recorded above. Exercise complete reference fields as well
as titles, and check that neighbouring names alone still select their own cru.
A clos named beside another cru can require a reviewed compound alias even when
their polygons do not overlap; never infer containment from that label alone.
For a producer subdivision without geometry, keep the published wider boundary
and explain its extent. Check red/white source codes and unknown-colour behaviour.
Finally, regenerate from the pinned source and compare previously published
maps and catalogues so manually reviewed notes and aliases survive the next batch.

## Validation

```sh
npx vitest run tests/unit/burgundyVillageMap.test.ts tests/unit/burgundyCortonMap.test.ts tests/unit/burgundyAtlas.test.ts tests/unit/burgundyAtlasPremierCru.test.ts tests/unit/burgundyAtlasAppellation.test.ts
npx vitest run tests/unit/burgundyBeauneNeighboursMap.test.ts
npx vitest run tests/unit/burgundyBeauneCompletionMap.test.ts
npx vitest run tests/unit/burgundyChalonnaiseMap.test.ts
npx vitest run tests/unit/burgundyMaconnaisMap.test.ts
npx playwright test tests/e2e/burgundy-village-map.spec.ts tests/e2e/burgundy-atlas.spec.ts --project=chromium
npm run build
npm run lint
```

Browser coverage uses the real MapLibre renderer with the street map unavailable,
checking local geometry, selection, owner/shared parity, small-screen layouts,
load-on-demand, retry, Escape and focus restoration. The source import and unit
checks cover all named targets and partial-area fallbacks, coverage in Brochon, Flagey, Premeaux and Remigny, intentional overlap,
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
The Savigny/Chorey/Auxey/Monthélie/Saint-Romain batch verifies 62 added wine
geometries (58 source denominations and four colour unions) and three overview
fills independently against INAO, including colour codes, areas and communes.
All twenty prior maps and catalogues remain unchanged, including the manually
reviewed Santenots note from #342. Tests cover all 46 new Premier Crus plus real
producer label forms, complete reference fields, repeated names, colour scope,
true containment versus partial overlap, and broad-only village wines.
The Santenay/Maranges/Côte de Beaune/Côte de Beaune-Villages batch independently
verifies 29 added wine geometries (27 source denominations and two colour unions)
and two overview fills against INAO, including colour codes, areas and communes.
All 25 earlier maps, catalogues, registry targets and umbrella relationships
remain unchanged, including the Auxey spelling/La Chapelle changes from #343.
Tests cover all 19 new named source identities, local appellation matching without
an Atlas link, the three different Beaune names, colour and tier conflicts,
producer spellings, Tavannes equivalence and full cross-commune coverage.
Owner/shared browser checks cover 320, 390 and 1280 pixels, lazy loading and
the four Côte de Beaune-Villages zoom controls.
Browser tests also exercise delayed successful
base-style loading and verify that opening a village never requests another map's
catalogue or geometry.
Boundary download failures offer an in-dialog retry. A failed catalogue module
offers a page reload, because browsers can cache a failed dynamic import.

## Côte de Beaune completion: source and label review

Reviewed 26 September 2026 against the pinned INAO archive and these primary
references:

- [BIVB Santenay](https://www.vins-bourgogne.fr/nos-vins-nos-terroirs/la-bourgogne-et-ses-appellations/gallery_files/site/321/402/57486/57572.pdf)
  lists **11 climats** and both Santenay and Remigny. INAO has 12 named IDs
  (`1160–1171`): Clos de Tavannes (`1164`) and Les Gravières-Clos de Tavannes
  (`1170`) have exactly equal geometry, both wholly within Les Gravières (`1169`).
  Both names remain selectable, with an explanatory note and a displayed count
  of 11 climats. Clos Rousseau (`1163`) and Grand Clos Rousseau (`1166`) do not
  overlap and must not be collapsed. White village ID `1159` and red `2082`
  share geometry across Santenay and Remigny but retain separate identities.
- [BIVB Maranges](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/maranges%2C2458%2C9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MzM4Jnw%3D)
  lists seven Premier Crus and Cheilly-lès-Maranges, Dezize-lès-Maranges and
  Sampigny-lès-Maranges. La Fussière (`800`) crosses Cheilly/Dezize and contains
  Clos de la Fussière (`799`); Les Clos Roussots (`804`) crosses Cheilly/Sampigny.
  White village ID `797` and red `2061` share geometry across all three communes.
- [BIVB Côte de Beaune](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/gallery_files/site/321/402/79294/79364.pdf)
  distinguishes this village appellation in Beaune from Côte de Beaune-Villages.
  The map retains the full 539.46 ha INAO boundary (`551`), which is an eligible
  production area, not current planted acreage or the footprint of one cuvée.
  [Drouhin's Côte de Beaune](https://www.drouhin.com/en_US/wine/cote-de-beaune-rouge/2023)
  also documents declassified Beaune production. Individual village lieux-dits
  remain unavailable; no named plot is inferred from this broad area.
- [INAO Côte de Beaune-Villages](https://www.inao.gouv.fr/node/1799/printable/print)
  and [BIVB's commune list](https://www.bourgogne-wines.com/our-wines-our-terroir/the-bourgogne-winegrowing-region-and-its-appellations/gallery_files/site/321/402/57644/57678.pdf)
  corroborate the red-only designation and its 16 producing communes.
  The pinned `552` boundary is retained across all of them, including the four
  in Saône-et-Loire; it excludes Beaune, Aloxe-Corton, Pommard and Volnay.
  [Drouhin's label](https://www.drouhin.com/fr_FR/products/cote-de-beaune-villages-rouge-2022)
  is a regression case for a map with no Atlas destination. Its label cannot
  identify which commune supplied the grapes, so four area buttons change only
  the view, never the wine's broad selection.

Producer spelling cases:

- [Mestre's Passe-Temps](https://www.mestre-pere-et-fils.fr/fr/vins-rouges/8-santenay-passe-temps.html)
  selects INAO Passetemps (`1171`), including the space-separated spelling.
- [Monnot-Roche's La Croix aux Moines](https://www.monnot-roche.com/nos-vins/product/127-maranges-1er-cru-la-croix-aux-moines)
  selects Le Croix Moines (`803`). The source spelling remains visible and the
  selection note explains the producer spelling.
- [Saint Marc's Clos Roussot](https://saint-marc.fr/fr/maranges-premier-cru-les-clos-roussots)
  and [Bichot's Clos Roussots](https://catalogue.albert-bichot.com/LA1BPF)
  select Les Clos Roussots (`804`). This is distinct from Santenay's Rousseau.
- [Clair's Clos de Tavannes Sélection](https://www.domaineclair.com/fr/nos-appellations/santenay-1er-cru-68/),
  [La Pousse d'Or's Clos de Tavannes](https://lapoussedor.fr/),
  [Jessiaume's Les Gravières in the BIVB selection](https://www.bourgogne-wines.com/press/gallery_files/site/289/1910/74922.pdf)
  and [Grachet-Duchemin's Clos des Loyères](https://grachetduchemin.com/wp-content/uploads/2023/03/clos-des-loyeres-domainegrachetduchemin-fichetechnique-eng.pdf)
  exercise ordinary title text and article omissions without merging neighbours.

All accepted spellings also have complete-reference-field and blend tests.
Producer names in a wine title are not read as blends. Family phrases such as
Père et Fils, Père & Fils, Frères et Cie and a trailing et Fils are removed from
the title, and where the title names the village, a conjunction before the
village belongs to the producer: “Mestre Père et Fils Santenay Passe-Temps”,
“Bouchard Père & Fils Beaune Grèves” and “Domaine Vincent et Sophie Morey
Santenay Les Gravières” select their cru. After the village, or in a title that
does not name it, `et`/`&` still marks a blend and keeps the broad area: “Santenay
Les Gravières et Clos Genet”, and “Françoise et Denis Clair Clos de Tavannes”,
whose first-name pair cannot be told from two vineyards. Outside the title, `&`
still marks a blend. Gevrey's Lavaut Saint-Jacques accepts the label spelling
[Lavaux Saint-Jacques](https://frederickwildman.com/producers/domaine-armand-rousseau/2022-domaine-armand-rousseau-gevrey-chambertin-1er-cru-lavaux-saint-jacques/)
(Armand Rousseau).

The #343 review's Cadastre lieux-dits suggestion is retained in the
[coverage backlog](burgundy-map-coverage.md). It needs a separate source review:
a cadastral named place does not by itself establish a wine boundary or a
producer holding. This batch completes the Côte de Beaune **appellation**
inventory; it does not claim complete village-plot coverage.

## Côte Chalonnaise: source and label review

Reviewed 26 September 2026 against the same pinned INAO archive and these
primary references. This batch adds all five village appellations and 141 named
Premier Cru boundaries. All 13 producing communes are retained in full.

- [INAO Bouzeron](https://inao.gouv.fr/produit/bouzeron-7747) and
  [the Bouzeron producers' association](https://www.bouzeron-vins.com/en/home/)
  confirm the white Aligoté appellation in Bouzeron and Chassey-le-Camp. There
  are no Premier Crus; village lieux-dits remain broad until geometry is reviewed.
- [BIVB Rully](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/gallery_files/site/321/402/79294/79818.pdf)
  lists 23 Premier Crus. Clos Saint-Jacques (`1091`) and Clos du Chaigne (`1092`)
  are in Chagny. The full published name “Clos du Chaigne (à Jean de France)”
  is a reviewed alias, including in reference fields. “Les Saint-Jacques” alone
  is not an alias of the Premier Cru. [Dureuil-Janthial](https://www.dureuil-janthial.fr/)
  provides the Le Meix Cadot label regression.
- [BIVB Mercurey](https://www.bourgogne-wines.com/our-wines-our-terroir/bourgogne-and-its-appellations/gallery_files/site/321/402/57644/57694.pdf)
  lists 32 Premier Crus across Mercurey and Saint-Martin-sous-Montaigu.
  [Faiveley's Clos des Myglands](https://domaine-faiveley.com/en/wine-detail/mercurey-clos-des-myglands-premier-cru/)
  supplies a producer-label case. The source uses capitalized “Premier Cru”
  for two names; prefix removal is case-insensitive without changing any old map.
  Source geometry places Clos du Château de Montaigu (`819`) inside Clos des
  Montaigus (`817`). Les Montaigus (`835`) overlaps about 3.63 ha of the latter,
  but neither contains the other. Each keeps its full identity and boundary;
  the partial overlap never becomes an umbrella relationship.
- [BIVB Givry](https://www.vins-bourgogne.fr/vins-et-terroirs/la-bourgogne-et-ses-appellations/givry%2C2377%2C9170.html?args=Y29tcF9pZD0yMjA1JmFjdGlvbj12aWV3RmljaGUmaWQ9MzExJnw%3D)
  lists **38** named Premier Crus; the source contains **37**. Le Vernoy is
  absent and is distinct from Clos du Vernoy (`628`). Every Givry dialog explains
  this gap. Le Vernoy keeps the broad Premier Cru view, and its name participates
  in ambiguity checks so a mixed label cannot silently select another vineyard.
  La Plante (`639`), La Matrosse (`2327`) and Le Médenchot (`2330`), all in Jambles,
  have source boundaries but no Atlas map paths. They use local named identities,
  with no fabricated outbound links. BIVB's “Crauzot” aliases source “Crausot”;
  [François Lumpp](https://francoislumpp.com/fr/pinot-noir/) and
  [Joblot's Clos du Cellier aux Moines](https://domaine-joblot.com/wp-content/uploads/2025/12/FT-2023-Clos-du-Cellier-aux-Moines.pdf)
  provide producer regressions. Dracy-le-Fort's Clos Jus remains in the full map.
  Reviewed label spellings also accept Mercurey's Clos du Roi for “Le Clos du Roy”
  ([Château de Chamirey](https://www.vivino.com/en/le-chateau-de-chamirey-mercurey-1er-cru-clos-du-roi/w/1459438),
  [Juillot](https://www.astorwines.com/item/39980)), Givry's Clos de la Barraude
  for “Clos de la Baraude” ([Vicomte d'Aligny](https://www.vivino.com/en/le-vicomte-d-aligny-givry-1er-cru-clos-de-la-barraude/w/2732648))
  and Cellier aux Moines for “Clos du Cellier aux Moines”
  ([Thénard](https://www.cellartracker.com/wine.asp?iWine=4617336)).
- [BIVB Montagny](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/montagny%2C2458%2C9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RmljaGUmaWQ9MzUxJnw%3D)
  confirms 49 Premier Crus and white Chardonnay across four communes. Les Coères
  (`886`) spans Montagny-lès-Buxy, Jully-lès-Buxy and Saint-Vallerin. Les Paquiers
  and Les Resses each span two communes. [Olivier Leflaive's Bonneveaux](https://olivier-leflaive.com/en/wine/montagny-1er-cru-bonneveaux-2015/)
  verifies the article omission from source “Les Bonneveaux”. No guessed spelling
  variants are introduced.

An independent comparison with the archive's original projection verifies all
150 wine geometries, four derived Premier Cru overview fills, areas, CVI colour
codes and commune membership. The 13 Cadastre outlines match their downloaded
source files and recorded hashes. All 29 earlier maps and catalogues, registry
targets, local appellations and existing umbrella relationships remain unchanged.
The #345 review's producer `et`/`&` handling and Lavaux Saint-Jacques alias remain
covered, with new conjunction cases for local Givry identities.

Unit checks cover every named boundary, colours, reference fields, repeated names,
containment versus partial overlap, blends and absent geometry. Owner/shared
browser checks cover all five maps at 320, 390 and 1280 pixels, lazy loading,
selection, return to the wine, focus restoration and unavailable street tiles.
Dedicated browser checks verify Givry's local names and visible source gap,
white-only colour guards and the absence of a Bouzeron Premier Cru map.

The Mâconnais batch below follows this coverage.

## Mâconnais: source and producer review

Reviewed 26 September 2026. The five maps add 36 source wine designations,
including 26 named Premier Crus, across 16 distinct producing communes. All five
appellations are white Chardonnay. Source geometry is retained without clipping.

- [The Pouilly-Fuissé producers' union](https://www.pouilly-fuisse.net/en/)
  confirms 22 Premier Cru climats since 2020. All 22 have named Atlas paths and
  INAO geometry (`2866–2887`); Vers Cras (`2876`) crosses Fuissé and Solutré-Pouilly.
  Source `1056`, “complété par une dénomination de climat”, is an additional broad
  village area, not a named vineyard. Both it and village `1055` remain selectable;
  their source geometries differ and are not merged.
- [The Loché/Vinzelles ODG announcement](https://www.bourgogne-wines.com/press/gallery_files/site/289/1910/78880.pdf)
  confirms Premier Cru status from vintage 2024: Les Mûres in Pouilly-Loché;
  Les Longeays, Les Pétaux and Les Quarts in Pouilly-Vinzelles. All four boundaries
  are in this INAO source, but none has an Atlas map path, nor does either broad
  Premier Cru tier. They use local INAO identities while village wines keep their
  existing Atlas village link. Naming a climat does not promote a recorded village
  wine. The parser requires recorded Premier Cru classification or a tier marker;
  it does not infer classification from the vintage year.
- [INAO's Vinzelles delimitation review](https://extranet.inao.gouv.fr/fichier/CNAOV-2016-419-Pouilly-Vinzelles.pdf)
  confirms the producing area is limited to Vinzelles. [The corresponding Loché review](https://extranet.inao.gouv.fr/fichier/CNAOV-2016-418-Pouilly-Loche.pdf)
  places Loché within Mâcon. The current Mâcon commune outline is used for context,
  with the wine-area extent setting the initial map view. Loché's broad Premier
  Cru `2931` and named Les Mûres `2932` are nearly coincident, with about 1.43 m² of
  symmetric difference. Both original boundaries remain; an unnamed wine still
  opens the broad area rather than claiming a plot.
- [The Saint-Véran specification](https://info.agriculture.gouv.fr/gedei/site/bo-agri/document_administratif-3347bbb6-daf8-46cf-acd2-eadb38e54177/telechargement)
  and [its producers' union](https://saint-veran-bourgogne.com/) name seven producing
  communes: Chânes, Chasselas, Davayé, Leynes, Prissé, Saint-Vérand and Solutré-Pouilly.
  All are present in the source. The northern and southern areas have separate
  zoom controls. Published village climats, such as Les Pommards, lack individual
  geometry here; the map keeps village scope and does not invent Premier Crus.
- [The Viré-Clessé producers' union](https://vireclesse.com/cahier-des-charges-appellation/)
  confirms Viré, Clessé, Montbellet and Laizé, and distinguishes wines bearing a
  climat name. Source `1593` is their broad named-climat eligibility area, smaller
  than full village `1287`; it is selectable but cannot stand in for Quintaine
  or another individual vineyard. No named plots are supplied for this map.

Producer label checks go beyond matching the source names:

- [Château Fuissé](https://chateau-fuisse.fr/2-7-ha-en-1er-cru-monopole/) identifies
  Le Clos as its Premier Cru monopole. A bare “clos” is not a sufficient match,
  nor is “Le Clos” at the start of an unrelated clos name.
- [Merlin's published labels](https://merlin-vins.com/fr/2020-la-naissance-des-pouilly-fuisse-premiers-crus/)
  verify Aux Vignerais for Au Vignerais, En France / Clos de France, and Aux Quarts /
  Clos des Quarts. The last two select the full official climat with a note about
  the missing producer subdivision. Aux Quarts in Chaintré remains separate from
  Les Quarts in Pouilly-Vinzelles.
- Ferret identifies [Clos de Jeanne](https://www.domaine-ferret.com/fr/vin/2/tete-de-cru-quot-clos-de-jeanne-quot)
  and [La Baudotte](https://www.domaine-ferret.com/fr/vin/3/tete-de-cru-quot-les-perrieres-quot)
  within Les Perrières, and [Tournant de Pouilly](https://www.domaine-ferret.com/fr/vin/5/cuvee-hors-classe-quot-tournant-de-pouilly-quot)
  within Les Reisses. These reviewed names select the whole official climat with
  an extent note. Ferret's historical “Le Clos” uses the reviewed producer
  location catalogue below, independently of bottle classification. Tournant
  de Pouilly never resolves to the separate Pouilly Premier Cru.
- [Albert Bichot's Clos Reyssié](https://www.albert-bichot.com/en/pouilly-fuisse-1er-cru-clos-reyssie_185)
  is a reviewed spelling of Le Clos Reyssier, the INAO and
  [Matisco](https://www.vivino.com/en/maison-matisco-pouilly-fuisse-1er-cru-le-clos-reyssier/w/11725495) form.
- [Clos des Rocs' Les Mûres](https://www.closdesrocs.fr/vins/pouilly-loche-mures-v6.php)
  and [Bret Brothers / La Soufrandière's 2024 labels](https://www.bretbrothers.com/document/cixk)
  cover local named identities and producer conjunctions. Complete reference
  fields, blends, village classifications and geography conflicts are tested too.

`burgundyProducerLocations.ts` records source-backed producer cuvée names,
their containing climat, and the producer of any homonymous official climat.
Ferret explicitly confirms that Le Clos became Clos de Jeanne from the 2020
vintage and that the 0.64 ha parcel remained the same. A verified Ferret identity
with either name selects the full Les Perrières boundary as geographical context,
including for village wines or records with no classification. The dialog labels
it “Vineyard location” and “Current map: Premier Cru”, explains the whole-climat
extent and historical village status, and links directly to the producer's source.
No wine fields, historical classification, or wine-detail Atlas tier are changed.

The recorded producer must equal a reviewed name; when absent, the wine title
must begin with one. All appellation, title and reference fields must agree;
unknown suffixes, blends, conflicting producers and other plots stay broad.
Shared country, region, appellation, identity and colour guards still apply.
Bare Le Clos without unambiguous producer evidence no longer selects Château
Fuissé's climat; that destination requires Château Fuissé evidence. Catalogue
entries do not create precise producer polygons or globally alias Le Clos to
Les Perrières. Vintage values are never used to infer or overwrite a wine's tier.

The **Domaine Vincent** follow-up is verified against
[Bernard-Massard's 2025 catalogue](https://www.bernard-massard.lu/wp-content/uploads/Tarif_Bernard-Massard_2025_light.pdf#page=33)
(printed page 32, PDF page 33, item A01264): it lists Pouilly-Fuissé Le Clos
under that exact producer heading. The
[estate's own wine list](https://chateau-fuisse.fr/nos-vins/) confirms the Vincent
family and Le Clos monopole, while distinguishing its Famille Vincent range.
The exact stored producer name Domaine Vincent is therefore accepted only by
the Pouilly-Fuissé Le Clos homonym guard, with existing tier, geography, blend
and conflict checks. It is not a global producer alias or a title-prefix match:
[Domaine Vincent Cornin](https://www.domainevincentcornin.fr/) is another Fuissé
estate and produces Le Clos Reyssier. Vincent alone, other Vincent producers,
and producer-less titles starting with Domaine Vincent remain broad. A recorded
village wine is never promoted by the alias.

An independent source comparison verifies all 36 projected wine geometries,
three derived Premier Cru overview fills, areas, colour codes and commune IDs,
plus all 16 Cadastre outlines and recorded hashes. All 34 prior maps/catalogues,
registry targets and existing umbrella relationships are unchanged. The #346
Clos du Roi, Clos de la Barraude and Cellier aux Moines review fixes are retained.
Browser coverage includes owner/shared views, lazy loading, selection, return
to the wine, mobile layouts, local-only Premier Cru links and the two Saint-Véran
area controls. That batch brought the full 44-appellation checklist to **39/44**.

The northern Burgundy batch below completes that village inventory.

## Chablis and Grand Auxerrois: source review and known gaps

Reviewed 26 September 2026. This batch adds 24 source designations and 27 new
commune outlines. All 44 village appellations and all 33 Grand Cru appellations
now have maps; regional AOCs and missing named plots remain separate work.

- Chablis and Petit Chablis each retain their full white-wine production areas
  across 17 current communes. Historical Fyé, Milly and Poinchy are represented
  by current Chablis (`89068`). Overlapping eligibility areas are preserved;
  Petit Chablis is not computed by subtracting the higher tiers.
- [BIVB's Chablis Premier Cru inventory](https://www.chablis-wines.com/explore/chablis-appellations/chablis-premier-cru/chablis-premier-cru,1819,7661.html)
  recognises 40 climats under 17 flag-bearing names. The source contains only
  ten named features (`404`, `408`, `414`, `416`, `418`, `420`, `432`, `433`, `435`,
  `437`) alongside village `397` and broad Premier Cru `438`. The 30 missing names
  stay in the matcher as unmapped entries, preventing a mixed label from selecting
  only its mapped component. No missing name receives an invented polygon.
- [BIVB's Fourchaume description](https://www.chablis-wines.com/explore/the-terroir/the-climats-of-chablis-micro-terroirs/fourchaume-l-homme-mort-vaupulent-cote-de-fontenay-vaulorent,3251,15616.html)
  spans Chablis-Poinchy, Fontenay-près-Chablis, Maligny and La Chapelle-Vaupelteigne.
  Source `414` has only the last three communes (99.43 ha). It is explicitly
  marked partial; a Fourchaume wine falls back to `438`. Vaupulent has its own
  boundary inside the available Fourchaume portion and remains selectable.
- [J. Moreau's Mont de Milieu description](https://www.jmoreau-fils.com/fr/rubrique.r-218/nos-gammes-de-vins.r-115/chablis-1er-cru-mont-de-milieu.v-1398.html)
  identifies Fleys and Fyé. Source `420` contains only Fleys (18.16 ha), so it is
  also partial and never automatically highlights a wine. Both partial features
  remain available for manual exploration with an explicit selector label and
  description. The broad Premier Cru source boundary supplies the overview fill,
  so absent named polygons do not erase Premier Cru land from the overview.
- Grand Cru `439` is a broad appellation; `440–446` are its seven named climats.
  Grand Cru wines open on the shared Grand Cru hillside, including broad wines
  such as La Moutonne, while named climats keep their individual highlight.
  “Grand Cru view” returns to that hillside, “Village view” shows all of Chablis,
  and “Zoom to selection” offers a closer look at a single climat. Returning to
  the wine restores its initial framing. Premier Cru and village openings keep
  their existing scope.
  The latter use local identities with no fabricated Atlas pages. The matcher
  requires Grand Cru evidence and supports white named Chablis while retaining
  Corton's existing red-only named-climat rule. Recorded tiers and source colour
  conflicts still win over a familiar plot name.
- [Long-Depaquit's own wine list](https://www.albert-bichot.com/fr/domaine-long-depaquit_22.html)
  verifies Les Blanchots for Blanchot, Les Vaudésirs for Vaudésir, Les Preuses for
  source Preuses, and Les Vaucopins for Premier Cru Vaucoupin. These exact aliases
  are scoped to their appellation and source identity. The estate also places
  La Moutonne partly in Vaudésir and partly in Les Preuses. With no separate
  source boundary, La Moutonne remains broad even if a reference names either
  containing climat. A generic “clos” never proves Les Clos.
- [BIVB's Irancy sheet](https://www.bourgogne-wines.com/our-wines-our-terroir/the-bourgogne-winegrowing-region-and-its-appellations/gallery_files/site/321/402/57644/57686.pdf)
  confirms red wine and Irancy, Cravant and Vincelottes. Cravant is now within
  Deux Rivières (`89130`): the current commune outline includes the merged area,
  while the INAO wine boundary retains its own Cravant extent. Palotte and other
  named vineyards remain broad; no Premier Cru is invented.
- [BIVB's Saint-Bris sheet](https://www.bourgogne-wines.com/our-wines-our-terroir/bourgogne-and-its-appellations/gallery_files/site/321/402/57644/57712.pdf)
  confirms a white Sauvignon/Sauvignon gris appellation across Saint-Bris-le-Vineux,
  Chitry, Irancy, Quenne and Vincelottes. All five source communes are preserved.
  [Vézelay's white area](https://www.bourgogne-wines.com/our-wines-our-terroir/bourgogne-and-its-appellations/gallery_files/site/321/402/57644/57717.pdf)
  spans Asquins, Saint-Père, Tharoiseau and Vézelay. Neither
  has individual vineyard polygons in this source.

Independent comparison against the archived shapefile confirms all 24 projected
wine geometries, source areas, colour codes and commune IDs, two derived overview
fills, and all 27 Cadastre outlines and hashes. All 39 prior maps/catalogues and
their registry targets are unchanged, including the #347 Ferret and Domaine
Vincent fixes. Browser checks cover all five new maps in owner/shared views at
320, 390 and 1280 pixels, seven-climat Grand Cru context, local-only links,
La Moutonne fallback and both explicitly partial Premier Cru features.

Next: inventory and map the seven regional AOCs and their geographic denominations,
while seeking licensed, reviewed geometry for missing Chablis/Givry/Corton names
and village lieux-dits. The 44/44 village count does not close those gaps.
