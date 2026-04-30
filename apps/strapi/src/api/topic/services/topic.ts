import { factories } from "@strapi/strapi"

export default factories.createCoreService("api::topic.topic" as any, () => ({
  async findApproved() {
    return strapi.documents("api::topic.topic" as any).findMany({
      filters: { status: "approved" } as any,
      sort: { name: "asc" } as any,
      limit: 500,
    })
  },

  async findAll() {
    return strapi.documents("api::topic.topic" as any).findMany({
      sort: [{ status: "asc" }, { name: "asc" }] as any,
      limit: 500,
    })
  },

  async create(data: {
    name: string
    status?: "approved" | "pending" | "rejected"
    suggestedByUserId?: string
    suggestedByEmail?: string
  }) {
    return strapi.documents("api::topic.topic" as any).create({ data } as any)
  },

  async updateStatus(
    documentId: string,
    status: "approved" | "pending" | "rejected"
  ) {
    return strapi.documents("api::topic.topic" as any).update({
      documentId,
      data: { status } as any,
    })
  },
}))
