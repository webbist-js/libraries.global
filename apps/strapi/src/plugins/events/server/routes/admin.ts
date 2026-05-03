const ADMIN_AUTH = { policies: ["admin::isAuthenticatedAdmin"] }

export default [
  {
    method: "GET",
    path: "/admin/credentials",
    handler: "admin.listCredentials",
    config: ADMIN_AUTH,
  },
  {
    method: "POST",
    path: "/admin/credentials",
    handler: "admin.createCredential",
    config: ADMIN_AUTH,
  },
  {
    method: "PUT",
    path: "/admin/credentials/:documentId",
    handler: "admin.updateCredential",
    config: ADMIN_AUTH,
  },
  {
    method: "DELETE",
    path: "/admin/credentials/:documentId",
    handler: "admin.deleteCredential",
    config: ADMIN_AUTH,
  },
  {
    method: "POST",
    path: "/admin/credentials/:documentId/test",
    handler: "admin.testCredential",
    config: ADMIN_AUTH,
  },
  {
    method: "POST",
    path: "/admin/credentials/test-raw",
    handler: "admin.testRaw",
    config: ADMIN_AUTH,
  },
  {
    method: "GET",
    path: "/admin/runs",
    handler: "admin.listRuns",
    config: ADMIN_AUTH,
  },
  {
    method: "GET",
    path: "/admin/runs/:runId",
    handler: "admin.getRun",
    config: ADMIN_AUTH,
  },
  {
    method: "POST",
    path: "/admin/sync",
    handler: "admin.triggerSync",
    config: ADMIN_AUTH,
  },
  {
    method: "GET",
    path: "/admin/worker-health",
    handler: "admin.workerHealth",
    config: ADMIN_AUTH,
  },
  {
    method: "GET",
    path: "/admin/pending-review",
    handler: "admin.listPendingReview",
    config: ADMIN_AUTH,
  },
  {
    method: "PATCH",
    path: "/admin/pending-review/:documentId",
    handler: "admin.reviewEvent",
    config: ADMIN_AUTH,
  },
]
