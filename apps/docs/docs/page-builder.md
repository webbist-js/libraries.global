# Page builder

The original starter's generic page builder has been retired. This document describes the remaining component infrastructure and the active article block workflow.

## Current content models

The CMS Page collection contains title, slug and SEO only. It has no page content dynamic zone, hierarchy relations or `fullPath`. The frontend has explicit routes rather than a generic CMS catch-all renderer.

Knowledge (`api::wiki-article.wiki-article`) and Journal (`api::blog-article.blog-article`) articles have a localized `body` dynamic zone. Both currently permit `content.rich-text`, `content.image-block`, `content.code-block`, `content.quote-block` and `content.callout`. Their shared renderer is `apps/ui/src/components/blog/ArticleBodyBlocks.tsx`.

The legacy `apps/ui/src/components/page-builder/index.tsx` registry retains CKEditor and TipTap utility renderers. It is not the registry for article body blocks. Add to it only when the requested feature actually uses that legacy rendering path.

## Naming and types

Component UIDs follow `category.kebab-case`; the schema lives at `apps/strapi/src/components/{category}/{name}.json`. Preserve existing collection names. A new component's collection name must be distinct from existing components.

For example, `content.callout` is typed as:

```typescript
import type { Data } from "@repo/strapi-types"

type Callout = Data.Component<"content.callout">
```

Use real fields from the schema (`type`, optional `title`, and `body` for a callout). Do not copy the starter's nonexistent `sections.hero` schema into examples or new code.

## Population rules

Inspect the feature's actual controller/loader and population configuration. Article detail/browse paths have publication and privacy rules; adding a relation to a component must not expose private account or draft fields.

`apps/strapi/src/populateDynamicZone/index.ts` retains a utility that loads per-component population files. Its presence does not imply every content type uses it. The old `documentMiddlewares/page.ts` hook is absent. Do not assume a `populateDynamicZone` query parameter will populate a new field unless its active server path implements that behavior.

For nested relations/media, reuse the feature's existing explicit populate shape. Scalar fields do not need relation population. Preserve published-only projections and bounded relation sizes.

## Adding new components

1. Identify the owning content type, field and renderer. Reuse an existing component when it fits.
2. Create or update the component schema. If it belongs in an article body, update both relevant article schemas and their accepted block validation; do not edit a nonexistent Page `content` field.
3. Update the feature's loader, public projection, editor, renderer and any export/search representation that handles the block. Article submissions and direct CMS edits must round-trip the same supported data.
4. After any schema change, run `pnpm --filter @repo/strapi generate:types` from the repository root.
5. Use the generated types and existing design-system primitives. Add meaningful content; avoid starter placeholder helpers.
6. Run focused validation for body round trips, draft/public separation and the new block's behavior. Reuse running services under the resource rules in root `AGENTS.md`.

The repository's `create-content-component` skill follows this workflow. See [Community publishing](community-publishing.md), [Strapi schemas](strapi-schemas.md) and [Strapi types](strapi-types-usage.md).
