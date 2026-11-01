"""Prepare Irish census context with complete GUID joins and source-native classes.

Defaults to staged assets. --install updates the local context catalogue only
after all joins, geometry checks and indexed lookup canaries have passed.
"""
import argparse
import fcntl
import json
import math
import base64
import urllib.parse
from pathlib import Path

from shapely import make_valid, union_all
from shapely.geometry import shape, mapping, Polygon
from prepare_europe_sources import Acquisition, ED_SERVICE, prepare_ireland
from prepare_context import publish
from sources import write_json, sha256

POBAL_CLASSES = [
    ("Extremely disadvantaged", "#9E3A64"),
    ("Very disadvantaged", "#B95778"),
    ("Disadvantaged", "#CE7891"),
    ("Marginally below average", "#E7BCC5"),
    ("Marginally above average", "#BCCBDC"),
    ("Affluent", "#6084AB"),
    ("Very affluent", "#416A98"),
    ("Extremely affluent", "#234C79"),
]


def esri_polygon(rings):
    """Esri's documented even-odd fill rule preserves holes and nested islands.
    https://developers.arcgis.com/rest/services-reference/enterprise/geometry-objects/
    """
    polygon = Polygon()
    for ring in rings:
        if len(ring) < 4 or ring[0] != ring[-1]:
            raise ValueError("Unclosed ArcGIS polygon ring")
        polygon = polygon.symmetric_difference(make_valid(Polygon(ring)))
    return mapping(polygon)


def irish_boundaries(acquire, expected):
    query = urllib.parse.urlencode({"where": "1=1", "returnIdsOnly": "true", "f": "json"})
    inventory = json.loads(acquire.get("ed-geometry-ids.json", ED_SERVICE + "/query?" + query,
                                     publisher="Tailte Éireann").read_text())
    ids = inventory.get("objectIds", [])
    if len(ids) != expected or len(set(ids)) != expected:
        raise ValueError("Boundary object inventory does not match census coverage")
    boundaries = {}
    ids.sort()
    for offset in range(0, len(ids), 100):
        batch = ids[offset:offset + 100]
        query = urllib.parse.urlencode({"objectIds": ",".join(map(str, batch)),
            "outFields": "OBJECTID,ED_GUID,ED_ID_STR,ED_ENGLISH", "outSR": 4326,
            "returnGeometry": "true", "f": "geojson"})
        text = acquire.get(f"ed-full-{offset}.geojson", ED_SERVICE + "/query?" + query,
                           max_mb=64, publisher="Tailte Éireann").read_text()
        try:
            raw = json.loads(text)
            if {f["properties"]["OBJECTID"] for f in raw.get("features", [])} != set(batch) or raw.get("exceededTransferLimit"):
                raise ValueError("GeoJSON exporter omitted requested features")
        except (json.JSONDecodeError, ValueError):
            # Some service features have malformed GeoJSON nesting. Read the
            # same IDs as native rings, never patch a broken coordinate string.
            native_query = query.replace("f=geojson", "f=json")
            raw = json.loads(acquire.get(f"ed-rings-{offset}.json", ED_SERVICE + "/query?" + native_query,
                                         max_mb=64, publisher="Tailte Éireann").read_text())
            if raw.get("spatialReference", {}).get("wkid") != 4326:
                raise ValueError("Unexpected native boundary CRS")
            raw["features"] = [{"type": "Feature", "properties": f["attributes"],
                                "geometry": esri_polygon(f["geometry"]["rings"])} for f in raw["features"]]
        features = raw.get("features", [])
        if raw.get("exceededTransferLimit") or {f["properties"]["OBJECTID"] for f in features} != set(batch):
            raise ValueError("Truncated or shifted boundary page")
        for feature in features:
            guid = feature["properties"]["ED_GUID"].lower()
            if guid in boundaries:
                raise ValueError("Duplicate boundary GUID")
            polygon = make_valid(shape(feature["geometry"]))
            if polygon.geom_type == "GeometryCollection":
                polygon = union_all([p for p in polygon.geoms if p.geom_type in {"Polygon", "MultiPolygon"}])
            if polygon.is_empty or polygon.geom_type not in {"Polygon", "MultiPolygon"}:
                raise ValueError("Invalid electoral-division polygon")
            west, south, east, north = polygon.bounds
            if not (-11 < west < east < -5 and 51 < south < north < 56):
                raise ValueError("Boundary outside Ireland or incorrect CRS")
            boundaries[guid] = polygon
        print(json.dumps({"stage": "irish-boundaries", "areas": len(boundaries)}), flush=True)
    return boundaries


def join_irish_context(observations, boundaries):
    areas = observations["areas"]
    if set(boundaries) != {r["code"] for r in areas}:
        raise ValueError("Boundary and census GUID coverage differ")
    cars, deprivation, seen = [], [], set()
    for row in areas:
        if row["households"] <= 0 or not 0 <= row["withoutCar"] + row["notStated"] <= row["households"]:
            raise ValueError("Invalid car availability denominator")
        cars.append({"type": "Feature", "geometry": mapping(boundaries[row["code"]]),
                     "properties": {**row, "value": row["withoutCarPercent"]}})
    labels = {label.casefold(): i + 1 for i, (label, _) in enumerate(POBAL_CLASSES)}
    for group in observations["deprivationGroups"]:
        members = group["memberGuids"]
        if not members or seen.intersection(members) or len(set(members)) != len(members):
            raise ValueError("Deprivation groups overlap or are empty")
        seen.update(members)
        source = group["deprivation"]
        if source is None or source["population"] != group["population"]:
            raise ValueError("Unreconciled deprivation population")
        category = source["category"].strip().casefold()
        if category not in labels:
            raise ValueError(f"Unknown published Pobal category: {category}")
        polygon = union_all([boundaries[guid] for guid in members])
        deprivation.append({"type": "Feature", "geometry": mapping(polygon), "properties": {
            "code": group["sourceCode"], "name": source["name"], "value": labels[category],
            "category": POBAL_CLASSES[labels[category] - 1][0], "relativeScore": source["relativeScore"],
            "population": group["population"], "memberGuids": members}})
    if seen != set(boundaries):
        raise ValueError("Deprivation groups do not partition the census areas")
    return cars, deprivation


def prepare(root, offline=False):
    acquire = Acquisition(root / "europe-staging/ireland", offline=offline)
    readiness = prepare_ireland(acquire)
    if any(readiness[k] for k in ["missingDeprivation", "populationMismatches", "unmatchedPobalCodes"]):
        raise ValueError("Irish source reconciliation is incomplete")
    observations = json.loads((acquire.root / "observations.json").read_text())
    boundaries = irish_boundaries(acquire, len(observations["areas"]))
    cars, deprivation = join_irish_context(observations, boundaries)
    source_manifest = acquire.root / "context-sources.json"
    write_json(source_manifest, acquire.inputs)
    common = {"country": "IE", "name": "Ireland", "year": 2022,
        "boundary": "CSO statistical electoral divisions 2022 · Tailte Éireann",
        "licence": "CC BY 4.0", "sourceManifestSha256": sha256(source_manifest)}
    car_meta = {**common, "theme": "carAccess", "edition": "CSO Census 2022 · motor car availability",
        "areaCount": len(cars), "source": "Central Statistics Office · Tailte Éireann",
        "sourceUrl": "https://www.cso.ie/en/census/census2022/census2022smallareapopulationstatistics/",
        "attribution": "Contains CSO Census 2022 statistics and Tailte Éireann boundaries, CC BY 4.0.",
        "note": "Households with no motor car as a percentage of all households. Not-stated responses remain in the denominator and are retained separately; they are not treated as car ownership."}
    deprivation_meta = {**common, "theme": "deprivation", "edition": "Pobal HP 2022 · published ED categories",
        "areaCount": len(deprivation), "source": "Pobal · Haase and Pratschke · Tailte Éireann",
        "sourceUrl": "https://data.gov.ie/dataset/pobal-hp-deprivation-index-scores-2022",
        "attribution": "Pobal HP Deprivation Index 2022, Haase and Pratschke; Tailte Éireann boundaries, CC BY 4.0.",
        "classification": "source-categories",
        "categories": [{"value": i + 1, "label": label, "color": color} for i, (label, color) in enumerate(POBAL_CLASSES)],
        "note": "Published Pobal HP categories and relative scores, not deciles or UK-equivalent deprivation. Three split census divisions are unioned into their official Pobal reporting unit; population is counted once."}
    releases = [publish(root, car_meta, cars), publish(root, deprivation_meta, deprivation)]
    # Publish simplifies display features in place; full boundaries remain in source snapshots.
    write_json(acquire.root / "context-release.json", {"releases": releases, "national": readiness["national"]})
    return releases


def install(root, releases):
    from context_layers import point, tile
    from rasterio.io import MemoryFile
    for release in releases:
        lng, lat = (-6.2603, 53.3498) if release["country"] == "IE" else (12.4964, 41.9028)
        result = point(root, release, lng, lat)
        if release["theme"] == "population":
            if result.get("density") is None or result["density"] <= 0:
                raise ValueError("Population lookup canary failed")
        elif not result.get("area"):
            raise ValueError("Context area lookup canary failed")
        if release["theme"] == "administrative":
            if (root / release["file"]).stat().st_size > 2_800_000:
                raise ValueError("Administrative display geometry exceeds API budget")
            continue
        z = 7
        x = int((lng + 180) / 360 * 2 ** z)
        y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 2 ** z)
        png = tile(root, release, z, x, y)["png"]
        with MemoryFile(base64.b64decode(png)) as memory, memory.open() as image:
            if not (image.read(4) > 0).any():
                raise ValueError("Context tile canary is entirely transparent")
    path = root / "context/catalogue.json"
    with (root / "context/catalogue.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        current = json.loads(path.read_text())["releases"] if path.exists() else []
        keys = {(r["theme"], r["country"], r.get("level")) for r in releases}
        write_json(path, {"schemaVersion": 1, "releases": [r for r in current if
            (r["theme"], r["country"], r.get("level")) not in keys] + releases})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("data"))
    parser.add_argument("--offline", action="store_true")
    parser.add_argument("--install", action="store_true")
    parser.add_argument("--population", choices=["ireland", "italy"])
    args = parser.parse_args()
    root = args.root.resolve()
    (root / "context").mkdir(parents=True, exist_ok=True)
    with (root / "context/.ireland-prepare-lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if args.population:
            from prepare import prepare_population
            from prepare_context import population
            profile = json.loads((Path(__file__).parent / f"profiles/{args.population}.json").read_text())
            manifest = root / f"releases/{profile['population']['id']}-{profile['id']}-v1/population.json"
            if not manifest.exists():
                raise ValueError("Prepare the population surface with prepare.py first")
            entry = prepare_population(root, profile)  # Verify hash, edition and extent.
            releases = [population(root, profile["country"], entry, profile["population"]["bounds"], args.population.title())]
        else:
            releases = prepare(root, args.offline)
        if args.install:
            install(root, releases)
    print(json.dumps({"installed": args.install, "releases": [r["id"] for r in releases]}))


if __name__ == "__main__":
    main()
