"""Stream a deduplicated routing extract from overlapping neighbouring sources."""
import heapq
import json
import shutil
import time
from pathlib import Path

from sources import sha256, write_json


def merge_sorted(inputs, output, reserve_bytes=2 * 1024 ** 3):
    import osmium
    streams = [iter(osmium.FileProcessor(p)) for p in inputs]
    heap, previous, count = [], {}, 0
    order = {"n": 0, "w": 1, "r": 2}

    def advance(index):
        obj = next(streams[index], None)
        if obj is None:
            return
        key = (order[obj.type_str()], obj.id)
        if key <= previous.get(index, (-1, -1)):
            raise ValueError("Routing input must be strictly sorted by object type and ID")
        previous[index] = key
        heapq.heappush(heap, (key, index, obj))

    for i in range(len(streams)):
        advance(i)
    next_check = time.monotonic() + 2
    with osmium.SimpleWriter(output, overwrite=True) as writer:
        while heap:
            key = heap[0][0]
            same = []
            while heap and heap[0][0] == key:
                same.append(heapq.heappop(heap))
            # Write before advancing: pyosmium objects reference iterator buffers.
            chosen = max(same, key=lambda item: item[2].version)[2]
            writer.add(chosen)
            count += 1
            for _, i, _ in same:
                advance(i)
            if time.monotonic() >= next_check:
                if shutil.disk_usage(Path(output).parent).free < reserve_bytes:
                    raise ValueError("Routing merge reached disk reserve")
                next_check = time.monotonic() + 2
    return count


def buffered_source(root, profile, refresh=False):
    from prepare import routing_source
    sources = profile["network"]["bufferSources"]
    urls = [profile["network"]["url"], *[s["url"] for s in sources]]
    if len(urls) > 8 or len(set(urls)) != len(urls):
        raise ValueError("Invalid routing buffer source set")
    merged = root / f"sources/{profile['id']}-buffered-routing.osm.pbf"
    manifest = merged.with_suffix(".pbf.json")
    if merged.exists() and manifest.exists() and not refresh:
        previous = json.loads(manifest.read_text())
        if previous["urls"] != urls or previous["sha256"] != sha256(merged):
            raise ValueError("Buffered routing source mismatch")
        return merged, previous["source"]
    network = {k: v for k, v in profile["network"].items() if k != "bufferSources"}
    inputs, snapshots = [], []
    for i, url in enumerate(urls):
        piece = {**profile, "id": f"{profile['id']}-buffer-{i}", "network": {**network, "url": url}}
        path, source = routing_source(root, piece, refresh)
        inputs.append(path)
        snapshots.append(source)
    temporary = merged.with_name(merged.stem + ".part.osm.pbf")
    print(json.dumps({"stage": "routing-merge", "sources": len(inputs)}), flush=True)
    count = merge_sorted(inputs, temporary)
    temporary.replace(merged)
    digest = sha256(merged)
    source = {"url": profile["network"]["url"], "sha256": digest, "bytes": merged.stat().st_size,
              "sources": snapshots, "selection": "reference-complete routing; neighbouring extracts merged by OSM type/id, highest version wins",
              "retrievedAt": max(s["retrievedAt"] for s in snapshots)}
    write_json(manifest, {"urls": urls, "sha256": digest, "objects": count, "source": source})
    print(json.dumps({"stage": "routing-merged", "objects": count, "bytes": merged.stat().st_size}), flush=True)
    return merged, source
