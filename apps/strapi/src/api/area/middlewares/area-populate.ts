import type { Core } from "@strapi/strapi"

import {
  applyPopulateShape,
  AREA_SHAPES,
  type PopulateView,
} from "../../../utils/populate-shapes"

/**
 * Route middleware for the core `find` / `findOne` routes: the response
 * shape is server-owned. Any client `populate` (including `*`) and `fields`
 * are replaced; filters, sort, locale, status and pagination pass through.
 * Attached in `routes/area.ts` with `config.view` = `list` | `detail`.
 */
export default (
  config: { view?: PopulateView } | undefined,
  _deps: { strapi: Core.Strapi }
) => {
  return async (
    ctx: { query?: Record<string, unknown> },
    next: () => Promise<unknown>
  ) => {
    applyPopulateShape(ctx, AREA_SHAPES, config)

    await next()
  }
}
