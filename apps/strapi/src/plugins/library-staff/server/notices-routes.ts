const route = (method: string, path: string, action: string) => ({
  method,
  path,
  handler: `notices.${action}`,
  config: { auth: false, policies: [] },
})

export default [
  route("GET", "/libraries/:documentId/notices", "list"),
  route("POST", "/libraries/:documentId/notices", "create"),
  route("PATCH", "/libraries/:documentId/notices/:noticeId", "edit"),
  route("POST", "/libraries/:documentId/notices/:noticeId/end", "end"),
  route(
    "POST",
    "/libraries/:documentId/notices/:noticeId/reactivate",
    "reactivate"
  ),
]
