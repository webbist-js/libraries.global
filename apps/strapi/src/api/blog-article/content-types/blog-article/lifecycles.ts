/** Set publishedAt on first publication. */
export default {
  beforeUpdate(event: {
    params: { data: Record<string, unknown>; status?: string }
  }) {
    const { data, status } = event.params
    // On publish action, set custom publishedAt if not already set
    if (status === "published" && data.publishedAt === undefined) {
      data.publishedAt = new Date().toISOString()
    }
  },
  beforeCreate(event: { params: { data: Record<string, unknown> } }) {
    // Don't auto-set on create; let it remain null until first publish
  },
}
