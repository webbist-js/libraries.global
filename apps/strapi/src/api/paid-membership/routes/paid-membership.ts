/** No public CRUD. Only the service-secret-gated projection bridge exists. */
export default {
  routes: [
    {
      method: "POST",
      path: "/billing/sync-membership",
      handler: "paid-membership.sync",
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
}
