export type EventsAdminAction =
  | "read"
  | "manage-credentials"
  | "review"
  | "reveal-credentials"

const can = (action: EventsAdminAction) => [
  "admin::isAuthenticatedAdmin",
  {
    name: "admin::hasPermissions",
    config: { actions: [`plugin::events.${action}`] },
  },
]

export default [
  {
    method: "GET",
    path: "/admin/credentials",
    handler: "admin.listCredentials",
    config: { policies: can("read") },
  },
  {
    method: "POST",
    path: "/admin/credentials",
    handler: "admin.createCredential",
    config: { policies: can("manage-credentials") },
  },
  {
    method: "PUT",
    path: "/admin/credentials/:documentId",
    handler: "admin.updateCredential",
    config: { policies: can("manage-credentials") },
  },
  {
    method: "DELETE",
    path: "/admin/credentials/:documentId",
    handler: "admin.deleteCredential",
    config: { policies: can("manage-credentials") },
  },
  {
    method: "POST",
    path: "/admin/credentials/:documentId/test",
    handler: "admin.testCredential",
    config: { policies: can("manage-credentials") },
  },
  {
    method: "POST",
    path: "/admin/credentials/:documentId/reveal",
    handler: "admin.revealCredential",
    config: { policies: can("reveal-credentials") },
  },
  {
    method: "GET",
    path: "/admin/runs",
    handler: "admin.listRuns",
    config: { policies: can("read") },
  },
  {
    method: "GET",
    path: "/admin/runs/:runId",
    handler: "admin.getRun",
    config: { policies: can("read") },
  },
  {
    method: "POST",
    path: "/admin/sync",
    handler: "admin.triggerSync",
    config: { policies: can("manage-credentials") },
  },
  {
    method: "GET",
    path: "/admin/worker-health",
    handler: "admin.workerHealth",
    config: { policies: can("read") },
  },
  {
    method: "GET",
    path: "/admin/pending-review",
    handler: "admin.listPendingReview",
    config: { policies: can("read") },
  },
  {
    method: "PATCH",
    path: "/admin/pending-review/:documentId",
    handler: "admin.reviewEvent",
    config: { policies: can("review") },
  },
]
