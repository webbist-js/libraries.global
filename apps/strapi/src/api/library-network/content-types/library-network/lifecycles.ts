/** A public page is an explicit editorial choice; imports omit this flag. */
export default {
  beforeCreate(event: { params: { data: Record<string, unknown> } }) {
    reviewPublicPage(event.params.data)
  },
  beforeUpdate(event: { params: { data: Record<string, unknown> } }) {
    reviewPublicPage(event.params.data)
  },
}
function reviewPublicPage(data: Record<string, unknown>) {
  if (data.publicPageEnabled === true)
    data.publicPageReviewedAt = new Date().toISOString()
  if (data.publicPageEnabled === false) data.publicPageReviewedAt = null
}
