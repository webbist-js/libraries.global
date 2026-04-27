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
  ],
}
