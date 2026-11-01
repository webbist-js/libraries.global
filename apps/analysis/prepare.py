"""Finite preparation commands. Large graph/surface files are never CMS rows."""
import argparse
import fcntl
import hashlib
import json
import os
import re
import shutil
import subprocess
import time
from pathlib import Path

from sources import download, sha256, write_json

NETWORK_URL = "https://download.geofabrik.de/europe/united-kingdom-latest.osm.pbf"
POPULATION_URL = "https://jrc-ghsl.s3.eu-central-1.amazonaws.com/ghs-pop/r2023a/54009/100m/2020/GHS_POP_E2020_GLOBE_R2023A_54009_100_V1_0.tif"


def tile_file(graph: Path, tile: dict) -> Path:
    identifier = tile["graphid"]
    digits = f"{identifier['tile_id']:09d}"
    return graph / str(identifier["level"]) / digits[:3] / digits[3:6] / f"{digits[6:]}.gph"


def pending_tiles(graph: Path, full: dict) -> dict:
    """One writer: replay its two newest files and any timestamp ties."""
    files = [tile_file(graph, tile) for tile in full["tiles"]]
    present = sorted((file for file in files if file.exists()), key=lambda file: file.stat().st_mtime_ns, reverse=True)
    cutoff = present[min(1, len(present) - 1)].stat().st_mtime_ns if present else None
    uncertain = {file for file in present if file.stat().st_mtime_ns >= cutoff}
    return {"tiles": [tile for tile in full["tiles"] if tile_file(graph, tile) in uncertain or not tile_file(graph, tile).exists() or tile_file(graph, tile).stat().st_size < 256]}


def routing_source(root: Path, profile: dict, refresh=False):
    """Retain reference-complete routing objects, not buildings/land-use data."""
    if profile["network"].get("bufferSources"):
        from routing_buffer import buffered_source
        return buffered_source(root, profile, refresh)
    import osmium
    compact = root / f"sources/{profile['id']}-routing.osm.pbf"
    metadata = compact.with_suffix(".pbf.json")
    if compact.exists() and metadata.exists() and not refresh:
        previous = json.loads(metadata.read_text())
        if previous["source"]["url"] != profile["network"]["url"] or previous["sha256"] != sha256(compact):
            raise ValueError("Prepared routing source mismatch")
        return compact, previous["source"]
    source = root / f"sources/{profile['id']}.osm.pbf"
    snapshot = download(profile["network"]["url"], source, profile["network"]["maxBytes"], refresh=refresh, workers=profile["network"].get("downloadWorkers", 1))
    temporary = compact.with_name(compact.stem + ".part.osm.pbf")
    print(json.dumps({"stage": "routing-compact", "profile": profile["id"], "sourceBytes": source.stat().st_size}), flush=True)
    processor = osmium.FileProcessor(source).with_filter(osmium.filter.KeyFilter("highway", "barrier", "route", "type", "railway", "public_transport"))
    next_check = time.monotonic() + 2
    with osmium.BackReferenceWriter(temporary, ref_src=source, overwrite=True, remove_tags=False, relation_depth=1) as writer:
        for obj in processor:
            tags = obj.tags
            if "highway" in tags or "barrier" in tags or tags.get("route") in {"bicycle", "hiking", "foot", "ferry"} or tags.get("type") in {"restriction", "connectivity"} or tags.get("boundary") == "administrative" or tags.get("railway") == "platform" or tags.get("public_transport") == "platform":
                writer.add(obj)
            if time.monotonic() >= next_check:
                if shutil.disk_usage(root).free < 2 * 1024 ** 3:
                    raise ValueError("Routing source preparation reached disk reserve")
                next_check = time.monotonic() + 2
    temporary.replace(compact)
    write_json(metadata, {"sha256": sha256(compact), "bytes": compact.stat().st_size, "source": snapshot,
                          "selection": "reference-complete-routing-v1; original node/way tags and administrative/restriction relations"})
    # The immutable graph and compact input are reproducible from the source
    # hash. Avoid retaining a second multi-gigabyte copy of unrelated OSM data.
    if not profile["network"].get("retainDownload", False):
        source.unlink()
    print(json.dumps({"stage": "routing-compacted", "profile": profile["id"], "bytes": compact.stat().st_size}), flush=True)
    return compact, snapshot


def prepare_graph(root: Path, profile: dict, refresh=False):
    from valhalla import get_config
    from valhalla._scripts import PYVALHALLA_BIN_DIR
    from valhalla import __version__
    source, snapshot = routing_source(root, profile, refresh)
    graph_id = f"osm-{profile['id']}-{snapshot['sha256'][:16]}-v{__version__}-r1"
    directory = root / "releases" / graph_id
    graph = directory / "graph"
    graph.mkdir(parents=True, exist_ok=True)
    manifest = directory / "network.json"
    if manifest.exists():
        return json.loads(manifest.read_text())
    parsed = directory / "parsed.json"
    minimum_free = profile["network"].get("minimumBuildFreeBytes", 14 * 1024 ** 3)
    if not parsed.exists() and shutil.disk_usage(root).free < minimum_free:
        raise ValueError(f"Graph preparation requires {minimum_free / 1024 ** 3:g} GiB free after source preparation")
    config = get_config(tile_dir=graph, tile_extract="", verbose=True)
    config["mjolnir"]["concurrency"] = 1
    config["mjolnir"]["max_cache_size"] = 256 * 1024 * 1024
    admin_file = directory / "admins.sqlite"
    config["mjolnir"]["admin"] = str(admin_file)
    config_file = directory / "valhalla.json"
    write_json(config_file, config)
    started = time.time()

    def native(program, arguments):
        print(json.dumps({"stage": program, "arguments": arguments[:4]}), flush=True)
        with (directory / "build.log").open("a") as log:
            child = subprocess.Popen([str(PYVALHALLA_BIN_DIR / program), "-c", str(config_file), *arguments, str(source)],
                                     cwd=directory, stdout=log, stderr=subprocess.STDOUT)
            try:
                while child.poll() is None:
                    if shutil.disk_usage(root).free < 2 * 1024 ** 3:
                        raise ValueError("Graph build reached disk reserve; previous release retained")
                    time.sleep(2)
                if child.returncode:
                    raise ValueError(f"{program} failed (exit {child.returncode}); inspect the private build log")
            except BaseException:
                child.terminate()
                child.wait(timeout=30)
                raise

    if not admin_file.exists():
        native("valhalla_build_admins", [])
    import sqlite3
    with sqlite3.connect(f"file:{admin_file}?mode=ro", uri=True) as database:
        if database.execute("PRAGMA integrity_check").fetchone()[0] != "ok" or database.execute("SELECT count(*) FROM admins").fetchone()[0] == 0:
            raise ValueError("Routing administrative database is invalid")
    if parsed.exists():
        if json.loads(parsed.read_text())["sourceHash"] != snapshot["sha256"]:
            raise ValueError("Parsing checkpoint does not match the source")
        if not (graph / "osmdata_counts.bin").exists():
            raise ValueError("Native parsing checkpoint is incomplete; remove parsed.json and rerun preparation")
    else:
        native("valhalla_build_tiles", ["-j", "1", "-e", "parsenodes"])
        write_json(parsed, {"sourceHash": snapshot["sha256"], "engineVersion": __version__})
    tile_manifest = graph / "tile_manifest.json"
    full_manifest = directory / "tile_manifest.full.json"
    if not full_manifest.exists():
        # Valhalla writes this complete JSON only after BuildEdges finishes.
        # A partial tile build may therefore reuse it with the same source key.
        if not tile_manifest.exists():
            native("valhalla_build_tiles", ["-j", "1", "-s", "constructedges", "-e", "constructedges"])
        full = json.loads(tile_manifest.read_text())
        if not full.get("tiles") or any(not (graph / name).exists() for name in ("nodes.bin", "edges.bin", "osmdata_counts.bin")):
            raise ValueError("Constructed graph checkpoint is incomplete")
        write_json(full_manifest, full)
    full = json.loads(full_manifest.read_text())
    built = directory / "built.json"
    if not built.exists():
        remaining = pending_tiles(graph, full)
        print(json.dumps({"stage": "resume-tiles", "total": len(full["tiles"]), "remaining": len(remaining["tiles"])}), flush=True)
        # The native build stage accepts its own tile manifest. Enhancement,
        # hierarchy, restrictions and validation subsequently see ALL files.
        write_json(tile_manifest, remaining)
        native("valhalla_build_tiles", ["-j", "1", "-s", "build", "-e", "build"])
        if any(not tile_file(graph, tile).exists() for tile in full["tiles"]):
            raise ValueError("Native tile build is incomplete")
        write_json(tile_manifest, full)
        write_json(built, {"sourceHash": snapshot["sha256"], "baseTiles": len(full["tiles"])})
    else:
        if json.loads(built.read_text())["sourceHash"] != snapshot["sha256"]:
            raise ValueError("Built graph checkpoint does not match the source")
        write_json(tile_manifest, full)
    native("valhalla_build_tiles", ["-j", "1", "-s", "enhance"])
    tile_count = sum(1 for _ in graph.rglob("*.gph"))
    if not tile_count:
        raise ValueError("Graph contains no routing tiles")
    result = {"id": graph_id, "graphDirectory": str(graph.relative_to(root)),
              "configFile": str(config_file.relative_to(root)), "adminFile": str(admin_file.relative_to(root)), "source": snapshot, "engineVersion": __version__,
              "tiles": tile_count, "adminSha256": sha256(admin_file), "buildSeconds": time.time() - started,
              "network": {"release": graph_id, **{key: profile["network"][key] for key in ("source", "sourceUrl", "licence")}}}
    write_json(manifest, result)
    return result


def prepare_population(root: Path, profile: dict):
    import numpy as np
    import rasterio
    from rasterio.windows import from_bounds, Window, transform as window_transform
    from rasterio.warp import transform_bounds
    from population import validate_surface
    destination = root / f"releases/{profile['population']['id']}-{profile['id']}-v1"
    destination.mkdir(parents=True, exist_ok=True)
    manifest = destination / "population.json"
    if manifest.exists():
        existing = json.loads(manifest.read_text())
        if (existing["source"]["sourceUrl"] != profile["population"]["url"]
                or existing["population"]["release"] != profile["population"]["id"]
                or existing["population"]["year"] != profile["population"]["year"]):
            raise ValueError("Prepared population edition does not match profile; use a new edition ID")
        from engine import inside
        if len(existing["populationFiles"]) != 1:
            raise ValueError("Invalid prepared population files")
        file = inside(root, existing["populationFiles"][0])
        if existing["sha256"] != sha256(file):
            raise ValueError("Prepared population hash mismatch")
        with rasterio.open(file) as source:
            desired = transform_bounds("EPSG:4326", source.crs, *profile["population"]["bounds"], densify_pts=21)
            actual = source.bounds
            tolerance = max(source.res) * 1e-6
            if (actual.left > desired[0] + tolerance or actual.bottom > desired[1] + tolerance
                    or actual.right < desired[2] - tolerance or actual.top < desired[3] - tolerance):
                raise ValueError("Prepared population extent is too small; use a new edition ID")
        return existing
    if shutil.disk_usage(root).free < 3 * 1024 ** 3:
        raise ValueError("Population preparation requires 3 GiB free")
    target = destination / "population.tif"
    temporary = destination / "population.tmp.tif"
    # Only the GB window is read over HTTP ranges from the JRC-managed raster.
    with rasterio.Env(GDAL_CACHEMAX=64 * 1024 ** 2, GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif"):
        with rasterio.open(profile["population"]["url"]) as source:
            bounds = transform_bounds("EPSG:4326", source.crs, *profile["population"]["bounds"], densify_pts=21)
            raw = from_bounds(*bounds, transform=source.transform)
            left, top = int(np.floor(raw.col_off)), int(np.floor(raw.row_off))
            window = Window(left, top, int(np.ceil(raw.col_off + raw.width)) - left,
                            int(np.ceil(raw.row_off + raw.height)) - top)
            if window.width * window.height > 250_000_000:
                raise ValueError("Population preparation window exceeds budget")
            output_profile = source.profile.copy()
            output_profile.update(driver="GTiff", width=int(window.width), height=int(window.height),
                           transform=window_transform(window, source.transform), tiled=True,
                           blockxsize=512, blockysize=512, compress="deflate", predictor=3)
            started = time.time()
            with rasterio.open(temporary, "w", **output_profile) as output:
                for _, block in output.block_windows(1):
                    read = Window(left + block.col_off, top + block.row_off, block.width, block.height)
                    output.write(source.read(1, window=read), 1, window=block)
                    if shutil.disk_usage(root).free < 2 * 1024 ** 3:
                        raise ValueError("Population preparation reached disk reserve")
            metadata = {"sourceCrs": str(source.crs), "resolution": list(source.res), "sourceUrl": profile["population"]["url"]}
    temporary.replace(target)
    validation = validate_surface([target])
    result = {"id": f"{profile['population']['id']}-{sha256(target)[:16]}", "sha256": sha256(target),
              "populationFiles": [str(target.relative_to(root))], "validation": validation, "source": metadata,
              "bytes": target.stat().st_size, "prepareSeconds": time.time() - started,
              "population": {"release": profile["population"]["id"],
                             **{key: profile["population"][key] for key in ("source", "sourceUrl", "licence", "year")}}}
    write_json(manifest, result)
    return result


def validate_canaries(engine, release, profile):
    result = None
    origins = profile.get("canaries", [profile["canary"]])
    if not isinstance(origins, list) or not 1 <= len(origins) <= 16:
        raise ValueError("At least one bounded activation canary is required")
    for origin in origins:
        coordinate_hash = hashlib.sha256(json.dumps([origin["lat"], origin["lng"]], separators=(",", ":")).encode()).hexdigest()
        for mode in ("walking", "cycling"):
            result = engine.compute({"libraryId": "release-canary", "coordinateHash": coordinate_hash, **origin, "mode": mode}, release)
            if result["state"] != "ready" or len(result["contours"]) != 4:
                raise ValueError("Analysis activation canary failed")
    return result


def activate(root: Path, graph_manifest: Path, population_manifest: Path, profile: dict, publish=True):
    graph = json.loads(graph_manifest.read_text())
    population = json.loads(population_manifest.read_text())
    if profile["network"].get("bufferSources"):
        expected = [profile["network"]["url"], *[s["url"] for s in profile["network"]["bufferSources"]]]
        if [s["url"] for s in graph["source"].get("sources", [])] != expected:
            raise ValueError("Prepared graph lacks the required neighbouring routing sources")
    from engine import inside
    if graph["source"]["url"] != profile["network"]["url"] or population["source"]["sourceUrl"] != profile["population"]["url"] or population["population"]["release"] != profile["population"]["id"] or population["population"]["year"] != profile["population"]["year"]:
        raise ValueError("Prepared assets do not match the requested profile")
    if len(population["populationFiles"]) != 1 or sha256(inside(root, population["populationFiles"][0])) != population["sha256"]:
        raise ValueError("Population artifact hash mismatch")
    if sum(1 for _ in inside(root, graph["graphDirectory"]).rglob("*.gph")) != graph["tiles"]:
        raise ValueError("Prepared graph is incomplete")
    if sha256(inside(root, graph["adminFile"])) != graph["adminSha256"]:
        raise ValueError("Routing administrative database hash mismatch")
    release_id = f"{profile['id']}-{graph['id']}-{population['sha256'][:16]}-cells-v3"
    release = {"id": release_id, "profile": profile["id"], "countries": profile.get("countries", [profile["country"]]), "originBounds": profile["originBounds"],
               "graphDirectory": graph["graphDirectory"], "configFile": graph["configFile"], "adminFile": graph["adminFile"],
               "network": graph["network"], "population": population["population"],
               "populationFiles": population["populationFiles"],
               "resultAliases": [f"{name}-{graph['id']}-{population['sha256'][:16]}-cells-v3" for name in profile.get("replacesProfiles", [])]}
    from engine import ReachEngine
    # A real reverse routing/population canary is required before activation.
    result = validate_canaries(ReachEngine(root), release, profile)
    if not publish:
        return release
    from engine import active_releases
    previous = [entry for entry in active_releases(root) if entry.get("profile") not in [profile["id"], *profile.get("replacesProfiles", [])]]
    for entry in previous:
        a, b = entry["originBounds"], release["originBounds"]
        if set(entry["countries"]) & set(release["countries"]) and max(a[0], b[0]) < min(a[2], b[2]) and max(a[1], b[1]) < min(a[3], b[3]):
            raise ValueError("Overlapping origin coverage requires an explicit profile partition")
    write_json(root / "active.json", [*previous, release])
    return {"release": release_id, "canary": result["state"]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("stage", choices=["network", "population", "activate"])
    parser.add_argument("--root", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--profile", default=str(Path(__file__).parent / "profiles/england.json"))
    parser.add_argument("--graph-manifest")
    parser.add_argument("--population-manifest")
    args = parser.parse_args()
    profile = json.loads(Path(args.profile).read_text())
    if not re.fullmatch(r"[a-z0-9-]{1,48}", profile["id"]) or not re.fullmatch(r"[a-z0-9-]{1,64}", profile["population"]["id"]):
        raise ValueError("Invalid profile identity")
    root = Path(args.root).resolve()
    if not args.apply:
        print(json.dumps({"dryRun": True, "stage": args.stage, "profile": profile["id"], "networkSource": profile["network"]["url"], "populationSource": profile["population"]["url"]}))
        return
    root.mkdir(parents=True, exist_ok=True)
    with (root / ".prepare-lock").open("w") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        if args.stage == "network": result = prepare_graph(root, profile, args.refresh)
        elif args.stage == "population": result = prepare_population(root, profile)
        else: result = activate(root, Path(args.graph_manifest), Path(args.population_manifest), profile)
    print(json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
