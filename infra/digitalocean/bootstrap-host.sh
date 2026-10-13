#!/usr/bin/env bash
set -euo pipefail

# Run as root on a new Ubuntu 24.04 DigitalOcean Droplet.
# Docker repository: https://docs.docker.com/engine/install/ubuntu/
if [[ $(id -u) != 0 ]]; then
  printf 'Run this script as root.\n' >&2
  exit 1
fi
. /etc/os-release
if [[ $ID != ubuntu || $VERSION_ID != 24.04 ]]; then
  printf 'Expected Ubuntu 24.04.\n' >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y --no-install-recommends ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update -qq
apt-get install -y --no-install-recommends \
  docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

if [[ ! -e /etc/docker/daemon.json ]]; then
  cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
EOF
  systemctl restart docker
fi
systemctl enable --now docker
timedatectl set-timezone UTC
install -d -m 0750 /opt/libraries-global

docker version --format 'Docker Engine {{.Server.Version}}'
docker compose version
