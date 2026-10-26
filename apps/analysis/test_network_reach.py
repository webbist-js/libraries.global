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
    @patch("network_reach.count_population")
    def test_large_service_routes_and_counts_only_the_requested_time(self, count):
        count.side_effect = self.count
        with tempfile.TemporaryDirectory() as directory:
            engine = Engine(Path(directory))
            engine.full_contours = Mock(wraps=engine.full_contours)
            result = coverage(engine, {**self.request,"minutes":15,"capacity":1}, self.release, mapping(box(0,0,7,10)))
        self.assertEqual([c["minutes"] for c in result["contours"]], [15])
        from contracts import validate_contract
        validate_contract("networkResult", result)
        with self.assertRaises(ValueError): validate_contract("networkResult", {**result,"requestedMinutes":30})
        context_release = {"id":"community-gb-eng-"+"a"*16,"country":"GB-ENG","assetSha256":"a"*64,"domain":"overall","year":2020,
                           "name":"Fixture","edition":"one","boundary":"fixture","sourceUrl":"https://example.test","licence":"CC0","geometryMethod":"exact"}
        groups = [{"quintile": i+1 if i<5 else None,"totalResidents":0,"contours":[{"minutes":15,"residents":0,"outsideResidents":0,"percent":None,"shareOfOutside":None}]} for i in range(6)]
        groups[0]["totalResidents"] = result["totalResidents"]
        groups[0]["contours"][0].update(residents=result["contours"][0]["residents"], percent=100)
        contextual = {**result,"community":{"schemaVersion":1,"state":"ready","method":"deprivation-partition-equal-area-v1","release":context_release,"groups":groups}}
        validate_contract("networkResult", contextual)
        groups[0]["contours"][0]["minutes"] = 30
        with self.assertRaises(ValueError): validate_contract("networkResult", contextual)
        self.assertEqual(result["requestedMinutes"],15)
        self.assertEqual(count.call_count,2)
        self.assertTrue(all(call.args[0]["minutes"]==[15] for call in engine.full_contours.call_args_list))

    @patch("network_reach.count_population")
    def test_selected_times_reuse_only_the_unchanged_population_denominator(self, count):
        count.side_effect = self.count
        with tempfile.TemporaryDirectory() as directory:
            engine = Engine(Path(directory))
            for minute in (15, 30):
                coverage(engine, {**self.request, "minutes":minute}, self.release, mapping(box(0,0,7,10)))
            self.assertEqual(count.call_count, 3)
            coverage(engine, {**self.request, "minutes":15}, {**self.release,"population":{"release":"new"}}, mapping(box(0,0,7,10)))
            self.assertEqual(count.call_count, 5)

    def test_team_capacity_is_double_and_cannot_be_unbounded(self):
        job={"kind":"network","networkId":"one","networkName":"One","areaCode":"E06000001","selectionHash":"a"*64,
             "mode":"walking","release":"uk-v1","areaVersion":"a"*16,"excludedLibraries":0,"capacity":2,"minutes":15,
             "members":[{"libraryId":str(i),"coordinateHash":"a"*64,"lat":52,"lng":0,"country":"GB-ENG"} for i in range(100)]}
        validate_network_job(job)
        for changed in [{**job,"capacity":3},{**job,"capacity":True},{**job,"minutes":20},
                        {**job,"members":job["members"]+[{**job["members"][0],"libraryId":"extra"}]}]:
            with self.assertRaises(ValueError): validate_network_job(changed)

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
        source={"release":"fixture","source":"Fixture","sourceUrl":"https://example.test","licence":"CC0","year":2020}
        self.release = {"populationFiles":[], "network":source, "population":source}

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
