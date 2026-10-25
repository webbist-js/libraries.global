"""Windowed population counts. Raster cells are files, never database records."""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import numpy as np
import rasterio
from rasterio.features import geometry_window
from rasterio.errors import WindowError
from rasterio.windows import Window
from pyproj import CRS, Transformer
from shapely import box, covers, intersects, intersection, area, union_all, transform, prepare
from shapely.geometry import mapping, shape


@dataclass(frozen=True)
class PopulationCount:
    residents: float | None
    covered_fraction: float
    cells_read: int


@lru_cache(maxsize=16)
def population_projector(crs: str):
    return Transformer.from_crs("EPSG:4326", crs, always_xy=True).transform


def validate_count_crs(source):
    crs = CRS.from_user_input(source.crs)
    method = crs.coordinate_operation.method_name.lower() if crs.coordinate_operation else ""
    if not crs.is_projected or not ("equal area" in method or "equal-area" in method or "mollweide" in method) or any(axis.unit_name != "metre" for axis in crs.axis_info):
        raise ValueError("Population requires an equal-area count raster in metres")
    if source.transform.b or source.transform.d or source.transform.a <= 0 or source.transform.e >= 0:
        raise ValueError("Population requires a north-up count raster")


def count_population(geometry: dict, files: list[Path], max_cells: int = 2_000_000, geometry_crs="EPSG:4326") -> PopulationCount:
    """Fractional cell intersections in the source's projected coordinates.

    Preparation requires an equal-area count surface, north-up, in metres.
    NoData remains unknown. Overlapping tiles are rejected rather than summed.
    Blocks bound temporary arrays independently of a country/world raster size.
    """
    original = shape(geometry)
    if original.is_empty or not original.is_valid or original.geom_type not in {"Polygon", "MultiPolygon"}:
        raise ValueError("Invalid analytical catchment")
    total = 0.0
    valid_area = 0.0
    missing_area = 0.0
    catchment_area = None
    seen_footprints = []
    cells_read = 0
    common_crs = None
    for file in files:
        with rasterio.open(file) as source:
            validate_count_crs(source)
            if common_crs is not None and source.crs != common_crs:
                raise ValueError("Population tiles must use one coordinate system")
            common_crs = source.crs
            # Cross-layer partitions are constructed once in this same equal-area
            # CRS. Do not reproject their shared edges independently via WGS84.
            projector = Transformer.from_crs(geometry_crs, source.crs, always_xy=True).transform
            catchment = original if CRS.from_user_input(geometry_crs) == source.crs else transform(original, projector, interleaved=False)
            # Reuse the polygon's spatial index across every candidate cell.
            # This preserves exact fractions while avoiding repeated edge scans.
            prepare(catchment)
            catchment_area = catchment.area
            footprint = catchment.intersection(box(*source.bounds))
            if footprint.is_empty:
                continue
            if any(footprint.intersection(previous).area > 1e-3 for previous in seen_footprints):
                raise ValueError("Overlapping population tiles")
            seen_footprints.append(footprint)
            try:
                window = geometry_window(source, [mapping(catchment)])
            except WindowError:
                continue
            cells_read += int(window.width * window.height)
            if cells_read > max_cells:
                raise ValueError("Population read exceeds cell budget")
            for row in range(int(window.row_off), int(window.row_off + window.height), 256):
                for col in range(int(window.col_off), int(window.col_off + window.width), 256):
                    chunk = Window(col, row, min(256, int(window.col_off + window.width) - col), min(256, int(window.row_off + window.height) - row))
                    values = source.read(1, window=chunk, masked=True)
                    yy, xx = np.indices(values.shape)
                    yy, xx = yy.ravel(), xx.ravel()
                    left = source.transform.c + (xx + col) * source.transform.a
                    top = source.transform.f + (yy + row) * source.transform.e
                    boxes = box(left, top + source.transform.e, left + source.transform.a, top)
                    # Raster drawing rounds near-grid edges and can omit real
                    # slivers. The prepared polygon is the authoritative filter.
                    touched = intersects(catchment, boxes)
                    yy, xx, boxes = yy[touched], xx[touched], boxes[touched]
                    if len(xx) == 0:
                        continue
                    cell_area = abs(source.transform.a * source.transform.e)
                    full = covers(catchment, boxes)
                    fractions = np.ones(len(xx), dtype=np.float64)
                    if not full.all():
                        fractions[~full] = area(intersection(catchment, boxes[~full])) / cell_area
                    selected = values[yy, xx]
                    valid = ~np.ma.getmaskarray(selected)
                    raw = np.asarray(selected.data, dtype=np.float64)
                    if not np.isfinite(raw[valid]).all() or (raw[valid] < 0).any():
                        raise ValueError("Invalid population cell values")
                    total += float(np.sum(raw[valid] * fractions[valid], dtype=np.float64))
                    valid_area += float(np.sum(fractions[valid], dtype=np.float64)) * cell_area
                    missing_area += float(np.sum(fractions[~valid], dtype=np.float64)) * cell_area
    if catchment_area is None or catchment_area <= 0:
        return PopulationCount(None, 0.0, cells_read)
    fraction = min(1.0, valid_area / catchment_area)
    uncovered_area = max(0.0, catchment_area - sum(footprint.area for footprint in seen_footprints))
    # Tolerate up to 0.001 m² of GEOS area roundoff, not an unknown
    # fraction of the whole catchment. Real NoData must not become zero as
    # a cumulative band grows larger.
    complete = missing_area <= 1e-3 and uncovered_area <= 1e-3
    return PopulationCount(total if complete else None, 1.0 if complete else fraction, cells_read)


def validate_surface(files: list[Path]) -> dict:
    """Scan blocks once during preparation; retain zero, reject bad counts."""
    total = 0.0
    cells = 0
    valid_cells = 0
    crs = None
    footprints = []
    for file in files:
        with rasterio.open(file) as source:
            validate_count_crs(source)
            if source.count != 1 or (crs and source.crs != crs):
                raise ValueError("Incompatible population tiles")
            crs = source.crs
            footprints.append(box(*source.bounds))
            for _, window in source.block_windows(1):
                data = source.read(1, window=window, masked=True)
                values = data.compressed()
                if not np.isfinite(values).all() or (values < 0).any():
                    raise ValueError("Invalid resident counts")
                total += float(values.sum(dtype=np.float64))
                cells += data.size
                valid_cells += values.size
    if not footprints or valid_cells == 0:
        raise ValueError("Population surface is empty")
    if sum(part.area for part in footprints) - union_all(footprints).area > 1e-3:
        raise ValueError("Population tiles overlap")
    return {"population": total, "cells": cells, "validCells": valid_cells, "crs": str(crs)}
