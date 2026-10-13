#!/usr/bin/env python3
"""Authenticated local replacement for the application's Vercel cron requests."""
from pathlib import Path
import json
import sys
from urllib.request import Request, urlopen

job = sys.argv[1]
if job not in {'retention', 'billing'}:
    raise SystemExit('Unsupported maintenance job')
values = dict(line.split('=', 1) for line in Path('/opt/libraries-global/ui.production.env').read_text().splitlines() if '=' in line)
request = Request('http://127.0.0.1:3000/api/cron/' + job, headers={
    'Host': 'libraries.global', 'X-Forwarded-Host': 'libraries.global',
    'X-Forwarded-Proto': 'https', 'Authorization': 'Bearer ' + values['CRON_SECRET'],
})
with urlopen(request, timeout=75) as response:
    if response.status != 200:
        raise SystemExit('Maintenance returned a non-success status')
    result = json.load(response)
if job == 'billing' and result.get('configured') is False:
    raise SystemExit('Billing is not configured')
if result.get('failed', 0):
    raise SystemExit('Maintenance reported a processing failure')
# Counts are useful in the journal; never log provider objects or user details.
counts = {key: value for key, value in result.items() if isinstance(value, int) and not isinstance(value, bool)}
print(job + ': authenticated maintenance succeeded ' + json.dumps(counts, sort_keys=True))
