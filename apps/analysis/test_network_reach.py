import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, Mock
from shapely.geometry import box, mapping, shape, MultiPolygon
from population import PopulationCount
from network_reach import coverage, validate_network_job, calculate_network, display_geometry, local_bounds


class Engine:
    def __init__(self, root, fail=False): self.root, self.fail = root, fail
    def full_contours(self, member, release):
        if self.fail and member["libraryId"] == "b": return {"state": "unroutable"}
        geometry = box(0, 0, 6, 10) if member["libraryId"] == "a" else box(4, 0, 8, 10)
        return {"geometries": {minute:geometry for minute in (5,10,15,30)}}


class NetworkCoverageTest(unittest.TestCase):
    def test_display_rounding_repairs_collapsed_coastline_slivers(self):
        geometry = MultiPolygon([box(0,0,7,7),box(8,0,9,0.00000001)])
        displayed = shape(display_geometry(geometry))
        self.assertTrue(displayed.is_valid)
        self.assertEqual(displayed.area,49)

    def test_contract_rejects_extra_origins_and_duplicate_members(self):
        job = {"kind":"network", "networkId":"one", "networkName":"One", "areaCode":"E06000001", "selectionHash":"a"*64,
               "mode":"walking", "release":"uk-v1", "areaVersion":"a"*16, "excludedLibraries":0,
               "members":[{"libraryId":"one", "coordinateHash":"a"*64, "lat":52, "lng":0, "country":"GB-ENG"}]}
        validate_network_job(job)
        with self.assertRaises(ValueError): validate_network_job({**job, "lat":52})
        with self.assertRaises(ValueError): validate_network_job({**job, "members":job["members"]*2})
        with self.assertRaises(ValueError):
            validate_network_job({**job, "members":[{**job["members"][0], "libraryId":str(index)} for index in range(51)]})
        with self.assertRaisesRegex(ValueError, "local Reach"):
            validate_network_job({**job, "members":[job["members"][0], {**job["members"][0], "libraryId":"far", "lat":57}]})

    def test_local_envelope_rejects_national_and_invalid_bounds(self):
        self.assertTrue(local_bounds((-3.2,53.3,-3,53.5)))
        self.assertFalse(local_bounds((-8,50,2,60)))
        self.assertFalse(local_bounds((0,0,.5,.5)))  # Under 75 km per side, over 2,500 km².
        self.assertFalse(local_bounds((float("nan"),0,1,1)))

    def test_rejects_cross_nation_community_comparison(self):
        job = {"kind":"network", "networkId":"one", "networkName":"One", "areaCode":"E06000001", "selectionHash":"a"*64,
               "mode":"walking", "release":"uk-v1", "areaVersion":"a"*16, "excludedLibraries":0,
               "members":[{"libraryId":"one", "coordinateHash":"a"*64, "lat":52, "lng":0, "country":"GB-ENG"}],
               "communityRelease":"community-gb-sct-" + "a"*16}
        with self.assertRaisesRegex(ValueError, "national"):
            validate_network_job(job)

    def setUp(self):
        self.request = {"networkId":"one", "networkName":"One", "areaCode":"E06000001", "selectionHash":"a"*64,
                        "mode":"walking", "members":[{"libraryId":"a"},{"libraryId":"b"}], "excludedLibraries":0}
        self.release = {"populationFiles":[], "network":{}, "population":{}}

    def count(self, geometry, *_args, **_kwargs):
        return PopulationCount(shape(geometry).area * 10, 1, 1)

    @patch("network_reach.count_population")
    def test_overlap_is_counted_once_and_clipped_to_reporting_area(self, count):
        count.side_effect = self.count
        with tempfile.TemporaryDirectory() as directory:
            result = coverage(Engine(Path(directory)), self.request, self.release, mapping(box(0,0,7,10)))
        self.assertEqual(result["totalResidents"],700)
        self.assertEqual(result["contours"][0]["residents"],700)
        self.assertEqual(result["contours"][0]["percent"],100)
        self.assertEqual(result["contours"][0]["outsideResidents"],0)

    @patch("network_reach.count_population")
    def test_failed_origin_does_not_turn_into_a_proven_gap(self, count):
        count.side_effect = self.count
        with tempfile.TemporaryDirectory() as directory:
            result = coverage(Engine(Path(directory), True), self.request, self.release, mapping(box(0,0,10,10)))
        self.assertEqual(result["state"], "partial")
        self.assertEqual(result["unavailableLibraries"],1)
        self.assertIsNone(result["contours"][0]["outsideResidents"])
        self.assertIsNone(result["contours"][0]["percent"])

    @patch("network_reach.count_population")
    def test_service_reporting_units_are_unioned_before_counting(self, count):
        count.side_effect = self.count
        job = {**self.request, "kind":"network", "release":"one", "areaVersion":"a"*16,
               "areaCodes":["E06000001", "E06000002"],
               "members":[{"libraryId":name, "coordinateHash":"a"*64, "lat":52, "lng":0, "country":"GB-ENG"} for name in ("a","b")]}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            catalogue = {"version":"a"*16, "features":[
                {"properties":{"code":"E06000001"}, "geometry":mapping(box(0,0,5,10))},
                {"properties":{"code":"E06000002"}, "geometry":mapping(box(4,0,7,10))}]}
            (root / "reporting-areas.json").write_text(json.dumps(catalogue))
            # Abstract geometry checks below use unit squares rather than degrees.
            with patch("network_reach.local_bounds", return_value=True):
                result = calculate_network(Engine(root), job, self.release)
        self.assertEqual(result["totalResidents"],700)
        self.assertEqual(result["contours"][0]["residents"],700)
        self.assertEqual(result["areaCodes"],job["areaCodes"])

    @patch("network_reach.count_population")
    def test_invalid_district_coastline_is_repaired_before_service_union(self, count):
        count.side_effect = self.count
        job = {**self.request, "kind":"network", "release":"one", "areaVersion":"a"*16,
               "areaCodes":["E06000001", "E06000002"],
               "members":[{"libraryId":name, "coordinateHash":"a"*64, "lat":52, "lng":0, "country":"GB-ENG"} for name in ("a","b")]}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            invalid = {"type":"Polygon","coordinates":[[[4,0],[7,10],[4,10],[7,0],[4,0]]]}
            catalogue = {"version":"a"*16, "features":[
                {"properties":{"code":"E06000001"}, "geometry":mapping(box(0,0,5,10))},
                {"properties":{"code":"E06000002"}, "geometry":invalid}]}
            (root / "reporting-areas.json").write_text(json.dumps(catalogue))
            with patch("network_reach.local_bounds", return_value=True):
                result = calculate_network(Engine(root), job, self.release)
        self.assertAlmostEqual(result["totalResidents"],1850/3)
        self.assertAlmostEqual(result["contours"][0]["residents"],1850/3)

    def test_large_reporting_area_is_rejected_before_any_routing_or_population_work(self):
        job = {**self.request, "kind":"network", "release":"one", "areaVersion":"a"*16,
               "members":[{"libraryId":"a", "coordinateHash":"a"*64, "lat":52, "lng":0, "country":"GB-ENG"}]}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "reporting-areas.json").write_text(json.dumps({"version":"a"*16, "features":[
                {"properties":{"code":"E06000001"}, "geometry":mapping(box(-8,50,2,60))}]}))
            engine = Engine(root)
            engine.full_contours = Mock()
            with patch("network_reach.count_population") as count:
                with self.assertRaisesRegex(ValueError, "local Reach"):
                    calculate_network(engine, job, self.release)
                engine.full_contours.assert_not_called()
                count.assert_not_called()

    @patch("network_reach.count_population")
    def test_disjoint_area_is_zero_coverage(self, count):
        count.side_effect = self.count
        with tempfile.TemporaryDirectory() as directory:
            result = coverage(Engine(Path(directory)), self.request, self.release, mapping(box(20,0,30,10)))
        self.assertEqual(result["contours"][0]["residents"],0)
        self.assertEqual(result["contours"][0]["outsideResidents"],1000)
        self.assertTrue(result["contours"][0]["empty"])

if __name__ == "__main__": unittest.main()
