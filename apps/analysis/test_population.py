import tempfile
import unittest
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin
from pyproj import Transformer
from shapely.geometry import box, mapping
from shapely import transform

from population import count_population, validate_surface


class PopulationTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.file = Path(self.directory.name) / "counts.tif"

    def tearDown(self):
        self.directory.cleanup()

    def write(self, values):
        with rasterio.open(self.file, "w", driver="GTiff", height=2, width=2, count=1,
                           dtype="float32", crs="EPSG:6933", transform=from_origin(0, 200, 100, 100), nodata=-200) as out:
            out.write(np.array(values, dtype=np.float32), 1)

    def polygon(self, bounds):
        return mapping(transform(box(*bounds), Transformer.from_crs("EPSG:6933", "EPSG:4326", always_xy=True).transform, interleaved=False))

    def test_fractional_cells_and_true_zero(self):
        self.write([[100, 0], [200, 400]])
        result = count_population(self.polygon((50, 0, 150, 200)), [self.file])
        self.assertAlmostEqual(result.residents, 350, places=3)
        self.assertEqual(result.covered_fraction, 1)
        self.assertEqual(validate_surface([self.file])["population"], 700)

    def test_missing_data_and_outside_coverage_are_unknown(self):
        self.write([[100, -200], [200, 400]])
        result = count_population(self.polygon((0, 0, 200, 200)), [self.file])
        self.assertIsNone(result.residents)
        self.assertAlmostEqual(result.covered_fraction, .75, places=6)
        outside = count_population(self.polygon((1000, 1000, 1100, 1100)), [self.file])
        self.assertIsNone(outside.residents)

    def test_thin_slivers_at_grid_edges_are_counted_without_drawing_roundoff(self):
        self.write([[100, 0], [200, 400]])
        result = count_population(self.polygon((99.999, 100, 100.001, 200)), [self.file])
        self.assertEqual(result.covered_fraction, 1)
        self.assertAlmostEqual(result.residents, .001, places=6)

    def test_real_nodata_does_not_disappear_inside_a_relative_area_tolerance(self):
        self.write([[100, -200], [200, 400]])
        result = count_population(self.polygon((0, 0, 100.000015, 200)), [self.file])
        self.assertIsNone(result.residents)
        self.assertLess(result.covered_fraction, 1)

    def test_duplicate_tiles_and_unbounded_reads_are_refused(self):
        self.write([[100, 0], [200, 400]])
        with self.assertRaisesRegex(ValueError, "Overlapping"):
            count_population(self.polygon((0, 0, 200, 200)), [self.file, self.file])
        with self.assertRaisesRegex(ValueError, "budget"):
            count_population(self.polygon((0, 0, 200, 200)), [self.file], max_cells=2)


if __name__ == "__main__":
    unittest.main()
