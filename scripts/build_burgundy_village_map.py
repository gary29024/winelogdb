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
        premiers = next(g for g in premier_groups if g["appellation"] == name)
        appellation = next(g for g in appellations if g["appellation"] == name)
        premier_links = {key(e["name"]): e["path"] for e in premiers["entries"]}
        first, last = village["premierRange"]
        expected_app = {village["villageDenomination"], village["premierDenomination"]} | set(range(first, last + 1))
        actual_app = {d for d, rows in grouped.items() if rows[0][0]["id_app"] == village["appellationId"]}
        assert actual_app == expected_app, f"Review changed source coverage for {name}"
        denominations = set(village["grands"]) | expected_app
        assert denominations <= grouped.keys(), f"Missing Grand Cru geometry for {name}"
        features, catalogue = [], []
        for denom_id in sorted(denominations):
            rows = grouped[denom_id]
            row = rows[0][0]
            assert all(r["denom"] == row["denom"] and r["id_app"] == row["id_app"] for r, _ in rows)
            geom_m = geometries[denom_id]
            geom = transform(to_wgs84, geom_m)
            assert 4.9 < geom.bounds[0] < geom.bounds[2] < 5.05 and 47.1 < geom.bounds[1] < geom.bounds[3] < 47.3
            tier = "grand_cru" if denom_id in village["grands"] else "village" if denom_id == village["villageDenomination"] else "premier_cru"
            broad = denom_id in (village["villageDenomination"], village["premierDenomination"])
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
            feature_id = f"inao-denom-{denom_id}"
            properties = {"id": feature_id, "name": feature_name, "tier": tier, "kind": "appellation" if broad else "vineyard",
                          "appellationId": row["id_app"], "denominationId": denom_id, "sourceName": row["denom"],
                          "communes": sorted({r["insee"] for r, _ in rows}), "areaHa": round(geom_m.area / 10000, 2)}
            assert set(properties["communes"]) <= {c["id"] for c in village["communes"]}
            features.append({"type": "Feature", "id": feature_id, "properties": properties, "geometry": geometry_json(geom)})
            label_geom = max(geom.geoms, key=lambda part: part.area) if geom.geom_type == "MultiPolygon" else geom
            point = label_geom.representative_point()
            catalogue.append({**properties, "matchId": match_id, "atlasUrl": "https://burgundyatlas.com" + atlas_path,
                              "bounds": rounded(geom.bounds), "labelPoint": rounded([point.x, point.y])})
            target = {"matchId": match_id, "featureId": feature_id, "name": feature_name, "scope": properties["kind"]}
            if match_id in targets:
                assert targets[match_id]["target"] == target, "A shared identity must refer to the same designation"
                targets[match_id]["villages"].append(village["id"])
            else:
                targets[match_id] = {"target": target, "villages": [village["id"]], "denom": denom_id}

        by_id = {f["id"]: f for f in catalogue}
        for feature_id, note in village["notes"].items():
            assert feature_id in by_id
            if cover_id := note.get("paintedBy"):
                assert cover_id in by_id and by_id[cover_id]["tier"] == by_id[feature_id]["tier"]
                assert not village["notes"].get(cover_id, {}).get("paintedBy")
                uncovered = geometries[by_id[feature_id]["denominationId"]].difference(geometries[by_id[cover_id]["denominationId"]])
                assert uncovered.area < 1, "Only suppress a fill actually covered by another designation"
        vineyard_bounds = unary_union([shape(f["geometry"]) for f in features]).bounds
        sources = [{"name": "INAO", "date": DATE, "url": INAO_URL, "sha256": source_hash, "license": "Licence Ouverte"}]
        for commune in village["communes"]:
            code = commune["id"]
            file = args.source_dir / f"commune-{code}.json.gz"
            data = json.loads(gzip.decompress(file.read_bytes()))
            assert len(data["features"]) == 1 and data["features"][0]["properties"]["id"] == code
            source = data["features"][0]
            features.append({"type": "Feature", "id": f"commune-{code}",
                             "properties": {"id": f"commune-{code}", "name": source["properties"]["nom"], "kind": "commune", "tier": "commune"},
                             "geometry": geometry_json(shape(source["geometry"]))})
            sources.append({"name": "Cadastre Etalab", "date": CADASTRE_DATE, "license": "Licence Ouverte 2.0",
                            "url": f"https://cadastre.data.gouv.fr/data/etalab-cadastre/{CADASTRE_DATE}/geojson/communes/21/{code}/cadastre-{code}-communes.json.gz",
                            "sha256": hashlib.sha256(file.read_bytes()).hexdigest()})
        url = f"/maps/{village['id']}.{DATE}.geojson"
        manifest = {"id": village["id"], "name": name, "region": village["region"], "communes": village["communes"],
                    "dataUrl": url, "bounds": rounded(vineyard_bounds), "sources": sources, "notes": village["notes"], "features": catalogue}
        outputs.append((village, manifest, {"type": "FeatureCollection", "features": features}))

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
        "villages": [{k: v[k] for k in ("id", "name", "region")} for v in villages], "targets": index
    }, compact=True)


if __name__ == "__main__":
    main()
