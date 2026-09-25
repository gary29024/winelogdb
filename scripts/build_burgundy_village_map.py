"""Build the Gevrey pilot from pinned INAO and Cadastre Etalab source files.

Install scripts/burgundy-map-requirements.txt, then run from the repository root:
python scripts/build_burgundy_village_map.py --source-dir .tmp/burgundy-map
Downloads are deliberately separate; see docs/burgundy-village-map.md.
"""
import argparse
import gzip
import hashlib
import json
import re
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
GRANDS = {447, 448, 475, 477, 646, 666, 808, 809, 1086}


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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True)
    args = parser.parse_args()
    archive = args.source_dir / f"inao-{DATE}.zip"
    grand_links = read_json(ROOT / "src/lib/places/burgundyAtlasLinks.json")["entries"]
    premiers = next(g for g in read_json(ROOT / "src/lib/places/burgundyAtlasPremierCruLinks.json")["groups"] if g["appellation"] == "Gevrey-Chambertin")
    appellation = next(g for g in read_json(ROOT / "src/lib/places/burgundyAtlasAppellationLinks.json")["groups"] if g["appellation"] == "Gevrey-Chambertin")
    premier_links = {key(e["name"]): e["path"] for e in premiers["entries"]}
    features, catalogue = [], []
    with zipfile.ZipFile(archive) as z:
        # Only extract the exact, flat shapefile members (no arbitrary zip paths).
        stem = f"{DATE}_delim-parcellaire-aoc-shp"
        for suffix in ("shp", "shx", "dbf"):
            destination = args.source_dir / f"{stem}.{suffix}"
            if not destination.exists():
                with z.open(f"{stem}.{suffix}") as source, destination.open("wb") as target:
                    import shutil
                    shutil.copyfileobj(source, target)
        crs = CRS.from_wkt(z.read(f"{stem}.prj").decode())
        assert crs.to_epsg() == 2154
        to_wgs84 = Transformer.from_crs(crs, 4326, always_xy=True).transform
        grouped = {}
        reader = shapefile.Reader(str(args.source_dir / stem), encoding="utf-8")
        for record in reader.iterRecords():
            row = record.as_dict()
            if row["id_app"] == 182 or row["id_denom"] in GRANDS:
                grouped.setdefault(row["id_denom"], []).append((row, shape(reader.shape(record.oid).__geo_interface__)))
        assert set(grouped) == GRANDS | set(range(589, 617)), "Review changed source coverage"
        for denom_id, rows in sorted(grouped.items()):
            row = rows[0][0]
            assert all(r["denom"] == row["denom"] for r, _ in rows)
            geom_m = unary_union([geom for _, geom in rows])
            geom = transform(to_wgs84, geom_m)
            assert 4.9 < geom.bounds[0] < geom.bounds[2] < 5.05 and 47.1 < geom.bounds[1] < geom.bounds[3] < 47.3
            tier = "grand_cru" if denom_id in GRANDS else "village" if denom_id == 589 else "premier_cru"
            broad = denom_id in (589, 616)
            name = row["denom"].replace("Gevrey-Chambertin premier cru ", "")
            if broad:
                name = "Gevrey-Chambertin" + (" Premier Cru" if denom_id == 616 else "")
                atlas_path = appellation["premierCruPath" if denom_id == 616 else "villagePath"]
                match_id = atlas_path.split("/")[2]
            elif tier == "grand_cru":
                # Reviewed whole-name slug equality, never substring matching.
                entry = next(e for e in grand_links if key(e["url"].split("/")[-1]) == key(name))
                atlas_path = entry["url"].removeprefix("https://burgundyatlas.com")
                match_id = entry["placeId"]
            else:
                # INAO calls this "Clos Saint-Jacques"; Atlas uses "Le Clos Saint-Jacques".
                atlas_path = premier_links[key("Le Clos Saint-Jacques" if name == "Clos Saint-Jacques" else name)]
                match_id = atlas_path.split("/")[2]
            feature_id = f"inao-denom-{denom_id}"
            properties = {"id": feature_id, "name": name, "tier": tier, "kind": "appellation" if broad else "vineyard",
                          "appellationId": row["id_app"], "denominationId": denom_id, "sourceName": row["denom"],
                          "communes": sorted({r["insee"] for r, _ in rows}), "areaHa": round(geom_m.area / 10000, 2)}
            features.append({"type": "Feature", "id": feature_id, "properties": properties, "geometry": geometry_json(geom)})
            label_geom = max(geom.geoms, key=lambda part: part.area) if geom.geom_type == "MultiPolygon" else geom
            point = label_geom.representative_point()
            catalogue.append({**properties, "matchId": match_id, "atlasUrl": "https://burgundyatlas.com" + atlas_path,
                              "bounds": rounded(geom.bounds), "labelPoint": rounded([point.x, point.y])})
    vineyard_bounds = unary_union([shape(f["geometry"]) for f in features]).bounds
    sources = [{"name": "INAO", "date": DATE, "url": INAO_URL,
                "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(), "license": "Licence Ouverte"}]
    for code in ("21295", "21110"):
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
    output = {"type": "FeatureCollection", "features": features}
    # Geometry never joins the initial application bundle; it is fetched on demand.
    url = f"/maps/gevrey-chambertin.{DATE}.geojson"
    destination = ROOT / "public" / url.lstrip("/")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    manifest = {"id": "gevrey-chambertin", "name": "Gevrey-Chambertin", "dataUrl": url,
                "bounds": rounded(vineyard_bounds), "sources": sources, "features": catalogue}
    (ROOT / "src/lib/places/burgundyVillageMapCatalogue.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Built {len(catalogue)} wine boundaries and 2 communes; {destination.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
