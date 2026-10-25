# Next.js frontend

`@repo/ui` is the Libraries Global site and application server: Next.js 16, React 19, Tailwind CSS v4, next-intl, TanStack Query and Better Auth.

## Local development

Follow the root [setup guide](../../README.md#local-development). Environment inputs are documented in [.env.local.example](.env.local.example). Reuse the existing PostgreSQL database and running CMS. Check processes and ports before starting a server; at most one Next.js and one Strapi server may run across checkouts.

From the repository root, start Next.js only when it is not already running:

```sh
pnpm dev:ui
```

Run finite checks sequentially with bounded Node memory and one test worker:

```sh
NODE_OPTIONS=--max-old-space-size=2048 pnpm --filter @repo/ui typecheck
NODE_OPTIONS=--max-old-space-size=2048 pnpm --filter @repo/ui test path/to/test.ts --maxWorkers=1
```

## Routes and content

The App Router has explicit routes for homepage, library search, geography, Journal, Knowledge, community, account and Staff pages. There is no generic CMS Page catch-all route.

- Place routes follow Continent → Country → Region → Library. Area is metadata, not a URL segment. Use `src/lib/library-helpers.ts` for library links.
- Journal and Knowledge have section/article routes and localized article body blocks. `src/components/blog/ArticleBodyBlocks.tsx` is their shared renderer.
- The retained CMS Page model contains title, slug and SEO. It has no `fullPath`, parent/children relations or page content dynamic zone.
- Sitemap handlers are `src/app/sitemap.xml/route.ts` and `src/app/sitemaps/[file]/route.ts`; robots rules are in `src/app/robots.ts`. Review beta/indexing restrictions with route changes.

Read [Routing](../docs/docs/pages-hierarchy.md), [Content components](../docs/docs/page-builder.md) and [Community publishing](../docs/docs/community-publishing.md).

## Data access and authentication

Server components use feature loaders in `src/lib/strapi-api/content/`. `PublicStrapiClient` supplies server-side content credentials. Browser calls go through bounded Next.js content/feature routes. Generic proxies permit selected published reads; they are not arbitrary CMS write APIs.

Better Auth owns public accounts and database-backed cookie sessions. Server code uses `getSessionSSR` from `@/lib/auth-server`; client code uses `useHydratedSession` from `@/lib/access-client`. Dedicated Next.js routes validate requests and construct trusted Strapi bridge headers. Strapi checks current grants, library assignments and entitlements independently.

`PrivateStrapiClient` is a legacy client for explicit authentication. It does not obtain a Strapi JWT from a Better Auth session. New account features must use dedicated session-aware routes.

Query caches include account identity and relevant permission scope. Never put private responses into public caches or unscoped browser storage. Read [Authentication](../docs/docs/authentication.md) and [API client](../docs/docs/strapi-api-client.md).

## UI and localization

Use the warm-paper tokens in `src/lib/design-tokens.ts` and primitives in `src/components/ds`. Preserve keyboard focus, reduced motion, useful loading/error states and status conveyed through text as well as color.

Supported locales and the default come from `packages/shared-data/locales.ts` (English, Czech and French). `src/lib/navigation.ts` configures next-intl; `src/lib/i18n.ts` loads messages from `locales/`. UI translations and CMS content enablement are separate. Keep message keys aligned across locales.

`src/proxy.ts` composes request gates and redirects. Check its current order and the individual files in `src/lib/proxies/` when changing public/guest/account behavior. A beta pass does not replace an account session.

## Environment and deployment

`src/env.mjs` validates environment inputs; `src/lib/env-vars.ts` reads the configured values. Browser-exposed runtime values must be explicitly allowlisted. Keep service credentials, database URLs, provider secrets and operator configuration server-side and out of Git.

Build from the monorepo root:

```sh
docker build --platform linux/amd64 -f apps/ui/Dockerfile -t libraries-global-ui:local .
```

The Dockerfile produces the server runtime. The retained static-export command does not provide the complete account, billing or API application. Review runtime inputs and the [generic release contract](../../scripts/release/README.md) before deployment; private host installation and acceptance are maintained separately.

CMS preview uses the existing preview route and shared preview secret. Keep draft reads behind the accepted server boundary. Public caches, search and sitemaps must not publish drafts.

## Feature references

| Area                         | Reference                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| Membership and catalogue     | [Pricing](PRICING.md), [billing implementation](BILLING.md), [local acceptance](BILLING-LOCAL-TESTS.md) |
| Team seats and API           | [Team billing](TEAM-BILLING.md), [Team API](TEAM-API.md)                                                |
| Beta and legal pages         | [Beta legal](BETA-LEGAL.md), [invitations](../strapi/BETA-INVITES.md)                                   |
| Analytics and consent        | [Analytics](ANALYTICS.md), [disclosures](ANALYTICS-NOTICE.md)                                           |
| Notifications and mail       | [Notifications](../strapi/NOTIFICATIONS.md)                                                             |
| Mobile console               | [Mobile app](MOBILE-APP.md)                                                                             |
| Browser/accessibility checks | [Browser acceptance](../../qa/tests/playwright/README.md)                                               |

Public documentation describes implementation and repeatable checks. Record current host/provider state, approvals, test identities, purchase evidence and delivery results in private operator storage.
