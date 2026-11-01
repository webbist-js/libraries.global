import json
import tempfile
import unittest
from pathlib import Path
import osmium
from routing_buffer import merge_sorted


class RoutingBufferTests(unittest.TestCase):
    def test_overlap_is_deduplicated_and_latest_object_keeps_references(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first, second, output = root / "one.osm", root / "two.osm", root / "merged.osm.pbf"
            first.write_text('<osm version="0.6"><node id="1" version="1" lat="45" lon="7"/><way id="10" version="1"><nd ref="1"/></way></osm>')
            second.write_text('<osm version="0.6"><node id="1" version="2" lat="45.1" lon="7"/><node id="2" version="1" lat="45.2" lon="7"/><way id="10" version="2"><nd ref="1"/><nd ref="2"/></way></osm>')
            self.assertEqual(merge_sorted([first, second], output, reserve_bytes=0), 3)
            result = []
            for obj in osmium.FileProcessor(output):
                result.append((obj.type_str(), obj.id, obj.version, [n.ref for n in obj.nodes] if obj.is_way() else obj.location.lat))
            self.assertEqual(result, [("n", 1, 2, 45.1), ("n", 2, 1, 45.2), ("w", 10, 2, [1, 2])])

    def test_activation_rejects_missing_border_sources_without_changing_active_release(self):
        from prepare import activate
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            graph, population = root / "network.json", root / "population.json"
            graph.write_text(json.dumps({"source": {"sources": [{"url": "https://example.test/italy.pbf"}]}}))
            population.write_text("{}")
            active = root / "active.json"
            active.write_text('{"release": "existing"}')
            profile = {"network": {"url": "https://example.test/italy.pbf",
                "bufferSources": [{"url": "https://example.test/neighbour.pbf"}]}}
            with self.assertRaisesRegex(ValueError, "neighbouring"):
                activate(root, graph, population, profile)
            self.assertEqual(json.loads(active.read_text()), {"release": "existing"})

    def test_unsorted_source_is_not_silently_merged(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "bad.osm"
            source.write_text('<osm version="0.6"><node id="2" version="1" lat="45" lon="7"/><node id="1" version="1" lat="45" lon="7"/></osm>')
            with self.assertRaisesRegex(ValueError, "strictly sorted"):
                merge_sorted([source], root / "bad.osm.pbf", reserve_bytes=0)


if __name__ == "__main__":
    unittest.main()
