#!/usr/bin/env python3
"""Poll public GitHub metadata; promote immutable images using host-only config.

Installed by an operator, never downloaded/executed from a polled commit.
The GitHub builder receives registry access only, not SSH or runtime secrets.
"""
import argparse
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.request import Request, urlopen

REPOSITORY = "webbist-js/libraries.global"
CHECKS = (
    "Install, Lint, Test and Build", "Analyze (actions)",
    "Analyze (javascript-typescript)", "Analyze (python)",
)
SERVICES = {"cms": "strapi", "ui": "ui", "atlas": "worker", "events": "worker"}
VARIABLES = {"strapi": "CMS_IMAGE", "ui": "UI_IMAGE", "worker": "WORKER_IMAGE"}
SHA = re.compile(r"[a-f0-9]{40}")
DIGEST = re.compile(r"sha256:[a-f0-9]{64}")
DATA_PATHS = (
    "apps/strapi/", "apps/sync-worker/", "packages/", "patches/", "pnpm-lock.yaml", "pnpm-workspace.yaml",
    "apps/ui/package.json", "apps/ui/src/lib/auth", "apps/ui/src/lib/billing/",
    "apps/ui/src/lib/team-api/", "apps/ui/src/lib/db", "apps/ui/src/lib/database",
    "apps/ui/src/app/api/auth/", "apps/ui/src/app/api/billing/",
    "apps/ui/src/app/api/cron/", "apps/ui/src/lib/stripe",
)
RUNTIME_FILES = (
    "release.env", "app.compose.yml", "ui.production.env", "strapi.production.env",
    "atlas.production.env", "events.production.env", "web.env", "web.compose.yml",
    "web.Caddyfile", "database-ca.crt", "search-ca.crt",
)


class PromotionFailed(RuntimeError):
    """A switched candidate failed; prevent automatic repeated promotions."""


def github(resource):
    request = Request(f"https://api.github.com/repos/{REPOSITORY}/{resource}", headers={
        "Accept": "application/vnd.github+json", "User-Agent": "libraries-global-release",
        "X-GitHub-Api-Version": "2022-11-28",
    })
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def check_passes(checks, name, commit):
    matching = [c for c in checks if c.get("name") == name
                and c.get("head_sha") == commit and c.get("app", {}).get("id") == 15368]
    latest = max(matching, key=lambda c: c["id"], default={})
    return latest if latest.get("status") == "completed" and latest.get("conclusion") == "success" else None


def candidate(fetch=github):
    commit = fetch("git/ref/heads/main")["object"]["sha"]
    if not SHA.fullmatch(commit):
        raise RuntimeError("Invalid main source")
    result = fetch(f"commits/{commit}/check-runs?per_page=100&filter=all")
    checks = result["check_runs"]
    if result.get("total_count", len(checks)) > len(checks):
        raise RuntimeError("Truncated release checks")
    if not all(check_passes(checks, name, commit) for name in CHECKS):
        return None
    published = check_passes(checks, "Production image manifest", commit)
    if not published:
        return None
    match = re.fullmatch(r"([1-9]\d*):([1-9]\d*)", published.get("external_id", ""))
    if not match:
        raise RuntimeError("Invalid publisher identity")
    run_id, attempt = match.groups()
    run = fetch(f"actions/runs/{run_id}/attempts/{attempt}")
    if (run.get("head_sha") != commit or run.get("head_branch") != "main"
            or run.get("head_repository", {}).get("full_name") != REPOSITORY
            or run.get("repository", {}).get("full_name") != REPOSITORY
            or run.get("event") not in ("push", "workflow_dispatch")
            or run.get("path") != ".github/workflows/production-images.yml"):
        raise RuntimeError("Untrusted image publisher")
    if run.get("status") != "completed" or run.get("conclusion") != "success":
        return None
    manifest = json.loads(published["output"]["summary"])
    if (set(manifest) != {"schema", "repository", "commit", "images"}
            or manifest["schema"] != 2 or manifest["repository"] != REPOSITORY
            or manifest["commit"] != commit or set(manifest["images"]) != set(VARIABLES)):
        raise RuntimeError("Invalid production manifest")
    for service, reference in manifest["images"].items():
        if not reference.startswith(service + "@") or not DIGEST.fullmatch(reference.split("@", 1)[1]):
            raise RuntimeError("Invalid immutable image reference")
    return {"manifest": manifest, "run": f"{run_id}:{attempt}"}


def needs_acceptance(comparison):
    # GitHub limits a comparison to 300 files. Do not infer safety from a
    # truncated, divergent or empty comparison.
    files = comparison.get("files", [])
    if comparison.get("status") not in ("ahead", "identical") or len(files) >= 300:
        return True
    if comparison.get("status") == "ahead" and not files:
        return True
    return any(any(file.get(key, "").startswith(prefix) for prefix in DATA_PATHS)
               for file in files for key in ("filename", "previous_filename"))


def atomic_write(file, content):
    descriptor, temporary = tempfile.mkstemp(dir=file.parent, prefix=".release-")
    try:
        with os.fdopen(descriptor, "w") as output:
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, file)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def command(args, root, docker_config, timeout=600):
    result = subprocess.run(args, cwd=root, env={**os.environ, "DOCKER_CONFIG": docker_config},
                            text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    if result.returncode:
        # Docker errors can include private endpoints or runtime information.
        raise RuntimeError("Release command failed; inspect the host privately")
    return result.stdout


def compose(root, docker_config, *args):
    return command(["docker", "compose", "--env-file", "release.env", "-f", "app.compose.yml",
                    "--profile", "workers", *args], root, docker_config)


def runtime_hashes(root):
    return {name: hashlib.sha256((root / name).read_bytes()).hexdigest()
            for name in RUNTIME_FILES if name != "release.env" and (root / name).is_file()}


def smoke(config):
    for probe in config["smoke"]:
        request = Request(probe["url"], headers=probe.get("headers", {}))
        with urlopen(request, timeout=20) as response:
            if response.status != probe["status"]:
                raise RuntimeError("Deployed HTTP smoke failed")
            if probe.get("noindex") and "noindex" not in response.headers.get("X-Robots-Tag", ""):
                raise RuntimeError("Beta indexing protection changed")


def verify_running(root, docker_config, manifest):
    output = compose(root, docker_config, "ps", "--format", "json")
    rows = json.loads(output) if output.lstrip().startswith("[") else [json.loads(line) for line in output.splitlines() if line]
    by_service = {row["Service"]: row for row in rows}
    for service, image in SERVICES.items():
        row = by_service.get(service, {})
        if row.get("State") != "running" or row.get("Health") != "healthy":
            raise RuntimeError("A production service is unhealthy")
        info = json.loads(command(["docker", "inspect", row["ID"]], root, docker_config))[0]
        labels = info.get("Config", {}).get("Labels", {})
        if labels.get("org.opencontainers.image.revision") != manifest["commit"]:
            raise RuntimeError("Running source revision mismatch")
        selected = json.loads(command(["docker", "image", "inspect", manifest["images"][image]], root, docker_config))[0]
        if info["Image"] != selected["Id"]:
            raise RuntimeError("Running image digest mismatch")


def promote(config, selected, fetch=github, run=command, health=smoke, running=verify_running):
    root = Path(config["root"])
    commit = selected["manifest"]["commit"]
    registry = config["registry"]
    if not re.fullmatch(r"registry\.digitalocean\.com/[a-z0-9]+(?:-[a-z0-9]+)*", registry):
        raise RuntimeError("Invalid host registry")
    docker_config = config["docker_config"]
    manifest = {**selected["manifest"], "images": {
        service: f"{registry}/{reference}" for service, reference in selected["manifest"]["images"].items()
    }}
    release_file = root / "release.env"
    previous = release_file.read_text()
    before = runtime_hashes(root)
    for reference in manifest["images"].values():
        run(["docker", "pull", "--platform", "linux/amd64", reference], root, docker_config)
        info = json.loads(run(["docker", "image", "inspect", reference], root, docker_config))[0]
        if (info.get("Architecture") != "amd64" or info.get("Config", {}).get("User") != "node"
                or info.get("Config", {}).get("Labels", {}).get("org.opencontainers.image.revision") != commit):
            raise RuntimeError("Candidate image verification failed")
    # Recheck after downloading: a later main merge must supersede this build.
    if candidate(fetch) != selected:
        raise RuntimeError("Candidate superseded before promotion")
    release = root / f"release-{commit}"
    release.mkdir(mode=0o700, exist_ok=True)
    recovery = release / "previous-runtime"
    recovery.mkdir(mode=0o700, exist_ok=True)
    for name in RUNTIME_FILES:
        if (root / name).is_file():
            shutil.copy2(root / name, recovery / name)
            (recovery / name).chmod(0o600)
    environment = "".join(f"{VARIABLES[service]}={reference}\n" for service, reference in manifest["images"].items())
    try:
        atomic_write(release_file, environment)
        run(["docker", "compose", "--env-file", "release.env", "-f", "app.compose.yml", "--profile", "workers", "config", "--quiet"], root, docker_config)
        run(["docker", "compose", "--env-file", "release.env", "-f", "app.compose.yml", "--profile", "workers", "up", "-d", "--wait", "--wait-timeout", "300"], root, docker_config)
        running(root, docker_config, manifest)
        health(config)
        if runtime_hashes(root) != before:
            raise RuntimeError("Runtime settings changed during release")
    except Exception:
        atomic_write(release_file, previous)
        try:
            run(["docker", "compose", "--env-file", "release.env", "-f", "app.compose.yml", "--profile", "workers", "up", "-d", "--wait", "--wait-timeout", "300"], root, docker_config)
            health(config)
        finally:
            raise PromotionFailed("Candidate failed; operator recovery is required") from None
    record = {**manifest, "publisher_run": selected["run"], "runtime_hashes": before,
              "deployed_at": datetime.now(timezone.utc).isoformat(), "smoke": "passed"}
    atomic_write(release / "manifest.json", json.dumps(record, indent=2) + "\n")
    atomic_write(root / "automated-release.json", json.dumps(record, indent=2) + "\n")
    print(f"Released main commit {commit[:12]}; four services and HTTPS smoke passed.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--check", action="store_true", help="Inspect readiness without pulling or switching images")
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text())
    root = Path(config["root"])
    with (root / "release-agent.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        selected = candidate()
        if not selected:
            print("No current main commit with successful checks and published images.")
            return
        commit = selected["manifest"]["commit"]
        state_file = root / "automated-release.json"
        current = json.loads(state_file.read_text())["commit"] if state_file.exists() else config["initial_commit"]
        if not SHA.fullmatch(current):
            raise RuntimeError("Invalid running source baseline")
        if commit == current:
            return
        comparison = github(f"compare/{current}...{commit}")
        if needs_acceptance(comparison):
            acceptance = root / "accepted-releases" / f"{commit}.json"
            accepted = json.loads(acceptance.read_text()) if acceptance.is_file() else {}
            if (accepted.get("commit") != commit or accepted.get("previous_commit") != current
                    or accepted.get("images") != selected["manifest"]["images"]
                    or not accepted.get("verified_backup") or accepted.get("isolated_data") != "passed"
                    or accepted.get("rollback") != "passed"):
                print(f"Main {commit[:12]} needs backup, isolated data and rollback acceptance.")
                return
        failure_file = root / "release-agent-failure.json"
        if failure_file.is_file() and json.loads(failure_file.read_text()).get("candidate") == selected:
            print("The current candidate previously failed. Operator recovery is required.")
            return
        if args.check or not config.get("enabled", False):
            print(f"Verified main candidate {commit[:12]}; deployment is disabled/check-only.")
            return
        try:
            promote(config, selected)
        except PromotionFailed:
            atomic_write(failure_file, json.dumps({"candidate": selected, "failed_at": datetime.now(timezone.utc).isoformat()}) + "\n")
            raise


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("Automatic production release stopped. Inspect private host readiness and recovery records.", file=sys.stderr)
        sys.exit(1)
