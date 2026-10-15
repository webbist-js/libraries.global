# Architecture

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Strapi CMS (apps/strapi)                       │
│  - Content management                                                       │
│  - REST API with document middleware                                        │
│  - PostgreSQL (Docker locally; managed in production)                       │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │ REST API
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Next.js Frontend (apps/ui)                        │
│  - App Router with catch-all routing                                        │
│  - Server/client Strapi clients with proxy                                  │
│  - Page builder component registry                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Production infrastructure and delivery

The closed beta runs on DigitalOcean with a Next.js frontend, Strapi CMS, event/Atlas workers, PostgreSQL, Meilisearch and object storage. Production secrets, host/network configuration and recovery evidence stay in private operator storage and outside images.

Feature PRs target protected `dev`. A reviewed PR from `dev` or a release branch into protected `main` prepares production delivery. The active publisher waits for CI and all CodeQL analyses on the exact merged commit, builds immutable UI/CMS/worker images, and publishes relative digests. The operator-installed pull agent validates accepted candidates and deployed health; failed promotion restores the previous image selection. Data, dependency, authentication and billing changes need additional private acceptance. See [release helpers](../../../scripts/release/README.md).

The beta gate and sandbox billing remain enabled. Neither a code release nor an analytics configuration change opens public access or live payments. Root `docs/` is private maintainer material; the public developer documentation lives here.

## Page Builder

Strapi component UIDs map to React components via a central registry.

- Strapi: Dynamic zone components in `src/components/{category}/`
- Next.js: React components in `components/page-builder/components/{category}/`
- Registry: `components/page-builder/index.tsx`

See [Page Builder](./page-builder.md) for details.

## Strapi API Clients

Two client classes handle content fetching:

| Client                | Auth     | Use Case                |
| --------------------- | -------- | ----------------------- |
| `PublicStrapiClient`  | API key  | Read-only content       |
| `PrivateStrapiClient` | User JWT | Authenticated endpoints |

Client-side requests use proxy routes (`/api/public-proxy`, `/api/private-proxy`) to hide Strapi URL.

See [Strapi API Client](./strapi-api-client.md) for details.

## Routing

- Catch-all `[locale]/[[...rest]]` renders Strapi-managed pages
- Auth pages under `[locale]/auth/`
- Locale extracted from URL, passed to API queries

## Internationalization

Dual i18n system:

| System      | Purpose    | Location                    |
| ----------- | ---------- | --------------------------- |
| next-intl   | UI strings | `src/locales/{locale}.json` |
| Strapi i18n | Content    | `locale` query parameter    |

## Authentication

- **Better Auth v1**: Session management (cookies)
- **Strapi JWT**: Stored in session as `user.strapiJWT`, used for private API calls

## Environment Variables

Validated via `@t3-oss/env-nextjs`. Access through `getEnvVar()`.

Files bootstrapped from `.example` files on `pnpm install`.

## Pages Hierarchy

Pages use parent-child relations for URL structure. `fullPath` auto-generated from slug chain.

See [Pages Hierarchy](./pages-hierarchy.md) for workflow.
