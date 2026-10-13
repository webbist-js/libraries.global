import cronTasks from "../../cron-tasks"

export default ({ env }) => ({
  proxy: {
    koa: env.bool("TRUST_PROXY", false),
  },
  url: env("APP_URL"), // Sets the public URL of the application.
  app: {
    keys: env.array("APP_KEYS"),
  },
  webhooks: {
    populateRelations: env.bool("WEBHOOKS_POPULATE_RELATIONS", false),
  },
  cron: {
    enabled: env.bool("CRON_ENABLED", false),
    tasks: cronTasks,
  },
})
