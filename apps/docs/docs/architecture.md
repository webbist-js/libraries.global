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

The closed beta runs on DigitalOcean in London. An app Droplet hosts Caddy HTTPS, Next.js/Better Auth, private Strapi and independent event/Atlas workers. A separate search Droplet holds persistent Meilisearch data behind a private TLS proxy. PostgreSQL 17 has a managed standby. Spaces holds CDN-backed media/Atlas objects and private versioned backups. The app/search servers each have one instance.

Production uses Compose host networking with loopback/private listeners and Cloud Firewalls. CMS administration is through an SSH tunnel, and runtime credentials/CA files stay outside images. Billing and retention are authenticated systemd jobs, not Vercel cron jobs. The deployed application still has invitation access and live purchases disabled.

GitHub validates protected `dev` commits through CI and CodeQL. The prepared manual publisher builds UI/CMS/worker images and records full digest references; the operator promotes accepted images over SSH using Compose health checks. PR merge, image publication and deployment are separate operations. The publisher has not run yet, and data upgrades/rollback require acceptance beyond CI.

Host-specific infrastructure and delivery runbooks are maintained privately by the operator. Root `docs/` contains local plans and acceptance records; it is gitignored and is separate from this Docusaurus documentation.

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
