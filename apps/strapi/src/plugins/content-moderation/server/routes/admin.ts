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
  {
    method: "GET",
    path: "/option-suggestions",
    handler: "option-suggestion.adminList",
    config: { policies: can("read") },
  },
  {
    method: "PUT",
    path: "/option-suggestions/:id",
    handler: "option-suggestion.decide",
    config: { policies: can("update") },
  },
]
