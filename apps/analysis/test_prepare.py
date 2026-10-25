import os
import json
import tempfile
import unittest
from pathlib import Path

from prepare import pending_tiles, tile_file, prepare_population, validate_canaries
from sources import sha256


class PreparationTests(unittest.TestCase):
    def test_each_country_canary_routes_its_own_coordinate_despite_route_caching(self):
        from unittest.mock import patch
        from engine import ReachEngine
        from population import PopulationCount
        from shapely.geometry import box, mapping
        origins=[{"lat":51.5,"lng":-.1},{"lat":54.6,"lng":-5.9}]
        with tempfile.TemporaryDirectory() as directory:
            engine=ReachEngine(Path(directory))
            release={"network":{"release":"graph1"},"population":{},"populationFiles":[]}
            raw={"snap":0,"contours":{str(n):mapping(box(0,0,n,n)) for n in (5,10,15,30)}}
            with patch.object(engine,"route",return_value=raw) as route, patch("engine.count_population",return_value=PopulationCount(100,1,1)):
                validate_canaries(engine,release,{"canary":origins[0],"canaries":origins})
                self.assertEqual(route.call_count,4)
                self.assertEqual({call.args[0]["lat"] for call in route.call_args_list},{51.5,54.6})

    def test_cached_population_cannot_hide_a_changed_source_year_or_extent(self):
        import rasterio
        import numpy as np
        from rasterio.transform import from_origin
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            edition = root / "releases/pop-test-v1"
            edition.mkdir(parents=True)
            file = edition / "population.tif"
            with rasterio.open(file, "w", driver="GTiff", height=2, width=2, count=1,
                               dtype="float32", crs="EPSG:6933", transform=from_origin(0, 200, 100, 100)) as output:
                output.write(np.ones((2, 2), dtype=np.float32), 1)
            population = {"release": "pop", "year": 2020}
            manifest = {"sha256": sha256(file), "populationFiles": [str(file.relative_to(root))],
                        "population": population, "source": {"sourceUrl": "https://example.test/counts.tif"}}
            (edition / "population.json").write_text(json.dumps(manifest))
            profile = {"id": "test", "population": {"id": "pop", "year": 2020,
                       "url": manifest["source"]["sourceUrl"], "bounds": [0, 0, .001, .001]}}
            self.assertEqual(prepare_population(root, profile), manifest)
            for change in ({"year": 2025}, {"url": "https://example.test/revised.tif"},
                           {"bounds": [0, 0, 1, 1]}):
                with self.assertRaisesRegex(ValueError, "new edition ID"):
                    prepare_population(root, {**profile, "population": {**profile["population"], **change}})

    def test_recovers_missing_and_potentially_torn_tiles_only(self):
        with tempfile.TemporaryDirectory() as directory:
            graph = Path(directory)
            tiles = [{"graphid": {"level": 2, "tile_id": number}, "node_index": number} for number in range(4)]
            for tile in tiles[:3]:
                file = tile_file(graph, tile)
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_bytes(b"x" * 256)
                timestamp = 1_700_000_000 + tile["node_index"]
                os.utime(file, (timestamp, timestamp))
            remaining = pending_tiles(graph, {"tiles": tiles})
            self.assertEqual(len(remaining["tiles"]), 3)
            self.assertIn(tiles[3], remaining["tiles"])
            self.assertNotIn(tiles[0], remaining["tiles"])

            # Coarse filesystem timestamps must not hide a potentially torn file.
            for tile in tiles[:3]:
                os.utime(tile_file(graph, tile), (1_700_000_002, 1_700_000_002))
            self.assertEqual(pending_tiles(graph, {"tiles": tiles})["tiles"], tiles)


if __name__ == "__main__":
    unittest.main()
