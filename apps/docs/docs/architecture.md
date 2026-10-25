# Architecture

Libraries Global is a pnpm/Turborepo monorepo with a Next.js frontend, a Strapi CMS and independent event/Atlas workers.

## Application boundaries

| Workspace                            | Responsibility                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| `apps/ui`                            | Public routes, Better Auth, session-aware API routes and browser UI                   |
| `apps/strapi`                        | Published content, moderation, library staff authority and private access projections |
| `apps/sync-worker`                   | Event ingestion and Atlas processing                                                  |
| `apps/analysis`                      | Private native routing, windowed population integration and bounded file artifacts    |
| `packages/access`                    | Shared capabilities, entitlements and limits                                          |
| `packages/shared-data`               | Domain constants, locales and shared data contracts                                   |
| `packages/strapi-types`              | Generated CMS types consumed across workspaces                                        |
| `packages/strapi-plugin-discussions` | Portable moderated discussion plugin                                                  |

PostgreSQL holds CMS and application data. Meilisearch serves derived public search data. Media storage and runtime connections are configured through server environment inputs. Host inventories and operational evidence belong in private operator storage.

## Content and account requests

Server components fetch published CMS content through `PublicStrapiClient` and feature-specific loaders. Browser requests use bounded Next.js routes; credentials stay on the server. The generic content proxies allow selected published reads only.

Better Auth owns public account sessions. Dedicated Next.js routes resolve the cookie session and construct trusted bridge headers. Strapi verifies the bridge and rechecks current authority for each operation. A paid plan changes tools and quotas; it never grants editorial or staff authority. `PrivateStrapiClient` is a legacy compatibility client and does not obtain a Strapi JWT from a Better Auth session.

See [Authentication](authentication.md) and [Strapi API client](strapi-api-client.md).

## Routing

The App Router defines public routes explicitly. Place routes follow Continent → Country → Region → Library; Area is metadata and adds no URL segment. Journal and Knowledge have separate section/article routes. There is no generic CMS catch-all page route.

The retained CMS Page model contains title, slug and SEO. Its old parent/children relations, `fullPath` and page content dynamic zone are absent. Article bodies use the current `content.*` block schemas and article renderers. See [Pages hierarchy](pages-hierarchy.md) and [Page builder](page-builder.md).

## Internationalization

`packages/shared-data/locales.ts` defines supported locales and the default. Next-intl reads UI messages from `apps/ui/locales/{locale}.json`; Strapi manages localized content independently. Adding a frontend locale also requires CMS enablement and reviewed content fallback behavior.

## Derived data and caching

Search indexes, Atlas projections and cached pages derive from authoritative records. Changes must preserve their invalidation/reprojection paths. Public CMS reads use tagged Next.js caching; private account data uses session-aware routes and account-scoped query keys. Do not put private responses into shared public caches.

Library browse, search and export operations must remain bounded. Use database counts, pagination and worker projections instead of loading the full catalogue into application memory.

[Reach and population density](atlas-analysis.md) keep routing graphs and resident rasters outside PostgreSQL. The sync worker manages small durable analysis jobs, while the private native service performs one calculation at a time. Density reuses reporting-area geometry and the existing population observations; the map receives only bounded area metadata or the selected library’s contour.

## Development and delivery

Reuse the existing local PostgreSQL database and running apps. Run at most one Next.js server and one Strapi server across checkouts. Run finite checks sequentially with bounded Node memory and one test worker. See [Commands](commands.md).

Feature PRs target `dev`; reviewed releases reach `main`. The image publisher checks the exact source commit before publishing immutable images. Host promotion verifies the accepted candidate and health, with additional private acceptance for data, dependency, authentication and billing changes. Preserve the beta gate and sandbox billing during routine releases.

The [release helpers](https://github.com/webbist-js/libraries.global/blob/dev/scripts/release/README.md) describe the public release contract. Installed host configuration, credentials, backups and acceptance results remain private. Root `docs/` is ignored maintainer material; public developer documentation lives in `apps/docs/docs/`.
