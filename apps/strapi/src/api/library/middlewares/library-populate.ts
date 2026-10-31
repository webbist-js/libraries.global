import { boundedLibraryQuery } from "@repo/shared-data"
import type { Core } from "@strapi/strapi"

import {
  applyPopulateShape,
  LIBRARY_SHAPES,
  type PopulateView,
} from "../../../utils/populate-shapes"

/**
 * Route middleware for the core `find` / `findOne` routes: the response
 * shape is server-owned. Any client `populate` (including `*`) and `fields`
 * are replaced; filters, sort, locale, status and pagination pass through.
 * Attached in `routes/library.ts` with `config.view` = `list` | `detail`.
 */
export default (
  config: { view?: PopulateView } | undefined,
  _deps: { strapi: Core.Strapi }
) => {
  return async (
    ctx: { query?: Record<string, unknown>; status?: number; body?: unknown },
    next: () => Promise<unknown>
  ) => {
    try {
      ctx.query = boundedLibraryQuery(ctx.query ?? {})
    } catch {
      ctx.status = 400
      ctx.body = { error: "invalid_library_query" }

      return
    }
    applyPopulateShape(ctx, LIBRARY_SHAPES, config)

    await next()
  }
}
