// Working custom-adapter example using a verified U&P account as an external identity.
// Replace load() with your own verified session bridge; never trust unsigned headers.
async function load(strapi: any, key: string) {
  const user = await strapi.db.query("plugin::users-permissions.user").findOne({
    where: { id: Number(key.replace("custom:", "")) },
    populate: ["role"],
  })
  if (!user || user.blocked || !user.confirmed) return null

  return {
    key: `custom:${user.id}`,
    name: user.username,
    capabilities: [
      "read",
      "createThread",
      "reply",
      "editOwn",
      "report",
      "subscribe",
    ],
  }
}

export default () => ({
  discussions: {
    enabled: true,
    config: {
      identity: async (ctx: any, { strapi }: { strapi: any }) => {
        if (!ctx.request.header.authorization) return null
        const payload = await strapi
          .plugin("users-permissions")
          .service("jwt")
          .getToken(ctx)

        return payload?.id ? load(strapi, `custom:${payload.id}`) : null
      },
      notificationActor: (key: string, { strapi }: { strapi: any }) =>
        load(strapi, key),
      targets: {}, // This host uses independent subject threads.
      authorize: async ({ actor, action }: any) =>
        action === "read" || Boolean(actor),
      onEvent: async (event: any) => {
        /* Invalidate host caches; deduplicate event.id. */
      },
      notify: async ({ idempotencyKey, actorKey, event }: any) => {
        /* Deliver through your host transport; deduplicate idempotencyKey. */
      },
    },
  },
})
