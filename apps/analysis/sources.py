"""Streaming, replayable source acquisition with explicit disk budgets."""
import hashlib
import json
import os
import shutil
import time
import urllib.request
from pathlib import Path


def write_json(file: Path, value):
    file.parent.mkdir(parents=True, exist_ok=True)
    temporary = file.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, separators=(",", ":"), allow_nan=False))
    temporary.replace(file)


def sha256(file: Path):
    digest = hashlib.sha256()
    with file.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str, target: Path, max_bytes: int, reserve_bytes=2 * 1024 ** 3, refresh=False):
    if not url.startswith("https://"):
        raise ValueError("Public sources require HTTPS")
    target.parent.mkdir(parents=True, exist_ok=True)
    metadata = target.with_suffix(target.suffix + ".source.json")
    if target.exists() and metadata.exists() and not refresh:
        previous = json.loads(metadata.read_text())
        if previous["url"] != url or previous["sha256"] != sha256(target):
            raise ValueError("Snapshot hash or request mismatch")
        return previous
    temporary = target.with_suffix(target.suffix + ".part")
    request = urllib.request.Request(url, headers={"User-Agent": "LibrariesGlobalIngest/1.0 (https://libraries.global)"})
    with urllib.request.urlopen(request, timeout=60) as response:
        expected = int(response.headers.get("Content-Length", "0"))
        if expected > max_bytes or shutil.disk_usage(target.parent).free < expected + reserve_bytes:
            raise ValueError("Source download exceeds disk budget")
        digest = hashlib.sha256()
        total = 0
        last_report = 0
        with temporary.open("wb") as output:
            while chunk := response.read(1024 * 1024):
                total += len(chunk)
                if total > max_bytes or shutil.disk_usage(target.parent).free < reserve_bytes:
                    raise ValueError("Source download exhausted its budget")
                output.write(chunk)
                digest.update(chunk)
                if time.time() - last_report > 15:
                    print(json.dumps({"stage": "download", "bytes": total, "expected": expected}), flush=True)
                    last_report = time.time()
            output.flush()
            os.fsync(output.fileno())
        if expected and total != expected:
            raise ValueError("Incomplete source download")
        info = {"url": url, "bytes": total, "sha256": digest.hexdigest(),
                "etag": response.headers.get("ETag"), "lastModified": response.headers.get("Last-Modified"),
                "retrievedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    temporary.replace(target)
    write_json(metadata, info)
    return info
