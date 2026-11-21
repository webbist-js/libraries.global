# Picomatch build-tool advisory — 17 November 2026

GitHub reviewed [CVE-2026-112366](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) on 17 November. `pnpm audit` reports two high-severity paths through `picomatch`: `@commitlint/config-pnpm-scopes` and `semantic-release` in the root build/release toolchain; the production-only audit also reports `@parcel/watcher` under Storybook and `copy-webpack-plugin` under Docusaurus. The advisory applies to attacker-supplied glob patterns. These tools receive repository-controlled build configuration, not public request patterns. No patched `picomatch` release is listed.

The checked-in pnpm `auditConfig` ignores only `CVE-2026-112366`; the CI all-workspace audit still fails for every other high or critical advisory. The preceding `check-dependencies.mjs` gate continues to reject any new high or critical finding in the deployed application workspaces and shared packages, with no exceptions in `dependency-baseline.json`.

Review this exception by **1 December 2026**, or earlier when an upstream fix is released. Remove the exact `ignoreCves` entry once the lockfile resolves a fixed version. Do not expand it to `--ignore-unfixable`.
