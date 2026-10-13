#!/usr/bin/env python3
"""Archive the credential-free build context and pin locally verified images."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tarfile

root = Path('/opt/libraries-global')
parser = argparse.ArgumentParser()
parser.add_argument('--source', default='build-20261012')
parser.add_argument('--release', default='release-20261013-beta')
parser.add_argument('--cms-image', default='libraries-global-strapi:launch-amd64')
parser.add_argument('--ui-image', default='libraries-global-ui:launch-amd64')
parser.add_argument('--worker-image', default='libraries-global-worker:launch-amd64')
args = parser.parse_args()
for name in [args.source, args.release]:
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,80}', name):
        raise RuntimeError('Invalid source or release directory name')
source = root / args.source
release = root / args.release
release.mkdir(exist_ok=False, mode=0o700)
manifest = json.loads((root / 'build-context-manifest.json').read_text())
files = {}
archive_path = release / 'source.tar.gz'
with tarfile.open(archive_path, 'w:gz', dereference=True) as archive:
    for name in sorted(manifest['files']):
        parts = Path(name).parts
        if '..' in parts or Path(name).is_absolute() or any(part.startswith('.env') for part in parts):
            raise RuntimeError('Unsafe release path')
        file = source / name
        files[name] = hashlib.sha256(file.read_bytes()).hexdigest()
        if files[name] != manifest['files'][name]:
            raise RuntimeError('Source differs from the supplied build manifest')
        archive.add(file, arcname=name, recursive=False)
images = {}
environment = []
for variable, app, selected_image in [
    ('CMS_IMAGE', 'strapi', args.cms_image),
    ('UI_IMAGE', 'ui', args.ui_image),
    ('WORKER_IMAGE', 'worker', args.worker_image),
]:
    repository = 'libraries-global-' + app
    image_id = subprocess.check_output(['docker', 'image', 'inspect', selected_image, '--format', '{{.Id}}'], text=True).strip()
    tag = repository + ':' + release.name.removeprefix('release-') + '-' + image_id.removeprefix('sha256:')[:12]
    subprocess.run(['docker', 'tag', image_id, tag], check=True)
    images[app] = {'id': image_id, 'tag': tag}
    environment.append(variable + '=' + tag)
(root / 'release.env').write_text('\n'.join(environment) + '\n')
(root / 'release.env').chmod(0o600)
record = {'source_head': manifest['head'], 'includes_uncommitted_source': True,
          'source_sha256': hashlib.sha256(archive_path.read_bytes()).hexdigest(),
          'files': files, 'images': images}
(release / 'manifest.json').write_text(json.dumps(record, indent=2) + '\n')
archive_path.chmod(0o600)
(release / 'manifest.json').chmod(0o600)
print('Recorded exact release source and immutable local image tags for CMS, UI and worker.')
