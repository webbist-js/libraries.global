"""Prepare buffered UK profiles, validate every canary, then activate atomically."""
import argparse
import fcntl
import json
from pathlib import Path

from prepare import activate, prepare_graph, prepare_population
from engine import active_releases
from sources import write_json


def assets(root, profile):
    graphs = [p for p in root.glob("releases/*/network.json") if json.loads(p.read_text())["source"]["url"] == profile["network"]["url"]]
    populations = [p for p in root.glob("releases/*/population.json") if json.loads(p.read_text())["population"]["release"] == profile["population"]["id"]]
    if not graphs:
        graph = prepare_graph(root, profile)
        graphs = [(root / graph["graphDirectory"]).parent / "network.json"]
    if not populations:
        surface = prepare_population(root, profile)
        populations = [(root / surface["populationFiles"][0]).parent / "population.json"]
    return max(graphs, key=lambda p:p.stat().st_mtime), max(populations, key=lambda p:p.stat().st_mtime)


def prepare(root, apply=False):
    profiles = [json.loads((Path(__file__).parent / f"profiles/{name}.json").read_text()) for name in ("uk", "northern-ireland")]
    boundaries = json.loads((Path(__file__).parents[2] / "packages/shared-data/atlas/data/local-boundaries.json").read_text())
    if not apply:
        return {"dryRun": True, "countries": [country for profile in profiles for country in profile["countries"]], "reportingAreas": len(boundaries["features"])}
    root.mkdir(parents=True, exist_ok=True)
    with (root / ".prepare-lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        # Ireland's full network buffers NI's land border; the original UK
        # graph remains sufficient for England, Wales and Scotland.
        prepared = [(profile, *assets(root, profile)) for profile in profiles]
        releases = [activate(root, graph, population, profile, publish=False) for profile, graph, population in prepared]
        retired = {"england", "uk", "northern-ireland"}
        retained = [entry for entry in active_releases(root) if entry.get("profile") not in retired]
        candidates = [*retained, *releases]
        for index, left in enumerate(candidates):
            for right in candidates[index+1:]:
                a,b=left["originBounds"],right["originBounds"]
                if set(left["countries"]) & set(right["countries"]) and max(a[0],b[0]) < min(a[2],b[2]) and max(a[1],b[1]) < min(a[3],b[3]):
                    raise ValueError("Overlapping UK origin profiles")
        write_json(root / "reporting-areas.json", boundaries)
        write_json(root / "active.json", candidates)
        return {"releases": [entry["id"] for entry in releases], "canaries": "ready"}


if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--root",required=True)
    parser.add_argument("--apply",action="store_true")
    args=parser.parse_args()
    print(json.dumps(prepare(Path(args.root).resolve(),args.apply)))
