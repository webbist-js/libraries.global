import { isPaidMembership } from "@repo/access"
import { emailTemplate } from "@repo/shared-data"

import { billingNotice } from "../../../utils/billing-notice"
import { isValidServiceSecret } from "../../../utils/service-secret"

const UID = "api::paid-membership.paid-membership"

export default {
  async sync(ctx: any) {
    if (!isValidServiceSecret(ctx.request.header["x-service-secret"]))
      return ctx.unauthorized()
    const { baUserId, subscriptionId, revision, membership } =
      ctx.request.body ?? {}
    if (
      typeof baUserId !== "string" ||
      !baUserId ||
      baUserId.length > 200 ||
      typeof subscriptionId !== "string" ||
      !/^sub_[\da-z]+$/i.test(subscriptionId) ||
      !Number.isSafeInteger(revision) ||
      revision < 1 ||
      !isPaidMembership(membership)
    )
      return ctx.badRequest("Invalid membership projection")
    if (
      membership.mode !==
      (process.env.BILLING_ENV === "live" ? "live" : "sandbox")
    )
      return ctx.badRequest("Billing environment mismatch")
    await strapi.db.transaction(async ({ trx }: any) => {
      // Serialize retries and out-of-order deliveries even across backend instances.
      if (strapi.db.connection.client.config.client === "pg")
        await trx.raw("select pg_advisory_xact_lock(hashtextextended(?, 0))", [
          `billing:${subscriptionId}`,
        ])
      const profile = await strapi.db
        .query("api::user-profile.user-profile")
        .findOne({ where: { baUserId } })
      if (!profile || String(profile.username ?? "").startsWith("deleted-")) {
        ctx.status = 410

        return
      }
      const existing = await strapi.db
        .query(UID)
        .findOne({ where: { subscriptionId } })
      if (existing && existing.baUserId !== baUserId) {
        ctx.status = 409

        return
      }
      if (existing && existing.revision >= revision) {
        ctx.body = { ok: true }

        return
      }
      const previous = isPaidMembership(existing?.membership)
        ? existing.membership
        : null
      const data = { baUserId, subscriptionId, revision, membership }
      await (existing
        ? strapi.db.query(UID).update({ where: { id: existing.id }, data })
        : strapi.db.query(UID).create({ data }))
      const notice = billingNotice(membership, previous)
      if (notice) {
        const { title, body } = notice
        const base = process.env.APP_PUBLIC_URL ?? "https://libraries.global"
        await strapi.service("api::notification.notification").enqueue({
          baUserId,
          kind: "billing_update",
          eventKey: `billing:${subscriptionId}:${revision}`,
          title,
          body,
          href: "/profile/settings#membership",
          emailPreference: notice.sendEmail ? "transactional" : undefined,
          emailPayload: emailTemplate({
            title,
            body,
            url: `${base}/profile/settings#membership`,
            action: "Manage membership",
            siteUrl: base,
          }),
        })
      }
      ctx.body = { ok: true }
    })
  },
}
