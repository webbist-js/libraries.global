export default {
  routes: [
    {
      method: "GET",
      path: "/topics/approved",
      handler: "topic.findApproved",
      config: { auth: false, policies: [] },
    },
    {
      method: "GET",
      path: "/topics",
      handler: "topic.findAll",
      config: { auth: { scope: [] }, policies: [] },
    },
    {
      method: "PATCH",
      path: "/topics/:id/status",
      handler: "topic.updateStatus",
      config: { auth: { scope: [] }, policies: [] },
    },
  ],
}
