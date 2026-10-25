import json
import unittest
from pathlib import Path

from contracts import validate_contract


class ContractTests(unittest.TestCase):
    def test_shared_typescript_and_native_conformance_cases(self):
        fixtures = json.loads((Path(__file__).parent / "contracts/conformance.json").read_text())
        for fixture in fixtures:
            with self.subTest(fixture["name"]):
                if fixture["valid"]:
                    validate_contract(fixture["contract"], fixture["value"])
                    if fixture["contract"] == "result":
                        for contour in fixture["value"]["contours"]:
                            contour["geometry"]["coordinates"] = tuple(
                                tuple(tuple(point) for point in ring)
                                for ring in contour["geometry"]["coordinates"])
                        validate_contract("result", fixture["value"])
                else:
                    with self.assertRaises(ValueError):
                        validate_contract(fixture["contract"], fixture["value"])

    def test_private_job_rejects_missing_release_and_browser_origins(self):
        job = {"libraryId": "example", "coordinateHash": "a" * 64,
               "mode": "walking", "lat": 51.5, "lng": -.1,
               "country": "GB-ENG", "release": "test-release"}
        validate_contract("job", job)
        for changed in ({**job, "lat": True}, {**job, "lat": 91},
                        {**job, "mode": "driving"}, {**job, "origin": "browser"},
                        {key: value for key, value in job.items() if key != "release"}):
            with self.assertRaises(ValueError):
                validate_contract("job", changed)


if __name__ == "__main__":
    unittest.main()
