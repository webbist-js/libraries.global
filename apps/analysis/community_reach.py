"""Population-weighted reach by national deprivation quintile.

Uses analytical source boundaries, never context display polygons. All overlays
share the population raster's equal-area CRS and the original network union.
"""
import json
import math
import rasterio
from pyproj import Transformer
from shapely import make_valid, union_all
from shapely.geometry import mapping
from shapely.ops import transform

from context_layers import indexed_shapes
from population import count_population

METHOD = "deprivation-partition-equal-area-v1"
MAX_CELLS = 80_000_000


def polygonal(geometry):
    """Shared borders can leave lines in intersections; they carry no cell area."""
    geometry = make_valid(geometry)
    if geometry.geom_type in {"Polygon", "MultiPolygon"}:
        return geometry
    return union_all([polygonal(part) for part in geometry.geoms if part.area > 0])


def catalogue(root):
    path = root / "community/catalogue.json"
    if not path.exists():
        return []
    if path.stat().st_size > 64 * 1024:
        raise ValueError("Community catalogue exceeds budget")
    entries = json.loads(path.read_text())
    if not isinstance(entries, list) or len(entries) > 16 or len({r['country'] for r in entries}) != len(entries):
        raise ValueError("Invalid community catalogue")
    return entries


def public_releases(root):
    return [{k: v for k, v in entry.items() if k != "lookup"} for entry in catalogue(root)]


def projected(geometry, files):
    with rasterio.open(files[0]) as source:
        crs = source.crs
    projector = Transformer.from_crs(4326, crs, always_xy=True).transform
    return transform(projector, geometry), crs, projector


def partition(area, pairs):
    """Dissolve within a class; conflicting classes become unknown, never priority wins."""
    groups = [union_all([g.intersection(area) for g, decile in pairs if decile is not None and math.ceil(decile / 2) == q]) for q in range(1, 6)]
    conflicts = []
    for i, group in enumerate(groups):
        for other in groups[i + 1:]:
            overlap = group.intersection(other)
            if overlap.area > 0:
                conflicts.append(overlap)
    ambiguous = union_all(conflicts + [g.intersection(area) for g, decile in pairs if decile is None])
    groups = [g.difference(ambiguous) for g in groups]
    unknown = area.difference(union_all(groups))
    return groups + [unknown]


def aggregate(area, catchments, partitions, files, crs, expected_total, expected_bands, max_cells=MAX_CELLS):
    cells = 0
    def count(geometry):
        nonlocal cells
        if geometry.is_empty or geometry.area == 0:
            return 0.0
        geometry = polygonal(geometry)
        result = count_population(mapping(geometry), files, max_cells=min(30_000_000, max_cells - cells), geometry_crs=crs)
        cells += result.cells_read
        if result.residents is None:
            raise ValueError("Incomplete community population surface")
        return result.residents
    groups = []
    for index, region in enumerate(partitions):
        total = count(region)
        bands = []
        previous = 0
        for minute, catchment in catchments.items():
            within = count(region.intersection(catchment))
            if within > total + .001 or within < previous - .001:
                raise ValueError("Inconsistent community coverage")
            within = min(total, max(previous, within))
            previous = within
            outside = max(0., total - within)
            all_outside = expected_total - expected_bands[minute]
            if outside > all_outside + max(.01, expected_total * 1e-8):
                raise ValueError("Group exceeds beyond-threshold denominator")
            bands.append({"minutes": minute, "residents": within, "outsideResidents": outside,
                          "percent": within / total * 100 if total > 0 else None,
                          "shareOfOutside": min(100., outside / all_outside * 100) if all_outside > .001 else None})
        groups.append({"quintile": index + 1 if index < 5 else None, "totalResidents": total, "contours": bands})
    tolerance = max(.01, expected_total * 1e-8)
    if abs(sum(g['totalResidents'] for g in groups) - expected_total) > tolerance:
        raise ValueError("Community denominator does not reconcile")
    for i, minute in enumerate(catchments):
        if abs(sum(g['contours'][i]['residents'] for g in groups) - expected_bands[minute]) > tolerance:
            raise ValueError("Community coverage does not reconcile")
    return groups


def calculate(root, release_id, area_wgs, catchments_wgs, files, total, bands, complete, max_cells=MAX_CELLS):
    unavailable = {"schemaVersion": 1, "state": "unavailable"}
    if not release_id:
        return unavailable
    matches = [r for r in catalogue(root) if r['id'] == release_id]
    if len(matches) != 1:
        raise ValueError("Community release changed")
    release = matches[0]
    metadata = {k: v for k, v in release.items() if k != 'lookup'}
    if not complete:
        return {**unavailable, "state": "incomplete", "release": metadata}
    try:
        area, crs, projector = projected(area_wgs, files)
        area = polygonal(area)
        catchments = {m: polygonal(transform(projector, g)).intersection(area) for m, g in catchments_wgs.items()}
        # RTree filters the national index before decoding full source geometries.
        candidates = indexed_shapes(root, release, area_wgs.bounds)
        pairs = [(make_valid(transform(projector, g)), p.get('value')) for g, p in candidates]
        groups = aggregate(area, catchments, partition(area, pairs), files, crs, total, bands, max_cells=max_cells)
    except ValueError as error:
        # Optional context must not erase a valid base Reach calculation. No
        # partial category percentages escape if integration or budgets fail.
        print(json.dumps({"component":"community-reach", "reason":str(error)[:200]}), flush=True)
        return {**unavailable, "state": "insufficient", "release": metadata}
    return {"schemaVersion": 1, "state": "ready", "method": METHOD, "release": metadata, "groups": groups}
