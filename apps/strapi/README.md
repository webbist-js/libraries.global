# Strapi CMS

`@repo/strapi` is the Strapi v5 CMS and authoritative content/access backend for Libraries Global. PostgreSQL stores content, moderation records, library affiliations and private access projections. Meilisearch and workers provide derived search/Atlas data.

## Local development

Follow the root [setup guide](../../README.md#local-development) and [.env.example](.env.example). Reuse the existing Docker PostgreSQL database and running apps. Run at most one Strapi server and one Next.js server across checkouts.

From the repository root, when Strapi is not already running:

```sh
pnpm dev:strapi
```

This starts the existing Compose database service and then Strapi. Local defaults are CMS/admin on `http://localhost:1337` and PostgreSQL on host port `5433` (container port `5432`). Inspect private environment overrides before connecting.

Create a local administrator through the normal first-run UI. Set up only the scoped API tokens required by the frontend or requested import. Do not import production users, customer records or an unreviewed database export. The homepage uses its dedicated content type; the retained Page model does not have a `fullPath` or content zone.

## Schemas and generated types

Content-type schemas live in `src/api/*/content-types/*/schema.json`; shared component schemas live in `src/components/`. Local plugin content types live under `src/plugins/`, with Discussions in its workspace package.

After every schema change:

```sh
pnpm --filter @repo/strapi generate:types
```

The generated declarations are shared through `@repo/strapi-types`. See [Schema conventions](../docs/docs/strapi-schemas.md), [types](../docs/docs/strapi-types-usage.md) and [content components](../docs/docs/page-builder.md).

## Plugins and authority

The CMS includes local Access, Beta Invites, Content Moderation, Events, Library Staff, Mobile Libraries, Rewards and Topics plugins, plus the portable [Discussions plugin](../../packages/strapi-plugin-discussions/README.md). Read `config/plugins.ts` and each package's scripts for current registration/build behavior; package.json is the dependency/version reference.

Better Auth in Next.js owns public account sessions. Server bridge endpoints verify trusted headers and current CMS authority. Strapi admin authentication and plugin RBAC are separate. Payment projections may grant tools, never community roles or staff authority. See [Authentication](../docs/docs/authentication.md).

Runtime loads compiled local plugin output. Build the affected plugin before using its changed server/admin code; `pnpm --filter @repo/strapi build` builds all CMS plugins and the admin. Reuse the existing server and restart only through the task's authorized development workflow.

## Content, imports and derived data

- [CMS content operations](CONTENT-OPERATIONS.md) defines production/local targets, draft preservation and publication verification.
- [Ingests](scripts/ingests/README.md) documents dataset registration, provenance and resumable imports.
- [Library maintenance](scripts/library-maintenance.md) covers reviewed maintenance scripts.
- [Notifications](NOTIFICATIONS.md) documents consent, delivery and mail templates.
- [Configuration sync](config/sync/README.md) explains the checked-in admin configuration. Review imports; do not assume configuration from another environment is safe to apply.

Changes to library/article content must preserve public projection, search reprojection, Atlas and cache invalidation. Keep reads bounded; do not load the entire catalogue to implement request-time filtering.

## Checks

Run focused finite checks sequentially with bounded Node memory and one worker:

```sh
NODE_OPTIONS=--max-old-space-size=2048 pnpm --filter @repo/strapi typecheck
NODE_OPTIONS=--max-old-space-size=2048 pnpm --filter @repo/strapi test:unit --maxWorkers=1
```

The full `test` command includes a CMS server-boot test. Database/provider acceptance suites require their documented isolated CI/acceptance environment; do not create another routine local stack or schema.

## Build and release

Build from the monorepo root:

```sh
docker build --platform linux/amd64 -f apps/strapi/Dockerfile -t libraries-global-strapi:local .
```

The Dockerfile builds CMS/plugins and runs as a non-root user. Credentials, database certificates and uploads are runtime inputs. Keep official Strapi packages aligned when upgrading, and regenerate/test their schema types together.

See the [generic release requirements](../../scripts/release/README.md). Host/network configuration, runtime secrets, backups, operator approvals and acceptance results belong in private operator storage. Public documentation must not record the current state of a particular provider account or maintainer machine.
