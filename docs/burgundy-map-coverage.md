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

**9 of 44 village appellations have maps in this branch.** This is not complete
Burgundy coverage. A mapped appellation can still lack individual village
lieux-dits; named plot coverage must be assessed separately.

| Region | Mapped | Remaining |
| --- | ---: | ---: |
| Côte de Nuits | 9 | 0 |
| Côte de Beaune | 0 | 20 |
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

- [ ] Meursault
- [ ] Puligny-Montrachet
- [ ] Chassagne-Montrachet
- [ ] Saint-Aubin
- [ ] Blagny
- [ ] Aloxe-Corton
- [ ] Pernand-Vergelesses
- [ ] Ladoix
- [ ] Beaune
- [ ] Pommard
- [ ] Volnay
- [ ] Savigny-lès-Beaune
- [ ] Chorey-lès-Beaune
- [ ] Auxey-Duresses
- [ ] Monthélie
- [ ] Saint-Romain
- [ ] Santenay
- [ ] Maranges
- [ ] Côte de Beaune
- [ ] Côte de Beaune-Villages

Start with Meursault/Puligny/Chassagne/Saint-Aubin/Blagny, then the Corton
communes, then the remaining Côte de Beaune entries. These are batches for
review, not a reduction in the coverage target.

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

All **24 Côte de Nuits Grand Cru appellations** are mapped, with Bonnes-Mares
counted once despite appearing in two maps. The remaining nine Bourgogne Grand
Cru appellations belong in the relevant village batches:

- [ ] Montrachet, Bâtard-Montrachet, Chevalier-Montrachet,
  Bienvenues-Bâtard-Montrachet and Criots-Bâtard-Montrachet
- [ ] Corton (including named denominations), Corton-Charlemagne and Charlemagne
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
- **Colour can change the production area.** Marsannay demonstrates why grouping
  by denomination ID alone is insufficient. Review colour-specific rows and
  alternative source names for each batch; never silently merge them as one plot.
- **No invented village plots.** The current snapshot does not give individual
  Marsannay or Côte de Nuits-Villages lieux-dit boundaries. Keep the appellation
  view explicit until reviewed, licensed geometry exists. Apply the same rule
  throughout Burgundy, including producer-owned subdivisions and cadastral lines.
- **Completion means more than a checkbox.** Verify every expected denomination,
  all producing communes, source provenance, shared boundaries, conservative wine
  matching, owner/shared views, lazy loading and mobile layouts. Document any
  remaining named-plot gaps alongside the published appellation map.
