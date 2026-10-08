const route = (method: string, path: string, action: string) => ({
  method,
  path: `/staff${path}`,
  handler: `staff.${action}`,
  config: { auth: false, policies: [] },
})

export default [
  route("POST", "/libraries/:documentId/publish", "publish"),
  route("POST", "/libraries/:documentId/verify", "verify"),
  route("GET", "/libraries/:documentId/suggestions", "suggestions"),
  route("POST", "/submissions/:documentId/decision", "decision"),
]
