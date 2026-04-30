export default [
  {
    method: "GET",
    path: "/submissions",
    handler: "submission.findAll",
    config: {
      policies: ["admin::isAuthenticatedAdmin"],
    },
  },
  {
    method: "PUT",
    path: "/submissions/:id/status",
    handler: "submission.updateStatus",
    config: {
      policies: ["admin::isAuthenticatedAdmin"],
    },
  },
  {
    method: "GET",
    path: "/relation-labels",
    handler: "submission.relationLabels",
    config: {
      policies: ["admin::isAuthenticatedAdmin"],
    },
  },
]
