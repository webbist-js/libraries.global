"""Bounded MBTiles validation: inspect every tile, compare exact source ID sets.

Uses only Python's standard library in the pinned Linux image. No full GeoJSON
collection or per-feature Python set is retained. Buffered duplicate IDs across
adjacent tiles are expected; missing/foreign IDs and silent thinning fail.
"""
import json
import sqlite3
import sys
import zlib

ALLOWLIST = {"i", "s", "n", "t", "o", "st", "ct", "co", "r", "ar", "ci", "a", "f", "e", "c", "l", "y", "p", "v", "nw"}
MAX_COMPRESSED = 512000
MAX_DECODED = 4194304


def varint(data, offset):
    value = 0
    for shift in range(0, 70, 7):
        if offset >= len(data):
            raise ValueError("Truncated MVT varint")
        byte = data[offset]
        offset += 1
        value |= (byte & 127) << shift
        if byte < 128:
            return value, offset
    raise ValueError("Invalid MVT varint")


def fields(data):
    offset = 0
    while offset < len(data):
        tag, offset = varint(data, offset)
        wire = tag & 7
        if wire == 0:
            value, offset = varint(data, offset)
        elif wire == 2:
            length, offset = varint(data, offset)
            if offset + length > len(data):
                raise ValueError("Truncated MVT field")
            value = data[offset:offset + length]
            offset += length
        elif wire in (1, 5):
            length = 8 if wire == 1 else 4
            value = data[offset:offset + length]
            offset += length
        else:
            raise ValueError("Invalid MVT wire type")
        yield tag >> 3, value


def ids(data):
    for field, layer in fields(data):
        if field != 3:
            continue
        entries = list(fields(layer))
        name = next((value.decode() for key, value in entries if key == 1), None)
        if name != "libraries":
            raise ValueError(f"Unexpected source layer {name}")
        keys = [value.decode() for key, value in entries if key == 3]
        values = [dict(fields(value)).get(1) for key, value in entries if key == 4]
        if set(keys) - ALLOWLIST:
            raise ValueError("Non-public properties in tile")
        for key, feature in entries:
            if key != 2:
                continue
            attributes = dict(fields(feature))
            if attributes.get(3) != 1 or 1 not in attributes:
                raise ValueError("Tile feature must be a point with numeric ID")
            tags = attributes.get(2, b"")
            offset = 0
            document_id = None
            while offset < len(tags):
                key_index, offset = varint(tags, offset)
                value_index, offset = varint(tags, offset)
                if keys[key_index] == "i":
                    document_id = values[value_index]
            if not isinstance(document_id, bytes):
                raise ValueError("Tile feature requires its documentId")
            yield attributes[1], document_id


def validate(archive, source, detail, maximum_id):
    if maximum_id < 1 or maximum_id > 128 * 1024 * 1024:
        raise ValueError("Source ID span exceeds validator memory budget")
    expected = bytearray(maximum_id + 1)
    count = 0
    width = 1
    with open(source, encoding="utf8") as stream:
        for line in stream:
            point = json.loads(line)
            identifier = point["id"]
            if not isinstance(identifier, int) or identifier < 1 or identifier > maximum_id or expected[identifier]:
                raise ValueError("Invalid/duplicate source ID")
            expected[identifier] = 1
            document_id = point["properties"]["i"].encode("utf8")
            if not 0 < len(document_id) <= 200:
                raise ValueError("Invalid source documentId")
            width = max(width, len(document_id) + 1)
            count += 1
    if not count:
        raise ValueError("Empty source")
    # Fixed-width bytes preserve exact document IDs without millions of Python
    # strings/dictionary entries. The fixture uses 16 bytes per ID; CMS IDs 25.
    if (maximum_id + 1) * (width + 3) > 512 * 1024 * 1024:
        raise ValueError("Source ID span exceeds validator memory budget")
    documents = bytearray((maximum_id + 1) * width)
    with open(source, encoding="utf8") as stream:
        for line in stream:
            point = json.loads(line)
            document_id = point["properties"]["i"].encode("utf8")
            offset = point["id"] * width
            documents[offset] = len(document_id)
            documents[offset + 1:offset + 1 + len(document_id)] = document_id
    seen = {zoom: bytearray(maximum_id + 1) for zoom in {detail, 16}}
    zoom_counts = {zoom: 0 for zoom in seen}
    compressed_peak = decoded_peak = tile_count = 0
    with sqlite3.connect(f"file:{archive}?mode=ro", uri=True) as db:
        for zoom, column, row, compressed in db.execute("SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles"):
            tile_count += 1
            compressed_peak = max(compressed_peak, len(compressed))
            if len(compressed) > MAX_COMPRESSED:
                raise ValueError(f"Oversized compressed tile {zoom}/{column}/{row}")
            decoder = zlib.decompressobj(16 + zlib.MAX_WBITS)
            decoded = decoder.decompress(compressed, MAX_DECODED + 1)
            decoded_peak = max(decoded_peak, len(decoded))
            if len(decoded) > MAX_DECODED or decoder.unconsumed_tail:
                raise ValueError(f"Oversized decoded tile {zoom}/{column}/{row}")
            for identifier, document_id in ids(decoded):
                if identifier > maximum_id or not expected[identifier]:
                    raise ValueError("Foreign ID in tile")
                offset = identifier * width
                expected_document = documents[offset + 1:offset + 1 + documents[offset]]
                if document_id != expected_document:
                    raise ValueError("Tile documentId differs from source")
                if zoom in seen and not seen[zoom][identifier]:
                    seen[zoom][identifier] = 1
                    zoom_counts[zoom] += 1
        metadata = dict(db.execute("SELECT name,value FROM metadata"))
    for zoom, actual in seen.items():
        if actual != expected:
            missing = [n for n in range(1, maximum_id + 1) if expected[n] and not actual[n]][:10]
            raise ValueError(f"Missing IDs at zoom {zoom}: {missing}; expected {count}, got {zoom_counts[zoom]}")
    if int(metadata.get("minzoom", -1)) != detail or int(metadata.get("maxzoom", -1)) != 16:
        raise ValueError("Archive zoom metadata mismatch")
    return {"complete": True, "sourceCount": count, "distinctIds": zoom_counts, "tiles": tile_count, "maxCompressedTileBytes": compressed_peak, "maxDecodedTileBytes": decoded_peak}


if __name__ == "__main__":
    print(json.dumps(validate(sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]))))
