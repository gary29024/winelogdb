# Full Burgundy map coverage

The target is all Bourgogne village appellations, their named Premier Crus and
Grand Crus, followed by regional appellations and their geographic denominations.
Coverage is tracked by appellation **and** producing commune: a village name is
not a reason to omit neighbouring communes or clip a shared cru.

The reviewed inventory in `scripts/burgundy-map-coverage.json` lists all **44
village appellations** with INAO appellation IDs. Tests reconcile it with the
existing Atlas list, include Côte de Beaune-Villages even though Atlas has no
map link for it, and verify all nine Côte de Nuits entries have map configurations.
Adding a map requires updating this document and the map configuration; the
inventory is the denominator, not the current list of supported Atlas pages.

Reviewed 26 September 2026 against the
[BIVB appellation list](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/bourgogne-an-ideal-location,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RnVsbExpc3RlJmlkPSZ8)
and the pinned INAO boundary snapshot documented in [the map guide](burgundy-village-map.md).
Beaujolais's own appellations are outside this inventory. Shared regional AOCs
retain their full official extent, including any producing communes there.

## Village coverage

**All 44 village appellations have maps in this branch.** Named plot and regional
coverage remain incomplete: Chablis has 30 missing and two partial Premier Cru
boundaries, Givry lacks Le Vernoy, and village lieux-dits need separate sources.

| Region | Mapped | Remaining |
| --- | ---: | ---: |
| Côte de Nuits | 9 | 0 |
| Côte de Beaune | 20 | 0 |
| Côte Chalonnaise | 5 | 0 |
| Mâconnais | 5 | 0 |
| Chablis & Grand Auxerrois | 5 | 0 |

### Côte de Nuits — mapped

- [x] Gevrey-Chambertin, including Brochon
- [x] Morey-Saint-Denis and shared Bonnes-Mares
- [x] Chambolle-Musigny and shared Bonnes-Mares
- [x] Vosne-Romanée, including Flagey-Échezeaux
- [x] Fixin, including Brochon and all six named Premier Crus
- [x] Vougeot, including Clos de Vougeot and all four named Premier Crus
- [x] Nuits-Saint-Georges, including Premeaux-Prissey and all 41 named Premier Crus
- [x] Marsannay: Chenôve, Marsannay-la-Côte and Couchey; separate red/white and rosé areas
- [x] Côte de Nuits-Villages: Fixin, Brochon, Premeaux-Prissey, Comblanchien and Corgoloin

### Côte de Beaune — mapped

- [x] Meursault: 19 named Premier Crus and separate red/white village areas
- [x] Puligny-Montrachet: 17 named Premier Crus, four Grand Crus and red/white village areas
- [x] Chassagne-Montrachet: Remigny, 55 named Premier Crus and three Grand Crus
- [x] Saint-Aubin: 30 named Premier Crus and both source colour identities
- [x] Blagny: seven named Premier Crus across Meursault and Puligny; red identities retained separately
- [x] Aloxe-Corton: 14 Premier Crus and production areas in all three Corton communes
- [x] Pernand-Vergelesses: eight Premier Crus and the full shared Corton group
- [x] Ladoix: 11 Premier Crus, both village colour identities and the full shared Corton group
- [x] Beaune: all 42 named Premier Crus, with red and white source boundaries shared
- [x] Pommard: all 28 named Premier Crus, including distinct Rugiens Hauts/Bas and Grands/Petits Epenots
- [x] Volnay: all 29 named Premier Crus, including Santenots in Meursault
- [x] Savigny-lès-Beaune: all 22 named Premier Crus and both village colour identities
- [x] Chorey-lès-Beaune: both village colour identities; individual lieux-dits remain unmapped
- [x] Auxey-Duresses: all nine named Premier Crus, both village colour identities and the whole commune including Petit-Auxey and Mélian
- [x] Monthélie: all 15 named Premier Crus, including the four non-contiguous source IDs
- [x] Saint-Romain: distinct red and white village areas; individual lieux-dits remain unmapped
- [x] Santenay: Remigny, 11 Premier Cru climats under 12 source names, and both village colour identities
- [x] Maranges: all three producing communes, seven Premier Crus and both village colour identities
- [x] Côte de Beaune: its full source area in Beaune, distinct from the subregion and the Beaune appellation
- [x] Côte de Beaune-Villages: all 16 producing communes, red-only, with a local identity and four area zoom controls

All five regional village inventories are now mapped. The regional AOC inventory
is now tracked separately, alongside the named-boundary gaps below. A completed village inventory
does not imply that every named plot has geometry.

### Côte Chalonnaise — mapped, with a Givry source gap

- [x] Bouzeron: Bouzeron and Chassey-le-Camp; white Aligoté, broad area only
- [x] Rully: all 23 named Premier Crus, including the two in Chagny
- [x] Mercurey: all 32 named Premier Crus and Saint-Martin-sous-Montaigu
- [x] Givry: 37 of 38 named Premier Crus, with Dracy-le-Fort and Jambles; Le Vernoy has no separate source geometry
- [x] Montagny: all 49 named Premier Crus across Montagny-lès-Buxy, Buxy, Jully-lès-Buxy and Saint-Vallerin; white only

### Mâconnais — mapped

- [x] Pouilly-Fuissé: all 22 Premier Crus across Fuissé, Solutré-Pouilly, Vergisson and Chaintré; both broad village source designations retained
- [x] Pouilly-Loché: Les Mûres and its broad Premier Cru area use local identities; Loché is within the current Mâcon commune
- [x] Pouilly-Vinzelles: all three Premier Crus use local identities; the producing commune is Vinzelles
- [x] Saint-Véran: all seven producing communes, with north/south area controls; no individual climat geometry in this source
- [x] Viré-Clessé: Viré, Clessé, Montbellet and Laizé; full village and named-climat eligibility areas retained, without individual plot boundaries

### Chablis & Grand Auxerrois — mapped, with Chablis source gaps

- [x] Chablis: all 17 current producing communes; broad village/Premier Cru areas, eight named Premier Cru boundaries and two explicitly partial boundaries
- [x] Petit Chablis: all 17 current producing communes; broad white-wine area
- [x] Irancy: Irancy, Vincelottes and Cravant within the current Deux Rivières commune; red only
- [x] Saint-Bris: Saint-Bris-le-Vineux, Chitry, Irancy, Quenne and Vincelottes; white only
- [x] Vézelay: Asquins, Saint-Père, Tharoiseau and Vézelay; white only

Chablis has 40 recognised Premier Cru climats. The pinned source supplies ten
named features, of which Fourchaume and Mont de Milieu omit their Chablis-commune
portions. Those two features remain available for labelled manual exploration;
their wines open on the broad Premier Cru area, as do the 30 missing names.
The full Premier Cru source area supplies the overview colour, including areas
whose individual climat names lack geometry. Named village plots in the other
four appellations remain unmapped.

## Grand Crus and regional coverage

All **24 Côte de Nuits Grand Cru appellations** and the **five Montrachet Grand
Crus**, plus **Corton, Corton-Charlemagne, Charlemagne and Chablis Grand Cru**,
are mapped: **33 of 33** Bourgogne Grand Cru appellations. Shared appellations
count once despite appearing in several village maps.

- [x] Montrachet, Bâtard-Montrachet, Chevalier-Montrachet,
  Bienvenues-Bâtard-Montrachet and Criots-Bâtard-Montrachet
- [x] Corton (24 named source denominations), Corton-Charlemagne and Charlemagne
- [x] Chablis Grand Cru and its seven named climats; La Moutonne alone has a dashed, approximate producer outline, separate from official boundaries

The reviewed inventory in `scripts/burgundy-regional-map-coverage.json` tracks
all seven regional AOCs: Bourgogne,
Bourgogne Aligoté, Bourgogne Mousseux, Bourgogne Passe-tout-grains, Coteaux
Bourguignons, Crémant de Bourgogne and Mâcon. This includes the Hautes Côtes,
Couchois, Châtillonnais and northern wine areas; they must not disappear from
the plan because they lack a village AOC. See the
[regional map guide](burgundy-regional-maps.md) for sources, matching and reproduction.

- [x] Bourgogne Côte d’Or: all 40 producing communes; red/white
- [x] Bourgogne Hautes Côtes de Nuits: all 19 communes; red/white/rosé
- [x] Bourgogne Hautes Côtes de Beaune: all 29 communes; red/white/rosé
- [x] Bourgogne Côte Chalonnaise: all 44 communes; red/white/rosé
- [x] Bourgogne Côtes du Couchois: all six communes; red only
- [x] Bourgogne Côtes d’Auxerre: all five source communes; red/white/rosé
- [x] Bourgogne Chitry: Chitry; red/white/rosé
- [x] Bourgogne Coulanges-la-Vineuse: all seven communes; red/white/rosé
- [x] Bourgogne Épineuil: Épineuil; red/rosé
- [x] Bourgogne Côte Saint-Jacques: the delimited hillside in Joigny; red/white/rosé, including vin gris
- [x] Bourgogne Tonnerre: all six communes, including Épineuil; white only
- [x] Bourgogne La Chapelle Notre-Dame: Ladoix-Serrigny; red/white/rosé
- [x] Bourgogne Le Chapitre: Chenôve; red/white/rosé, with an appellation-transition note
- [x] Bourgogne Montrecul: Dijon; red/white/rosé, including Montre-Cul / En Montre-Cul aliases

All **14 Bourgogne geographic denominations** in the pinned source now have maps.
These are denominations within Bourgogne AOC, not new AOCs or village maps.
**Fourteen of 49 regional source denominations are mapped; 35 remain pending:**
the seven broad regional denominations, Mâcon-Villages and 27 named Mâcon denominations.
The [Yonne source review](burgundy-regional-maps.md#yonne-source-review)
explains the five-commune Côtes d’Auxerre list and its difference from some
seven-name promotional lists. It does not add boundaries from those lists.

Within Bourgogne, the completed geographic-denomination inventory covers all 14 names in the pinned
snapshot: Chitry, Côte Chalonnaise, Côte d'Or, Côte Saint-Jacques, Côtes d'Auxerre,
Côtes du Couchois, Coulanges-la-Vineuse, Épineuil, Hautes Côtes de Beaune, Hautes
Côtes de Nuits, La Chapelle Notre-Dame, Le Chapitre, Montrecul and Tonnerre.
Within Mâcon, track Mâcon-Villages and all 27 named geographic denominations
in the source, rather than just the five village AOCs above.

## Source gaps and completion criteria

- **A boundary must not depend on an Atlas page existing.** Côte de Beaune-Villages
  now uses an explicitly reviewed local appellation identity with no outbound
  Atlas link; it shares the existing geographic and tier conflict checks.
  Givry's La Plante, La Matrosse and Le Médenchot now use local named Premier Cru
  identities with the same safeguards. Pouilly-Loché and Pouilly-Vinzelles now
  also have local named and broad Premier Cru identities, while keeping their
  existing Atlas village links. A missing tier page must not hide its boundaries.
- **Givry is 37 of 38 named Premier Crus.** BIVB lists Le Vernoy separately from
  Clos du Vernoy. The pinned INAO source lacks Le Vernoy geometry. Its wines keep
  the broad Premier Cru view; the gap is visible in every Givry map dialog.
  Do not substitute Clos du Vernoy or silently drop Le Vernoy from a blend.
- **Chablis named Premier Cru coverage remains partial.** Its 12 village-AOC
  source denominations comprise two broad areas and ten named features. BIVB
  recognises 40 climats under 17 flag-bearing names. Fourchaume (`414`) lacks
  Chablis-Poinchy and Mont de Milieu (`420`) lacks Fyé in Chablis. Neither partial
  polygon may automatically locate a wine. Missing names also participate in
  blend checks: “Fourchaume Vaulorent” must not silently select Fourchaume.
  The [cadastral reconstruction audit](chablis-cadastre-audit.md) failed its
  benchmark gate, so no derived completion or all-40 crosswalk is published.
- **Seven Chablis climats are one Grand Cru appellation.** White wine can select
  a named climat; a recorded village or Premier Cru cannot be promoted by its
  name. La Moutonne crosses Vaudésir and Les Preuses and has no official parcel
  geometry here. The owner-approved [one-off producer illustration](la-moutonne-approximation.md)
  is labelled approximate and kept separate from all official boundaries/counts.
- **A named-climat eligibility area is not one climat.** Pouilly-Fuissé `1056`
  and Viré-Clessé `1593` describe broader production areas for village wines
  labelled with a climat. Keep them selectable with clear scope, and never use
  them as a named plot or promote a village wine to Premier Cru from its name.
- **Producer names can resemble official climats.** Ferret's Clos de Jeanne
  belongs to Les Perrières and Tournant de Pouilly to Les Reisses. They select
  the whole official climat with an explanatory note. Generic clos text and
  Ferret's historical Le Clos must not select Château Fuissé's separate Le Clos.
- **Corton named-plot coverage is partial.** All 24 named denominations in the
  pinned source are mapped, alongside the full Corton area. The BIVB inventory
  also names Clos des Cortons Faiveley and additional Pernand climats that lack
  separate Corton geometry here. Do not copy a neighbouring or Premier Cru
  polygon to fill that gap. Those wines retain a broad Corton view; white Corton
  also stays broad because the source's named denominations are for red wine.
- **Colour can change the production area.** Marsannay demonstrates why grouping
  by denomination ID alone is insufficient. Review colour-specific rows and
  alternative source names for each batch; never silently merge them as one plot.
- **Volnay Santenots is one source denomination.** Its full 29.01 ha boundary
  lies in Meursault. Smaller Volnay plots such as Santenots du Milieu have no
  separate denomination in this snapshot. Keep the whole Santenots area and
  its explanatory note; do not substitute Meursault's white-wine boundaries.
- **Pommard names can be underspecified.** "Rugiens" does not identify Hauts
  or Bas, and "Epenots" does not identify Grands or Petits Epenots. These labels
  keep the broad Premier Cru view until a reviewed combined designation exists.
- **No invented village plots.** The current snapshot does not give individual
  Marsannay or Côte de Nuits-Villages lieux-dit boundaries. Keep the appellation
  view explicit until reviewed, licensed geometry exists. Apply the same rule
  throughout Burgundy, including producer-owned subdivisions and cadastral lines.
- **Chorey and Saint-Romain have broad maps only.** Les Beaumonts, Sous la Velle,
  Sous Roche and other named village vineyards are not separate source features.
  Monthélie's Clos des Champs Fulliot also selects the full Les Champs Fulliots
  denomination, with a note explaining the missing enclosed-plot boundary.
- **Check actual producer labels before each PR.** Keep cited regression cases
  for alternate spellings and compound cru names, alongside exact source names.
  Distinguish a reviewed compound label (Bataillère aux Vergelesses) from a blend
  and from geometric containment. Colour and appellation evidence must remain
  explicit; a producer subdivision must not acquire an invented polygon.
- **Count climats separately from alternative source names.** Santenay has 11
  BIVB climats but 12 INAO named entries. Clos de Tavannes and Les Gravières-Clos
  de Tavannes have equal geometry. Both names remain selectable, while the
  displayed climat count excludes the reviewed duplicate. Clos Rousseau and
  Grand Clos Rousseau remain separate boundaries.
- **Review Cadastre lieux-dits as a possible next source.** The #343 feedback
  suggested its named-place layer for missing village plots such as Les Beaumonts
  and Sous le Château. Evaluate geometry, names, licensing and matching against
  wine references before importing it. A cadastral place is not automatically
  a wine designation or a producer holding; no such plot boundaries are shipped yet.
- **Completion means more than a checkbox.** Verify every expected denomination,
  all producing communes, source provenance, shared boundaries, conservative wine
  matching, owner/shared views, lazy loading and mobile layouts. Document any
  remaining named-plot gaps alongside the published appellation map.
