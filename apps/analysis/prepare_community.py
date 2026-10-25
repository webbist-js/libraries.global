"""Finite analytical deprivation ingest: full source boundaries and exact code joins."""
import argparse
from contextlib import closing
import fcntl
import hashlib
import json
import math
import os
import sqlite3
import urllib.parse
from pathlib import Path
from shapely.geometry import shape
from shapely import make_valid, union_all
from prepare_context import acquire, xlsx_rows, deprivation_source, ENGLAND_BOOK, ONS
from sources import write_json, sha256


def england(root):
    book, _ = acquire(root, 'imd2025-corrected.xlsx', ENGLAND_BOOK, 8 * 1024 ** 2)
    rows = {r[0]: {'code':r[0], 'name':r[1], 'rank':int(r[4]), 'value':int(r[5])}
            for r in xlsx_rows(book) if r and str(r[0]).startswith('E01') and len(str(r[0])) == 9}
    if len(rows) != 33755:
        raise ValueError('Incomplete IMD workbook')
    seen, offset = set(), 0
    while True:
        query = urllib.parse.urlencode({'f':'geojson', 'where':"CODE LIKE 'E%'", 'outFields':'CODE,NAME',
                                       'outSR':4326, 'orderByFields':'CODE', 'resultOffset':offset, 'resultRecordCount':250})
        path, _ = acquire(root, f'lsoa2021-england-full-{offset}.json', ONS.rsplit('/',1)[0] + '/1/query?' + query, 64 * 1024 ** 2)
        page = json.loads(path.read_text())
        if 'features' not in page:
            raise ValueError('Invalid full ONS boundary response')
        for f in page['features']:
            code = f['properties']['CODE']
            if code in seen or code not in rows:
                raise ValueError('Duplicate or unmatched IMD code')
            seen.add(code)
            yield {**f, 'properties':rows[code]}
        offset += len(page['features'])
        print(json.dumps({'nation':'england', 'areas':offset}), flush=True)
        if not page.get('exceededTransferLimit') and len(page['features']) < 250:
            break
        if not page['features'] or offset > 33755:
            raise ValueError('Truncated ONS source')
    if seen != set(rows):
        raise ValueError('IMD and full boundary codes disagree')


def publish(root, meta, features):
    directory = root / 'community'
    directory.mkdir(parents=True, exist_ok=True)
    temporary = directory / f'staged-{os.getpid()}.sqlite'
    temporary.unlink(missing_ok=True)
    seen = set()
    digest = hashlib.sha256(json.dumps(meta, sort_keys=True).encode())
    try:
        with closing(sqlite3.connect(temporary)) as db, db:
            db.execute('CREATE TABLE areas (id INTEGER PRIMARY KEY, code TEXT UNIQUE, properties TEXT, geometry BLOB)')
            db.execute('CREATE VIRTUAL TABLE bounds USING rtree (id, west, east, south, north)')
            for i, feature in enumerate(features):
                p = feature['properties']
                if p['code'] in seen or (p.get('value') is not None and (not isinstance(p['value'], (int,float)) or not math.isfinite(p['value']) or p['value'] != int(p['value']) or not 1 <= p['value'] <= 10)):
                    raise ValueError('Invalid analytical deprivation classification')
                seen.add(p['code'])
                g = make_valid(shape(feature['geometry']))
                if g.geom_type == 'GeometryCollection':
                    g = union_all([part for part in g.geoms if part.geom_type in {'Polygon','MultiPolygon'}])
                if g.is_empty or g.geom_type not in {'Polygon','MultiPolygon'}:
                    raise ValueError('Invalid analytical source boundary')
                properties = json.dumps(p, sort_keys=True)
                digest.update(properties.encode())
                digest.update(g.wkb)
                west,south,east,north = g.bounds
                db.execute('INSERT INTO areas VALUES (?,?,?,?)', (i,p['code'],properties,g.wkb))
                db.execute('INSERT INTO bounds VALUES (?,?,?,?,?)', (i,west,east,south,north))
            if len(seen) != meta['areaCount']:
                raise ValueError('Incomplete national analytical boundary join')
        version = digest.hexdigest()[:16]
        relative = f'community/deprivation-{meta["country"].lower()}-{version}.sqlite'
        temporary.replace(root / relative)
        return {**meta, 'id':f'community-{meta["country"].lower()}-{version}', 'lookup':relative, 'assetSha256':sha256(root / relative)}
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def prepare(root, nation):
    country = {'england':'GB-ENG','wales':'GB-WLS','scotland':'GB-SCT','ni':'GB-NIR'}[nation]
    meta = next(r for r in json.loads((root / 'context/catalogue.json').read_text())['releases'] if r['theme']=='deprivation' and r['country']==country)
    if nation == 'england':
        features = england(root)
        boundary = '2021 LSOAs · ONS full resolution clipped (BFC)'
    else:
        source_meta, features = deprivation_source(root, nation)
        if source_meta['edition'] != meta['edition']:
            raise ValueError('Refresh the matching display edition before analytical preparation')
        boundary = meta['boundary']
    fields = ('country','name','year','edition','areaCount','source','sourceUrl','licence','attribution')
    return publish(root, {**{k:meta[k] for k in fields}, 'boundary':boundary,
                          'geometryMethod':'Source boundaries, no additional simplification; repaired polygon topology',
                          'domain':'overall', 'grouping':'National decile pairs 1–2, 3–4, 5–6, 7–8, 9–10'}, features)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('nation', choices=['england','wales','scotland','ni'])
    parser.add_argument('--root', type=Path, default=Path('data'))
    args = parser.parse_args()
    release = prepare(args.root.resolve(), args.nation)
    path = args.root / 'community/catalogue.json'
    with (args.root / 'community/.prepare-lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        existing = json.loads(path.read_text()) if path.exists() else []
        write_json(path, [r for r in existing if r['country'] != release['country']] + [release])
    print(json.dumps({k:v for k,v in release.items() if k != 'lookup'}))

if __name__ == '__main__':
    main()
