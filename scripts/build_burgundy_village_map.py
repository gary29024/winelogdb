"""Build village maps from pinned INAO and Cadastre Etalab source files.

Install scripts/burgundy-map-requirements.txt, then run from the repository root:
python scripts/build_burgundy_village_map.py --source-dir .tmp/burgundy-map
Downloads are deliberately separate; see docs/burgundy-village-map.md.
"""
import argparse
import gzip
import hashlib
import json
import re
import shutil
import unicodedata
import zipfile
from pathlib import Path

import shapefile
from pyproj import CRS, Transformer
from shapely.geometry import shape, mapping
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
DATE = "2026-09-21"
CADASTRE_DATE = "2026-06-01"
INAO_URL = "https://static.data.gouv.fr/resources/delimitation-parcellaire-des-aoc-viticoles-de-linao/20260921-213954/2026-09-21-delim-parcellaire-aoc-shp.zip"
INAO_SHA256 = "6f84e0622c2a27d35fc1ad7b39629856bc5038aa38b9d629758c2fb873801d81"
PLACES = ROOT / "src/lib/places"


def key(value):
    value = "".join(c for c in unicodedata.normalize("NFKD", value) if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def rounded(value):
    if isinstance(value, (list, tuple)):
        return [rounded(v) for v in value]
    return round(value, 6) if isinstance(value, float) else value


def geometry_json(geom):
    assert geom.is_valid and not geom.is_empty and geom.geom_type in ("Polygon", "MultiPolygon")
    result = mapping(geom)
    # Narrow rings can collapse when rounded; retain the source precision.
    assert shape(result).is_valid
    return result


def write_json(path, value, compact=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False,
                              **({"separators": (",", ":")} if compact else {"indent": 2})) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True)
    args = parser.parse_args()
    config = read_json(ROOT / "scripts/burgundy-villages.json")
    villages = config["villages"]
    archive = args.source_dir / f"inao-{DATE}.zip"
    source_hash = hashlib.sha256(archive.read_bytes()).hexdigest()
    assert source_hash == INAO_SHA256, "Unexpected INAO archive; review the snapshot before updating"
    grand_links = read_json(PLACES / "burgundyAtlasLinks.json")["entries"]
    premier_groups = read_json(PLACES / "burgundyAtlasPremierCruLinks.json")["groups"]
    appellations = read_json(PLACES / "burgundyAtlasAppellationLinks.json")["groups"]
    app_ids = {v["appellationId"] for v in villages}
    grands = {d for v in villages for d in v["grands"]}
    grouped = {}
    with zipfile.ZipFile(archive) as z:
        # Only extract exact, flat members. Refresh them from the verified archive
        # so stale extracted files cannot silently change the generated maps.
        stem = f"{DATE}_delim-parcellaire-aoc-shp"
        for suffix in ("shp", "shx", "dbf"):
            with z.open(f"{stem}.{suffix}") as source, (args.source_dir / f"{stem}.{suffix}").open("wb") as target:
                shutil.copyfileobj(source, target)
        crs = CRS.from_wkt(z.read(f"{stem}.prj").decode())
        assert crs.to_epsg() == 2154
    to_wgs84 = Transformer.from_crs(crs, 4326, always_xy=True).transform
    with shapefile.Reader(str(args.source_dir / stem), encoding="utf-8") as reader:
        for record in reader.iterRecords():
            row = record.as_dict()
            if row["id_app"] in app_ids or row["id_denom"] in grands:
                grouped.setdefault(row["id_denom"], []).append((row, shape(reader.shape(record.oid).__geo_interface__)))

    # Union a designation once across ALL communes, never clip it to the
    # village being rendered. Bonnes-Mares must be identical on both maps.
    geometries = {d: unary_union([geom for _, geom in rows]) for d, rows in grouped.items()}
    outputs, targets = [], {}
    for village in villages:
        name = village["name"]
        premiers = next((g for g in premier_groups if g["appellation"] == name), {"entries": []})
        appellation = next(g for g in appellations if g["appellation"] == name)
        premier_links = {key(e["name"]): e["path"] for e in premiers["entries"]}
        colour_denominations = {int(d): colour for d, colour in village.get("colourDenominations", {}).items()}
        village_ids = {village["villageDenomination"]} | colour_denominations.keys()
        if colour_denominations:
            assert village["villageDenomination"] in colour_denominations
            assert sorted(colour_denominations.values()) == ["red", "white"]
        premier_ids = set(village.get("premierDenominations", []))
        if village.get("premierRange"):
            first, last = village["premierRange"]
            premier_ids.update(range(first, last + 1))
        expected_app = village_ids | premier_ids
        if village.get("premierDenomination"):
            expected_app.add(village["premierDenomination"])
        actual_app = {d for d, rows in grouped.items() if rows[0][0]["id_app"] == village["appellationId"]}
        assert actual_app == expected_app, f"Review changed source coverage for {name}"
        denominations = set(village["grands"]) | expected_app
        assert denominations <= grouped.keys(), f"Missing Grand Cru geometry for {name}"
        features, catalogue = [], []
        for denom_id in sorted(denominations):
            rows = grouped[denom_id]
            row = rows[0][0]
            variants = village.get("sourceVariants", {}).get(str(denom_id), [])
            source_names = {r["denom"] for r, _ in rows}
            expected_names = {v["sourceName"] for v in variants} | {name} if variants else {row["denom"]}
            assert source_names == expected_names, f"Review source names for {name}: {source_names}"
            assert all(r["id_app"] == row["id_app"] for r, _ in rows)
            geom_m = geometries[denom_id]
            geom = transform(to_wgs84, geom_m)
            west, south, east, north = village.get("expectedBounds", [4.9, 47.1, 5.05, 47.3])
            assert west < geom.bounds[0] < geom.bounds[2] < east and south < geom.bounds[1] < geom.bounds[3] < north
            tier = "grand_cru" if denom_id in village["grands"] else "village" if denom_id in village_ids else "premier_cru"
            broad = denom_id in village_ids or denom_id == village.get("premierDenomination")
            feature_name = row["denom"].removeprefix(f"{name} premier cru ")
            if broad:
                feature_name = name + (" Premier Cru" if tier == "premier_cru" else "")
                atlas_path = appellation["premierCruPath" if tier == "premier_cru" else "villagePath"]
                match_id = atlas_path.split("/")[2]
            elif tier == "grand_cru":
                entries = [e for e in grand_links if key(e["url"].split("/")[-1]) == key(feature_name)]
                assert len(entries) == 1, f"Review Grand Cru identity: {feature_name}"
                entry = entries[0]
                atlas_path = entry["url"].removeprefix("https://burgundyatlas.com")
                match_id = entry["placeId"]
            else:
                atlas_name = village["nameCrosswalk"].get(feature_name, feature_name)
                atlas_path = premier_links[key(atlas_name)]
                match_id = atlas_path.split("/")[2]
            # A shorter name for display where INAO records alternatives in one
            # string; the full INAO name stays in sourceName and the Atlas lookup.
            feature_name = village.get("displayNames", {}).get(feature_name, feature_name)
            if denom_id in colour_denominations:
                feature_name = f"{name} ({colour_denominations[denom_id]})"
            feature_id = f"inao-denom-{denom_id}"
            properties = {"id": feature_id, "name": feature_name, "tier": tier, "kind": "appellation" if broad else "vineyard",
                          "appellationId": row["id_app"], "denominationId": denom_id, "sourceName": " / ".join(sorted(source_names)),
                          "communes": sorted({r["insee"] for r, _ in rows}), "areaHa": round(geom_m.area / 10000, 2)}
            assert set(properties["communes"]) <= {c["id"] for c in village["communes"]}
            features.append({"type": "Feature", "id": feature_id, "properties": properties, "geometry": geometry_json(geom)})
            label_geom = max(geom.geoms, key=lambda part: part.area) if geom.geom_type == "MultiPolygon" else geom
            point = label_geom.representative_point()
            catalogue.append({**properties, "matchId": match_id, "atlasUrl": "https://burgundyatlas.com" + atlas_path,
                              "bounds": rounded(geom.bounds), "labelPoint": rounded([point.x, point.y])})
            target = {"matchId": match_id, "featureId": feature_id, "name": feature_name, "scope": properties["kind"]}
            # Marsannay uses one denomination ID for three source labels. Keep
            # colour-specific unions as separate broad areas, and the full union
            # as an explicitly labelled fallback when the wine colour is unknown.
            for variant in variants:
                assert broad and tier == "village"
                variant_rows = [(r, g) for r, g in rows if r["denom"] == variant["sourceName"]]
                assert variant_rows
                variant_m = unary_union([g for _, g in variant_rows])
                variant_geom = transform(to_wgs84, variant_m)
                variant_id = f"{feature_id}-{variant['suffix']}"
                variant_properties = {**properties, "id": variant_id, "name": variant["name"],
                                      "sourceName": variant["sourceName"], "areaHa": round(variant_m.area / 10000, 2),
                                      "communes": sorted({r["insee"] for r, _ in variant_rows})}
                features.append({"type": "Feature", "id": variant_id, "properties": variant_properties,
                                 "geometry": geometry_json(variant_geom)})
                point = variant_geom.representative_point()
                catalogue.append({**variant_properties, "matchId": match_id, "atlasUrl": "https://burgundyatlas.com" + atlas_path,
                                  "bounds": rounded(variant_geom.bounds), "labelPoint": rounded([point.x, point.y])})
                for colour in variant["colours"]:
                    colour_targets = target.setdefault("colourTargets", {})
                    assert colour not in colour_targets
                    colour_targets[colour] = {"featureId": variant_id, "name": variant["name"]}
            if denom_id in colour_denominations:
                continue  # Register the colour choices with their combined overview below.
            if match_id in targets:
                assert targets[match_id]["target"] == target, "A shared identity must refer to the same designation"
                targets[match_id]["villages"].append(village["id"])
            else:
                targets[match_id] = {"target": target, "villages": [village["id"]], "denom": denom_id}

        if colour_denominations:
            members = [f for f in catalogue if f["denominationId"] in colour_denominations]
            combined_m = unary_union([geometries[d] for d in colour_denominations])
            combined = transform(to_wgs84, combined_m)
            feature_id = f"inao-app-{village['appellationId']}-village"
            properties = {"id": feature_id, "name": f"{name} (all colours)", "tier": "village", "kind": "appellation",
                          "appellationId": village["appellationId"], "denominationId": None,
                          "denominationIds": sorted(colour_denominations), "sourceName": " / ".join(f["sourceName"] for f in members),
                          "communes": sorted({code for f in members for code in f["communes"]}), "areaHa": round(combined_m.area / 10000, 2)}
            # A derived overview is not a new INAO denomination. Keep every
            # official colour boundary intact, with its own source ID.
            features.insert(0, {"type": "Feature", "id": feature_id, "properties": properties, "geometry": geometry_json(combined)})
            point = combined.representative_point()
            match_id = appellation["villagePath"].split("/")[2]
            catalogue.insert(0, {**properties, "matchId": match_id, "atlasUrl": "https://burgundyatlas.com" + appellation["villagePath"],
                                 "bounds": rounded(combined.bounds), "labelPoint": rounded([point.x, point.y])})
            assert match_id not in targets
            targets[match_id] = {"target": {"matchId": match_id, "featureId": feature_id, "name": properties["name"], "scope": "appellation",
                                           "colourTargets": {colour_denominations[f["denominationId"]]: {"featureId": f["id"], "name": f["name"]} for f in members}},
                                 "villages": [village["id"]], "denom": None}

        by_id = {f["id"]: f for f in catalogue}
        # Some reviewed INAO areas overlap across tiers. Preserve every full
        # source geometry for selection, hit testing and outlines. Only the
        # overview fill uses this derived geometry, avoiding stacked colours.
        by_denom = {f["properties"]["denominationId"]: f for f in features}
        tier_rank = {"premier_cru": 1, "grand_cru": 2}
        for lower, higher in village.get("contextExclusions", {}).items():
            lower = int(lower)
            feature = by_denom[lower]
            assert feature["properties"]["kind"] == "vineyard"
            for upper in higher:
                assert by_denom[upper]["properties"]["kind"] == "vineyard"
                assert tier_rank[by_denom[upper]["properties"]["tier"]] > tier_rank[feature["properties"]["tier"]]
            mask = unary_union([geometries[d] for d in higher])
            full = geometries[lower]
            assert full.intersection(mask).area > 0, "Review an exclusion whose overlap disappeared"
            context = full.difference(mask)
            assert context.intersection(mask).area < 0.001
            assert abs(full.area - context.area - full.intersection(mask).area) < 0.001
            feature["contextGeometry"] = geometry_json(transform(to_wgs84, context))
        for feature_id, note in village["notes"].items():
            assert feature_id in by_id
            if cover_id := note.get("paintedBy"):
                assert cover_id in by_id and by_id[cover_id]["tier"] == by_id[feature_id]["tier"]
                assert not village["notes"].get(cover_id, {}).get("paintedBy")
                uncovered = geometries[by_id[feature_id]["denominationId"]].difference(geometries[by_id[cover_id]["denominationId"]])
                assert uncovered.area < 1, "Only suppress a fill actually covered by another designation"
        vineyard_bounds = unary_union([shape(f["geometry"]) for f in features]).bounds
        sources = [{"name": "INAO", "date": DATE, "url": INAO_URL, "sha256": source_hash, "license": "Licence Ouverte"}]
        commune_shapes = {}
        for commune in village["communes"]:
            code = commune["id"]
            file = args.source_dir / f"commune-{code}.json.gz"
            data = json.loads(gzip.decompress(file.read_bytes()))
            assert len(data["features"]) == 1 and data["features"][0]["properties"]["id"] == code
            source = data["features"][0]
            commune_shapes[code] = shape(source["geometry"])
            features.append({"type": "Feature", "id": f"commune-{code}",
                             "properties": {"id": f"commune-{code}", "name": source["properties"]["nom"], "kind": "commune", "tier": "commune"},
                             "geometry": geometry_json(shape(source["geometry"]))})
            sources.append({"name": "Cadastre Etalab", "date": CADASTRE_DATE, "license": "Licence Ouverte 2.0",
                            "url": f"https://cadastre.data.gouv.fr/data/etalab-cadastre/{CADASTRE_DATE}/geojson/communes/{code[:2]}/{code}/cadastre-{code}-communes.json.gz",
                            "sha256": hashlib.sha256(file.read_bytes()).hexdigest()})
        url = f"/maps/{village['id']}.{DATE}.geojson"
        manifest = {"id": village["id"], "name": name, "region": village["region"], "communes": village["communes"],
                    "dataUrl": url, "bounds": rounded(vineyard_bounds), "sources": sources, "notes": village["notes"], "features": catalogue}
        if village.get("overlapNote"):
            manifest["overlapNote"] = village["overlapNote"]
        # Separate parts of one appellation (Côte de Nuits-Villages) each get a
        # zoom target: every polygon of the village area is assigned, by its
        # centroid, to exactly one configured group of communes.
        if village.get("areas"):
            whole = transform(to_wgs84, geometries[village["villageDenomination"]])
            parts = list(whole.geoms) if whole.geom_type == "MultiPolygon" else [whole]
            assigned = {area["id"]: [] for area in village["areas"]}
            for part in parts:
                owners = [area["id"] for area in village["areas"]
                          if any(commune_shapes[code].contains(part.centroid) for code in area["communes"])]
                assert len(owners) == 1, "Every part of the area must belong to exactly one configured group"
                assigned[owners[0]].append(part)
            manifest["areas"] = []
            for area in village["areas"]:
                assert assigned[area["id"]], f"Configured area {area['id']} has no production area"
                manifest["areas"].append({"id": area["id"], "label": area["label"], "name": area["name"],
                                          "bounds": rounded(unary_union(assigned[area["id"]]).bounds)})
        data = {"type": "FeatureCollection", "features": features}
        if village.get("unionOverviewFills"):
            assert not village.get("contextExclusions"), "Choose one overview derivation per map"
            # Several Premier Cru names can cover the same ground. Paint one
            # union per tier so overlap never darkens into a misleading shade.
            # Individual boundaries still handle all selection and hit testing.
            data["overviewFills"] = []
            higher = None
            for tier in ("grand_cru", "premier_cru"):
                ids = [f["denominationId"] for f in catalogue if f["kind"] == "vineyard" and f["tier"] == tier]
                if not ids:
                    continue
                full = unary_union([geometries[d] for d in ids])
                fill = full.difference(higher) if higher is not None else full
                assert abs(full.area - fill.area - (full.intersection(higher).area if higher is not None else 0)) < 0.001
                data["overviewFills"].append({"type": "Feature", "id": f"overview-{tier}",
                    "properties": {"id": f"overview-{tier}", "kind": "vineyard", "tier": tier},
                    "geometry": geometry_json(transform(to_wgs84, fill))})
                higher = unary_union([higher, full]) if higher is not None else full
        outputs.append((village, manifest, data))

    index = []
    for entry in targets.values():
        options = entry["villages"]
        chosen = options[0] if len(options) == 1 else config["sharedDefaults"][str(entry["denom"])]
        assert chosen in options
        index.append({**entry["target"], "villageId": chosen})
    # Validate everything before publishing any generated files.
    for village, manifest, geometry in outputs:
        destination = ROOT / "public" / manifest["dataUrl"].lstrip("/")
        write_json(destination, geometry, compact=True)
        write_json(PLACES / village["catalogueFile"], manifest)
        print(f"Built {village['id']}: {len(manifest['features'])} wine boundaries; {destination.stat().st_size:,} bytes")
    write_json(PLACES / "burgundyVillageMapRegistry.json", {
        "villages": [{k: v[k] for k in ("id", "name", "region", "wineColours") if k in v} for v in villages], "targets": index
    }, compact=True)


if __name__ == "__main__":
    main()
