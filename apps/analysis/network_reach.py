"""Bounded network coverage from full analytical contours and one population edition."""
import hashlib
import json
import math
from datetime import datetime, timezone

from shapely import union_all, make_valid
from shapely.geometry import shape, mapping

from engine import MINUTES, inside
from population import count_population, PopulationCount
from cache import read_artifact, write_artifact

# Keep these admission limits aligned with shared-data/atlas/reach-limits.ts.
MAX_LIBRARIES = 50
MAX_SPAN_KM = 75
MAX_BOUNDS_KM2 = 2500
EXTENDED_SPAN_KM = 200
EXTENDED_BOUNDS_KM2 = 20_000


def local_bounds(bounds, capacity=1, single_time=False):
    west, south, east, north = bounds
    if not all(math.isfinite(value) for value in bounds) or not (-180 <= west <= east <= 180 and -90 <= south <= north <= 90):
        return False
    latitude = 0 if south <= 0 <= north else min(abs(south), abs(north))
    width = (east - west) * 111.195 * math.cos(math.radians(latitude))
    height = (north - south) * 111.195
    span = EXTENDED_SPAN_KM if single_time else MAX_SPAN_KM
    area = EXTENDED_BOUNDS_KM2 if single_time else MAX_BOUNDS_KM2
    return max(width, height) <= span * capacity and width * height <= area * capacity


def network_key(request):
    return hashlib.sha256(json.dumps(["network-partition-v4-selected-time", request], sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def validate_network_job(request):
    from contracts import validate_contract
    validate_contract("networkJob", request)
    if not isinstance(request, dict) or set(request) - {"areaCodes", "communityRelease", "capacity", "minutes"} != {"kind", "networkId", "networkName", "areaCode", "selectionHash", "mode", "release", "members", "excludedLibraries", "areaVersion"}:
        raise ValueError("Invalid network job")
    capacity = request.get("capacity", 1)
    if type(capacity) is not int or capacity not in (1, 2):
        raise ValueError("Invalid Reach capacity")
    if "minutes" in request and (type(request["minutes"]) is not int or request["minutes"] not in MINUTES):
        raise ValueError("Invalid Reach time")
    import re
    for field, pattern in [("networkId", r"[a-zA-Z0-9_-]{1,80}"), ("areaCode", r"[EWSN]\d{8}"), ("selectionHash", r"[a-f0-9]{64}"), ("areaVersion", r"[a-f0-9]{16,64}")]:
        if not isinstance(request[field], str) or not re.fullmatch(pattern, request[field]):
            raise ValueError("Invalid network identity")
    codes = request.get("areaCodes", [request["areaCode"]])
    if request.get("communityRelease"):
        # National editions must never be combined into one category scale.
        nation = {"E":"eng", "W":"wls", "S":"sct", "N":"nir"}[codes[0][0]]
        if not request["communityRelease"].startswith("community-gb-" + nation + "-") or any(code[0] != codes[0][0] for code in codes):
            raise ValueError("Incompatible national community release")
    if codes[0] != request["areaCode"]:
        raise ValueError("Inconsistent service reporting areas")
    if request["kind"] != "network" or request["mode"] not in {"walking", "cycling"} or not isinstance(request["networkName"], str) or len(request["networkName"]) > 240:
        raise ValueError("Invalid network options")
    if not isinstance(request["members"], list) or not 1 <= len(request["members"]) <= MAX_LIBRARIES * capacity or len({m["libraryId"] for m in request["members"]}) != len(request["members"]):
        raise ValueError("Network member limit exceeded")
    from contracts import validate_contract
    for member in request["members"]:
        validate_contract("job", {**member, "mode": request["mode"], "release": request["release"]})
    if not local_bounds((min(m["lng"] for m in request["members"]), min(m["lat"] for m in request["members"]),
                         max(m["lng"] for m in request["members"]), max(m["lat"] for m in request["members"])), capacity, "minutes" in request):
        raise ValueError("Network exceeds the local Reach area limit")
    if not isinstance(request["excludedLibraries"], int) or request["excludedLibraries"] < 0:
        raise ValueError("Invalid exclusion count")


def display_geometry(geometry):
    # Counts always use original geometry. Keep all eight display polygons
    # together within the existing result budget, including island-rich areas.
    for tolerance in (.0001, .00025, .0005, .001, .002, .005):
        displayed = mapping(geometry.simplify(tolerance, preserve_topology=True))
        # Sub-metre coordinate precision avoids spending the display budget on
        # intersection arithmetic tails. Analytical population geometry is untouched.
        def rounded(values):
            return [rounded(value) for value in values] if isinstance(values, (list, tuple)) else round(values, 6)
        displayed["coordinates"] = rounded(displayed["coordinates"])
        candidate = shape(displayed)
        if not candidate.is_valid:
            candidate = make_valid(candidate)
            if candidate.geom_type not in {"Polygon", "MultiPolygon"}:
                candidate = union_all(polygon_parts(candidate))
            displayed = mapping(candidate)
        if candidate.is_empty:
            continue
        # Eight shapes at this cap leave over 170 KiB for metadata within 2 MiB.
        if len(json.dumps(displayed, separators=(",", ":")).encode()) <= 240_000:
            return displayed
    raise ValueError("Reporting display geometry exceeds the network result budget")


def polygon_parts(geometry):
    """Keep the area of repaired boundaries; collapsed coastline lines have no population area."""
    if geometry.geom_type in {"Polygon", "MultiPolygon"}:
        return [geometry]
    return [part for child in getattr(geometry, "geoms", []) for part in polygon_parts(child)]


def coverage(engine, request, release, area):
    """Union before population integration. Failed origins cannot become proven gaps."""
    area = make_valid(shape(area))
    if area.is_empty or area.geom_type not in {"Polygon", "MultiPolygon"}:
        raise ValueError("Invalid reporting area")
    # Compact small batches instead of repeatedly overlaying a growing national
    # union for every library. Retain at most sixteen intermediates per band.
    minutes = (request["minutes"],) if "minutes" in request else MINUTES
    capacity = request.get("capacity", 1)
    max_cells = (3_000_000 if "minutes" in request else 1_000_000) * capacity
    unions = {minute: [] for minute in minutes}
    unavailable = 0
    for member in request["members"]:
        routed = engine.full_contours({**member, "mode": request["mode"], **({"minutes": list(minutes)} if "minutes" in request else {})}, release)
        if "state" in routed:
            unavailable += 1
            continue
        for minute in minutes:
            clipped = routed["geometries"][minute].intersection(area)
            if not clipped.is_empty:
                unions[minute].append(clipped)
            if len(unions[minute]) == 16:
                unions[minute] = [union_all(unions[minute])]
    files = [inside(engine.root, file) for file in release["populationFiles"]]
    # Reporting units are processed in raster windows, never loaded as global cells.
    population_key = hashlib.sha256(json.dumps(["network-denominator-v1", request.get("areaVersion"), release.get("id"),
        release["population"], release["populationFiles"], mapping(area)], sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    cached = read_artifact(engine.root, "population", population_key)
    denominator = PopulationCount(**cached) if cached else count_population(mapping(area), files, max_cells=max_cells)
    if denominator.cells_read > max_cells:
        raise ValueError("Population read exceeds cell budget")
    if cached is None:
        write_artifact(engine.root, "population", population_key, denominator.__dict__)
    total = denominator.residents
    contours = []
    analytical = {}
    for minute in minutes:
        geometry = union_all(unions[minute])
        if analytical:
            geometry = union_all([next(reversed(analytical.values())), geometry])
        analytical[minute] = geometry
        # A disjoint selection still has a valid zero coverage result. Use the
        # area as display geometry only with an explicit empty flag (no fill).
        empty = geometry is None or geometry.is_empty
        population = None if empty else count_population(mapping(geometry), files, max_cells=max_cells)
        residents = 0.0 if empty else population.residents
        complete = unavailable == 0 and total is not None and residents is not None
        if total is not None and residents is not None and residents > total + max(.001, total * 1e-9):
            raise ValueError("Covered population exceeds denominator")
        gap = area if empty else area.difference(geometry)
        contours.append({"gapGeometry": display_geometry(gap) if complete and not gap.is_empty else None,
                         "minutes": minute, "residents": residents,
                         "coveredFraction": 1 if empty else population.covered_fraction,
                         "percent": min(100., residents / total * 100) if complete and total > 0 else None,
                         "outsideResidents": max(0., total - residents) if complete else None,
                         "empty": empty,
                         "geometry": display_geometry(area if empty else geometry)})
    complete = unavailable == 0 and total is not None and all(c["residents"] is not None for c in contours)
    from community_reach import calculate as community_calculate
    community = community_calculate(engine.root, request.get("communityRelease"), area, analytical, files, total,
                                    {c["minutes"]:c["residents"] for c in contours}, complete, max_cells=12_000_000 * capacity)
    return {"schemaVersion": 1, "kind": "network", "state": "ready" if complete else "partial",
            "libraryId": "network-" + request["networkId"], "networkId": request["networkId"], "networkName": request["networkName"],
            "coordinateHash": request["selectionHash"], "selectionHash": request["selectionHash"], "areaCode": request["areaCode"], "areaCodes": request.get("areaCodes", [request["areaCode"]]),
            "mode": request["mode"], "calculatedAt": datetime.now(timezone.utc).isoformat(), "snapDistanceMetres": 0,
            "method": "network-union-clipped-v2; exact equal-area fractional population cells", "network": release["network"],
            "population": release["population"], "totalResidents": total, "selectedLibraries": len(request["members"]),
            "excludedLibraries": request["excludedLibraries"], "unavailableLibraries": unavailable,
            "warnings": ["Coverage is potential geographical reach to the selected recorded libraries, not observed use or guaranteed admission.",
                         "No elevation model, opening-hours journey or step-free routing is included. Ferries are excluded."] +
                        ([] if complete else ["Incomplete routing or population data: unavailable coverage must not be interpreted as an underserved community."]),
            "community": community, "contours": contours,
            **({"requestedMinutes": request["minutes"]} if "minutes" in request else {})}


def calculate_network(engine, request, release):
    validate_network_job(request)
    area_file = engine.root / "reporting-areas.json"
    if area_file.stat().st_size > 32 * 1024 * 1024:
        raise ValueError("Reporting geometry exceeds budget")
    catalogue = json.loads(area_file.read_text())
    if catalogue["version"] != request["areaVersion"]:
        raise ValueError("Reporting geometry edition changed")
    codes = request.get("areaCodes", [request["areaCode"]])
    matches = [f for f in catalogue["features"] if f["properties"]["code"] in codes]
    if len(matches) != len(codes):
        raise ValueError("Unsupported reporting area")
    areas = [part for feature in matches for part in polygon_parts(make_valid(shape(feature["geometry"])))]
    if not areas or not local_bounds((min(a.bounds[0] for a in areas), min(a.bounds[1] for a in areas),
                                      max(a.bounds[2] for a in areas), max(a.bounds[3] for a in areas)), request.get("capacity", 1), "minutes" in request):
        raise ValueError("Reporting area exceeds the local Reach area limit")
    area = union_all(areas)
    return coverage(engine, request, release, mapping(area))
