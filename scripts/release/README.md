# Release helpers

`dev` is the integration branch. A PR from `dev` or a release branch into protected `main` releases production. There is no deployed dev environment during beta; pushes to `dev` run CI only.

## Publishing

`production-images.yml` triggers on a push to `main` or a manual retry from `main`. It requires the repository Actions variable `DO_IMAGE_PUBLISH_ENABLED=true`, then waits up to 55 minutes for CI and the three CodeQL analyses on the exact merged SHA. Failed checks, forks, PR refs, other branches and superseded main commits cannot publish a deployable manifest.

The `production-images` environment must allow **main only**. Its secrets are `DO_CONTAINER_REGISTRY`, `DO_REGISTRY_USERNAME` and `DO_REGISTRY_TOKEN`. Grant only registry read/write access. Automatic publishing requires explicit owner approval to replace the existing per-run environment review with the protected-main merge review. Keep administrator bypass disabled. Use an expiring writer and record its renewal date privately; an expired credential stops publishing.

The three `git-<full SHA>` tags are reused on retries rather than overwritten. Worker builds use a committed context with `apps/ui` excluded, as required by its Dockerfile. Registry login diagnostics are suppressed, derived credentials are masked and the temporary Docker configuration is removed after every run.

`image-manifest.mjs` writes a schema-2 artifact with the repository, full source commit and three relative references: `ui@sha256:...`, `strapi@sha256:...`, `worker@sha256:...`. The public artifact omits the private registry prefix. `publish-manifest-check.mjs` publishes the same JSON in the **Production image manifest** check, tied to the exact Actions run and attempt. This lets the server read public metadata without a GitHub token or downloading executable source.

## Server promotion

An operator installs `pull-release.py` on the host and adapts the supplied systemd service, timer and JSON examples. The installed script is reviewed operator code; it does not update itself from the branch it polls. Keep the private configuration and a separate read-only registry login on the host, outside the build context. Start with `enabled=false` and use `--check` to inspect readiness.

The example timer polls every two minutes; operators choose the installed interval to respect API budgets. It verifies the current main head, exact commit checks from GitHub Actions app ID 15368, and the successful `production-images.yml` run on main. It validates service names/digests and checks image architecture, non-root user and revision before changing `release.env`. A newer merge supersedes an older candidate.

Each release preserves the prior image selection and private runtime/configuration files. Compose starts all four services with a health gate; the agent verifies their running image IDs/revision and configured HTTPS/HTTP smoke probes. Runtime flags remain unchanged. On failure it restores the prior selection, runs the health gate again and records the failed candidate to prevent repeated promotion. Registry/network failures before switching leave the current release alone and can retry later. Stop the timer before an operator rollback or manual promotion, then update the verified source baseline before restarting it.

CMS, worker, shared package, dependency, auth and billing changes require a host-only `accepted-releases/<full SHA>.json` record. The record must contain `commit`, `previous_commit`, the exact public `images`, a `verified_backup` reference, and `isolated_data`/`rollback` set to `passed`. Renamed paths and truncated/divergent comparisons also require acceptance. Ordinary UI releases preserve the current database and runtime settings and use the existing provider recovery policy. This does not authorize exporting production records to new destinations.

The beta publisher and host agent are active. A new installation must still install the reader, accept the recovery policy and verify a first publish/promotion/rollback. Preserve accepted manifests outside the 14-day Actions retention window. The timer must be disabled when switching production manually. A later dev environment needs its own configuration, credentials and trigger; do not point it at production.

## Verification

```sh
pnpm exec eslint scripts/release/*.mjs
node --test scripts/release/*.test.mjs
python3 -m unittest discover -s scripts/release -p 'test_*.py'
```

`check-public-files.mjs` rejects private operational paths and credentials from the Git index. Host inventories, runtime secrets, recovery records and promotion commands belong in private operator documentation.
