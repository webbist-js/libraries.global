# Strapi types

`@repo/strapi-types` exposes generated CMS schema declarations and Strapi utility types to the frontend and other workspaces.

## Regeneration

After any Strapi schema change, run from the repository root:

```sh
pnpm --filter @repo/strapi generate:types
```

Strapi writes to `apps/strapi/types/generated/`; `packages/strapi-types/generated` is a symlink to that directory. The package entry point is `packages/strapi-types/src/index.ts`. If a checkout cannot use symlinks, follow the package README's copy workflow and run `sync-types` after regeneration.

## Data and query types

```typescript
import type { Data, FindMany, Result, UID } from "@repo/strapi-types"

type Page = Data.ContentType<"api::page.page">
type Callout = Data.Component<"content.callout">
type ComponentUID = UID.Component

const params = {
  locale: "en",
  pagination: { page: 1, pageSize: 10 },
  populate: { seo: true },
} satisfies FindMany<"api::page.page">

type PopulatedPage = Result<"api::page.page", typeof params>
```

Use current schema UIDs and fields. The Page model does not have a content dynamic zone; article `body` fields use `content.*` blocks. Avoid examples based on removed starter components such as `sections.hero`.

## API response types

Client methods return an envelope, not a bare record/array:

```typescript
import { PublicStrapiClient } from "@/lib/strapi-api"

const response = await PublicStrapiClient.fetchMany("api::page.page", params)
const pages = response.data
```

`Result` reflects the selected/populated shape. Required schema attributes can still be absent from a response because of fields, publication state, authorization or controller projection. Handle optional/null values at the boundary. A generated content type is not a public DTO: explicitly select safe fields for browser responses.

## Dynamic zones

Article body items identify their component with `__component`. Follow the existing shared article renderer and editor validation when extending blocks. Narrow to a supported UID before reading its fields; regenerate types after changing a component or allowed dynamic-zone list.

## Troubleshooting

Missing autocomplete or incorrect field shapes can indicate stale generated declarations, a broken symlink, an outdated copy or an unpopulated field. Check those causes before widening types or adding casts. Schema changes must include their generated declarations.

See [Page builder](page-builder.md), [Strapi API client](strapi-api-client.md) and the [types package README](https://github.com/webbist-js/libraries.global/blob/dev/packages/strapi-types/README.md).
