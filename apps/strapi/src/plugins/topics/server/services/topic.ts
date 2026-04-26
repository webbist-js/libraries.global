export default ({ strapi }: { strapi: any }) => ({
  async findApproved() {
    return strapi.documents("plugin::topics.topic").findMany({
      filters: { status: "approved" },
      sort: { name: "asc" },
      limit: 500,
    })
  },

  async findAll() {
    return strapi.documents("plugin::topics.topic").findMany({
      sort: [{ status: "asc" }, { name: "asc" }],
      limit: 500,
    })
  },

  async create(data: {
    name: string
    status?: "approved" | "pending" | "rejected"
    suggestedByUserId?: string
    suggestedByEmail?: string
  }) {
    return strapi.documents("plugin::topics.topic").create({ data })
  },

  async updateStatus(
    documentId: string,
    status: "approved" | "pending" | "rejected"
  ) {
    return strapi.documents("plugin::topics.topic").update({
      documentId,
      data: { status },
    })
  },
})
