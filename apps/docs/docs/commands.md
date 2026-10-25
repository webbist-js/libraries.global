# Commands reference

Run commands from the repository root unless a workspace is specified. Reuse existing services: at most one Next.js server and one Strapi server may run across checkouts. Check processes and listening ports before starting anything. Routine development uses the existing Docker PostgreSQL database.

## Development

```sh
pnpm dev         # Applications, Atlas projection worker, Reach worker and native service
pnpm dev:strapi  # Start the existing Docker DB service and Strapi
pnpm dev:ui      # Start Next.js
pnpm dev:docs    # Start Docusaurus when editing the docs site
```

`pnpm dev` runs workspace development tasks, the Atlas projection worker, the Reach job worker and the native analysis service through Turbo. It requires the analysis virtual environment and local configuration described in [Atlas analysis](atlas-analysis.md). It uses prepared routing/population assets; source preparation and ingestion remain explicit commands. `pnpm dev:with-atlas` is an alias for this full startup. Use the individual commands when other services are already running, and stop only processes you started.

## Finite checks

Run checks sequentially, with bounded Node memory. For example:

```sh
NODE_OPTIONS=--max-old-space-size=2048 pnpm build:docs
NODE_OPTIONS=--max-old-space-size=2048 pnpm --filter @repo/ui typecheck
NODE_OPTIONS=--max-old-space-size=2048 pnpm --filter @repo/ui test path/to/test.ts --maxWorkers=1
```

Use the focused checks needed for a change. Watch mode and additional local servers/databases are not routine validation tools. Fixture suites that require isolated services belong in their documented CI/acceptance environment.

| Command             | Purpose                                                    |
| ------------------- | ---------------------------------------------------------- |
| `pnpm build`        | Build all workspaces                                       |
| `pnpm build:ui`     | Build the Next.js app                                      |
| `pnpm build:strapi` | Build Strapi and its plugins                               |
| `pnpm lint`         | Lint all workspaces                                        |
| `pnpm typecheck`    | Typecheck all workspaces                                   |
| `pnpm test:ci`      | Unit suites used by CI, excluding the CMS server-boot test |
| `pnpm format:check` | Check Markdown/CSS/SCSS formatting                         |

`build:ui:static` is retained as an export command; the full account, billing and API application requires a server runtime and is not a static-site deployment.

## Atlas analysis

The four-nation workflow prepares UK Reach, reconciles source identities, imports Network memberships and verifies results. Use `--stage=prepare|import|networks|backfill|verify`; `--apply --local` explicitly selects local writes. Run `node scripts/atlas/uk.mjs` to inspect the plan. See [Atlas analysis](atlas-analysis.md) for setup, limits and acceptance commands.

```sh
node scripts/atlas/england.mjs                         # Show the country data plan
node scripts/atlas/england.mjs --stage=all --apply --local
node scripts/atlas/england.mjs --stage=verify
pnpm --filter @repo/sync-worker dev:analysis            # Separate analytical worker
pnpm dev:analysis:service                             # Prepared private native service
```

See [Atlas Reach and population density](atlas-analysis.md) for the native runtime, supporting feeds, bounded storage, individual stages and reproducible England acceptance. Reuse the existing applications and projection worker; the country command does not start a stack.

## Schema changes

```sh
pnpm --filter @repo/strapi generate:types
```

Run this after every Strapi schema change. Rebuild affected shared packages/plugins before checking their consumers.

## Browser checks

Use the current [browser acceptance guide](https://github.com/webbist-js/libraries.global/blob/dev/qa/tests/playwright/README.md). It identifies fixtures and suites that start a frontend. Run one worker and avoid starting another stack alongside existing apps.

## Content and release work

[CMS content operations](https://github.com/webbist-js/libraries.global/blob/dev/apps/strapi/CONTENT-OPERATIONS.md) defines production/local content targets. [Release helpers](https://github.com/webbist-js/libraries.global/blob/dev/scripts/release/README.md) defines image and acceptance checks. Credentials, host access and results stay in private operator storage.
