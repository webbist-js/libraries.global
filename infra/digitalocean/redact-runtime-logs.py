#!/usr/bin/env python3
"""Print recent deployment diagnostics without emitting runtime credentials."""
from pathlib import Path
import subprocess

root = Path('/opt/libraries-global')
values = []
for env_file in root.glob('*.production.env'):
    for line in env_file.read_text().splitlines():
        if '=' in line:
            value = line.split('=', 1)[1]
            if len(value) >= 8:
                values.append(value)
result = subprocess.run(['docker', 'compose', '-f', str(root / 'app.compose.yml'),
                         'logs', '--no-color', '--tail', '60'],
                        cwd=root, capture_output=True, text=True)
body = result.stdout + result.stderr
for value in sorted(set(values), key=len, reverse=True):
    body = body.replace(value, '[runtime value redacted]')
print(body)
