import type { Core } from "@strapi/strapi"

import {
  applyPopulateShape,
  COUNTRY_SHAPES,
  type PopulateView,
} from "../../../utils/populate-shapes"

/**
 * Route middleware for the core `find` / `findOne` routes: the response
 * shape is server-owned. Any client `populate` (including `*`) and `fields`
 * are replaced; filters, sort, locale, status and pagination pass through.
 * Attached in `routes/country.ts` with `config.view` = `list` | `detail`.
 */
export default (
  config: { view?: PopulateView } | undefined,
  _deps: { strapi: Core.Strapi }
) => {
  return async (
    ctx: { query?: Record<string, unknown> },
    next: () => Promise<unknown>
  ) => {
    applyPopulateShape(ctx, COUNTRY_SHAPES, config)

    await next()
  }
}
