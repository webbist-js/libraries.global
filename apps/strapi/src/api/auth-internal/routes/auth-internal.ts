export default {
  routes: [
    {
      method: "GET",
      path: "/auth-internal/providers",
      handler: "auth-internal.providers",
      config: { auth: false, policies: ["global::service-auth"] },
    },
    {
      method: "POST",
      path: "/auth-internal/verify-password",
      handler: "auth-internal.verifyPassword",
      config: { auth: false, policies: ["global::service-auth"] },
    },
    {
      method: "POST",
      path: "/auth-internal/verified-identities",
      handler: "auth-internal.verifiedIdentities",
      config: { auth: false, policies: ["global::service-auth"] },
    },
    {
      method: "POST",
      path: "/auth-internal/retention",
      handler: "auth-internal.retention",
      config: { auth: false, policies: ["global::service-auth"] },
    },
  ],
}
