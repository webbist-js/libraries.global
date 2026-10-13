# Libraries Global

Libraries Global is an atlas of the world's libraries: public, national, academic, monastic, parliamentary and cultural. Every library sits in a place hierarchy (continent → country → region → area → library) and has its own page with opening hours, status, collections, services and sources. The site lives at [libraries.global](https://www.libraries.global).

The closed beta is deployed on DigitalOcean in London. Public-launch acceptance is tracked in [TODOS.md](./TODOS.md) and the local `docs/pre-golive-checklist.md`.

## What the site does

- **Browse by place.** Location pages at `/{continent}/{country}/{region}/{library}`, generated from the Strapi hierarchy. Large regions can have areas, such as London boroughs.
- **Find libraries** (`/libraries`). Faceted search on Meilisearch, with type, status and "open now" filters, distance, and grid, list or map views.
- **Atlas** (`/map`). A full-screen MapLibre GL map with clustering, boundary drill-down and pin panels.
- **Library pages.** Structured opening hours, operational status, collection and visitor stats, services, amenities, accessibility, IIIF links, provenance, and an inline correction form.
- **Knowledge** (`/knowledge`) and **Journal** (`/journal`). How-to articles and editorial posts, both stored in Strapi.
- **Events** (`/events`). A date-grouped agenda filled by the sync worker. Built, not launched.
- **Accounts and contribution.** Sign-in with email and password, magic link or Google. Profiles, privacy settings and data export. Corrections and additions go to a moderation queue, and contributor roles (reader → contributor → verified librarian → wiki editor → editorial board) unlock more direct editing.

## Repository layout

This is a pnpm workspace run with Turborepo.

| Path                                                                     | What it is                                                                                                                                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/ui`                                                                | Next.js 16 site (App Router, React 19, Tailwind CSS v4, next-intl). Better Auth runs here too. [README](./apps/ui/README.md)                                                   |
| `apps/strapi`                                                            | Strapi 5 CMS on Postgres, with four local plugins: `content-moderation`, `events`, `rewards`, `topics`. [README](./apps/strapi/README.md)                                      |
| `apps/sync-worker`                                                       | Node service that pulls library events from Eventbrite, Spydus, Solus, Aspen, iCal feeds, TicketSource and WeGotTickets, matches them to libraries and writes them to Postgres |
| `apps/docs`                                                              | Docusaurus developer docs inherited from the starter. Mostly not yet rewritten for this project                                                                                |
| `packages/access`                                                        | Contributor roles, capabilities, entitlements and limits, shared by the UI and Strapi                                                                                          |
| `packages/events-crypto`                                                 | AES-256-GCM encryption for event provider credentials, shared by Strapi and the sync worker                                                                                    |
| `packages/strapi-types`                                                  | TypeScript types generated from the Strapi schemas. [README](./packages/strapi-types/README.md)                                                                                |
| `packages/design-system`                                                 | Theme CSS shared by the UI and the Strapi admin                                                                                                                                |
| `packages/shared-data`                                                   | Constants shared by frontend and backend                                                                                                                                       |
| `packages/eslint-config`, `typescript-config`, `semantic-release-config` | Tooling configs                                                                                                                                                                |
| `qa/tests/playwright`                                                    | End-to-end, accessibility, SEO, visual and Lighthouse tests. [README](./qa/tests/README.md)                                                                                    |

## How the pieces fit

- Next.js server components fetch content from the Strapi REST API with a read-only token. Client components get data as props and never call Strapi directly.
- Better Auth runs in the Next.js app and keeps its tables in the same Postgres database as Strapi. When a user signs up, Next.js creates the matching Strapi user through the `auth-bridge` API, signed with `STRAPI_BRIDGE_SECRET`.
- Strapi indexes published content into Meilisearch. Browsers use the gated Next.js `/api/search` proxy; the private search host and search-only credential are server inputs.
- The sync worker reads provider credentials from Postgres, decrypts them with `@repo/events-crypto`, and upserts events on a cron schedule. Strapi calls it to test credentials (`WORKER_URL`, `WORKER_SECRET`).

The domain language (Library, Area, Operational Status, Event and so on) is defined in [CONTEXT.md](./CONTEXT.md), and design decisions are recorded in [docs/adr](./docs/adr).

## Local development

### Prerequisites

- Node 22 (`.nvmrc`; run `nvm use`)
- pnpm 10.28.1 (`corepack enable` picks up the version from `package.json`)
- Docker, for Postgres and Meilisearch

### 1. Install

```sh
git clone https://github.com/webbist-js/libraries.global
cd libraries.global
nvm use
corepack enable
pnpm install
```

`pnpm install` copies every `*.example` env file to its real name (`apps/strapi/.env`, `apps/ui/.env.local`, `apps/sync-worker/.env`, `qa/tests/playwright/.env`). It never overwrites a file that already exists.

### 2. Start Meilisearch

Meilisearch isn't in the compose file. Run it on port 7701:

```sh
docker run -d --name librariesglobal-meilisearch \
  -p 7701:7700 \
  -e MEILI_MASTER_KEY=<a long random string> \
  -v librariesglobal-meili:/meili_data \
  getmeili/meilisearch:latest
```

List its keys with `curl -H "Authorization: Bearer <master key>" http://localhost:7701/keys`. Use a search-only key as the server-side UI credential (`MEILISEARCH_SEARCH_API_KEY`); browsers use the application proxy.

### 3. Fill in the env files

The example files don't list everything the apps read yet. On top of what's in them, set:

**`apps/strapi/.env`**

| Variable                                                       | Value                                                                                    |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `JWT_SECRET` | `openssl rand -base64 16` each                                                           |
| `DATABASE_*`                                                   | Anything; the compose file uses them to create the database on port 5433                 |
| `MEILISEARCH_HOST`                                             | `http://localhost:7701` (the config falls back to port 7700)                             |
| `MEILISEARCH_ADMIN_API_KEY`, `MEILISEARCH_MASTER_KEY`          | The master key is fine locally                                                           |
| `STRAPI_BRIDGE_SECRET`                                         | `openssl rand -hex 32`; must match the UI                                                |
| `STRAPI_API_TOKEN`                                             | A full-access Strapi API token, for the seed and ingest scripts (create it after step 4) |
| `EVENTS_CREDENTIAL_KEY`                                        | Needed to store event provider credentials; must match the sync worker                   |

**`apps/ui/.env.local`**

| Variable                                              | Value                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| `STRAPI_URL`, `NEXT_PUBLIC_STRAPI_URL`                | `http://127.0.0.1:1337`                                                   |
| `STRAPI_REST_READONLY_API_KEY`                        | A read-only Strapi API token (create it after step 4)                     |
| `STRAPI_REST_CUSTOM_API_KEY`, `STRAPI_UPLOAD_API_KEY` | Custom tokens; the upload one needs only `upload.create`                  |
| `DATABASE_URL`                                        | The Strapi database: `postgres://<user>:<password>@localhost:5433/<name>` |
| `BETTER_AUTH_SECRET`                                  | `openssl rand -hex 32`                                                    |
| `STRAPI_BRIDGE_SECRET`                                | Same value as in Strapi                                                   |
| `APP_PUBLIC_URL`, `NEXT_PUBLIC_APP_URL`               | `http://localhost:3000`                                                   |
| `MEILISEARCH_HOST`, `MEILISEARCH_SEARCH_API_KEY`      | `http://localhost:7701` and the search key                                |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`            | Optional; Google sign-in                                                  |

Without a configured transport, development logs email to the console; production refuses delivery. Generic SMTP is selected through `SMTP_HOST`, `SMTP_USER` and `SMTP_PASS`. Brevo is the selected deployed provider; Mailgun/Mailtrap remain alternative configurations.

### 4. Run Strapi

```sh
pnpm dev:strapi
```

This starts Postgres with `docker compose` and then runs `strapi develop`. Open [localhost:1337/admin](http://localhost:1337/admin), create the first admin user, then create the API tokens from step 3 under **Settings → API Tokens**. On every boot Strapi seeds, where missing, the approved topics and draft legal documents. There are no libraries or places until you load them in step 6.

### 5. Run the site

```sh
pnpm dev:ui
```

The site runs on [localhost:3000](http://localhost:3000). `pnpm dev` starts every app at once, including the sync worker, which needs its own `.env` filled in.

Better Auth keeps its data in the `user`, `session`, `account`, `verification` and `rateLimit` tables. If they don't exist in your database yet, create them with the [Better Auth CLI](https://www.better-auth.com/docs/concepts/cli).

### 6. Load data and the search index

```sh
# UK public libraries from libraryOn (resumable; try --dry-run first)
cd apps/strapi && npx tsx scripts/libraryon-ingest.ts --dry-run --limit=10

# Build the Meilisearch `library` index from Strapi
node apps/strapi/scripts/seed-meilisearch.mjs
```

`apps/strapi/scripts/` also has scripts for European countries and boundaries. The order to run them in is in [docs/pre-golive-checklist.md](./docs/pre-golive-checklist.md).

## Commands

Run from the repo root.

```sh
pnpm dev              # all apps in watch mode
pnpm dev:ui           # Next.js only
pnpm dev:strapi       # Postgres + Strapi
pnpm build            # build everything
pnpm lint             # ESLint across the workspace
pnpm typecheck        # tsc across the workspace
pnpm test             # every Vitest suite
pnpm test:ci          # what CI runs (skips the Strapi test that boots a real server)
pnpm format:check     # Prettier on CSS, SCSS and Markdown
pnpm commit           # Commitizen prompt for a conventional commit
```

For one workspace, use a filter: `pnpm -F @repo/ui test`.

After changing a Strapi schema, regenerate the types so the UI sees the change:

```sh
pnpm -F @repo/strapi generate:types
```

The Playwright suites need a running site and browsers (`pnpm -F @repo/tests-playwright exec playwright install --with-deps`). Then run `pnpm tests:playwright:e2e:test`, `tests:playwright:axe`, `tests:playwright:seo` or `tests:playwright:visual`. See [qa/tests/README.md](./qa/tests/README.md).

## Conventions

The UI follows the v2 "warm paper" design system: tokens in `apps/ui/src/lib/design-tokens.ts`, primitives in `apps/ui/src/components/ds`. The accessibility baseline (visible focus rings, a skip link, reduced motion, status shown as colour + icon + text) is required, not optional. [CLAUDE.md](./CLAUDE.md) has the full frontend conventions.

The Husky pre-commit hook runs lint-staged (ESLint and Prettier) and checks branch names. Topic branches use `<type>/<description>`, for example `feat/open-now-filter` or `codex/github-protection`. Legacy `STAR-<number>-` prefixes remain accepted. Commit messages must be [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/), checked by commitlint.

Describe added or changed environment variables in the pull request so maintainers can update deployment configuration. Never include credential values.

## CI and releases

`dev` is the protected default branch and the source branch for production images. [CI](.github/workflows/ci.yml) runs on PRs and pushes to `dev`/`main`, plus manual dispatch: frozen install, lint, formatting, release-source guard tests, unit/component tests, UI build/typecheck and CMS build. GitHub CodeQL analyzes JavaScript/TypeScript, Python and Actions. Contributor changes require maintainer/code-owner review and passing checks; merges use squash commits.

[Production images](https://github.com/webbist-js/libraries.global/blob/dev/.github/workflows/production-images.yml) is a prepared manual publisher for x86-64 UI, CMS and worker images. It verifies the current protected `dev` SHA and its checks, then records full registry digests in a release manifest. Activation requires the repository switch, protected environment review and an approved expiring registry writer. It has not run yet. Production promotion is an operator action over SSH; merging or publishing does not deploy.

[QA](.github/workflows/qa.yml) runs deployed browser/accessibility/SEO/performance checks on demand. The [Atlas archive workflow](.github/workflows/atlas-tiles.yml) awaits a separate private runner. [Docusaurus Pages](.github/workflows/docs.yml) is behind its own publishing switch. [Semantic release](.github/workflows/release.yml) retains a `main` trigger, but `main` has not been established and the former automatic `dev` to `main` PR workflow was removed. Neither workflow promotes the application.

## Deployment

The closed beta is deployed on DigitalOcean in London: Next.js, Strapi, independent event/Atlas workers, Managed PostgreSQL with a standby, Spaces and persistent Meilisearch storage. The approved baseline is $164.50/month before tax and overages. Caddy handles HTTPS, the CMS stays private through SSH and authenticated systemd jobs handle daily retention and per-minute billing processing.

The [infrastructure record](./infra/digitalocean/README.md) describes the running services. The [deployment runbook](./infra/digitalocean/deployment.md) covers CI, image publishing, manual promotion, secrets and recovery. The verified running release is `release-20261013-google-auth`; the merged framework upgrades still need data acceptance and promotion. The invitation gate is on and live purchases are off. Local public-launch acceptance is tracked in `docs/operations/digitalocean-launch-checklist.md` and `docs/pre-golive-checklist.md`.

## Documentation

| Where                                                                        | What                                  |
| ---------------------------------------------------------------------------- | ------------------------------------- |
| [CONTEXT.md](./CONTEXT.md)                                                   | Domain glossary                       |
| [docs/adr](./docs/adr)                                                       | Architecture decision records         |
| [docs/events-system-spec.md](./docs/events-system-spec.md)                   | Events, providers and the sync worker |
| [docs/strapi-role-permissions.md](./docs/strapi-role-permissions.md)         | Strapi roles and what each can do     |
| [docs/community-and-points-system.md](./docs/community-and-points-system.md) | Contributor roles and rewards         |
| [docs/search-assessment.md](./docs/search-assessment.md)                     | Search design and Meilisearch setup   |
| [docs/user-touchpoints.md](./docs/user-touchpoints.md)                       | Every place the site talks to users   |
| [TODOS.md](./TODOS.md)                                                       | Open work, by priority                |
| [CLAUDE.md](./CLAUDE.md), [AGENTS.md](./AGENTS.md)                           | Notes for coding agents               |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and the [code of conduct](./CODE_OF_CONDUCT.md). Report security problems as described in [SECURITY.md](./SECURITY.md), not in public issues. For anything else, email info@libraries.global.

## Licence

The code is MIT licensed; see [LICENSE](./LICENSE). Library data and Knowledge documentation on the site are published under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); the terms are on the site at `/legal/data-licence`, and CC BY-SA does not apply to the code. The name "Libraries Global", the logo and other original brand assets are not covered by either licence. Third-party library names and logos belong to their owners.

Every imported dataset is registered as a `Dataset` in Strapi with its publisher, licence, attribution and import details (seeded from `apps/strapi/src/seeds/datasets.ts`), and records point at it through their `source` field. The site's independence and provenance statement is at `/legal/independence`.

The legal documents in Strapi are pre-launch drafts (version 0.x). The first-publication review in [docs/pre-golive-checklist.md](./docs/pre-golive-checklist.md) §7f assigns v1.0 and the effective date at launch.

## Acknowledgements

- The monorepo began as [notum-cz/strapi-next-monorepo-starter](https://github.com/notum-cz/strapi-next-monorepo-starter) (MIT).
