import { emailTemplate } from "@repo/shared-data"

import {
  emailActionUrl,
  emailLinkToken,
  readEmailLink,
} from "../../../utils/email-links"

const UID = "api::subscriber.subscriber"

export default ({ strapi }: { strapi: any }) => ({
  async confirmRequest(subscriber: any) {
    if (subscriber.state !== "pending_confirmation") return
    // Repeated requests do not flood a mailbox or reset an active confirmation token.
    if (
      subscriber.confirmationSentAt &&
      Date.now() - new Date(subscriber.confirmationSentAt).getTime() <
        24 * 3600000
    )
      return
    const token = emailLinkToken({
      id: subscriber.documentId,
      purpose: "newsletter_confirm",
      version: subscriber.consentedAt,
      exp: Date.now() + 7 * 86400000,
    })
    const unsubscribe = emailActionUrl(
      emailLinkToken({
        id: subscriber.documentId,
        purpose: "newsletter_unsubscribe",
      })
    )
    await strapi.service("api::notification.notification").enqueue({
      kind: "newsletter_confirmation",
      eventKey: `newsletter-confirm:${subscriber.documentId}:${new Date().toISOString().slice(0, 10)}`,
      title: "Confirm your newsletter subscription",
      body: "Confirm that you want to receive Libraries Global news and Journal articles, at most monthly.",
      inApp: false,
      emailPreference: "transactional",
      recipientEmail: subscriber.email,
      emailPayload: {
        ...emailTemplate({
          postalAddress: process.env.EMAIL_POSTAL_ADDRESS,
          siteUrl: process.env.APP_PUBLIC_URL,
          title: "Confirm your newsletter subscription",
          body: "Confirm that you want to receive Libraries Global news and Journal articles, at most monthly. The link expires in seven days. If you did not request this, you can ignore this email.",
          url: emailActionUrl(token),
          action: "Confirm subscription",
          unsubscribeUrl: unsubscribe,
        }),
        subscriberId: subscriber.documentId,
        consentVersion: subscriber.consentedAt,
      },
    })
    await strapi.documents(UID).update({
      documentId: subscriber.documentId,
      data: { confirmationSentAt: new Date().toISOString() },
    })
  },

  async action(token: unknown, apply: boolean) {
    const link = readEmailLink(token)
    if (!link) return null
    if (
      link.purpose === "digest_unsubscribe" ||
      link.purpose === "activity_unsubscribe"
    ) {
      const preference =
        link.purpose === "digest_unsubscribe"
          ? "weeklyDigest"
          : link.preference!
      const profile = await strapi.db
        .query("api::user-profile.user-profile")
        .findOne({ where: { baUserId: link.id } })
      if (!profile) return null
      if (apply)
        await strapi.db.query("api::user-profile.user-profile").update({
          where: { id: profile.id },
          data: {
            notifPrefs: {
              ...profile.notifPrefs,
              [preference]: false,
              ...(preference === "weeklyDigest"
                ? { digestConsentedAt: null }
                : {}),
              ...(preference === "weeklyReport"
                ? { reportConsentedAt: null }
                : {}),
              ...(preference === "marketing"
                ? { productConsentedAt: null }
                : {}),
            },
          },
        })

      const labels: Record<string, string> = {
        weeklyDigest: "weekly digest",
        weeklyReport: "weekly community report",
        editsReviewed: "contribution review emails",
        drives: "drive thank-you emails",
        newFollowers: "new follower emails",
        recognition: "badge emails",
        editorialMessages: "project notices",
        marketing: "product updates",
      }

      return { action: "unsubscribe", purpose: labels[preference] }
    }
    const subscriber = await strapi
      .documents(UID)
      .findOne({ documentId: link.id })
    if (!subscriber || subscriber.type !== "newsletter") return null
    if (link.purpose === "newsletter_confirm") {
      if (
        subscriber.consentedAt !== link.version ||
        ["unsubscribed", "suppressed"].includes(subscriber.state)
      )
        return null
      if (apply)
        await strapi.documents(UID).update({
          documentId: link.id,
          data: {
            state: "active",
            confirmedAt: subscriber.confirmedAt || new Date().toISOString(),
          },
        })

      return { action: "confirm", purpose: "newsletter" }
    }
    if (apply && subscriber.state !== "suppressed")
      await strapi
        .documents(UID)
        .update({ documentId: link.id, data: { state: "unsubscribed" } })

    return { action: "unsubscribe", purpose: "newsletter" }
  },
})
