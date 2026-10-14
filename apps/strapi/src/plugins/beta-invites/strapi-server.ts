import controller from "./server/controller"
import invites from "./server/service"

import schema from "./server/content-types/invitation/schema.json"

const policies = [
  "admin::isAuthenticatedAdmin",
  {
    name: "admin::hasPermissions",
    config: { actions: ["plugin::beta-invites.manage"] },
  },
]
const adminRoute = (method: string, path: string, handler: string) => ({
  method,
  path,
  handler: `invites.${handler}`,
  config: { policies },
})

export default {
  register() {},
  async bootstrap({ strapi }: { strapi: any }) {
    // Strapi's schema diff respects this core list even when an older image
    // does not register our content type. Keep issued invitations on rollback.
    const store = strapi.store({ type: "core", key: "persisted_tables" })
    const persisted = (await store.get()) ?? []
    if (
      !persisted.some(
        (table: string | { name: string }) =>
          (typeof table === "string" ? table : table.name) ===
          "beta_invitations"
      )
    )
      await store.set({ value: [...persisted, "beta_invitations"] })
    await strapi.service("admin::permission").actionProvider.registerMany([
      {
        section: "plugins",
        displayName: "Manage beta invitations",
        uid: "manage",
        pluginName: "beta-invites",
      },
    ])
    if (["pg", "postgres", "postgresql"].includes(strapi.db.dialect.client)) {
      await strapi.db.connection.raw(
        "CREATE INDEX IF NOT EXISTS beta_invitations_subscriber_idx ON beta_invitations (subscriber_document_id, id DESC)"
      )
    }
    strapi.cron.add({
      betaInvitationPrune: {
        task: () => strapi.plugin("beta-invites").service("invites").prune(),
        options: { rule: "45 3 * * *" },
      },
    })
  },
  config: { default: {}, validator() {} },
  contentTypes: { invitation: { schema } },
  controllers: { invites: controller },
  services: { invites },
  routes: {
    admin: {
      type: "admin",
      routes: [
        adminRoute("GET", "/subscribers", "list"),
        adminRoute("GET", "/preview", "preview"),
        adminRoute("GET", "/subscribers/:id/history", "history"),
        adminRoute("POST", "/subscribers/:id/send", "send"),
        adminRoute("POST", "/subscribers/:id/resend", "resend"),
        adminRoute("POST", "/subscribers/:id/revoke", "revoke"),
        adminRoute("POST", "/subscribers/:id/retry", "retry"),
      ],
    },
    "content-api": {
      type: "content-api",
      routes: [
        {
          method: "POST",
          path: "/redeem",
          handler: "invites.redeem",
          config: { auth: false },
        },
        {
          method: "POST",
          path: "/validate",
          handler: "invites.validate",
          config: { auth: false },
        },
      ],
    },
  },
  middlewares: {},
  policies: {},
}
