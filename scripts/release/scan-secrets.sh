#!/bin/sh
set -eu
# Upstream release and SHA-256 are reviewed together; never execute a mutable tag.
version=8.30.1
digest=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb
case "$(uname -s):$(uname -m)" in
  Linux:x86_64) platform=linux_x64 ;;
  *) echo 'Use the pinned scanner manually on this platform.' >&2; exit 2 ;;
esac
task_dir=$(mktemp -d)
trap 'rm -rf "$task_dir"' EXIT HUP INT TERM
archive="$task_dir/scanner.tar.gz"
curl --fail --silent --show-error --location --proto '=https' \
  "https://github.com/gitleaks/gitleaks/releases/download/v$version/gitleaks_${version}_${platform}.tar.gz" -o "$archive"
echo "$digest  $archive" | sha256sum --check --status
tar -xzf "$archive" -C "$task_dir" gitleaks
"$task_dir/gitleaks" git --redact --no-banner --exit-code 1 .
