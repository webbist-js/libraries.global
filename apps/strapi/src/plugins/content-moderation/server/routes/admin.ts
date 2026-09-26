const can = (action: "read" | "update") => [
  "admin::isAuthenticatedAdmin",
  {
    name: "admin::hasPermissions",
    config: { actions: [`plugin::content-moderation.${action}`] },
  },
]

export default [
  {
    method: "GET",
    path: "/submissions",
    handler: "submission.findAll",
    config: { policies: can("read") },
  },
  {
    method: "PUT",
    path: "/submissions/:id/status",
    handler: "submission.updateStatus",
    config: { policies: can("update") },
  },
  {
    method: "GET",
    path: "/relation-labels",
    handler: "submission.relationLabels",
    config: { policies: can("read") },
  },
]
