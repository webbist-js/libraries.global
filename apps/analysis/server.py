"""Serial private HTTP boundary. Large inputs remain in versioned files."""
import hmac
import json
import math
import os
import re
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.parse import urlsplit, parse_qsl
from threading import BoundedSemaphore

from engine import ReachEngine, active_releases, calculation_key, select_release, compatible_result
from cache import read_artifact, write_artifact, prune_artifacts
from contracts import validate_contract
from network_reach import calculate_network, network_key, validate_network_job
from context_layers import handle as context_request
from community_reach import public_releases as community_releases

MAX_RESULT_BYTES = 2 * 1024 * 1024


class AnalysisHTTPServer(ThreadingHTTPServer):
    # A viewport can request sixteen tiles together. The default backlog of
    # five drops connections before bounded tile workers can accept them.
    request_queue_size = 64
    daemon_threads = True


def main():
    token = os.environ.get("ANALYSIS_SERVICE_TOKEN", "")
    if len(token) < 32:
        raise ValueError("ANALYSIS_SERVICE_TOKEN must have at least 32 characters")
    root = Path(os.environ.get("ANALYSIS_DATA_DIR", "data")).resolve()
    results = root / "results"
    results.mkdir(parents=True, exist_ok=True)
    engine = ReachEngine(root)
    compute_lock = Lock()
    context_slots = BoundedSemaphore(2)
    cache_bytes = int(os.environ.get("ANALYSIS_CACHE_BYTES", 256 * 1024 * 1024))
    last_prune = 0

    def prune():
        nonlocal last_prune
        if time.time() - last_prune < 60:
            return
        prune_artifacts(root, cache_bytes)
        last_prune = time.time()

    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(30)

        def log_message(self, *_):
            pass

        def send(self, status, value):
            data = json.dumps(value, separators=(",", ":"), allow_nan=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def authorized(self):
            if not hmac.compare_digest(self.headers.get("X-Analysis-Token", ""), token):
                self.send(401, {"error": "Authentication required"})
                return False
            return True

        def do_GET(self):
            if self.path == "/health":
                self.send(200, {"service": "atlas-analysis", "configuredReleases": len(active_releases(root))})
                return
            if not self.authorized():
                return
            if urlsplit(self.path).path == "/context":
                pairs = parse_qsl(urlsplit(self.path).query, keep_blank_values=True)
                if len(self.path) > 2048 or len({k for k, _ in pairs}) != len(pairs):
                    self.send(400, {"error": "Invalid context query"})
                    return
                is_tile = dict(pairs).get("kind") == "tile"
                if is_tile and not context_slots.acquire(timeout=8):
                    self.send(503, {"error": "Context service busy"})
                    return
                try:
                    self.send(200, context_request(root, dict(pairs)))
                except (ValueError, KeyError, TypeError):
                    self.send(400, {"error": "Invalid context query or release"})
                except Exception as error:
                    print(json.dumps({"component": "context", "errorType": type(error).__name__}), flush=True)
                    self.send(503, {"error": "Context temporarily unavailable"})
                finally:
                    if is_tile:
                        context_slots.release()
                return
            if self.path == "/releases":
                self.send(200, [{**{key: entry[key] for key in ("id", "countries", "originBounds", "network", "population")},
                                 "communityReleases": community_releases(root)}
                                for entry in active_releases(root)])
            elif re.fullmatch(r"/results/[a-f0-9]{64}", self.path):
                key = self.path.rsplit("/", 1)[1]
                result = read_artifact(root, "results", key)
                if result is None:
                    self.send(404, {"error": "Result expired"})
                else:
                    self.send(200, result)
            else:
                self.send(404, {"error": "Not found"})

        def do_POST(self):
            if not self.authorized():
                return
            if not compute_lock.acquire(blocking=False):
                self.send(503, {"state": "failed", "message": "Analysis worker is busy. Retry later."})
                return
            try:
                self.calculate()
            finally:
                compute_lock.release()

        def calculate(self):
            if self.path not in {"/calculate", "/calculate-network"}:
                self.send(404, {"error": "Not found"})
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length < 1 or length > (128 * 1024 if self.path == "/calculate-network" else 16384):
                    self.send(413, {"error": "Request exceeds budget"})
                    return
                request = json.loads(self.rfile.read(length))
                if self.path == "/calculate-network":
                    validate_network_job(request)
                    releases = [r for r in active_releases(root) if r["id"] == request["release"]]
                    if len(releases) != 1 or any(select_release(root, m["lat"], m["lng"], m["country"]) != releases[0] for m in request["members"]):
                        raise ValueError("Network release changed or member outside coverage")
                    key = network_key(request)
                    result = read_artifact(root, "results", key)
                    if result is None:
                        result = calculate_network(engine, request, releases[0])
                    validate_contract("networkResult", result)
                    # networkResult validates its own provenance/geometry and the
                    # one-time or four-time contour shape. The single-library
                    # result contract deliberately remains four-time only.
                    if result.get("requestedMinutes") != request.get("minutes"):
                        raise ValueError("Network result time changed")
                    write_artifact(root, "results", key, result)
                    prune()
                    self.send(200, {"state": "ready", "resultKey": key})
                    return
                validate_contract("job", request)
                if any(not math.isfinite(request[field]) for field in ("lat", "lng")):
                    raise ValueError("Invalid calculation origin")
                release = select_release(root, request["lat"], request["lng"], request["country"])
                if release is None:
                    self.send(200, {"state": "unsupported", "message": "Routing and population coverage is not installed for this Library."})
                    return
                if release["id"] != request["release"]:
                    self.send(409, {"error": "Analysis release changed"})
                    return
                key = calculation_key(request, release)
                result = read_artifact(root, "results", key)
                if result is None:
                    # Expanding an origin catalogue does not change results for
                    # existing origins when graph, raster and method are identical.
                    for previous_id in release.get("resultAliases", [])[:8]:
                        candidate = read_artifact(root, "results", calculation_key(request, {**release, "id": previous_id}))
                        if compatible_result(candidate, request, release):
                            validate_contract("result", candidate)
                            result = candidate
                            break
                if result is None:
                    result = engine.compute(request, release)
                if result["state"] in {"ready", "partial"}:
                    validate_contract("result", result)
                    write_artifact(root, "results", key, result)
                    prune()
                    self.send(200, {"state": "ready", "resultKey": key})
                else:
                    self.send(200, result)
            except (KeyError, ValueError, TypeError) as error:
                print(json.dumps({"component": "analysis", "errorType": type(error).__name__, "reason": str(error)[:300]}), flush=True)
                self.send(400, {"state": "failed", "message": "Invalid or unsupported calculation input."})
            except Exception as error:
                print(json.dumps({"component": "analysis", "errorType": type(error).__name__}), flush=True)
                self.send(503, {"state": "failed", "message": "Catchment calculation is temporarily unavailable."})

    prune()
    # Catalogue/cache reads remain responsive during a native calculation.
    # Only the holder of compute_lock may access the native Actor or prune.
    server = AnalysisHTTPServer((os.environ.get("ANALYSIS_HOST", "127.0.0.1"), int(os.environ.get("ANALYSIS_PORT", "3102"))), Handler)
    server.timeout = 30
    server.serve_forever()


if __name__ == "__main__":
    main()
