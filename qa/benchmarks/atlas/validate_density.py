"""Inspect all density tiles and reconcile every cell/count at every resolution.

SQLite scratch keeps the validator bounded; buffered duplicate features count
once. Source totals must reconcile independently for both geometry layers.
"""
import json
from contextlib import closing
import math
import sqlite3
import struct
import sys
import zlib
from validate_archive import fields, varint, MAX_COMPRESSED, MAX_DECODED


def value(data):
    item = dict(fields(data))
    if 1 in item:
        return item[1].decode()
    if 3 in item:
        return struct.unpack('<d', item[3])[0]
    if 2 in item:
        return struct.unpack('<f', item[2])[0]
    for key in (4, 5):
        if key in item:
            return item[key]
    if 6 in item:
        n = item[6]
        return (n >> 1) ^ -(n & 1)
    raise ValueError('Unsupported density value')


def features(data):
    for field, layer in fields(data):
        if field != 3:
            continue
        entries = list(fields(layer))
        name = next(v.decode() for k, v in entries if k == 1)
        if name not in ('density', 'density-grid'):
            raise ValueError('Unexpected density layer')
        keys = [v.decode() for k, v in entries if k == 3]
        values = [value(v) for k, v in entries if k == 4]
        if set(keys) - {'cell', 'total', 'areaKm2', 'per100Km2'}:
            raise ValueError('Unexpected density properties')
        for key, feature in entries:
            if key != 2:
                continue
            attrs = dict(fields(feature))
            if attrs.get(3) != (1 if name == 'density' else 3):
                raise ValueError('Wrong density geometry')
            tags, offset, props = attrs.get(2, b''), 0, {}
            while offset < len(tags):
                k, offset = varint(tags, offset)
                v, offset = varint(tags, offset)
                props[keys[k]] = values[v]
            yield name, props


def validate(archive, source, count):
    with closing(sqlite3.connect('density-validation.sqlite')) as check, check:
        check.execute('PRAGMA cache_size=-8192')
        check.execute('CREATE TABLE expected (zoom INTEGER, layer TEXT, cell TEXT, total INTEGER, area REAL, rate REAL, PRIMARY KEY(zoom,layer,cell))')
        check.execute('CREATE TABLE seen (zoom INTEGER, layer TEXT, cell TEXT, PRIMARY KEY(zoom,layer,cell))')
        with open(source, encoding='utf8') as stream:
            for line in stream:
                f = json.loads(line)
                p, t = f['properties'], f['tippecanoe']
                check.execute('INSERT INTO expected VALUES(?,?,?,?,?,?)', (t['minzoom'], t['layer'], p['cell'], p['total'], p['areaKm2'], p['per100Km2']))
        totals = list(check.execute('SELECT zoom,layer,SUM(total) FROM expected GROUP BY zoom,layer'))
        if len(totals) != 34 or any(n != count for _, _, n in totals):
            raise ValueError('Density source totals do not reconcile')
        tiles = 0
        with closing(sqlite3.connect(f'file:{archive}?mode=ro', uri=True)) as db:
            for zoom, compressed in db.execute('SELECT zoom_level,tile_data FROM tiles'):
                tiles += 1
                if len(compressed) > MAX_COMPRESSED:
                    raise ValueError('Oversized compressed density tile')
                decoder = zlib.decompressobj(16 + zlib.MAX_WBITS)
                decoded = decoder.decompress(compressed, MAX_DECODED + 1)
                if len(decoded) > MAX_DECODED or decoder.unconsumed_tail or not decoder.eof:
                    raise ValueError('Oversized decoded density tile')
                for layer, p in features(decoded):
                    expected = check.execute('SELECT total,area,rate FROM expected WHERE zoom=? AND layer=? AND cell=?', (zoom, layer, p.get('cell'))).fetchone()
                    if not expected or p.get('total') != expected[0] or not math.isclose(p.get('areaKm2', 0), expected[1], rel_tol=1e-6) or not math.isclose(p.get('per100Km2', 0), expected[2], rel_tol=1e-6):
                        raise ValueError('Density tile values changed')
                    check.execute('INSERT OR IGNORE INTO seen VALUES(?,?,?)', (zoom, layer, p['cell']))
            metadata = dict(db.execute('SELECT name,value FROM metadata'))
        if metadata.get('minzoom') != '0' or metadata.get('maxzoom') != '16':
            raise ValueError('Density zoom metadata mismatch')
        if check.execute('SELECT zoom,layer,cell FROM expected EXCEPT SELECT zoom,layer,cell FROM seen LIMIT 1').fetchone():
            raise ValueError('Density cells were dropped')
    return {'complete': True, 'sourceCount': count, 'tiles': tiles}


if __name__ == '__main__':
    print(json.dumps(validate(sys.argv[1], sys.argv[2], int(sys.argv[3]))))
