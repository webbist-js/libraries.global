# Strapi API client

The frontend has typed CMS content clients and dedicated session-aware routes for account operations. Choose the request path from the feature's authority and privacy requirements.

## Published content

`PublicStrapiClient`, exported from `apps/ui/src/lib/strapi-api/index.ts`, extends `BaseStrapiClient`. It uses the server's read-only content token for GET/HEAD and the custom content token for other methods. The latter does not turn a generic browser proxy into a write API.

Use existing feature loaders in `apps/ui/src/lib/strapi-api/content/` when available. They define the required population, locale fallback and publication behavior.

```typescript
import { PublicStrapiClient } from "@/lib/strapi-api"

const response = await PublicStrapiClient.fetchOne(
  "api::page.page",
  documentId,
  { locale: "en", populate: { seo: true } }
)
const page = response.data
```

The Page model has title, slug and SEO only. It has no `content` or `fullPath` field.

## Account operations

Better Auth owns the public cookie session. Dedicated Next.js account, contribution, moderation and Staff routes resolve that session, validate the request and construct trusted bridge headers. Strapi rechecks authority. See [Authentication](authentication.md).

`PrivateStrapiClient` remains for explicit legacy authentication. It accepts an explicit `userJWT` option, but its default compatibility hook returns no token. It does not obtain a Strapi JWT from a Better Auth session. Do not use it to implement new account functionality.

## Browser proxies

Client-side content calls use `useProxy: true` in the method's options argument:

```typescript
const response = await PublicStrapiClient.fetchMany(
  "api::page.page",
  { locale: "en", pagination: { page: 1, pageSize: 10 } },
  undefined,
  { useProxy: true }
)
```

`fetchMany` has four arguments, so its options are fourth; `fetchOne` has an additional document-ID argument, making its options fifth. Check the method signature before copying a call.

The generic `/api/public-proxy` and `/api/private-proxy` routes validate paths through `request-auth.ts`. They allow selected published browse GETs and refuse generic account/authentication writes. A cookie alone does not give the private compatibility proxy CMS authority. Feature-specific gateways also constrain query parameters, response fields and result sizes.

## Methods and response envelopes

The implementations are in `apps/ui/src/lib/strapi-api/base.ts`; UID mappings are in `endpoints.ts`.

| Method                                                    | Purpose                                                        |
| --------------------------------------------------------- | -------------------------------------------------------------- |
| `fetchAPI(path, params, requestInit, options)`            | Custom endpoint with explicit response handling                |
| `fetchOne(uid, documentId, params, requestInit, options)` | One collection entry or a single type                          |
| `fetchMany(uid, params, requestInit, options)`            | One bounded page of entries                                    |
| `fetchOneBySlug(uid, slug, params, requestInit, options)` | One entry selected by slug                                     |
| `fetchAll(uid, params, requestInit, options)`             | Aggregate every page; use only for deliberately small datasets |

`fetchOneByFullPath` has been removed. Collection responses have `data` and `meta`; single responses have `data`. Do not treat the entire response as an array.

The library catalogue must use bounded reads, keyset pagination, database counts and search/worker projections. `fetchAll` is not appropriate for catalogue-wide request handling.

## Caching

`DEFAULT_REVALIDATE_SECONDS` in `base.ts` defines the production default (currently 300 seconds). Development requests use zero revalidation. Requests include model/entry tags, invalidated through the feature's webhook or bridge path.

Pass Next.js fetch options as `requestInit`, not the client-options argument:

```typescript
await PublicStrapiClient.fetchOne(
  "api::page.page",
  documentId,
  { locale: "en", populate: { seo: true } },
  { next: { revalidate: 0 } }
)
```

Private responses must use their feature's uncached session-aware boundary. Account-scoped browser query keys must include identity and permission scope.

## Extending an endpoint

Add a UID mapping only for the content type actually served. For browser reads, review the feature's projection and query limits before extending an allowlist. Never expose raw user/profile, draft or financial records through a generic proxy. New authenticated operations need dedicated Next.js and permissioned Strapi routes, with focused authority and input-validation checks.
