const can = (action: "manage-roles" | "manage-teams" | "manage-plans") => [
  "admin::isAuthenticatedAdmin",
  {
    name: "admin::hasPermissions",
    config: { actions: [`plugin::access.${action}`] },
  },
]

const route = (
  method: string,
  path: string,
  handler: string,
  action: "manage-roles" | "manage-teams" | "manage-plans"
) => ({ method, path, handler, config: { policies: can(action) } })

export default [
  // People: contributors' Role Grants (moved from content-moderation).
  route("GET", "/people", "people.search", "manage-roles"),
  route("GET", "/people/:baUserId", "people.findOne", "manage-roles"),
  route(
    "POST",
    "/people/:baUserId/grants",
    "people.createGrant",
    "manage-roles"
  ),
  route(
    "POST",
    "/grants/:documentId/revoke",
    "people.revokeGrant",
    "manage-roles"
  ),

  // Teams.
  route("GET", "/teams", "teams.list", "manage-teams"),
  route("POST", "/teams", "teams.create", "manage-teams"),
  route("GET", "/libraries", "teams.searchLibraries", "manage-teams"),
  route("GET", "/teams/:id", "teams.findOne", "manage-teams"),
  route("PUT", "/teams/:id", "teams.update", "manage-teams"),
  route("POST", "/teams/:id/verify", "teams.verify", "manage-teams"),
  route("POST", "/teams/:id/members", "teams.invite", "manage-teams"),
  route("PUT", "/teams/:id/members/:memberId", "teams.member", "manage-teams"),
  route(
    "POST",
    "/teams/:id/members/:memberId/resend",
    "teams.resend",
    "manage-teams"
  ),
  route(
    "DELETE",
    "/teams/:id/members/:memberId",
    "teams.remove",
    "manage-teams"
  ),
  route("POST", "/teams/:id/assign", "teams.assign", "manage-teams"),
  route("POST", "/teams/:id/unassign", "teams.unassign", "manage-teams"),

  // Plans: complimentary plans and Pro verifications.
  route("GET", "/plans/grants", "plans.listGrants", "manage-plans"),
  route("POST", "/plans/grants", "plans.createGrant", "manage-plans"),
  route(
    "POST",
    "/plans/grants/:documentId/revoke",
    "plans.revokeGrant",
    "manage-plans"
  ),
  route(
    "GET",
    "/plans/verifications",
    "plans.listVerifications",
    "manage-plans"
  ),
  route(
    "POST",
    "/plans/verifications",
    "plans.createVerification",
    "manage-plans"
  ),
  route(
    "POST",
    "/plans/verifications/:documentId/revoke",
    "plans.revokeVerification",
    "manage-plans"
  ),
]
