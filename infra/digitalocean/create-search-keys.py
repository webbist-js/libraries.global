#!/usr/bin/env python3
"""Run on the search host; credentials are written to a private local file."""
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen
import uuid

root = Path('/opt/libraries-global')
master = dict(line.split('=', 1) for line in (root / 'search.env').read_text().splitlines() if '=' in line)['MEILI_MASTER_KEY']
target = root / 'service-search-keys.json'
if target.exists():
    raise SystemExit('Service key file already exists; inspect before changing keys.')
writers = ['search', 'documents.*', 'indexes.*', 'settings.*', 'tasks.get', 'stats.get']
specs = {
    'cms': (writers, ['library', 'blog-article', 'wiki-article', 'event', 'mobile-stop']),
    'ui': (['search'], ['library', 'blog-article', 'wiki-article', 'event', 'mobile-stop']),
    'atlas_worker': (writers, ['atlas-library', 'atlas-library-staging-*']),
    'atlas_ui': (['search'], ['atlas-library']),
}
result = {}
# Write each result immediately, so a partial failure never loses created keys.
os.umask(0o077)
for name, (actions, indexes) in specs.items():
    payload = {'uid': str(uuid.uuid4()), 'name': 'libraries-global-' + name,
               'actions': actions, 'indexes': indexes, 'expiresAt': None}
    request = Request('http://127.0.0.1:7700/keys', data=json.dumps(payload).encode(),
                      headers={'Authorization': 'Bearer ' + master, 'Content-Type': 'application/json'})
    with urlopen(request, timeout=15) as response:
        result[name] = json.load(response)
    target.write_text(json.dumps(result, indent=2) + '\n')
print('Created four service keys with separate writer and search-only index scopes.')
