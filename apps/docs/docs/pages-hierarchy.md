# Pages hierarchy

Public URLs are defined by Next.js App Router files and route helpers, rather than a parent/child tree in the CMS Page collection.

## Place routes

| Entity    | Path without locale prefix                  |
| --------- | ------------------------------------------- |
| Continent | `/{continent}`                              |
| Country   | `/{continent}/{country}`                    |
| Region    | `/{continent}/{country}/{region}`           |
| Library   | `/{continent}/{country}/{region}/{library}` |

Area is optional geographic metadata, not a route segment. `apps/ui/src/lib/library-helpers.ts` builds library links and returns `null` when a required slug is missing. Use shared helpers rather than constructing a second path convention.

Entity references are identifiers, not public paths. The `entityRef` lifecycle derives colon-separated references from geographic slugs; a library's reference may include its Area even though its public URL does not.

## Articles and fixed pages

Journal articles use `/journal/{section}/{slug}`; Knowledge articles use `/knowledge/{section}/{slug}`. Their section relations and published article loaders determine the path. Legal documents use `/legal/{slug}`. Homepage, library search, Atlas, community and account pages have explicit application routes.

Next-intl uses the supported locales from `packages/shared-data/locales.ts`. English has no prefix; Czech and French use `/cs` and `/fr`.

## Retained Page model

`apps/strapi/src/api/page/content-types/page/schema.json` currently contains `title`, `slug` and `seo`. It has no `parent`, `children`, `fullPath` or `content` attributes. The retained `fetchPage` loader looks up a slug; it does not create frontend routes.

The starter's hierarchy job queue, automatic full-path propagation and generic catch-all renderer have been removed. Do not add components or redirect jobs to that old model without an explicit feature design.

## Changing a URL

Check the route loader, path helper, metadata/canonical URL, sitemap and incoming links together. The CMS retains a Redirect model, but that does not establish that an application route consumes it. Inspect the active route/proxy behavior and implement any required redirect explicitly. A slug edit must not be assumed to create redirects automatically.

See [Architecture](architecture.md) and [Page builder](page-builder.md).
