import cronTasks from "./cron-tasks"

export default ({ env }) => ({
  host: env("HOST", "0.0.0.0"),
  port: env.int("PORT", 1337),
  url: env("APP_URL"),
  app: {
    keys: env.array("APP_KEYS"),
  },
  webhooks: {
    populateRelations: env.bool("WEBHOOKS_POPULATE_RELATIONS", false),
  },
  // Trust X-Forwarded-* from the reverse proxy in front of Strapi so
  // `ctx.ip` (rate limits, logs) is the client, not the proxy. Only set
  // TRUST_PROXY=true behind a proxy that strips inbound X-Forwarded-For;
  // with a direct exposure a client could spoof its address. Strapi reads
  // `proxy.koa`, not a bare boolean.
  proxy: {
    koa: env.bool("TRUST_PROXY", false),
  },
  // Built-in MCP server (POST /mcp). Authenticates with admin tokens only;
  // every tool call runs with the token owner's admin RBAC permissions.
  mcp: {
    enabled: env.bool("MCP_ENABLED", false),
  },
  cron: {
    enabled: env.bool("CRON_ENABLED", false),
    tasks: cronTasks,
  },
})
