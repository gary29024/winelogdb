# La Moutonne: one approved producer illustration

The owner explicitly approved this exception for **La Moutonne only**, in PR
#349. It supersedes the previous two full-climat highlights for this wine.
It does not authorise tracing other producer holdings or filling missing
Chablis Premier Cru boundaries. Those retain the cadastral audit's stop condition.

## Source and trace

[Domaines Albert Bichot's catalogue](https://catalogue.albert-bichot.com/QM1NSF)
publishes a detailed **Carte Marc de Moutonne**, showing the monopole in white
against the Grand Cru hillside. The same page identifies the vineyard as
2.35 ha, approximately 95% Vaudésir and 5% Les Preuses. The map depicts the
vineyard that supplies the marc; it is not a separate vineyard designation.

- [Original image](https://cdn.vin.co/_clients_folder/3418PY2MYC/Carte_Marc_de_Moutonne_1719303156.png): 1920 × 1080 pixels; reviewed 26 September 2026.
- SHA-256: `9f59e58c4482e99330c0e8860ef5b83c7e039eb027d34f8d3fbb7ee4cf2a4394`.
- The source image remains an ignored local input; it is not redistributed.
  Producer attribution and a source link accompany the derived illustration.
  No open-data licence is stated for this image; INAO's Licence Ouverte does
  not apply to the producer illustration.
- `scripts/la-moutonne-approximation.json` records every digitised outline vertex
  in source pixels and four reviewed control points: the western Bougros tip,
  Bougros/Preuses northern road junction, western Grenouilles tip and eastern
  Blanchot corner. Controls surround the outline, avoiding extrapolation.

`scripts/build_la_moutonne_approximation.py` fits a least-squares affine transform
from source pixels to Lambert-93, using the pinned INAO snapshot's original CRS
definition. Reviewed control seeds snap to the nearest existing source vertex
within one metre; this only avoids rounding the recorded control coordinates.
The traced outline itself is **never clipped, snapped, scaled to 2.35 ha or
adjusted to force a 95%/5% split**. Polygon orientation/coordinate rounding do
not substitute an inferred cadastral boundary. The builder verifies source
hashes, control proximity, polygon validity and broad geographic plausibility.

## What the alignment can and cannot establish

| Diagnostic | Result |
| --- | --- |
| Four control residuals | 13.16, 4.18, 14.97, 5.99 m |
| Control RMS residual | 10.61 m |
| Area of georeferenced illustration | 2.9851 ha |
| Producer's published holding area | 2.35 ha |
| Intersection with Vaudésir | 94.63% of illustrated shape |
| Intersection with Les Preuses | 3.43% of illustrated shape |
| Outside those two production polygons | 1.94%, including source road gaps |

Control residuals measure fit to those four manually identified points, **not
positional accuracy or a confidence interval**. The illustrated area is about
27% larger than the stated holding. A schematic outline, stroke thickness and
generalised map features cannot establish parcel limits. The UI explicitly
says that it draws larger and cannot measure the parcel; it displays the
producer's reported area as a statement about the holding, not the overlay.
The source was visually compared with the overlaid official hillside; local
road and outer-edge differences remain. No surveyed boundary is claimed.

## Isolation and presentation

The generated `src/lib/places/laMoutonneApproximation.json` is imported only in
the lazy map dialog. It is a separate `producer-illustration` MapLibre source,
with a dashed red outline, light fill, “La Moutonne (approx.)” marker and
“Approximate producer outline” legend. Its source/licence credit is separate
from the official INAO and Cadastre credits. The sole selector flag is the
literal `la-moutonne`, gated by the reviewed wine matcher, Chablis catalogue
and exact La Moutonne selection ID. It does not appear for other wine targets.

All seven official climats and their counts are unchanged. Clicking/exploring
them hides the illustration and uses the original INAO selection. Back to this
wine restores the illustration and Grand Cru hillside view; Zoom to selection
shows the approximate plot more closely. Producer, title, reference, tier,
colour and geography conflict guards remain unchanged. Ferret keeps its
existing full containing-climat view.

## Reproduction

Use the pinned INAO archive described in the map guide and download the exact
producer image above to `.tmp/burgundy-map/moutonne-producer-second-map.png`.
Install `scripts/burgundy-map-requirements.txt` and NumPy (review run: 2.5.3).

```sh
python scripts/build_la_moutonne_approximation.py --source-dir .tmp/burgundy-map
python scripts/build_la_moutonne_approximation.py --source-dir .tmp/burgundy-map --check
```

The builder writes only the one illustration JSON. It never writes the
official GeoJSON, registry, catalogues or other holdings. `--check` checks the
committed artifact without writing. Replacing this with an exact boundary still
requires documented parcel IDs and suitable cadastral geometry.
