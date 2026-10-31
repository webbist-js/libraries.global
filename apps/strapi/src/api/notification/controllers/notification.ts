import {
  runCmsMaintenance,
  cmsMaintenanceStatus,
} from "../../../utils/cms-maintenance"
import { internalNotifications } from "../../../utils/internal-notifications/service"
import { runNetworkFulfilmentJob } from "../../../utils/network-fulfilment-job"
import {
  bridgeBaUserId,
  isValidServiceSecret,
} from "../../../utils/service-secret"
import {
  communityWeek,
  personalWeek,
  reportBody,
  weeklyWindow,
} from "../../../utils/weekly-community-report"

const UID = "api::notification.notification"

const operationHandlers = new Map<string, () => Promise<unknown>>([
  ["maintenance", () => runCmsMaintenance(strapi)],
  ["maintenanceStatus", () => cmsMaintenanceStatus(strapi)],
  ["internalRun", () => internalNotifications(strapi).run()],
  ["internalStatus", () => internalNotifications(strapi).status()],
  ["internalRetry", () => internalNotifications(strapi).retry()],
])

export default {
  /** Operator-only diagnostics and manual cron runs. Never forwarded by the UI. */
  async operations(ctx: any) {
    if (!isValidServiceSecret(ctx.request.headers?.["x-service-secret"]))
      return ctx.unauthorized()
    ctx.set("Cache-Control", "private, no-store")
    const { action, baUserId } = ctx.request.body ?? {}
    const operation = operationHandlers.get(String(action))
    if (operation) return ctx.send(await operation())
    if (action === "networkFulfilment")
      return ctx.send(await runNetworkFulfilmentJob(strapi))
    const service = strapi.service(UID)
    if (action === "betaInvites") {
      await strapi.plugin("beta-invites").service("invites").prune()

      return ctx.send(await service.deliver(new Date(), "beta_invitation"))
    }
    if (action === "status") {
      const counts: Record<string, number> = {}
      for (const state of ["pending", "sent", "skipped", "failed"])
        counts[state] = await strapi.db
          .query(UID)
          .count({ where: { emailState: state } })

      return ctx.send({
        counts,
        digestEnabled: process.env.EMAIL_DIGEST_ENABLED === "true",
        reportEnabled: process.env.EMAIL_REPORT_ENABLED === "true",
      })
    }
    if (action === "previewReport") {
      if (typeof baUserId !== "string" || baUserId.length > 200)
        return ctx.badRequest("Specify a user")
      const profile = await strapi.db
        .query("api::user-profile.user-profile")
        .findOne({ where: { baUserId } })
      if (!profile) return ctx.notFound()
      const { start, end } = weeklyWindow(new Date())
      const week = await communityWeek(strapi, start, end)
      const personal = await personalWeek(strapi, baUserId, start, end)

      return ctx.send({
        body: reportBody(
          week,
          personal,
          start,
          end,
          (process.env.APP_PUBLIC_URL || "https://libraries.global").replace(
            /\/$/,
            ""
          )
        ),
        start,
        end,
      })
    }
    const actions: Record<string, string> = {
      digest: "weeklyDigest",
      report: "weeklyReport",
      follows: "followedLibraryUpdates",
      announcements: "announcements",
      deliver: "deliver",
    }
    if (typeof action !== "string" || !Object.hasOwn(actions, action))
      return ctx.badRequest("Unknown operation")

    return ctx.send(await service[actions[action]]())
  },
  async inbox(ctx: any) {
    const baUserId = bridgeBaUserId(ctx)
    if (!baUserId) return ctx.unauthorized()
    ctx.set("Cache-Control", "private, no-store")
    const where = { baUserId, inApp: true }
    const [rows, unread] = await Promise.all([
      strapi.db
        .query(UID)
        .findMany({ where, orderBy: { id: "desc" }, limit: 50 }),
      strapi.db.query(UID).count({ where: { ...where, readAt: null } }),
    ])
    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId }, select: ["notifPrefs"] })

    return ctx.send({
      data: rows.map(
        ({ documentId, title, body, href, readAt, createdAt, kind }: any) => ({
          documentId,
          title,
          body,
          href,
          readAt,
          createdAt,
          kind,
        })
      ),
      unread,
      soundOn: profile?.notifPrefs?.soundOn === true,
    })
  },
  async read(ctx: any) {
    const baUserId = bridgeBaUserId(ctx)
    if (!baUserId) return ctx.unauthorized()
    const id = ctx.request.body?.documentId
    if (id !== "all" && (typeof id !== "string" || id.length > 100))
      return ctx.badRequest("Invalid notification")
    await strapi.db.query(UID).updateMany({
      where: {
        baUserId,
        inApp: true,
        readAt: null,
        ...(id === "all" ? {} : { documentId: id }),
      },
      data: { readAt: new Date().toISOString() },
    })

    return ctx.send({ ok: true })
  },
}
