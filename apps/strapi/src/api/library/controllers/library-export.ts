import {
  findLibrariesForExport,
  LIBRARY_EXPORT_MAX_IDS,
  parseExportIds,
} from "../../../utils/library-export"
import { isValidServiceSecret } from "../../../utils/service-secret"

/**
 * POST /libraries/export: rows for the Atlas export. Only the Next route
 * calls it, after checking the account's `atlas.export` entitlement and row
 * limit, so it needs the bridge secret; without that gate Strapi would be a
 * way around those limits.
 */
export default {
  async exportRows(ctx: any) {
    if (!isValidServiceSecret(ctx.request.header["x-service-secret"]))
      return ctx.unauthorized("Invalid or missing service secret")

    const ids = parseExportIds(ctx.request.body)
    if (!ids)
      return ctx.badRequest(
        `Send { ids }: 1 to ${LIBRARY_EXPORT_MAX_IDS} library documentIds`
      )

    return ctx.send({ data: await findLibrariesForExport(strapi, ids) })
  },
}
