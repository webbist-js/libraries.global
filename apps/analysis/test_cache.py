import os
import tempfile
import time
import unittest
from pathlib import Path

from cache import read_artifact, write_artifact, prune_artifacts


class CacheTests(unittest.TestCase):
    def test_route_optimization_cannot_evict_all_user_visible_results(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            key = "b" * 64
            write_artifact(root, "routes", key, {"geometry": list(range(100))})
            write_artifact(root, "results", key, {"residents": 42})
            size = next(root.glob("results/*/*.json.gz")).stat().st_size
            prune_artifacts(root, size)
            self.assertEqual(read_artifact(root, "results", key), {"residents": 42})
            self.assertIsNone(read_artifact(root, "routes", key))

    def test_separate_keys_expiry_and_byte_budget(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            key = "a" * 64
            write_artifact(root, "routes", key, {"geometry": [1, 2, 3]})
            self.assertEqual(read_artifact(root, "routes", key), {"geometry": [1, 2, 3]})
            self.assertIsNone(read_artifact(root, "results", key))
            file = next(root.glob("routes/*/*.json.gz"))
            old = time.time() - 8 * 86400
            os.utime(file, (old, old))
            self.assertIsNone(read_artifact(root, "routes", key))
            self.assertEqual(prune_artifacts(root, 1000)["removed"], 1)
            write_artifact(root, "results", key, {"value": "one"})
            self.assertEqual(prune_artifacts(root, 0)["entries"], 0)


if __name__ == "__main__":
    unittest.main()
