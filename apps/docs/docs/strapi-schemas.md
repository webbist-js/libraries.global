# Strapi Schemas

Guidelines for creating and managing Strapi content type and component schemas.

## Component Naming Convention

Pattern: `{category}.{kebab-case-name}`

| Element        | Pattern                                    | Example                               |
| -------------- | ------------------------------------------ | ------------------------------------- |
| Strapi UID     | `category.kebab-case`                      | `content.callout`                     |
| Schema file    | `{name}.json`                              | `src/components/content/callout.json` |
| collectionName | `components_{category}_{name_underscored}` | `components_content_callouts`         |

The UID must match exactly in:

1. Schema file location
2. The owning component field or dynamic-zone components array
3. Document middleware population rules
4. Frontend component registry

## Schema Attributes

### Basic Types

```json
{
  "title": {
    "type": "string",
    "required": true
  },
  "description": {
    "type": "text"
  },
  "content": {
    "type": "richtext"
  },
  "isActive": {
    "type": "boolean",
    "default": false
  }
}
```

### Enumerations

```json
{
  "variant": {
    "type": "enumeration",
    "enum": ["primary", "secondary", "outline"],
    "default": "primary"
  }
}
```

### Nested Components

```json
{
  "link": {
    "type": "component",
    "repeatable": false,
    "component": "utilities.link"
  },
  "images": {
    "type": "component",
    "repeatable": true,
    "component": "utilities.basic-image"
  }
}
```

### Media Fields

```json
{
  "image": {
    "type": "media",
    "multiple": false,
    "allowedTypes": ["images"]
  },
  "documents": {
    "type": "media",
    "multiple": true,
    "allowedTypes": ["files"]
  }
}
```

### Relations

```json
{
  "section": {
    "type": "relation",
    "relation": "manyToOne",
    "target": "api::wiki-section.wiki-section",
    "inversedBy": "articles"
  }
}
```

## Localization

All localizable fields need the i18n plugin option:

```json
{
  "title": {
    "type": "string",
    "pluginOptions": {
      "i18n": { "localized": true }
    }
  },
  "internalCode": {
    "type": "string"
  }
}
```

Fields without `i18n.localized: true` share the same value across all locales.

## Lifecycle Subscribers

Database subscribers live in `apps/strapi/src/lifeCycles/` and are registered from `src/index.ts`. Follow an active subscriber, such as `entityRef.ts`, rather than adding an unregistered file. That subscriber derives geographic entity references and refreshes library completeness after relevant changes; its self-write guard prevents recursive updates.

Choose hooks for the actual transaction/publication path. Preserve existing draft handling and post-commit projection/invalidation behavior. Better Auth owns public account activation and requested authentication emails; do not recreate the starter's Strapi end-user welcome lifecycle.

## Document Middlewares

Document middleware lives in `apps/strapi/src/documentMiddlewares/` and is registered by the CMS. Inspect the active feature hook before extending query, publication or projection behavior. The old `documentMiddlewares/page.ts` has been removed.

The retained Page model has title, slug and SEO only. Article bodies use their own `content.*` blocks and feature-specific loaders. See [Page Builder](./page-builder.md) for the current integration workflow.

## Adding New Components

Use the skill for automated creation:

```
/create-content-component
```

Or follow manual steps in [Page Builder](./page-builder.md#adding-new-components).

## Related Documentation

- [Page Builder](./page-builder.md) — Component registry and rendering
- [Pages Hierarchy](./pages-hierarchy.md) — URL structure and redirects
