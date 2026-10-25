---
name: create-content-component
description: Add or change a Strapi content component and its Next.js editor/renderer integration in Libraries Global. Use for article blocks, CMS sections or component-backed feature fields.
---

# Create a content component

Read `apps/docs/docs/page-builder.md` and the owning feature's schemas/loaders before editing. The original Page builder is retired: `api::page.page` has title, slug and SEO only, with no `content`, hierarchy relations or `fullPath`.

## Choose the integration

Identify the requested behavior, component fields and consuming content type. Reuse existing components when they fit. Infer routine naming choices from the feature; ask only for missing product decisions that affect implementation.

Knowledge and Journal article bodies use `content.*` components in their `body` dynamic zones. Their shared renderer is `apps/ui/src/components/blog/ArticleBodyBlocks.tsx`. The article editor, server validation and public detail/browse projections must agree on accepted blocks.

The legacy `apps/ui/src/components/page-builder/index.tsx` registry contains rich-text utility renderers. Extend it only for an actual consumer of that path. Do not recreate the removed Page zone or catch-all route as an incidental component change.

## Implement

1. Create/update `apps/strapi/src/components/{category}/{kebab-case-name}.json`. Use a unique collection name and fields appropriate to the request; preserve existing collection names.
2. Register the component in the owning field. For article blocks, inspect both Journal and Knowledge schemas, accepted submission payloads and the shared editor. Extend only the types the requested feature supports.
3. Follow that feature's active population, publication and privacy rules. `src/populateDynamicZone` is a retained utility, not an automatic hook for every content type; the old `documentMiddlewares/page.ts` does not exist.
4. Run `pnpm --filter @repo/strapi generate:types` after any schema change.
5. Use `Data.Component<"category.name">` from `@repo/strapi-types` in the relevant renderer/editor. Use existing `components/ds` primitives. Do not add starter placeholder helpers or unfinished sample UI.
6. Update export/search representations when they handle the changed block. Verify saved/submitted/published content round trips, including draft/public separation and media ownership where applicable.

Follow root `AGENTS.md` for resource use. Run focused finite checks sequentially with bounded Node memory and one worker; reuse the existing apps and database.
