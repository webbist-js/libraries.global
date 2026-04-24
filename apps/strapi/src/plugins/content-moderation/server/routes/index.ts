export default [
  {
    method: "POST",
    path: "/submissions",
    handler: "submission.create",
    config: {
      auth: { scope: [] },
      policies: [],
    },
  },
  {
    method: "GET",
    path: "/submissions/my",
    handler: "submission.findMine",
    config: {
      auth: { scope: [] },
      policies: [],
    },
  },
  {
    method: "PATCH",
    path: "/submissions/:id/status",
    handler: "submission.updateStatus",
    config: {
      auth: { scope: [] },
      policies: [],
    },
  },
]
