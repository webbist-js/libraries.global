export default {
  async afterUpdate(event: {
    result: { status: string; libraryEntityRef: string }
  }) {
    if (event.result.status !== "active") return

    const { libraryEntityRef } = event.result
    const libraries = await strapi.documents("api::library.library").findMany({
      filters: { entityRef: libraryEntityRef } as never,
      limit: 1,
    })

    if (libraries[0]) {
      await strapi.documents("api::library.library").update({
        documentId: libraries[0].documentId,
        data: { hasActiveFeed: true },
      })
    }
  },
}
