"""Private computation: native routing and windowed population intersection."""
from __future__ import annotations

import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

from shapely import make_valid, union_all
from shapely.geometry import mapping, shape
from valhalla import Actor

from population import count_population
from cache import read_artifact, write_artifact

MINUTES = (5, 10, 15, 30)
REACH_METHOD = "reverse-network-cumulative-v3; exact equal-area fractional population cells"

def compatible_result(candidate, request, release):
    return candidate is not None and all(candidate.get(field) == request[field] for field in ("libraryId", "coordinateHash", "mode")) and candidate.get("network") == release["network"] and candidate.get("population") == release["population"] and candidate.get("method") == REACH_METHOD


def routing_unavailable(reason):
    return {"state": "unroutable", "message": reason + " No population estimate is available."}


def empty_contour_outcome(contours):
    if any(shape(geometry).is_empty for geometry in contours.values()):
        return routing_unavailable("Routing returned empty catchment boundaries for a requested travel time.")
    return None


def inside(root: Path, relative: str) -> Path:
    candidate = (root / relative).resolve()
    if not candidate.is_relative_to(root.resolve()):
        raise ValueError("Invalid asset location")
    return candidate


def active_releases(root: Path) -> list[dict]:
    index = root / "active.json"
    if not index.exists():
        return []
    if index.stat().st_size > 1_000_000:
        raise ValueError("Release catalogue exceeds budget")
    entries = json.loads(index.read_text())
    if not isinstance(entries, list) or len(entries) > 512:
        raise ValueError("Invalid release catalogue")
    return entries


def select_release(root: Path, lat: float, lng: float, country: str) -> dict | None:
    matches = [entry for entry in active_releases(root)
               if country in entry["countries"] and entry["originBounds"][0] <= lng <= entry["originBounds"][2]
               and entry["originBounds"][1] <= lat <= entry["originBounds"][3]]
    if len(matches) > 1:
        raise ValueError("Ambiguous analysis coverage")
    return matches[0] if matches else None


class ReachEngine:
    def __init__(self, root: Path):
        self.root = root.resolve()
        self.actor = None
        self.loaded_release = None

    def router(self, release: dict):
        if self.loaded_release != release["id"]:
            config = json.loads(inside(self.root, release["configFile"]).read_text())
            config["mjolnir"]["tile_dir"] = str(inside(self.root, release["graphDirectory"]))
            config["mjolnir"].pop("tile_extract", None)
            config["mjolnir"].pop("traffic_extract", None)
            if release.get("adminFile"):
                config["mjolnir"]["admin"] = str(inside(self.root, release["adminFile"]))
            config["mjolnir"]["max_cache_size"] = 256 * 1024 * 1024
            config["mjolnir"]["use_lru_mem_cache"] = True
            config["service_limits"]["allow_hard_exclusions"] = True
            self.actor = Actor(config)
            self.loaded_release = release["id"]
        return self.actor

    def full_contours(self, request: dict, release: dict):
        routing_key = hashlib.sha256(json.dumps([request["coordinateHash"], request["mode"], release["network"]["release"], "reverse-routing-v1-hard-ferries"], separators=(",", ":")).encode()).hexdigest()
        routing = read_artifact(self.root, "routes", routing_key)
        if routing is None:
            routing = self.route(request, release)
            if "state" in routing:
                return routing
            write_artifact(self.root, "routes", routing_key, routing)
        unavailable = empty_contour_outcome(routing["contours"])
        if unavailable:
            return unavailable
        snap = routing["snap"]
        geometries = {int(minute): shape(geometry) for minute, geometry in routing["contours"].items()}
        previous = None
        for minute in MINUTES:
            geometry = geometries[minute]
            if not geometry.is_valid:
                repaired = make_valid(geometry)
                if repaired.geom_type == "GeometryCollection":
                    repaired = union_all([part for part in repaired.geoms if part.geom_type in {"Polygon", "MultiPolygon"}])
                if abs(repaired.area - geometry.area) > max(geometry.area * .001, 1e-12):
                    return routing_unavailable("Routing topology could not be validated within the repair tolerance.")
                geometry = repaired
            if previous is not None:
                if previous.difference(geometry).area > max(geometry.area * .01, 1e-12):
                    return routing_unavailable("Routing boundaries are not cumulative within the nesting tolerance.")
                geometry = union_all([previous, geometry])
            if geometry.geom_type not in {"Polygon", "MultiPolygon"} or geometry.is_empty:
                return routing_unavailable("Routing did not return a valid catchment polygon.")
            previous = geometry
            geometries[minute] = geometry
        return {"snap": snap, "geometries": geometries}

    def compute(self, request: dict, release: dict) -> dict:
        lat, lng = request["lat"], request["lng"]
        if request["mode"] not in {"walking", "cycling"}:
            raise ValueError("Unsupported mode")
        if not isinstance(lat, (float, int)) or not isinstance(lng, (float, int)) or not math.isfinite(lat + lng):
            raise ValueError("Invalid origin")
        routing = self.full_contours(request, release)
        if "state" in routing:
            return routing
        snap = routing["snap"]
        geometries = routing["geometries"]
        files = [inside(self.root, file) for file in release["populationFiles"]]
        contours = []
        previous = None
        previous_residents = 0.0
        for minute in MINUTES:
            geometry = geometries[minute]
            population = count_population(mapping(geometry), files)
            residents = population.residents
            if residents is not None:
                if residents < previous_residents - .0001:
                    raise ValueError("Cumulative population decreased")
                residents = max(residents, previous_residents)
                previous_residents = residents
            # Analytical geometry above stays full precision. Display simplification
            # never feeds back into population counts or future recalculation.
            display = geometry.simplify(.0001, preserve_topology=True)
            contours.append({"minutes": minute, "residents": residents,
                             "coveredFraction": population.covered_fraction, "geometry": mapping(display)})
        complete = all(contour["residents"] is not None for contour in contours)
        return {"schemaVersion": 1, "state": "ready" if complete else "partial", "libraryId": request["libraryId"],
                "coordinateHash": request["coordinateHash"], "mode": request["mode"],
                "calculatedAt": datetime.now(timezone.utc).isoformat(),
                "method": REACH_METHOD,
                "snapDistanceMetres": snap, "network": release["network"], "population": release["population"],
                "warnings": ["Walking and cycling times are estimates; a walking profile does not guarantee step-free access.",
                             "No elevation model, opening hours or temporary changes are included. Ferries are excluded."]
                    + ([] if complete else ["Some catchment population coverage is missing; unavailable counts remain unknown."]),
                "contours": contours}

    def route(self, request: dict, release: dict):
        lat, lng = request["lat"], request["lng"]
        actor = self.router(release)
        costing = "pedestrian" if request["mode"] == "walking" else "bicycle"
        location = {"lat": lat, "lon": lng, "radius": 100, "search_cutoff": 100, "minimum_reachability": 0,
                    "search_filter": {"exclude_ferry": True}}
        located = actor.locate({"locations": [location], "costing": costing, "verbose": True})
        distances = [edge["distance"] for edge in located[0].get("edges", [])
                     if isinstance(edge.get("distance"), (int, float)) and math.isfinite(edge["distance"]) and edge["distance"] >= 0]
        if not distances or min(distances) > 100:
            return {"state": "unroutable", "message": "No suitable walking or cycling network within 100 metres."}
        snap = min(distances)
        options = {"pedestrian": {"walking_speed": 5.1, "use_ferry": 0, "exclude_ferries": True},
                   "bicycle": {"cycling_speed": 15, "bicycle_type": "Hybrid", "use_ferry": 0, "exclude_ferries": True}}
        output = actor.isochrone({"locations": [location], "costing": costing, "costing_options": options,
                                  "reverse": True, "polygons": True, "denoise": 0,
                                  "generalize": 0, "contours": [{"time": minute} for minute in MINUTES]})
        geometries = {int(feature["properties"]["contour"]): shape(feature["geometry"])
                      for feature in output["features"] if feature["geometry"]["type"] in {"Polygon", "MultiPolygon"}}
        if set(geometries) != set(MINUTES):
            return routing_unavailable("Routing did not return every requested catchment boundary.")
        unavailable = empty_contour_outcome({minute: mapping(geometry) for minute, geometry in geometries.items()})
        if unavailable:
            return unavailable
        return {"snap": snap, "contours": {str(minute): mapping(geometries[minute]) for minute in MINUTES}}


def calculation_key(request: dict, release: dict) -> str:
    return hashlib.sha256(json.dumps([request["libraryId"], request["coordinateHash"], request["mode"],
                                     release["id"], "reach-v1"], separators=(",", ":")).encode()).hexdigest()
