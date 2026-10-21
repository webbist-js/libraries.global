// Bridge secret + X-Ba-User-Id on every route (controllers/team-api). The
// teams service re-reads the caller's membership (organiser for writes).
const route = (method: string, path: string, action: string) => ({
  method,
  path,
  handler: `team-api.${action}`,
  config: { auth: false, policies: [] },
})

export default [
  ...["create", "context", "sync", "deletionCheck", "discard"].map(
    (action) => ({
      method: "POST",
      path: `/billing/${action}`,
      handler: `team-billing.${action}`,
      config: { auth: false },
    })
  ),
  {
    method: "GET",
    path: "/api/teams/:id/status",
    handler: "api-data.status",
    config: { auth: false },
  },
  {
    method: "GET",
    path: "/api/libraries",
    handler: "api-data.libraries",
    config: { auth: false },
  },
  {
    method: "GET",
    path: "/api/libraries/:entityRef",
    handler: "api-data.libraries",
    config: { auth: false },
  },
  route("GET", "/teams/mine", "mine"),
  route("GET", "/team-libraries", "libraries"),
  route("GET", "/teams/join/:token", "preview"),
  route("POST", "/teams/join/:token/accept", "accept"),
  route("GET", "/teams/:id", "detail"),
  route("PUT", "/teams/:id", "configure"),
  route("POST", "/teams/:id/invites", "invite"),
  route("POST", "/teams/:id/invites/:memberId/resend", "resendInvite"),
  route("DELETE", "/teams/:id/invites/:memberId", "revokeInvite"),
  route("PUT", "/teams/:id/members/:memberId", "member"),
  route("DELETE", "/teams/:id/members/:memberId", "remove"),
]
