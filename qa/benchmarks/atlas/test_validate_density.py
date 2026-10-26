"""Small standard-library MVT fixtures exercise the production validator."""
import gzip
import json
from contextlib import closing
import os
from pathlib import Path
import sqlite3
import struct
import tempfile
import unittest

from validate_density import validate


def integer(n):
    result = bytearray()
    while n >= 128:
        result.append((n & 127) | 128)
        n >>= 7
    result.append(n)
    return bytes(result)


def field(key, data):
    return integer(key * 8 + 2) + integer(len(data)) + data


def layer(name, resolution, total=2):
    keys = ('cell', 'total', 'areaKm2', 'per100Km2')
    values = [field(1, f'{resolution}/0/0'.encode()), integer(5 * 8) + integer(total), integer(3 * 8 + 1) + struct.pack('<d', 1.0), integer(3 * 8 + 1) + struct.pack('<d', 200.0)]
    tags = b''.join(integer(n) + integer(n) for n in range(4))
    geometry = bytes([9, 0, 0]) if name == 'density' else bytes([9, 0, 0, 26, 64, 0, 0, 64, 63, 0, 15])
    feature = field(2, tags) + integer(3 * 8) + integer(1 if name == 'density' else 3) + field(4, geometry)
    return field(3, field(1, name.encode()) + field(2, feature) + b''.join(field(3, k.encode()) for k in keys) + b''.join(field(4, v) for v in values) + integer(15 * 8) + integer(2))


class DensityValidatorTest(unittest.TestCase):
    def run_fixture(self, missing=False, changed=False):
        with tempfile.TemporaryDirectory() as directory:
            old = os.getcwd()
            os.chdir(directory)
            try:
                source = Path('density.ndjson')
                with source.open('w') as output:
                    for zoom in range(17):
                        for name in ('density', 'density-grid'):
                            output.write(json.dumps({'properties': {'cell': f'{zoom + 4}/0/0', 'total': 2, 'areaKm2': 1.0, 'per100Km2': 200.0}, 'tippecanoe': {'minzoom': zoom, 'layer': name}}) + '\n')
                with closing(sqlite3.connect('density.mbtiles')) as db, db:
                    db.execute('CREATE TABLE tiles(zoom_level INTEGER,tile_data BLOB)')
                    db.execute('CREATE TABLE metadata(name TEXT,value TEXT)')
                    db.executemany('INSERT INTO metadata VALUES(?,?)', [('minzoom', '0'), ('maxzoom', '16')])
                    for zoom in range(17):
                        tile = layer('density', zoom + 4)
                        if not (missing and zoom == 16):
                            tile += layer('density-grid', zoom + 4, 3 if changed and zoom == 8 else 2)
                        db.execute('INSERT INTO tiles VALUES(?,?)', (zoom, gzip.compress(tile)))
                return validate('density.mbtiles', str(source), 2)
            finally:
                os.chdir(old)

    def test_all_resolutions_reconcile(self):
        self.assertEqual(self.run_fixture(), {'complete': True, 'sourceCount': 2, 'tiles': 17})

    def test_missing_cell_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'dropped'):
            self.run_fixture(missing=True)

    def test_changed_count_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'changed'):
            self.run_fixture(changed=True)


if __name__ == '__main__':
    unittest.main()
