const publicRoute = (method: string, path: string, action: string) => ({
  method,
  path,
  handler: `discussion.${action}`,
  config: { auth: false, policies: [] },
})
const adminRoute = (
  method: string,
  path: string,
  action: string,
  permission: string
) => ({
  method,
  path,
  handler: `discussion.${action}`,
  config: {
    policies: [
      "admin::isAuthenticatedAdmin",
      {
        name: "admin::hasPermissions",
        config: { actions: [`plugin::discussions.${permission}`] },
      },
    ],
  },
})

export default {
  "content-api": {
    type: "content-api",
    routes: [
      publicRoute("GET", "/my/records", "myRecords"),
      publicRoute("GET", "/my/status", "myStatus"),
      publicRoute("POST", "/attachments", "uploadImage"),
      publicRoute("GET", "/attachments/:id", "image"),
      publicRoute("PUT", "/my/sanctions/:id/appeal", "appealSanction"),
      publicRoute("PUT", "/records/:kind/:id/reaction", "react"),
      publicRoute("GET", "/moderation/sanctions", "sanctions"),
      publicRoute("PUT", "/moderation/sanctions/:id", "liftSanction"),
      publicRoute(
        "POST",
        "/moderation/records/:kind/:id/sanctions",
        "sanctionRecord"
      ),
      publicRoute("GET", "/subjects", "subjects"),
      publicRoute("GET", "/context", "contextMetadata"),
      publicRoute("PUT", "/context", "configureContext"),
      publicRoute("GET", "/contexts", "contexts"),
      publicRoute("POST", "/context-links", "addContextLink"),
      publicRoute("PUT", "/context-links/:id", "actContextLink"),
      publicRoute("GET", "/threads", "threads"),
      publicRoute("POST", "/threads", "createThread"),
      publicRoute("GET", "/threads/:id", "thread"),
      publicRoute("GET", "/threads/:id/replies", "replies"),
      publicRoute("POST", "/threads/:id/replies", "createReply"),
      publicRoute("PUT", "/threads/:id/subscription", "subscribe"),
      publicRoute("POST", "/records/:kind/:id/revisions", "edit"),
      publicRoute("GET", "/records/:kind/:id/revisions", "revisions"),
      publicRoute("POST", "/records/:kind/:id/reports", "report"),
      publicRoute("GET", "/moderation/revisions", "queue"),
      publicRoute("PUT", "/moderation/revisions/:id", "review"),
      publicRoute("PUT", "/moderation/records/:kind/:id", "moderate"),
      publicRoute("GET", "/moderation/reports", "reports"),
      publicRoute("PUT", "/moderation/reports/:id", "decideReport"),
      publicRoute("GET", "/moderation/threads/:id/audit", "audit"),
    ],
  },
  admin: {
    type: "admin",
    routes: [
      adminRoute("GET", "/threads", "adminThreads", "read"),
      adminRoute("GET", "/context", "adminContextMetadata", "read"),
      adminRoute("GET", "/contexts", "adminContexts", "read"),
      adminRoute("PUT", "/context", "adminConfigureContext", "manage"),
      adminRoute("POST", "/context-links", "adminAddContextLink", "manage"),
      adminRoute("PUT", "/context-links/:id", "adminActContextLink", "manage"),
      adminRoute("GET", "/attachments/:id", "adminImage", "read"),
      adminRoute("GET", "/sanctions", "adminSanctions", "read"),
      adminRoute("PUT", "/sanctions/:id", "adminLiftSanction", "sanction"),
      adminRoute(
        "POST",
        "/records/:kind/:id/sanctions",
        "adminSanctionRecord",
        "sanction"
      ),
      adminRoute("GET", "/subjects", "adminSubjects", "read"),
      adminRoute("POST", "/subjects", "adminSaveSubject", "manage"),
      adminRoute("PUT", "/subjects/:id", "adminSaveSubject", "manage"),
      adminRoute("GET", "/revisions", "adminQueue", "read"),
      adminRoute("PUT", "/revisions/:id", "adminReview", "review"),
      adminRoute("PUT", "/records/:kind/:id", "adminModerate", "review"),
      adminRoute("GET", "/reports", "adminReports", "read"),
      adminRoute("PUT", "/reports/:id", "adminDecideReport", "review"),
      adminRoute("GET", "/threads/:id/audit", "adminAudit", "read"),
    ],
  },
}
