import copy
import tempfile
import unittest
from pathlib import Path
from shapely.geometry import box, shape, mapping
from prepare_europe_context import esri_polygon, join_irish_context, POBAL_CLASSES
from prepare_context import publish
from context_layers import point


class EuropeContextTests(unittest.TestCase):
    def setUp(self):
        self.boundaries = {"a": box(-7, 53, -6.5, 54), "b": box(-6.5, 53, -6, 54)}
        self.observations = {"areas": [{"code": code, "name": code, "households": 10,
            "withoutCar": 2, "notStated": 1, "withoutCarPercent": 20} for code in self.boundaries],
            "deprivationGroups": [{"sourceCode": "001", "memberGuids": ["a", "b"], "population": 30,
                "deprivation": {"name": "Combined", "population": 30, "relativeScore": -12.5,
                    "category": "Disadvantaged"}}]}

    def test_native_rings_keep_holes_and_nested_islands_regardless_of_winding(self):
        rings = [list(box(0, 0, 10, 10).exterior.coords), list(box(2, 2, 8, 8).exterior.coords),
                 list(box(3, 3, 4, 4).exterior.coords)]
        polygon = shape(esri_polygon(rings))
        self.assertEqual(polygon.area, 65)
        self.assertEqual(shape(esri_polygon([r[::-1] for r in rings])).area, 65)
        with self.assertRaisesRegex(ValueError, "Unclosed"):
            esri_polygon([rings[0][:-1]])

    def test_split_division_unioned_once_and_native_category_retained(self):
        cars, deprivation = join_irish_context(self.observations, self.boundaries)
        self.assertEqual(len(cars), 2)
        self.assertEqual(len(deprivation), 1)
        self.assertEqual(shape(deprivation[0]["geometry"]).area, 1)
        self.assertEqual(deprivation[0]["properties"]["population"], 30)
        self.assertEqual(deprivation[0]["properties"]["category"], "Disadvantaged")
        self.assertNotIn("rank", deprivation[0]["properties"])
        self.assertEqual(cars[0]["properties"]["notStated"], 1)

    def test_missing_overlapping_or_unreconciled_groups_fail(self):
        for change in [lambda o: o["deprivationGroups"].append(copy.deepcopy(o["deprivationGroups"][0])),
                       lambda o: o["deprivationGroups"][0].update(population=31),
                       lambda o: o["deprivationGroups"][0].update(memberGuids=["a"]),
                       lambda o: o["deprivationGroups"][0]["deprivation"].update(category="Unknown")]:
            observations = copy.deepcopy(self.observations)
            change(observations)
            with self.assertRaises(ValueError):
                join_irish_context(observations, self.boundaries)

    def test_native_category_publication_and_lookup_do_not_require_deciles(self):
        _, features = join_irish_context(self.observations, self.boundaries)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "context").mkdir()
            release = publish(root, {"edition": "Pobal test", "theme": "deprivation", "country": "IE",
                "areaCount": 1, "classification": "source-categories", "categories": [
                    {"value": i + 1, "label": label, "color": color} for i, (label, color) in enumerate(POBAL_CLASSES)]}, features)
            area = point(root, release, -6.8, 53.5)["area"]
            self.assertEqual(area["category"], "Disadvantaged")
            self.assertEqual(area["relativeScore"], -12.5)
            self.assertNotIn("rank", area)


if __name__ == "__main__":
    unittest.main()
