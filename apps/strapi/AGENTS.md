# Strapi Backend

Strapi v5 CMS with PostgreSQL. Handles content, moderation, access authority and API endpoints.

## Component Naming (Critical)

Pattern: `category.kebab-case`

| Element        | Pattern                                 | Example                               |
| -------------- | --------------------------------------- | ------------------------------------- |
| Strapi UID     | `category.kebab-case`                   | `content.callout`                     |
| Schema file    | `src/components/{category}/{name}.json` | `src/components/content/callout.json` |
| collectionName | Unique existing/new database name       | `components_content_callouts`         |

The UID must match the schema, owning component field/dynamic zone, active population rules and feature renderer. Preserve existing collection names.

## Document Middleware

Inspect the feature's active hook in `src/documentMiddlewares/` and its controller/loader before changing population or publication behavior. The old `documentMiddlewares/page.ts` is absent; the retained `populateDynamicZone` utility is not automatically applied to every model. See [population rules](../docs/docs/page-builder.md#population-rules).

## Localization

Localizable fields need i18n plugin option:

```json
{
  "title": {
    "type": "string",
    "pluginOptions": { "i18n": { "localized": true } }
  }
}
```

## Adding Page Components

Use skill: `/create-content-component`

Or manually:

1. Create schema: `src/components/{category}/{name}.json`
2. Register in the actual owning field; Journal and Knowledge use article `body` dynamic zones
3. Update the feature's population, editor validation and public projections
4. Generate types: `pnpm generate:types`
5. Create React component in `apps/ui` — see [apps/ui/AGENTS.md](../ui/AGENTS.md)

Full workflow: [Page Builder docs](../docs/docs/page-builder.md#adding-new-components)

## Page Hierarchy

The Page model has title, slug and SEO only. Its hierarchy/content zone and the starter's full-path job queue are removed. Public routes are explicit in Next.js; follow the current [routing guide](../docs/docs/pages-hierarchy.md).

## Related Documentation

- [Strapi Schemas](../docs/docs/strapi-schemas.md) — Schema attributes, localization, lifecycle hooks
- [Page Builder](../docs/docs/page-builder.md) — Component registry and rendering
- [Pages Hierarchy](../docs/docs/pages-hierarchy.md) — URL structure and redirects
