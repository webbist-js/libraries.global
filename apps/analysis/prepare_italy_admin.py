"""Reconcile census 2023 to Istat's 2024 regional/provincial geography.

Prepare display boundaries plus an explicit population-owner plan; CMS writing
is a separate finite command. No municipality is inferred from a library pin.
"""
import argparse
from collections import defaultdict
import fcntl
import io
import json
import re
import zipfile
from pathlib import Path

import shapefile
from pyproj import CRS, Transformer, Geod
from shapely import make_valid, orient_polygons
from shapely.geometry import shape, mapping
from shapely.ops import transform

from prepare_europe_sources import Acquisition
from prepare_context import publish
from prepare_europe_context import install
from context_layers import bounds_dict
from sources import sha256, write_json

BOUNDARIES = "https://www.istat.it/storage/cartografia/confini_amministrativi/generalizzati/2024/Limiti01012024_g.zip"
SOURCE = "https://www.istat.it/notizia/dati-per-sezioni-di-censimento/"
TOTAL_SOURCE = "https://www.istat.it/comunicato-stampa/popolazione-residente-e-dinamica-della-popolazione/"
NATIONAL_2023 = 58_971_230


def aggregate_sections(root):
    regions, provinces, province_regions, seen = defaultdict(int), defaultdict(int), {}, set()
    inputs = []
    for region in range(1, 21):
        path = root / f"population-{region:02}.ndjson"
        inputs.append({"file": path.name, "sha256": sha256(path)})
        with path.open() as source:
            for line in source:
                row = json.loads(line)
                if (row["code"] in seen or row["regionCode"] != f"{region:02}" or
                        not isinstance(row["population"], int) or row["population"] < 0 or
                        not re.fullmatch(r"\d{6}", row["municipalityCode"])):
                    raise ValueError("Invalid or duplicate census section")
                seen.add(row["code"])
                # Current PROCOM identifies the observation's municipality;
                # the 2021 section prefix is only for section-boundary joins.
                province = row["municipalityCode"][:3]
                if province in province_regions and province_regions[province] != row["regionCode"]:
                    raise ValueError("Province crosses census Regions")
                province_regions[province] = row["regionCode"]
                regions[row["regionCode"]] += row["population"]
                provinces[province] += row["population"]
    if sum(regions.values()) != NATIONAL_2023 or sum(provinces.values()) != NATIONAL_2023:
        raise ValueError("Census sections do not reconcile to the independent national release")
    if len(regions) != 20 or len(provinces) != 107:
        raise ValueError("Incomplete regional/provincial census coverage")
    return regions, provinces, province_regions, inputs


def prepare(root, offline=False):
    staged = root / "europe-staging/italy"
    regions, provinces, parents, census_inputs = aggregate_sections(staged)
    acquire = Acquisition(staged, offline=offline)
    archive = acquire.get("istat-boundaries-2024.zip", BOUNDARIES, max_mb=128, publisher="Istat")
    retrieved = acquire.inputs[0]["retrievedAt"]
    common = {"iso2": "IT", "year": 2023, "source": "Istat · Census 2023",
        "sourceUrl": SOURCE, "licence": "CC BY 4.0", "retrievedAt": retrieved,
        "method": "sum_complete_children", "boundaryVersion": "20240101",
        "coverage": {"complete": True, "basis": "Census sections aggregated by current municipality code; nonspatial section residents retained in administrative totals"}}
    observations = [{**common, "key": "istat:IT:2023:country:ITA", "level": "country", "name": "Italy",
                     "reportingCode": "ITA", "population": NATIONAL_2023}]
    releases = []
    geod = Geod(ellps="WGS84")
    with zipfile.ZipFile(archive) as zipped:
        for level, prefix, totals, code_field, name_field, width in [
            ("region", "Reg01012024_g", regions, "COD_REG", "DEN_REG", 2),
            ("area", "ProvCM01012024_g", provinces, "COD_PROV", "DEN_UTS", 3),
        ]:
            base = f"Limiti01012024_g/{prefix}/{prefix}_WGS84"
            if any(zipped.getinfo(base + ext).file_size > 128 * 1024 ** 2 for ext in [".shp", ".shx", ".dbf"]):
                raise ValueError("Administrative member exceeds budget")
            crs = CRS.from_wkt(zipped.read(base + ".prj").decode())
            if crs.to_epsg() != 32632:
                raise ValueError("Unexpected Istat boundary CRS")
            projector = Transformer.from_crs(crs, 4326, always_xy=True)
            reader = shapefile.Reader(**{ext[1:]: io.BytesIO(zipped.read(base + ext)) for ext in [".shp", ".shx", ".dbf"]}, encoding="utf8")
            features, seen = [], set()
            for record in reader.iterShapeRecords():
                attrs = record.record.as_dict()
                code = str(attrs[code_field]).zfill(width)
                region = str(attrs["COD_REG"]).zfill(2)
                if code in seen or code not in totals or (level == "area" and parents[code] != region):
                    raise ValueError("Census/boundary code or parent mismatch")
                seen.add(code)
                identifier = f"IT-{'R' if level == 'region' else 'P'}{code}"
                parent = "ITA" if level == "region" else f"IT-R{region}"
                polygon = orient_polygons(make_valid(transform(projector.transform, shape(record.shape.__geo_interface__))))
                if polygon.is_empty or polygon.geom_type not in {"Polygon", "MultiPolygon"}:
                    raise ValueError("Invalid Istat reporting polygon")
                area = abs(geod.geometry_area_perimeter(polygon)[0]) / 1e6
                if area <= 0:
                    raise ValueError("Invalid reporting area denominator")
                name = attrs[name_field]
                observations.append({**common, "key": f"istat:IT:2023:{level}:{identifier}", "level": level,
                    "name": name, "reportingCode": identifier, "parentReportingCode": parent, "population": totals[code]})
                features.append({"type": "Feature", "geometry": mapping(polygon.simplify(.001, preserve_topology=True)),
                    "properties": {"code": identifier, "name": name, "value": 0, "areaKm2": area, "bounds": bounds_dict(polygon.bounds)}})
            if seen != set(totals):
                raise ValueError("Incomplete Istat administrative boundary join")
            release = publish(root, {"theme": "administrative", "country": "IT", "name": "Italy",
                "level": "regions" if level == "region" else "local", "areaCount": len(features), "year": 2023,
                "edition": "Istat Census 2023 · administrative boundaries 1 January 2024", "boundaryDate": "20240101",
                "boundary": "Istat generalised statistical administrative boundaries 2024", "source": "Istat",
                "sourceUrl": SOURCE, "licence": "CC BY 4.0", "attribution": "Istat Census 2023 and statistical boundaries 2024, CC BY 4.0.",
                "note": "Census residents per km² of the whole Istat reporting boundary, including inland waters. Ellipsoidal area measured before additional display simplification. Province totals include nonspatial section residents; no section polygon is invented."}, features)
            releases.append(release)
    plan = {"country": "IT", "observations": observations, "releases": releases,
            "nationalCheck": {"population": NATIONAL_2023, "sourceUrl": TOTAL_SOURCE},
            "inputs": [*acquire.inputs, *census_inputs]}
    write_json(staged / "administrative.json", plan)
    return plan


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("data"))
    parser.add_argument("--offline", action="store_true")
    parser.add_argument("--install", action="store_true")
    args = parser.parse_args()
    root = args.root.resolve()
    (root / "context").mkdir(parents=True, exist_ok=True)
    with (root / "context/.italy-admin-lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        plan = prepare(root, args.offline)
        if args.install:
            install(root, plan["releases"])
    print(json.dumps({"observations": len(plan["observations"]), "installed": args.install,
                      "releases": [r["id"] for r in plan["releases"]]}))


if __name__ == "__main__":
    main()
