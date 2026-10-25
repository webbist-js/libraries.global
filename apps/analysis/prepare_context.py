"""Finite context ingest. Validate complete code joins before atomic publication.

Raw downloads and prepared assets live in ignored data/context. No Library rows,
database schema or Reach source rasters are changed by these commands.
"""
import argparse
from contextlib import closing
import fcntl
import os
import csv
import io
import json
import math
import re
import shutil
import sqlite3
import time
import urllib.parse
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import rasterio
from rasterio.enums import Resampling
from shapely import geometry, make_valid, union_all
from shapely.ops import transform
from pyproj import Transformer, CRS, Geod
from sources import download, sha256, write_json
from context_layers import bounds_dict

ONS = "https://services-eu1.arcgis.com/6BsumkdKnml1ntNV/arcgis/rest/services/2021_LSOA_Boundary/FeatureServer/2"
SCOTLAND = "https://maps.gov.scot/server/rest/services/ScotGov/PeopleSociety/MapServer/7"
ENGLAND_BOOK = "https://assets.publishing.service.gov.uk/media/691dece32c6b98ecdbc500d5/File_1_IoD2025_Index_of_Multiple_Deprivation.xlsx"
WALES = "https://datamap.gov.wales/geoserver/ows?service=WFS&version=1.0.0&request=GetFeature&typename=geonode:wimd2025_overall&outputFormat=json&srsName=EPSG:4326"
NI_BOOK = "https://www.nisra.gov.uk/files/nisra/publications/NIMDM17_SOAresults.xls"
CAR = "https://www.nomisweb.co.uk/output/census/2021/census2021-ts045.zip"


def acquire(root, name, url, max_bytes=128 * 1024 ** 2):
    target = root / "context/sources" / name
    info = download(url, target, max_bytes)
    return target, info


def arcgis(root, name, url, fields, where="1=1"):
    # Stable code ordering and bounded, replayable pages; truncation is an error.
    features, offset = [], 0
    while True:
        query = urllib.parse.urlencode({"f": "geojson", "where": where, "outFields": fields,
                                       "outSR": 4326, "orderByFields": fields.split(",")[0],
                                       "resultOffset": offset, "resultRecordCount": 1000,
                                       "geometryPrecision": 6})
        path, _ = acquire(root, f"{name}-{offset}.json", url + "/query?" + query, 32 * 1024 ** 2)
        page = json.loads(path.read_text())
        if "features" not in page:
            raise ValueError(f"Invalid source page: {name}")
        features.extend(page["features"])
        print(json.dumps({"stage": name, "areas": len(features)}), flush=True)
        if len(features) > 40000:
            raise ValueError("Source exceeds area budget")
        if not page.get("exceededTransferLimit") and len(page["features"]) < 1000:
            break
        if not page["features"]:
            break
        offset += len(page["features"])
    return features


def xlsx_rows(path):
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(path) as book:
        strings = []
        if "xl/sharedStrings.xml" in book.namelist():
            strings = ["".join(n.itertext()) for n in ET.fromstring(book.read("xl/sharedStrings.xml")).findall("m:si", ns)]
        for name in book.namelist():
            if not re.fullmatch(r"xl/worksheets/sheet\d+.xml", name):
                continue
            for row in ET.fromstring(book.read(name)).findall(".//m:row", ns):
                values = []
                for cell in row.findall("m:c", ns):
                    column = re.match(r"[A-Z]+", cell.attrib["r"])[0]
                    index = 0
                    for c in column:
                        index = index * 26 + ord(c) - 64
                    while len(values) < index:
                        values.append("")
                    value = cell.find("m:v", ns)
                    text = value.text if value is not None else "".join(cell.find("m:is", ns).itertext()) if cell.find("m:is", ns) is not None else ""
                    values[index - 1] = strings[int(text)] if cell.attrib.get("t") == "s" else text
                yield values


def publish(root, meta, features):
    if not features or len(features) != meta["areaCount"]:
        raise ValueError(f"Incomplete {meta['edition']} area coverage: {len(features)}")
    codes = [f["properties"]["code"] for f in features]
    if len(set(codes)) != len(codes):
        raise ValueError("Duplicate context codes")
    shapes = []
    for feature in features:
        p = feature["properties"]
        if not p["name"] or not isinstance(p.get("value"), (int, float)) or not math.isfinite(p["value"]):
            raise ValueError("Missing context value")
        if meta["theme"] == "deprivation" and (not 1 <= p["value"] <= 10 or not 1 <= p["rank"] <= len(features)):
            raise ValueError("Invalid national rank or decile")
        shape = make_valid(geometry.shape(feature["geometry"]))
        if shape.geom_type == "GeometryCollection":
            # Repair can leave zero-area boundary spurs. Retain every polygon.
            shape = union_all([part for part in shape.geoms if part.geom_type in {"Polygon", "MultiPolygon"}])
        if shape.is_empty or shape.geom_type not in {"Polygon", "MultiPolygon"}:
            raise ValueError("Invalid context polygon")
        # Keep full source snapshots for future analysis; this asset is for map
        # display and area lookup only. Five-metre simplification avoids loading
        # millions of coastal vertices into each live context process.
        display = shape if meta["theme"] == "administrative" else shape.simplify(0.00005, preserve_topology=True)
        feature["geometry"] = geometry.mapping(display)
        shapes.append(shape)
    bounds = (min(s.bounds[0] for s in shapes), min(s.bounds[1] for s in shapes),
              max(s.bounds[2] for s in shapes), max(s.bounds[3] for s in shapes))
    value = {"type": "FeatureCollection", "features": features}
    temporary = root / f"context/staged-{os.getpid()}.json"
    write_json(temporary, value)
    version = sha256(temporary)[:16]
    file = f"context/releases/{meta['theme']}-{meta['country'].lower()}-{version}.geojson"
    target = root / file
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary.replace(target)
    return {**meta, "id": f"{meta['theme'].lower()}-{meta['country'].lower()}-{version}",
            "file": file, **({"lookup": build_lookup(root, file, features)} if meta["theme"] != "administrative" else {}),
            "bounds": bounds_dict(bounds), "retrievedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}


def build_lookup(root, file, features=None):
    relative = str(Path(file).with_suffix(".sqlite"))
    target = root / relative
    if target.exists():
        return relative
    if features is None:
        features = json.loads((root / file).read_text())["features"]
    temporary = target.with_suffix(f".{os.getpid()}.tmp")
    temporary.unlink(missing_ok=True)
    with closing(sqlite3.connect(temporary)) as db, db:
        db.execute("CREATE TABLE areas (id INTEGER PRIMARY KEY, code TEXT UNIQUE, name TEXT, search TEXT, properties TEXT, geometry BLOB)")
        db.execute("CREATE VIRTUAL TABLE bounds USING rtree (id, west, east, south, north)")
        for index, feature in enumerate(features):
            shape = geometry.shape(feature["geometry"])
            p = feature["properties"]
            bounds = shape.bounds
            properties = {**p, "bounds": bounds_dict(bounds)}
            db.execute("INSERT INTO areas VALUES (?, ?, ?, ?, ?, ?)", (index, p["code"], p["name"], (p["name"] + " " + p["code"]).casefold(), json.dumps(properties), shape.wkb))
            db.execute("INSERT INTO bounds VALUES (?, ?, ?, ?, ?)", (index, bounds[0], bounds[2], bounds[1], bounds[3]))
        db.commit()
        if db.execute("SELECT count(*) FROM areas").fetchone()[0] != len(features):
            raise ValueError("Incomplete context spatial index")
    temporary.replace(target)
    return relative


def normalized(features, code, name, value, rank=None):
    return [{"type": "Feature", "geometry": f["geometry"], "properties": {
        "code": str(f["properties"][code]), "name": str(f["properties"][name]),
        "value": float(f["properties"][value]),
        **({"rank": int(f["properties"][rank])} if rank else {}),
    }} for f in features]


def deprivation_source(root, nation):
    common = {"theme": "deprivation", "licence": "Open Government Licence v3.0",
              "note": "Rank 1 is the most deprived area within this nation and edition. Deciles group areas, not residents. Indices from different nations or editions are not directly comparable. Area characteristics do not describe every resident. Display boundaries are simplified; point lookups close to a boundary are approximate."}
    if nation == "wales":
        path, _ = acquire(root, "wimd2025.json", WALES)
        features = normalized(json.loads(path.read_text())["features"], "lsoa", "lsoa_name_en", "decile", "rank")
        meta = {"country": "GB-WLS", "name": "Wales", "year": 2025, "edition": "WIMD 2025", "boundary": "2021 LSOAs", "areaCount": 1917,
                "source": "Welsh Government", "sourceUrl": "https://datamap.gov.wales/layers/geonode:wimd2025_overall", "attribution": "© Welsh Government. Contains OS data © Crown copyright and database right 2026."}
    elif nation == "scotland":
        data = arcgis(root, "simd2020v2", SCOTLAND, "datazone,dzname,rankv2,decilev2")
        features = normalized(data, "datazone", "dzname", "decilev2", "rankv2")
        meta = {"country": "GB-SCT", "name": "Scotland", "year": 2020, "edition": "SIMD 2020v2", "boundary": "2011 Data Zones", "areaCount": 6976,
                "source": "Scottish Government", "sourceUrl": "https://www.gov.scot/collections/scottish-index-of-multiple-deprivation-2020/", "attribution": "Copyright Scottish Government. Contains Ordnance Survey data © Crown copyright and database right 2026."}
    elif nation == "england":
        book, _ = acquire(root, "imd2025-corrected.xlsx", ENGLAND_BOOK, 8 * 1024 ** 2)
        rows = {}
        for row in xlsx_rows(book):
            if row and re.fullmatch(r"E01\d{6}", str(row[0])):
                # File 1: LSOA code/name, LAD code/name, IMD rank and decile.
                rows[row[0]] = {"code": row[0], "name": row[1], "rank": int(row[4]), "value": int(row[5])}
        if len(rows) != 33755:
            raise ValueError(f"Incomplete IMD workbook {len(rows)}")
        boundaries = arcgis(root, "lsoa2021-england", ONS, "CODE,NAME", "CODE LIKE 'E%'")
        if set(rows) != {f["properties"]["CODE"] for f in boundaries}:
            raise ValueError("IMD and 2021 LSOA boundary codes disagree")
        features = [{"type": "Feature", "geometry": f["geometry"], "properties": rows[f["properties"]["CODE"]]} for f in boundaries]
        meta = {"country": "GB-ENG", "name": "England", "year": 2025, "edition": "IMD 2025 · corrected workbook", "boundary": "2021 LSOAs · ONS generalised clipped", "areaCount": 33755,
                "source": "MHCLG · Office for National Statistics", "sourceUrl": "https://www.gov.uk/government/statistics/english-indices-of-deprivation-2025", "attribution": "Contains National Statistics data © Crown copyright and database right 2026. Contains OS data © Crown copyright and database right 2026."}
    elif nation == "ni":
        import shapefile
        import xlrd
        book, _ = acquire(root, "nimdm2017.xls", NI_BOOK, 4 * 1024 ** 2)
        archive, _ = acquire(root, "ni-boundaries.zip", "https://www.nisra.gov.uk/files/nisra/publications/SOA2011_Esri_Shapefile_0.zip", 32 * 1024 ** 2)
        sheet = xlrd.open_workbook(book).sheet_by_name("MDM")
        rows = {sheet.cell_value(i, 2): {"code": sheet.cell_value(i, 2), "name": sheet.cell_value(i, 3).replace("_", " "), "rank": int(sheet.cell_value(i, 4)), "value": math.ceil(int(sheet.cell_value(i, 4)) / 89)} for i in range(1, sheet.nrows)}
        with zipfile.ZipFile(archive) as zipped:
            reader = shapefile.Reader(shp=io.BytesIO(zipped.read("SOA2011.shp")), dbf=io.BytesIO(zipped.read("SOA2011.dbf")))
            to_wgs = Transformer.from_crs(CRS.from_wkt(zipped.read("SOA2011.prj").decode()), 4326, always_xy=True)
            features = [{"type": "Feature", "properties": rows[r.record["SOA_CODE"]], "geometry": geometry.mapping(transform(to_wgs.transform, geometry.shape(r.shape.__geo_interface__)))} for r in reader.iterShapeRecords()]
        if set(rows) != {f["properties"]["code"] for f in features}:
            raise ValueError("NIMDM and 2011 SOA codes disagree")
        meta = {"country": "GB-NIR", "name": "Northern Ireland", "year": 2017, "edition": "NIMDM 2017", "boundary": "2011 SOAs", "areaCount": 890,
                "source": "Northern Ireland Statistics and Research Agency", "sourceUrl": "https://www.nisra.gov.uk/statistics/deprivation-and-poverty/northern-ireland-multiple-deprivation-measure-2017-nimdm2017", "attribution": "Contains NISRA data © Crown copyright and database right 2026. Deciles derived from national ranks (89 SOAs per decile)."}
    else:
        raise ValueError("Unknown nation")
    return {**common, **meta}, features


def deprivation(root, nation):
    meta, features = deprivation_source(root, nation)
    return publish(root, meta, features)


def population(root):
    # Copy for overviews: preserve the immutable raster used by Reach.
    active = json.loads((root / "active.json").read_text())
    entries = active if isinstance(active, list) else active["releases"]
    entry = next(r for r in entries if r.get("profile") == "uk" or "GB-ENG" in r.get("countries", []))
    if len(entry["populationFiles"]) != 1:
        raise ValueError("Context preparation expects a single installed population surface")
    source = root / entry["populationFiles"][0]
    version = sha256(source)[:16]
    relative = f"context/releases/ghsl-2020-{version}.tif"
    target = root / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        temporary = target.with_suffix(".part.tif")
        shutil.copyfile(source, temporary)
        with rasterio.open(temporary, "r+") as dataset:
            dataset.build_overviews([2, 4, 8, 16, 32, 64], Resampling.average)
            dataset.update_tags(ns="rio_overview", resampling="average")
        temporary.replace(target)
    return {"id": f"population-gb-{version}", "theme": "population", "country": "GB", "name": "United Kingdom",
            "edition": "GHS-POP 2020 · R2023A", "year": 2020, "boundary": "100 m equal-area population cells", "raster": relative,
            "source": "European Commission · Joint Research Centre", "sourceUrl": "https://human-settlement.emergency.copernicus.eu/ghs_pop2023.php", "licence": "CC BY 4.0",
            "attribution": "European Commission, Joint Research Centre (JRC), GHS-POP R2023A, 2020.",
            "bounds": bounds_dict((-9, 49, 3, 61)), "note": "Modelled residents on a 100 m equal-area grid for 2020. Zoomed-out tiles average cells for display. Reach counts residents from the original grid; newer official area totals are a separate measure. Transparent cells have no data."}


def cars(root, existing):
    path, _ = acquire(root, "census2021-ts045.zip", CAR, 64 * 1024 ** 2)
    rows = {}
    with zipfile.ZipFile(path) as archive:
        name = next(n for n in archive.namelist() if n.lower().endswith("ts045-lsoa.csv"))
        with archive.open(name) as source:
            for row in csv.DictReader(io.TextIOWrapper(source, encoding="utf-8-sig")):
                code = row["geography code"]
                total = int(row["Number of cars or vans: Total: All households"])
                without = int(row["Number of cars or vans: No cars or vans in household"])
                if total <= 0 or not 0 <= without <= total:
                    raise ValueError("Invalid household counts")
                rows[code] = {"households": total, "withoutCar": without, "value": without * 100 / total}
    results = []
    for country in ["GB-ENG", "GB-WLS"]:
        boundary = next(r for r in existing if r["theme"] == "deprivation" and r["country"] == country)
        features = json.loads((root / boundary["file"]).read_text())["features"]
        if any(f["properties"]["code"] not in rows for f in features):
            raise ValueError("Census and LSOA codes disagree")
        for f in features:
            p = f["properties"]
            f["properties"] = {"code": p["code"], "name": p["name"], **rows[p["code"]]}
        meta = {**{k: boundary[k] for k in ["country", "name", "bounds", "areaCount", "boundary", "licence", "attribution"]},
                "theme": "carAccess", "year": 2021, "edition": "Census 2021 · TS045", "source": "Office for National Statistics · Nomis",
                "sourceUrl": "https://www.nomisweb.co.uk/datasets/c2021ts045",
                "note": "Share of households with no car or van available in March 2021. This describes households, not residents or current transport access. Student and other communal establishments are outside the household denominator."}
        results.append(publish(root, meta, features))
    return results


def administrative(root, country, observations):
    data = json.loads(observations.read_text())
    if data["country"] != country or len(data["observations"]) > 4096:
        raise ValueError("Invalid geographic observation snapshot")
    observations = data["observations"]
    vintages = {r["boundaryVersion"] for r in observations if r["level"] in {"area", "region"}}
    if len(vintages) != 1:
        raise ValueError("Mixed population boundary vintages")
    vintage = vintages.pop().replace("statfin-", "")
    geod = Geod(ellps="WGS84")
    results = []
    for level, observation_level in [("local", "area"), ("regions", "region")]:
        rows = {r["reportingCode"]: r for r in observations if r["level"] == observation_level}
        if not rows:
            continue
        if country == "SE":
            if vintage != "2025-01-01":
                raise ValueError("SCB RegSO profile requires 2025 boundaries")
            url = "https://geodata.scb.se/geoserver/stat/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=stat:RegSO_2025&outputFormat=application/json&srsName=EPSG:4326&maxFeatures=10000"
            path, _ = acquire(root, "scb-regso2025.json", url)
            raw = json.loads(path.read_text())
            features = raw["features"]
            if raw.get("totalFeatures") != len(features):
                raise ValueError("Truncated SCB boundaries")
            groups = {}
            for f in features:
                code = f["properties"]["kommunkod" if level == "local" else "lanskod"]
                groups.setdefault(code, []).append(make_valid(geometry.shape(f["geometry"])))
            shapes = {code: union_all(parts) for code, parts in groups.items()}
            source, licence = "Statistics Sweden · RegSO 2025", "CC0 1.0"
            source_url = "https://www.scb.se/vara-tjanster/oppna-data/oppna-geodata/regso/"
        else:
            if not re.fullmatch(r"202[5-6]0101", vintage):
                raise ValueError("Unsupported Statistics Finland boundary edition")
            prefix = "kunta" if level == "local" else "seutukunta" if country == "AX" else "maakunta"
            url = f"https://geo.stat.fi/geoserver/tilastointialueet/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=tilastointialueet:{prefix}1000k_{vintage[:4]}&outputFormat=application/json&srsName=EPSG:4326&maxFeatures=1000"
            path, _ = acquire(root, f"statfin-{prefix}-{vintage}.json", url)
            raw = json.loads(path.read_text())
            if raw.get("totalFeatures") != len(raw["features"]):
                raise ValueError("Truncated Statistics Finland boundaries")
            code_prefix = "KU" if level == "local" else "SK" if country == "AX" else "MK"
            shapes = {code_prefix + f["properties"][prefix]: make_valid(geometry.shape(f["geometry"])) for f in raw["features"]}
            shapes = {code: shape for code, shape in shapes.items() if code in rows}
            source, licence = "Statistics Finland · statistical areas", "CC BY 4.0"
            source_url = "https://stat.fi/en/services/statistical-data-services/open-data-and-interfaces/interface-use-of-geographic-data"
        if set(shapes) != set(rows):
            raise ValueError(f"Boundary/observation code mismatch: {country} {level}")
        features = []
        for code, shape in shapes.items():
            if shape.geom_type == "GeometryCollection":
                shape = union_all([p for p in shape.geoms if p.geom_type in {"Polygon", "MultiPolygon"}])
            area_km2 = abs(geod.geometry_area_perimeter(shape)[0]) / 1e6
            # Browser geometry only. Calculate area from the source before display simplification.
            features.append({"type": "Feature", "geometry": geometry.mapping(shape.simplify(0.001, preserve_topology=True)), "properties": {
                "code": code, "name": rows[code]["name"], "value": 0, "areaKm2": area_km2, "bounds": bounds_dict(shape.bounds)}})
        meta = {"theme": "administrative", "country": country, "level": level, "name": {"SE": "Sweden", "FI": "Finland", "AX": "Åland"}[country],
                "year": max(r["year"] for r in rows.values()), "edition": f"{source} · {vintage}", "boundary": f"{vintage} statistical boundaries", "boundaryDate": vintage,
                "source": source, "sourceUrl": source_url, "licence": licence, "attribution": source,
                "areaCount": len(features), "note": "Ellipsoidal whole-boundary area, including inland waters, measured before display simplification. Statistical boundaries support thematic comparisons; they are not cadastral boundaries or precise site analysis."}
        results.append(publish(root, meta, features))
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["population", "england", "wales", "scotland", "ni", "cars", "sweden", "finland", "aland", "index"])
    parser.add_argument("--root", type=Path, default=Path("data"))
    parser.add_argument("--observations", type=Path, help="Country observation snapshot from the private local geographic bridge")
    args = parser.parse_args()
    root = args.root.resolve()
    catalogue = root / "context/catalogue.json"
    previous = json.loads(catalogue.read_text())["releases"] if catalogue.exists() else []
    if args.command == "index":
        new = [{**r, "lookup": build_lookup(root, r["file"])} for r in previous if r["theme"] in {"deprivation", "carAccess"}]
    elif args.command in {"sweden", "finland", "aland"}:
        if not args.observations:
            raise ValueError("An observation snapshot is required for a complete code/vintage join")
        new = administrative(root, {"sweden": "SE", "finland": "FI", "aland": "AX"}[args.command], args.observations)
    else:
        new = cars(root, previous) if args.command == "cars" else [population(root) if args.command == "population" else deprivation(root, args.command)]
    # A failed download, code mismatch or invalid geometry leaves the old release active.
    keys = {(r["theme"], r["country"], r.get("level")) for r in new}
    with (root / "context/catalogue.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        # Another finite preparation may have finished while sources downloaded.
        current = json.loads(catalogue.read_text())["releases"] if catalogue.exists() else []
        combined = [r for r in current if (r["theme"], r["country"], r.get("level")) not in keys] + new
        write_json(catalogue, {"schemaVersion": 1, "releases": combined})
    print(json.dumps({"stage": "published", "releases": [r["id"] for r in new]}), flush=True)


if __name__ == "__main__":
    main()
