/** Strapi documentIds: 24 lowercase letters and digits. */
const DOCUMENT_ID = /^[a-z0-9]{24}$/

/**
 * GET /libraries/:documentId/followers: how many people follow a published
 * library. Public and anonymous: only the count leaves Strapi, never who.
 * Profiles are counted by the library's documentId, so a follow stored
 * against either the draft or the published row counts once.
 */
export default {
  async count(ctx: any) {
    const { documentId } = ctx.params as { documentId?: string }
    if (!documentId || !DOCUMENT_ID.test(documentId))
      return ctx.badRequest("Invalid library documentId")

    const library = await strapi.documents("api::library.library").findOne({
      documentId,
      status: "published",
      fields: ["documentId"],
    })
    if (!library) return ctx.notFound("Library not found")

    const followers = await strapi
      .documents("api::user-profile.user-profile")
      .count({
        filters: { followedLibraries: { documentId: { $eq: documentId } } },
      } as never)

    ctx.set("Cache-Control", "public, max-age=60")

    return ctx.send({ data: { documentId, followers } })
  },
}
