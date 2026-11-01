/** New networks are public; later updates preserve an editor's visibility choice. */
export default {
  beforeCreate(event: { params: { data: Record<string, unknown> } }) {
    if (event.params.data.publicPageEnabled === undefined)
      event.params.data.publicPageEnabled = true
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
