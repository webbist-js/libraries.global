export default [
  {
    method: "GET",
    path: "/approved",
    handler: "topic.findApproved",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/",
    handler: "topic.findAll",
    config: { auth: { scope: [] }, policies: [] },
  },
  {
    method: "PATCH",
    path: "/:id/status",
    handler: "topic.updateStatus",
    config: { auth: { scope: [] }, policies: [] },
  },
]
