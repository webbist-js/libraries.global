"""Bounded compressed artifacts; routing and resident totals have separate keys."""
import gzip
import json
import re
import time
from pathlib import Path

MAX_BYTES = 2 * 1024 * 1024


def artifact_path(root: Path, kind: str, key: str) -> Path:
    if kind not in {"routes", "results"} or not re.fullmatch(r"[a-f0-9]{64}", key):
        raise ValueError("Invalid artifact cache key")
    return root / kind / key[:2] / f"{key}.json.gz"


def read_artifact(root: Path, kind: str, key: str):
    file = artifact_path(root, kind, key)
    try:
        if file.stat().st_mtime < time.time() - 7 * 86400:
            return None
        with gzip.open(file, "rt") as source:
            text = source.read(MAX_BYTES + 1)
    except FileNotFoundError:
        # A concurrent bounded-cache prune can remove the file before open.
        return None
    if len(text.encode()) > MAX_BYTES:
        raise ValueError("Cached geometry exceeds budget")
    return json.loads(text)


def write_artifact(root: Path, kind: str, key: str, value):
    destination = artifact_path(root, kind, key)
    data = json.dumps(value, separators=(",", ":"), allow_nan=False).encode()
    if len(data) > MAX_BYTES:
        raise ValueError("Geometry exceeds artifact budget")
    directory = destination.parent
    directory.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(".tmp")
    with temporary.open("wb") as file:
        file.write(gzip.compress(data, compresslevel=6, mtime=0))
    temporary.chmod(0o600)
    temporary.replace(destination)


def prune_artifacts(root: Path, max_bytes: int):
    files = []
    removed = 0
    for temporary in [*root.glob("results/*/*.tmp"), *root.glob("routes/*/*.tmp")]:
        if temporary.stat().st_mtime < time.time() - 300:
            temporary.unlink(missing_ok=True)
    for file in [*root.glob("results/*/*.json.gz"), *root.glob("routes/*/*.json.gz")]:
        stat = file.stat()
        if stat.st_mtime < time.time() - 7 * 86400:
            file.unlink(missing_ok=True)
            removed += 1
        else:
            files.append((file, stat.st_mtime, stat.st_size, file.parent.parent.name == "routes"))
    total = sum(item[2] for item in files)
    route_bytes = sum(item[2] for item in files if item[3])
    entries = len(files)
    # Full-precision routes are an optimization for population refreshes.
    # Prioritize reusable, user-visible results within the same hard budget.
    for file, _, size, route in sorted(files, key=lambda item: (not item[3], item[1])):
        if total > max_bytes or entries > 20000 or (route and route_bytes > max_bytes // 4):
            file.unlink(missing_ok=True)
            total -= size
            route_bytes -= size if route else 0
            entries -= 1
            removed += 1
    return {"bytes": total, "entries": entries, "removed": removed}
