import { emailTemplate } from "@repo/shared-data"
import {
  linkLifetime,
  MAGIC_LINK_EMAIL_SUBJECT,
  MAGIC_LINK_TTL_SECONDS,
  RESET_EMAIL_SUBJECT,
  RESET_LINK_TTL_SECONDS,
  VERIFICATION_EMAIL_SUBJECT,
  VERIFICATION_LINK_TTL_SECONDS,
  SITE_NAME,
} from "@repo/shared-data/auth-policy"

async function deliver(
  to: string,
  title: string,
  body: string,
  url?: string,
  action?: string,
  credential?: string
) {
  await strapi
    .plugin("email")
    .service("email")
    .send({
      from:
        process.env.EMAIL_FROM ?? `"${SITE_NAME}" <noreply@libraries.global>`,
      replyTo: process.env.EMAIL_REPLY_TO,
      to,
      ...emailTemplate({
        title,
        body,
        url,
        action,
        code: credential,
        eyebrow: "Your account",
        postalAddress: process.env.EMAIL_POSTAL_ADDRESS,
        siteUrl: process.env.APP_PUBLIC_URL,
      }),
      // Mailgun honors these; other providers need tracking disabled in their dashboard.
      headers: {
        "X-Mailgun-Track": "no",
        "X-Mailgun-Track-Clicks": "no",
        "X-Mailgun-Track-Opens": "no",
      },
    })
}

export async function sendMagicLinkEmail(
  to: string,
  url: string
): Promise<void> {
  await deliver(
    to,
    MAGIC_LINK_EMAIL_SUBJECT,
    `Sign in to ${SITE_NAME}. This link works once, within ${linkLifetime(MAGIC_LINK_TTL_SECONDS)}. If you did not request it, you can ignore this email.`,
    url,
    "Sign in"
  )
}
export async function sendResetPasswordEmail(
  to: string,
  url: string
): Promise<void> {
  await deliver(
    to,
    RESET_EMAIL_SUBJECT,
    `Choose a new ${SITE_NAME} password. The link works once, for ${linkLifetime(RESET_LINK_TTL_SECONDS)}. If you did not ask for it, you can ignore this email: your password stays the same.`,
    url,
    "Reset password"
  )
}
export async function sendVerificationEmail(
  to: string,
  url: string
): Promise<void> {
  await deliver(
    to,
    VERIFICATION_EMAIL_SUBJECT,
    `Confirm your email address to finish creating your ${SITE_NAME} account. The link works for ${linkLifetime(VERIFICATION_LINK_TTL_SECONDS)}. If you did not sign up, you can ignore this email.`,
    url,
    "Confirm email"
  )
}
export async function sendLiveConfirmationEmail(
  to: string,
  code: string
): Promise<void> {
  await deliver(
    to,
    "Confirm it is you — Libraries Global Live",
    "Use the confirmation code below. It works once, within 10 minutes. If you did not request it, ignore this email.",
    undefined,
    undefined,
    code
  )
}
