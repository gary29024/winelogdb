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

Reviewed 25 September 2026 against the
[BIVB appellation list](https://www.bourgogne-wines.com/wine-and-terroir/bourgogne-and-its-appellations/bourgogne-an-ideal-location,2458,9253.html?args=Y29tcF9pZD0yMjc4JmFjdGlvbj12aWV3RnVsbExpc3RlJmlkPSZ8)
and the pinned INAO boundary snapshot documented in [the map guide](burgundy-village-map.md).
Beaujolais has its own appellation system and is outside this Bourgogne inventory.

## Village coverage

**25 of 44 village appellations have maps in this branch.** This is not complete
Burgundy coverage. A mapped appellation can still lack individual village
lieux-dits; named plot coverage must be assessed separately.

| Region | Mapped | Remaining |
| --- | ---: | ---: |
| Côte de Nuits | 9 | 0 |
| Côte de Beaune | 16 | 4 |
| Côte Chalonnaise | 0 | 5 |
| Mâconnais | 0 | 5 |
| Chablis & Grand Auxerrois | 0 | 5 |

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

### Côte de Beaune — next batches

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
- [ ] Santenay
- [ ] Maranges
- [ ] Côte de Beaune
- [ ] Côte de Beaune-Villages

Next are Santenay, Maranges, Côte de Beaune and Côte de Beaune-Villages, completing
the Côte de Beaune village inventory. Côte de Beaune-Villages needs a local
identity because the Atlas crosswalk has no page for it. Then continue through
the Côte Chalonnaise, Mâconnais, Chablis/Grand Auxerrois and regional inventory.

### Côte Chalonnaise

- [ ] Bouzeron
- [ ] Rully
- [ ] Mercurey
- [ ] Givry
- [ ] Montagny

### Mâconnais

- [ ] Pouilly-Fuissé
- [ ] Pouilly-Loché
- [ ] Pouilly-Vinzelles
- [ ] Saint-Véran
- [ ] Viré-Clessé

### Chablis & Grand Auxerrois

- [ ] Chablis, including its Premier Crus
- [ ] Petit Chablis
- [ ] Irancy
- [ ] Saint-Bris
- [ ] Vézelay

## Grand Crus and regional coverage

All **24 Côte de Nuits Grand Cru appellations** and the **five Montrachet Grand
Crus**, plus **Corton, Corton-Charlemagne and Charlemagne**, are mapped:
**32 of 33** Bourgogne Grand Cru appellations. Shared appellations count once
despite appearing in several village maps. Chablis Grand Cru remains pending:

- [x] Montrachet, Bâtard-Montrachet, Chevalier-Montrachet,
  Bienvenues-Bâtard-Montrachet and Criots-Bâtard-Montrachet
- [x] Corton (24 named source denominations), Corton-Charlemagne and Charlemagne
- [ ] Chablis Grand Cru and its seven named climats

Regional coverage remains pending. Track all seven regional AOCs: Bourgogne,
Bourgogne Aligoté, Bourgogne Mousseux, Bourgogne Passe-tout-grains, Coteaux
Bourguignons, Crémant de Bourgogne and Mâcon. This includes the Hautes Côtes,
Couchois, Châtillonnais and northern wine areas; they must not disappear from
the plan because they lack a village AOC.

Within Bourgogne, review all 14 geographic denominations present in the pinned
snapshot: Chitry, Côte Chalonnaise, Côte d'Or, Côte Saint-Jacques, Côtes d'Auxerre,
Côtes du Couchois, Coulanges-la-Vineuse, Épineuil, Hautes Côtes de Beaune, Hautes
Côtes de Nuits, La Chapelle Notre-Dame, Le Chapitre, Montrecul and Tonnerre.
Within Mâcon, track Mâcon-Villages and all 27 named geographic denominations
in the source, rather than just the five village AOCs above.

## Source gaps and completion criteria

- **A boundary must not depend on an Atlas page existing.** The current crosswalk
  does depend on Atlas identities. Before the affected batches, add reviewed local
  identities with optional outbound Atlas links. Côte de Beaune-Villages and the
  Premier Crus of Pouilly-Loché/Pouilly-Vinzelles are known gaps in that crosswalk.
- **Source counts need review.** The pinned INAO file has only 12 Chablis
  denominations under its village appellation; that is not a complete inventory
  of named Premier Cru climats. Verify umbrella names and missing geometries
  against official sources before calling Chablis complete.
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
- **Completion means more than a checkbox.** Verify every expected denomination,
  all producing communes, source provenance, shared boundaries, conservative wine
  matching, owner/shared views, lazy loading and mobile layouts. Document any
  remaining named-plot gaps alongside the published appellation map.
