import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from engine import ReachEngine, compatible_result, REACH_METHOD
from population import PopulationCount


class RoutingAvailabilityTests(unittest.TestCase):
    def test_selected_time_reaches_the_router_and_has_a_separate_cache_key(self):
        from shapely.geometry import box, mapping
        from unittest.mock import Mock
        class Actor:
            def locate(self, request): return [{"edges":[{"distance":10}]}]
            def isochrone(self, request):
                self.request = request
                return {"features":[{"properties":{"contour":c["time"]},"geometry":mapping(box(0,0,1,1))} for c in request["contours"]]}
        with tempfile.TemporaryDirectory() as directory:
            engine=ReachEngine(Path(directory))
            actor=Actor()
            with patch.object(engine,"router",return_value=actor) as router:
                request={"lat":52,"lng":0,"mode":"walking","coordinateHash":"a"*64,"minutes":[15]}
                release={"network":{"release":"one"}}
                self.assertEqual(list(engine.full_contours(request,release)["geometries"]),[15])
                self.assertEqual(actor.request["contours"],[{"time":15}])
                engine.full_contours(request,release)
                self.assertEqual(router.call_count,1)
                engine.full_contours({**request,"minutes":[30]},release)
                self.assertEqual(actor.request["contours"],[{"time":30}])
                self.assertEqual(router.call_count,2)

    def test_profile_expansion_reuses_only_identical_analytical_inputs(self):
        request = {"libraryId":"one", "coordinateHash":"a"*64, "mode":"walking"}
        release = {"network":{"release":"graph1"}, "population":{"release":"population1", "year":2020}}
        result = {**request, **release, "method":REACH_METHOD}
        self.assertTrue(compatible_result(result, request, release))
        self.assertFalse(compatible_result({**result, "method":"old"}, request, release))
        self.assertFalse(compatible_result(result, request, {**release, "population":{"release":"population2", "year":2025}}))
        self.assertFalse(compatible_result(result, {**request,"coordinateHash":"b"*64}, release))

    def test_non_cumulative_provider_contours_remain_unavailable(self):
        contours = self.contours()
        contours["10"] = {"type": "Polygon", "coordinates": [[[0, 0], [.1, 0], [.1, .1], [0, 0]]]}
        contours["15"] = contours["30"] = contours["5"]
        with tempfile.TemporaryDirectory() as directory:
            with patch("engine.read_artifact", return_value={"snap": 12.2, "contours": contours}), \
                    patch("engine.count_population", return_value=PopulationCount(1, 1, 1)):
                result = ReachEngine(Path(directory)).compute(
                    {"lat": 53.53, "lng": -.65, "mode": "walking", "coordinateHash": "a" * 64},
                    {"network": {"release": "fixture"}, "populationFiles": ["fixture.tif"]})
                self.assertEqual(result["state"], "unroutable")
                self.assertIn("not cumulative", result["message"])
                self.assertNotIn("residents", result)

    def contours(self):
        return {str(minute): {"type": "Polygon", "coordinates": [] if minute >= 15 else
                [[[0, 0], [1, 0], [1, 1], [0, 0]]]} for minute in (5, 10, 15, 30)}

    def test_cached_empty_polygon_is_unavailable_not_a_zero_or_repeated_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch("engine.read_artifact", return_value={"snap": 12.2, "contours": self.contours()}):
                result = ReachEngine(Path(directory)).compute(
                    {"lat": 53.53, "lng": -.65, "mode": "walking", "coordinateHash": "a" * 64},
                    {"network": {"release": "fixture"}})
                self.assertEqual(result["state"], "unroutable")
                self.assertIn("empty catchment", result["message"])
                self.assertNotIn("residents", result)

    def test_native_empty_contours_are_rejected_before_route_caching(self):
        class Actor:
            def locate(self, _request):
                return [{"edges": [{"distance": 12.2}]}]

            def isochrone(self, _request):
                return {"features": [{"properties": {"contour": int(minute)}, "geometry": geometry}
                                     for minute, geometry in RoutingAvailabilityTests().contours().items()]}

        with tempfile.TemporaryDirectory() as directory:
            engine = ReachEngine(Path(directory))
            with patch.object(engine, "router", return_value=Actor()):
                result = engine.route({"lat": 53.53, "lng": -.65, "mode": "walking"}, {})
                self.assertEqual(result["state"], "unroutable")


if __name__ == "__main__":
    unittest.main()
