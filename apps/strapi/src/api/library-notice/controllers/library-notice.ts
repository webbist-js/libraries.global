import { isDocumentId } from "../../../plugins/content-moderation/server/utils/params"
import {
  noticesForLibraries,
  noticesForLibrary,
} from "../../../utils/library-notices"

const MAX_IDS = 100

export default {
  async forLibrary(ctx: any) {
    if (!isDocumentId(ctx.params?.documentId)) {
      ctx.status = 400
      ctx.body = { error: "Invalid id" }

      return
    }
    ctx.set("Cache-Control", "public, max-age=60, stale-while-revalidate=60")
    ctx.body = { data: await noticesForLibrary(strapi, ctx.params.documentId) }
  },
  /** `?ids=a,b,c` (at most 100): `{ data: { [documentId]: notices } }`. */
  async forLibraries(ctx: any) {
    const raw = ctx.query?.ids
    const ids = typeof raw === "string" ? raw.split(",").filter(Boolean) : null
    if (
      !ids ||
      ids.length === 0 ||
      ids.length > MAX_IDS ||
      ids.some((id) => !isDocumentId(id))
    ) {
      ctx.status = 400
      ctx.body = { error: `Pass 1 to ${MAX_IDS} valid ids` }

      return
    }
    ctx.set("Cache-Control", "public, max-age=60, stale-while-revalidate=60")
    ctx.body = {
      data: Object.fromEntries(await noticesForLibraries(strapi, ids)),
    }
  },
}
