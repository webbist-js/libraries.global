import config from "./config"
import contentTypes from "./content-types"
import discussion from "./controllers"
import routes from "./routes"
import discussionService from "./service"
import { attachmentAdmission } from "./upload-admission"

const workers = new WeakMap<
  object,
  {
    timer: ReturnType<typeof setInterval>
    running: boolean
    stopped: boolean
    promise?: Promise<void>
  }
>()

const permissions = [
  { uid: "sanction", displayName: "Apply discussion member sanctions" },
  { uid: "read", displayName: "Read discussion moderation queue" },
  { uid: "review", displayName: "Review discussions and reports" },
  { uid: "manage", displayName: "Manage discussion subjects" },
]

export default {
  register({ strapi }: { strapi: any }) {
    // Plugin register precedes configured application middleware in supported Strapi 5.
    strapi.server.use(attachmentAdmission(strapi))
  },
  async bootstrap({ strapi }: { strapi: any }) {
    await strapi.service("admin::permission").actionProvider.registerMany(
      permissions.map((permission) => ({
        ...permission,
        section: "plugins",
        pluginName: "discussions",
      }))
    )
    const worker: {
      timer: ReturnType<typeof setInterval>
      running: boolean
      stopped: boolean
      promise?: Promise<void>
    } = {
      timer: null as unknown as ReturnType<typeof setInterval>,
      running: false,
      stopped: false,
    }
    const drain = async () => {
      if (worker.running || worker.stopped) return
      worker.running = true
      worker.promise = (async () => {
        const service = strapi.plugin("discussions").service("discussion")
        for (const action of ["flushNotifications", "cleanupImages"]) {
          try {
            await service[action]()
          } catch {
            strapi.log.warn("[discussions] Durable background work deferred")
          }
        }
      })()
      try {
        await worker.promise
      } finally {
        worker.running = false
        worker.promise = undefined
      }
    }
    worker.timer = setInterval(() => {
      void drain()
    }, 60_000)
    worker.timer.unref?.()
    workers.set(strapi, worker)
    void drain()
  },
  async destroy({ strapi }: { strapi: any }) {
    const worker = workers.get(strapi)
    if (worker) {
      worker.stopped = true
      clearInterval(worker.timer)
      await worker.promise
      workers.delete(strapi)
    }
  },
  config,
  contentTypes,
  routes,
  controllers: { discussion },
  services: { discussion: discussionService },
  policies: {},
  middlewares: {},
}
