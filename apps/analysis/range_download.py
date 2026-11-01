"""Bounded HTTP ranges for large immutable public snapshots; never mix editions."""
from concurrent.futures import ThreadPoolExecutor
import os
import shutil
import threading
import time
import urllib.request


def fetch_ranges(url, temporary, max_bytes, reserve_bytes, workers):
    if not isinstance(workers, int) or not 2 <= workers <= 4:
        raise ValueError("Range downloads require 2–4 workers")
    headers = {"User-Agent": "LibrariesGlobalIngest/1.0 (https://libraries.global)"}
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers, method="HEAD"), timeout=60) as response:
        length = int(response.headers.get("Content-Length", "0"))
        etag = response.headers.get("ETag")
        modified = response.headers.get("Last-Modified")
        if response.headers.get("Accept-Ranges") != "bytes" or not etag or etag.startswith("W/") or length < workers:
            return None  # The caller retains the bounded sequential path.
    if length > max_bytes or shutil.disk_usage(temporary.parent).free < length + reserve_bytes:
        raise ValueError("Source download exceeds disk budget")
    progress, last_report, lock = 0, 0., threading.Lock()
    with temporary.open("wb") as output:
        descriptor = output.fileno()

        def fetch(index):
            nonlocal progress, last_report
            start, stop = length * index // workers, length * (index + 1) // workers - 1
            request = urllib.request.Request(url, headers={**headers, "Range": f"bytes={start}-{stop}", "If-Match": etag})
            with urllib.request.urlopen(request, timeout=60) as response:
                if response.status != 206 or response.headers.get("Content-Range") != f"bytes {start}-{stop}/{length}" or response.headers.get("ETag") != etag:
                    raise ValueError("Range response changed edition or ignored requested bytes")
                offset = start
                while chunk := response.read(1024 * 1024):
                    if offset + len(chunk) > stop + 1 or shutil.disk_usage(temporary.parent).free < reserve_bytes:
                        raise ValueError("Range response exceeded its budget")
                    view = memoryview(chunk)
                    while view:
                        written = os.pwrite(descriptor, view, offset)
                        if written <= 0:
                            raise OSError("Incomplete range write")
                        offset += written
                        view = view[written:]
                    with lock:
                        progress += len(chunk)
                        if time.time() - last_report > 15:
                            import json
                            print(json.dumps({"stage": "download", "bytes": progress, "expected": length, "connections": workers}), flush=True)
                            last_report = time.time()
                if offset != stop + 1:
                    raise ValueError("Incomplete source range")
        with ThreadPoolExecutor(max_workers=workers) as executor:
            list(executor.map(fetch, range(workers)))
        if progress != length:
            raise ValueError("Incomplete source download")
        os.fsync(descriptor)
    return {"bytes": length, "etag": etag, "lastModified": modified}
