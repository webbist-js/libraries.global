import { emailTemplate } from "@repo/shared-data"
import type { Event } from "@strapi/database/dist/lifecycles"
import type { Core } from "@strapi/strapi"

import { emailConfigured } from "../plugins/content-moderation/server/utils/email-config"

export const registerAdminUserSubscriber = async ({
  strapi,
}: {
  strapi: Core.Strapi
}) => {
  strapi.db.lifecycles.subscribe({
    models: ["admin::user"],

    async afterCreate(event) {
      await sendEmail(strapi, event)
    },
  })
}

/**
 * Send email after registration to admin strapi panel.
 * Email is sent:
 *  - if the admin is created from the admin panel
 */
const sendEmail = async (strapi: Core.Strapi, event: Event) => {
  const { email, registrationToken } = event.result ?? {}

  if (registrationToken && email) {
    if (!emailConfigured()) {
      strapi.log.warn("[email] Admin invitation not sent: provider missing")

      return
    }
    const url = new URL(
      "/admin/auth/register",
      process.env.APP_URL || "http://localhost:1337"
    )
    url.searchParams.set("registrationToken", registrationToken)

    try {
      await strapi.plugins["email"].services.email.send({
        to: email,
        ...emailTemplate({
          postalAddress: process.env.EMAIL_POSTAL_ADDRESS,
          siteUrl: process.env.APP_PUBLIC_URL,
          title: "Your Libraries Global admin invitation",
          body: "You have been invited to the Libraries Global content administration team. Set up your administrator account using the link below.",
          url: url.toString(),
          action: "Accept admin invitation",
        }),
      })
    } catch {
      strapi.log.warn("[email] Admin invitation failed; resend it from Strapi")
    }
  }
}
