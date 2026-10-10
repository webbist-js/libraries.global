"""Validate every boundary tile and reconcile all country IDs at maximum zoom."""
import json
import sqlite3
import sys
import zlib

from validate_archive import fields, varint, MAX_COMPRESSED, MAX_DECODED


def country_ids(data):
    for field, layer in fields(data):
        if field != 3:
            continue
        entries = list(fields(layer))
        name = next((value.decode() for key, value in entries if key == 1), None)
        if name != "countries":
            raise ValueError("Unexpected boundary layer")
        keys = [value.decode() for key, value in entries if key == 3]
        if set(keys) - {"iso3", "name"}:
            raise ValueError("Unexpected country properties")
        values = [dict(fields(value)).get(1) for key, value in entries if key == 4]
        for key, feature in entries:
            if key != 2:
                continue
            attributes = dict(fields(feature))
            if attributes.get(3) != 3:
                raise ValueError("Country must be a polygon")
            tags, offset, code = attributes.get(2, b""), 0, None
            while offset < len(tags):
                key_index, offset = varint(tags, offset)
                value_index, offset = varint(tags, offset)
                if keys[key_index] == "iso3":
                    code = values[value_index].decode()
            if not code:
                raise ValueError("Country requires an ISO join key")
            yield code


def validate(archive, source):
    with open(source, encoding="utf8") as stream:
        expected = {f["properties"]["iso3"] for f in json.load(stream)["features"]}
    if not expected:
        raise ValueError("Empty country geometry")
    seen, tile_count = set(), 0
    with sqlite3.connect(f"file:{archive}?mode=ro", uri=True) as db:
        for zoom, compressed in db.execute("SELECT zoom_level,tile_data FROM tiles"):
            tile_count += 1
            if len(compressed) > MAX_COMPRESSED:
                raise ValueError("Oversized compressed country tile")
            decoder = zlib.decompressobj(16 + zlib.MAX_WBITS)
            decoded = decoder.decompress(compressed, MAX_DECODED + 1)
            if len(decoded) > MAX_DECODED or decoder.unconsumed_tail:
                raise ValueError("Oversized decoded country tile")
            actual = set(country_ids(decoded))
            if actual - expected:
                raise ValueError("Foreign country in archive")
            if zoom == 6:
                seen.update(actual)
        metadata = dict(db.execute("SELECT name,value FROM metadata"))
    if int(metadata.get("minzoom", -1)) != 0 or int(metadata.get("maxzoom", -1)) != 6:
        raise ValueError("Country zoom metadata mismatch")
    if seen != expected:
        raise ValueError(f"Missing countries: {sorted(expected - seen)}")
    return {"complete": True, "sourceCount": len(expected), "tiles": tile_count}


if __name__ == "__main__":
    print(json.dumps(validate(sys.argv[1], sys.argv[2])))
