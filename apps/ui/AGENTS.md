# Next.js Frontend

Next.js 16 with App Router, React 19, TailwindCSS v4, TanStack Query, and Shadcn/ui.

## Import Alias

Always use `@/` prefix (maps to `src/`):

```typescript
import { Container } from "@/components/elementary/Container"
```

## Content Components

Journal and Knowledge bodies use `content.*` components and the shared `components/blog/ArticleBodyBlocks.tsx` renderer. The old Page content zone and generic catch-all route are removed. Identify the owning feature before adding a component.

**Props:** Use `Data.Component<"uid">` from `@repo/strapi-types`:

```typescript
import { Data } from "@repo/strapi-types"

type Callout = Data.Component<"content.callout">
```

The legacy `components/page-builder/index.tsx` registry retains rich-text utility renderers. Extend it only for a feature that consumes that path; it is not the article body registry.

Full workflow: [Page Builder docs](../docs/docs/page-builder.md)

## Strapi API Clients

```typescript
import { PrivateStrapiClient, PublicStrapiClient } from "@/lib/strapi-api"
```

| Client                | Auth                 | Use Case                                                               |
| --------------------- | -------------------- | ---------------------------------------------------------------------- |
| `PublicStrapiClient`  | API key              | Read-only content                                                      |
| `PrivateStrapiClient` | Explicit legacy auth | Compatibility only; use dedicated bridge routes for account operations |

**Client-side:** Use `useProxy: true` option.

Full reference: [Strapi API Client docs](../docs/docs/strapi-api-client.md)

## Typography

Use the shared heading and display roles in `src/styles/typography.css` and
`T.type`; do not add local heading font sizes. Choose heading levels for the
document outline and visual roles for their context. See
[Typography](../docs/docs/typography.md) for the scale and examples.

## Internationalization

| System      | Purpose    | Location                          |
| ----------- | ---------- | --------------------------------- |
| next-intl   | UI strings | `locales/{locale}.json`           |
| Strapi i18n | Content    | `locale` query param (auto-added) |

## Authentication

- **Better Auth v1**: Session management
- **Server bridge**: Dedicated Next.js routes resolve the Better Auth session; Strapi verifies trusted server headers and rechecks access. No Strapi JWT or service secret is exposed in the browser.

```typescript
// Server
const session = await getSessionSSR(await headers())

// Client
const { data: session } = useHydratedSession()
```

Full reference: [Authentication docs](../docs/docs/authentication.md)

## Adding Page Builder Components

Use skill: `/create-content-component`, or do it manually

1. Create Strapi schema — see [apps/strapi/AGENTS.md](../strapi/AGENTS.md)
2. Generate types (see root AGENTS.md)
3. Update the owning feature's editor, renderer and public projection
4. Extend a registry only when that feature uses it

## Related Documentation

- [Page Builder](../docs/docs/page-builder.md) — Full component workflow
- [Strapi API Client](../docs/docs/strapi-api-client.md) — Fetching content
- [Authentication](../docs/docs/authentication.md) — Better Auth sessions + server bridge
- [Strapi Types](../docs/docs/strapi-types-usage.md) — Type utilities

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
