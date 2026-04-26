export default ({ strapi }: { strapi: any }) => ({
  async create(data: {
    submissionType: string
    targetEntityType?: string
    targetDocumentId?: string
    targetSlug?: string
    fields?: Record<string, unknown>
    note?: string
    verificationMethod?: string
    submittedByUserId: string
    submittedByEmail: string
    submittedByName?: string
  }) {
    return strapi.documents("plugin::content-moderation.submission").create({
      data: { ...data, status: "pending" },
    })
  },

  async findAll(status?: string) {
    const filters: Record<string, unknown> = {}
    if (status) filters.status = status

    return strapi.documents("plugin::content-moderation.submission").findMany({
      filters,
      sort: { createdAt: "desc" },
      limit: 200,
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
    const submission = await strapi
      .documents("plugin::content-moderation.submission")
      .findOne({ documentId })

    const updated = await strapi
      .documents("plugin::content-moderation.submission")
      .update({
        documentId,
        data: { status, reviewedByUserId, reviewNote, reviewedAt: new Date() },
      })

    // Side-effect: if approving a library_claim, update the user profile
    if (
      status === "approved" &&
      submission?.submissionType === "library_claim"
    ) {
      const fields = (submission.fields ?? {}) as Record<string, unknown>
      await strapi.query("api::user-profile.user-profile").update({
        where: { baUserId: submission.submittedByUserId },
        data: {
          claimedLibraryEntityRef: fields.entityRef ?? null,
          claimedLibraryName: fields.name ?? null,
          claimedLibraryRole: fields.role ?? null,
          claimedLibraryDepartment: fields.department ?? null,
          affiliationVerificationStatus: "verified",
          affiliationVerificationMethod:
            submission.verificationMethod ?? "contact_us",
          isVerifiedLibrarian: true,
        },
      })
    }

    // Side-effect: if approving a topic_suggestion, approve the topic
    if (
      status === "approved" &&
      submission?.submissionType === "topic_suggestion"
    ) {
      const fields = (submission.fields ?? {}) as Record<string, unknown>
      if (fields.topicDocumentId) {
        await strapi.documents("plugin::topics.topic").update({
          documentId: fields.topicDocumentId as string,
          data: { status: "approved" },
        })
      }
    }

    // Side-effect: if rejecting a library_claim, mark profile as rejected
    if (
      status === "rejected" &&
      submission?.submissionType === "library_claim"
    ) {
      await strapi.query("api::user-profile.user-profile").update({
        where: { baUserId: submission.submittedByUserId },
        data: { affiliationVerificationStatus: "rejected" },
      })
    }

    return updated
  },
})
