export default ({ strapi }: { strapi: any }) => ({
  async create(data: {
    submissionType: string
    targetEntityType?: string
    targetDocumentId?: string
    targetSlug?: string
    fields?: Record<string, unknown>
    note?: string
    submittedByUserId: string
    submittedByEmail: string
    submittedByName?: string
  }) {
    return strapi.documents("plugin::content-moderation.submission").create({
      data: { ...data, status: "pending" },
    })
  },

  async findByUser(userId: string) {
    return strapi.documents("plugin::content-moderation.submission").findMany({
      filters: { submittedByUserId: userId },
      sort: { createdAt: "desc" },
      limit: 100,
    })
  },

  async updateStatus(
    documentId: string,
    status: "approved" | "rejected" | "needs_info",
    reviewedByUserId: string,
    reviewNote?: string
  ) {
    return strapi.documents("plugin::content-moderation.submission").update({
      documentId,
      data: { status, reviewedByUserId, reviewNote, reviewedAt: new Date() },
    })
  },
})
