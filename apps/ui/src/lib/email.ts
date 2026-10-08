import "server-only"

import nodemailer, { type Transporter } from "nodemailer"

import {
  linkLifetime,
  MAGIC_LINK_EMAIL_SUBJECT,
  MAGIC_LINK_TTL_SECONDS,
  RESET_EMAIL_SUBJECT,
  RESET_LINK_TTL_SECONDS,
  VERIFICATION_EMAIL_SUBJECT,
  VERIFICATION_LINK_TTL_SECONDS,
} from "@/lib/auth-links"
import { SITE_NAME } from "@/lib/constants"

/** Automated sender for transactional mail — not a contact address. */
const DEFAULT_FROM = `"${SITE_NAME}" <noreply@libraries.global>`

const MAGIC_LINK_LIFETIME = linkLifetime(MAGIC_LINK_TTL_SECONDS)
const VERIFICATION_LINK_LIFETIME = linkLifetime(VERIFICATION_LINK_TTL_SECONDS)
const RESET_LINK_LIFETIME = linkLifetime(RESET_LINK_TTL_SECONDS)

function createTransporter(): Transporter | null {
  if (process.env.MAILTRAP_USER && process.env.MAILTRAP_PASS) {
    return nodemailer.createTransport({
      host: process.env.MAILTRAP_HOST ?? "sandbox.smtp.mailtrap.io",
      port: Number.parseInt(process.env.MAILTRAP_PORT ?? "2525", 10),
      auth: {
        user: process.env.MAILTRAP_USER,
        pass: process.env.MAILTRAP_PASS,
      },
    })
  }

  if (process.env.MAILGUN_SMTP_USER && process.env.MAILGUN_SMTP_PASS) {
    return nodemailer.createTransport({
      // EU-region Mailgun domains must use smtp.eu.mailgun.org.
      host: process.env.MAILGUN_SMTP_HOST ?? "smtp.mailgun.org",
      port: 587,
      auth: {
        user: process.env.MAILGUN_SMTP_USER,
        pass: process.env.MAILGUN_SMTP_PASS,
      },
    })
  }

  return null
}

/**
 * With no email provider, development logs the link so sign-in still works
 * locally. Production refuses: sign-in, reset and verification links are
 * credentials and must never end up in server logs.
 */
function logLinkInDevelopment(label: string, to: string, url: string): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Email delivery is not configured (set MAILGUN_SMTP_USER/PASS)."
    )
  }
  console.warn(`[email] No provider configured. ${label} for ${to}: ${url}`)
}

export async function sendMagicLinkEmail(
  to: string,
  magicUrl: string
): Promise<void> {
  const transporter = createTransporter()
  const from = process.env.EMAIL_FROM ?? DEFAULT_FROM

  if (!transporter) {
    logLinkInDevelopment("Magic link", to, magicUrl)

    return
  }

  await transporter.sendMail({
    from,
    to,
    subject: MAGIC_LINK_EMAIL_SUBJECT,
    html: `<p>Click the link below to sign in to ${SITE_NAME}. It works once, within ${MAGIC_LINK_LIFETIME}.</p><p><a href="${magicUrl}">${magicUrl}</a></p>`,
    text: `Sign in to ${SITE_NAME}: ${magicUrl}\n\nIt works once, within ${MAGIC_LINK_LIFETIME}.`,
  })
}

export async function sendResetPasswordEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  const transporter = createTransporter()
  const from = process.env.EMAIL_FROM ?? DEFAULT_FROM

  if (!transporter) {
    logLinkInDevelopment("Password reset link", to, resetUrl)

    return
  }

  await transporter.sendMail({
    from,
    to,
    subject: RESET_EMAIL_SUBJECT,
    html: `<p>Choose a new ${SITE_NAME} password: <a href="${resetUrl}">${resetUrl}</a></p><p>The link works once, for ${RESET_LINK_LIFETIME}. If you didn't ask for it, you can ignore this email: your password stays the same.</p>`,
    text: `Choose a new ${SITE_NAME} password: ${resetUrl}\n\nThe link works once, for ${RESET_LINK_LIFETIME}. If you didn't ask for it, you can ignore this email: your password stays the same.`,
  })
}

export async function sendVerificationEmail(
  to: string,
  verifyUrl: string
): Promise<void> {
  const transporter = createTransporter()
  const from = process.env.EMAIL_FROM ?? DEFAULT_FROM

  if (!transporter) {
    logLinkInDevelopment("Verification link", to, verifyUrl)

    return
  }

  await transporter.sendMail({
    from,
    to,
    subject: VERIFICATION_EMAIL_SUBJECT,
    html: `<p>Confirm your email address to finish creating your ${SITE_NAME} account:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>The link works for ${VERIFICATION_LINK_LIFETIME}. If you didn't sign up, you can ignore this email.</p>`,
    text: `Confirm your email address to finish creating your ${SITE_NAME} account: ${verifyUrl}\n\nThe link works for ${VERIFICATION_LINK_LIFETIME}. If you didn't sign up, you can ignore this email.`,
  })
}

/** Confirmation codes are credentials, so even development requires real delivery. */
export async function sendLiveConfirmationEmail(
  to: string,
  code: string
): Promise<void> {
  const transporter = createTransporter()
  if (!transporter) throw new Error("Email delivery is not configured")
  await transporter.sendMail({
    from: process.env.EMAIL_FROM ?? DEFAULT_FROM,
    to,
    subject: "Confirm it is you — Libraries Global Live",
    text: `Your confirmation code is ${code}. It works once, within 10 minutes.\n\nIf you did not request it, ignore this email.`,
  })
}
