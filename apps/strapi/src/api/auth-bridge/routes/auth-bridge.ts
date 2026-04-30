export default {
  routes: [
    {
      method: "POST",
      path: "/auth-bridge/sync-user",
      handler: "auth-bridge.syncUser",
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: "POST",
      path: "/auth-bridge/upsert-profile",
      handler: "auth-bridge.upsertProfile",
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: "POST",
      path: "/auth-bridge/delete-profile",
      handler: "auth-bridge.deleteProfile",
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: "GET",
      path: "/auth-bridge/follow-status",
      handler: "auth-bridge.followStatus",
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: "POST",
      path: "/auth-bridge/create-affiliation",
      handler: "auth-bridge.createAffiliation",
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: "GET",
      path: "/auth-bridge/affiliation-count",
      handler: "auth-bridge.affiliationCount",
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: "GET",
      path: "/auth-bridge/claim-status",
      handler: "auth-bridge.claimStatus",
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: "POST",
      path: "/auth-bridge/toggle-follow",
      handler: "auth-bridge.toggleFollow",
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: "GET",
      path: "/auth-bridge/user-affiliations",
      handler: "auth-bridge.getUserAffiliations",
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
}
