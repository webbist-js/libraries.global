export default [
  {
    method: "GET",
    path: "/submissions/stats",
    handler: "submission.stats",
    config: { auth: false, policies: [] },
  },
  {
    method: "POST",
    path: "/submissions",
    handler: "submission.create",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/submissions/by-document-id/:documentId",
    handler: "submission.findByDocumentId",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/submissions/by-username/:username",
    handler: "submission.findByUsername",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/submissions/my",
    handler: "submission.findMine",
    config: { auth: false, policies: [] },
  },
  {
    method: "PATCH",
    path: "/submissions/:id/draft",
    handler: "submission.saveDraft",
    config: { auth: false, policies: [] },
  },
  {
    method: "PATCH",
    path: "/submissions/:id/finalize",
    handler: "submission.finalize",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/submissions/draft/:type",
    handler: "submission.findDraft",
    config: { auth: false, policies: [] },
  },
]
