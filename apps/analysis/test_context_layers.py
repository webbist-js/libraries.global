import base64
import json
import tempfile
import unittest
from pathlib import Path

import numpy as np
import rasterio
from rasterio.io import MemoryFile
from rasterio.transform import from_origin
from pyproj import Transformer

from context_layers import handle, point, tile, vectors
from prepare_context import publish


class ContextTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.root.joinpath("context").mkdir()
        self.raster = self.root / "population.tif"
        with rasterio.open(self.raster, "w", driver="GTiff", width=2, height=2, count=1,
                           dtype="float32", crs="ESRI:54009", transform=from_origin(0, 200, 100, 100), nodata=-200) as src:
            src.write(np.array([[0, 10], [-200, 20]], dtype="float32"), 1)
        self.release = {"id": "population-test", "theme": "population", "raster": "population.tif"}
        self.catalogue([self.release])

    def catalogue(self, releases):
        self.root.joinpath("context/catalogue.json").write_text(json.dumps({"schemaVersion": 1, "releases": releases}))

    def tearDown(self):
        vectors.cache_clear() if hasattr(vectors, "cache_clear") else None
        self.temp.cleanup()

    def test_grid_point_preserves_zero_nodata_and_native_cell_area(self):
        transform = Transformer.from_crs("ESRI:54009", 4326, always_xy=True)
        self.assertEqual(point(self.root, self.release, *transform.transform(50, 150))["density"], 0)
        self.assertEqual(point(self.root, self.release, *transform.transform(150, 150))["density"], 1000)
        self.assertIsNone(point(self.root, self.release, *transform.transform(50, 50))["density"])

    def test_png_tiles_are_bounded_and_keep_missing_pixels_transparent(self):
        result = tile(self.root, self.release, 14, 8192, 8191)
        binary = base64.b64decode(result["png"])
        self.assertLess(len(binary), 256 * 1024)
        with MemoryFile(binary) as file, file.open() as png:
            self.assertEqual((png.width, png.height, png.count), (256, 256, 4))
            alpha = png.read(4)
            self.assertTrue(np.any(alpha == 0))
            self.assertTrue(np.any(alpha == 255))

    def test_catalogue_hides_files_and_rejects_unbounded_assets(self):
        self.assertNotIn("raster", handle(self.root, {"kind": "catalogue"})["releases"][0])
        with self.assertRaises(ValueError):
            handle(self.root, {"kind": "tile", "release": "population-test", "z": "15", "x": "0", "y": "0"})
        with self.assertRaises(ValueError):
            handle(self.root, {"kind": "point", "release": "population-test", "lng": "NaN", "lat": "0"})

    def test_national_ranks_survive_display_tiles_and_paged_search(self):
        features = [{"type": "Feature", "properties": {"code": f"E{i:03}", "name": f"Area {i:03}", "value": i % 10 + 1, "rank": i + 1},
                     "geometry": {"type": "Polygon", "coordinates": [[[i, 0], [i + .5, 0], [i + .5, .5], [i, .5], [i, 0]]]}} for i in range(40)]
        release = publish(self.root, {"theme": "deprivation", "country": "GB-ENG", "edition": "Test national index", "areaCount": 40}, features)
        self.catalogue([release])
        result = handle(self.root, {"kind": "search", "release": release["id"]})
        self.assertEqual(len(result["areas"]), 30)
        self.assertEqual(result["next"], 30)
        self.assertEqual(result["areas"][0]["rank"], 1)
        self.assertEqual(result["areas"][0]["value"], 1)
        self.assertEqual(handle(self.root, {"kind": "search", "release": release["id"], "q": "E039"})["areas"][0]["rank"], 40)
        self.assertIsNone(handle(self.root, {"kind": "point", "release": release["id"], "lng": "-.1", "lat": ".1"})["area"])

    def test_incomplete_or_invalid_release_never_replaces_catalogue(self):
        before = self.root.joinpath("context/catalogue.json").read_bytes()
        with self.assertRaises(ValueError):
            publish(self.root, {"theme": "deprivation", "country": "GB-ENG", "edition": "Test", "areaCount": 40}, [])
        self.assertEqual(self.root.joinpath("context/catalogue.json").read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
