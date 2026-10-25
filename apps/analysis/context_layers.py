"""Versioned context maps. Only bounded tiles, searches and point lookups leave here.

Display tiles never enter population calculations. Vector ranks retain their
national edition; they are neither interpolated nor averaged during rendering.
"""
import base64
from contextlib import closing
import json
import math
import sqlite3
from functools import lru_cache
from pathlib import Path
from threading import Lock

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.features import rasterize
from rasterio.io import MemoryFile
from rasterio.transform import from_bounds
from rasterio.vrt import WarpedVRT
from pyproj import Transformer
from shapely import STRtree, box, geometry, from_wkb
from shapely.ops import transform

MAX_VECTOR_BYTES = 128 * 1024 * 1024
PALETTES = {
    "population": [(0, "#F0F4E5"), (50, "#D7E5B0"), (200, "#9DC776"), (1000, "#57A266"), (5000, "#22634C")],
    "deprivation": [(1, "#9E3A64"), (3, "#CE7891"), (5, "#E7BCC5"), (7, "#BCCBDC"), (9, "#6084AB")],
    "carAccess": [(0, "#EFF3FF"), (10, "#BDD7E7"), (25, "#6BAED6"), (40, "#3182BD"), (60, "#08519C")],
}


def catalogue(root: Path):
    path = root / "context/catalogue.json"
    if not path.exists():
        return {"schemaVersion": 1, "releases": []}
    if path.stat().st_size > 128 * 1024:
        raise ValueError("Context catalogue exceeds budget")
    result = json.loads(path.read_text())
    if result.get("schemaVersion") != 1 or len(result["releases"]) > 128:
        raise ValueError("Invalid context catalogue")
    # Private relative asset paths never leave this process.
    return {"schemaVersion": 1, "releases": [
        {k: v for k, v in r.items() if k not in {"file", "raster", "lookup"}}
        for r in result["releases"]
    ]}


def release_for(root, identifier):
    catalogue(root)  # Validate before resolving any asset paths.
    data = json.loads((root / "context/catalogue.json").read_text())
    matches = [r for r in data["releases"] if r["id"] == identifier]
    if len(matches) != 1:
        raise ValueError("Context release is not installed")
    return matches[0]


def asset(root, relative):
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()) or not path.is_file():
        raise ValueError("Invalid context asset")
    return path


_vector_lock = Lock()


def vectors(path):
    # Coalesce first use: two tile workers must not decode a national file twice.
    with _vector_lock:
        return _vectors(path)


@lru_cache(maxsize=3)
def _vectors(path):
    path = Path(path)
    if path.stat().st_size > MAX_VECTOR_BYTES:
        raise ValueError("Context vector exceeds budget")
    features = json.loads(path.read_text())["features"]
    if not 0 < len(features) <= 40000:
        raise ValueError("Invalid context area count")
    shapes = [geometry.shape(f["geometry"]) for f in features]
    return features, shapes, STRtree(shapes)


def bounds_dict(bounds):
    return dict(zip(("west", "south", "east", "north"), bounds))


def area_row(feature, shape):
    return {**feature["properties"], "bounds": bounds_dict(shape.bounds)}


def search(root, release, query, offset):
    if "lookup" in release:
        with closing(sqlite3.connect(f"file:{asset(root, release['lookup'])}?mode=ro", uri=True)) as db:
            term = query.casefold().strip()
            total = db.execute("SELECT count(*) FROM areas WHERE instr(search, ?) > 0", (term,)).fetchone()[0]
            rows = db.execute("SELECT properties FROM areas WHERE instr(search, ?) > 0 ORDER BY name, code LIMIT 30 OFFSET ?", (term, offset)).fetchall()
        return {"areas": [json.loads(row[0]) for row in rows], "total": total, "next": offset + 30 if total > offset + 30 else None}
    features, shapes, _ = vectors(str(asset(root, release["file"])))
    query = query.casefold().strip()
    matches = [i for i, f in enumerate(features)
               if query in (f["properties"]["name"] + " " + f["properties"]["code"]).casefold()]
    matches.sort(key=lambda i: features[i]["properties"]["name"])
    return {"areas": [area_row(features[i], shapes[i]) for i in matches[offset:offset + 30]],
            "total": len(matches), "next": offset + 30 if len(matches) > offset + 30 else None}


def point(root, release, lng, lat):
    if "raster" in release:
        with rasterio.open(asset(root, release["raster"])) as src:
            x, y = Transformer.from_crs(4326, src.crs, always_xy=True).transform(lng, lat)
            value = next(src.sample([(x, y)], masked=True))[0]
            density = None if np.ma.is_masked(value) or value < 0 else float(value) * 1e6 / abs(src.transform.a * src.transform.e)
            return {"area": None, "density": density}
    if "lookup" in release:
        rows = indexed_shapes(root, release, (lng, lat, lng, lat))
        p = geometry.Point(lng, lat)
        return {"area": next((properties for shape, properties in rows if shape.intersects(p)), None)}
    features, shapes, tree = vectors(str(asset(root, release["file"])))
    p = geometry.Point(lng, lat)
    indexes = sorted(tree.query(p, predicate="intersects").tolist())
    return {"area": area_row(features[indexes[0]], shapes[indexes[0]]) if indexes else None}


def tile_bounds(z, x, y):
    edge = 20037508.342789244
    size = 2 * edge / 2 ** z
    return (-edge + x * size, edge - (y + 1) * size,
            -edge + (x + 1) * size, edge - y * size)


def indexed_shapes(root, release, bounds):
    west, south, east, north = bounds
    with closing(sqlite3.connect(f"file:{asset(root, release['lookup'])}?mode=ro", uri=True)) as db:
        rows = db.execute("SELECT a.geometry, a.properties FROM areas a JOIN bounds b ON a.id = b.id WHERE b.west <= ? AND b.east >= ? AND b.south <= ? AND b.north >= ? ORDER BY a.id LIMIT 40001", (east, west, north, south)).fetchall()
    if len(rows) > 40000:
        raise ValueError("Context tile exceeds geometry budget")
    return [(from_wkb(row[0]), json.loads(row[1])) for row in rows]


def tile(root, release, z, x, y):
    if not 0 <= z <= 14 or not 0 <= x < 2 ** z or not 0 <= y < 2 ** z:
        raise ValueError("Invalid map tile")
    bounds = tile_bounds(z, x, y)
    affine = from_bounds(*bounds, 256, 256)
    if "raster" in release:
        with rasterio.open(asset(root, release["raster"])) as src:
            with WarpedVRT(src, crs="EPSG:3857", transform=affine, width=256, height=256,
                           resampling=Resampling.average, nodata=-200) as vrt:
                values = vrt.read(1, masked=True)
                values = values * (1e6 / abs(src.transform.a * src.transform.e))
    else:
        to_wgs = Transformer.from_crs(3857, 4326, always_xy=True)
        to_map = Transformer.from_crs(4326, 3857, always_xy=True)
        query = transform(to_wgs.transform, box(*bounds))
        if "lookup" in release:
            pairs = [(transform(to_map.transform, shape), p["value"]) for shape, p in indexed_shapes(root, release, query.bounds) if p.get("value") is not None]
        else:
            features, shapes, tree = vectors(str(asset(root, release["file"])))
            candidates = tree.query(query)
            pairs = [(transform(to_map.transform, shapes[i]), features[i]["properties"]["value"])
                     for i in candidates if features[i]["properties"].get("value") is not None]
        values = rasterize(pairs, out_shape=(256, 256), transform=affine, fill=-1, dtype="float32") if pairs else np.full((256, 256), -1, dtype="float32")
        values = np.ma.masked_less(values, 0)
    rgba = np.zeros((4, 256, 256), dtype="uint8")
    valid = ~np.ma.getmaskarray(values)
    for minimum, color in PALETTES[release["theme"]]:
        match = valid & (values.filled(-1) >= minimum)
        for channel in range(3):
            rgba[channel][match] = int(color[1 + channel * 2:3 + channel * 2], 16)
    rgba[3][valid] = 255
    with MemoryFile() as memory:
        with memory.open(driver="PNG", count=4, width=256, height=256, dtype="uint8") as png:
            png.write(rgba)
        return {"png": base64.b64encode(memory.read()).decode("ascii")}


@lru_cache(maxsize=256)
def cached_tile(root, release_id, z, x, y):
    return tile(root, release_for(root, release_id), z, x, y)


def handle(root, params):
    kind = params.pop("kind", "catalogue")
    if kind == "catalogue" and not params:
        return catalogue(root)
    release = release_for(root, params.pop("release", ""))
    if kind == "tile" and set(params) == {"z", "x", "y"}:
        return cached_tile(root, release["id"], *(int(params[k]) for k in ("z", "x", "y")))
    if kind == "point" and set(params) == {"lng", "lat"}:
        lng, lat = float(params["lng"]), float(params["lat"])
        if not math.isfinite(lng) or not math.isfinite(lat) or abs(lng) > 180 or abs(lat) > 85.1:
            raise ValueError("Invalid context location")
        return point(root, release, lng, lat)
    if kind == "search" and set(params) <= {"q", "offset"} and "file" in release:
        offset = int(params.get("offset", "0"))
        if len(params.get("q", "")) > 80 or not 0 <= offset <= 40000:
            raise ValueError("Invalid context search")
        return search(root, release, params.get("q", ""), offset)
    if kind == "geometry" and not params and release["theme"] == "administrative":
        path = asset(root, release["file"])
        if path.stat().st_size > 2800000:
            raise ValueError("Administrative display geometry exceeds budget")
        return json.loads(path.read_text())
    raise ValueError("Invalid context query")
