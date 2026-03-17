# Strapi Backend

Strapi v5 CMS with PostgreSQL. Handles content management, page hierarchy, and API endpoints.

## Component Naming (Critical)

Pattern: `category.kebab-case`

| Element        | Pattern                                    | Example                             |
| -------------- | ------------------------------------------ | ----------------------------------- |
| Strapi UID     | `category.kebab-case`                      | `sections.hero`                     |
| Schema file    | `src/components/{category}/{name}.json`    | `src/components/sections/hero.json` |
| collectionName | `components_{category}_{name_underscored}` | `components_sections_hero`          |

The UID must match in: schema location, page dynamiczone, middleware population, frontend registry.

## Document Middleware

**`src/documentMiddlewares/page.ts`** applies deep population.

Frontend triggers via `populateDynamicZone` parameter:

```typescript
await client.fetchOneByFullPath("api::page.page", fullPath, {
  populateDynamicZone: { content: true },
})
```

Population uses `on` pattern for dynamic zones — see [Page Builder docs](../../docs/page-builder.md#population-rules).

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
2. Register in page dynamiczone: `src/api/page/content-types/page/schema.json`
3. Add population files: `src/populateDynamicZone`
4. Generate types: `pnpm generate:types`
5. Create React component in `apps/ui` — see [apps/ui/AGENTS.md](../ui/AGENTS.md)

Full workflow: [Page Builder docs](../../docs/page-builder.md#adding-new-components)

## Page Hierarchy

The original starter-kit hierarchy/fullpath job queue has been removed from this project. Treat any remaining hierarchy documentation as historical reference unless it is updated alongside the current page model.

## Related Documentation

- [Strapi Schemas](../../docs/strapi-schemas.md) — Schema attributes, localization, lifecycle hooks
- [Page Builder](../../docs/page-builder.md) — Component registry and rendering
- [Pages Hierarchy](../../docs/pages-hierarchy.md) — URL structure and redirects
