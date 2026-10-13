import nodemailer, { type Transporter } from "nodemailer"

/** Shared by the app and the explicit-recipient delivery check script. */
export function createEmailTransport(): Transporter | null {
  const timeouts = {
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  }
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      ...timeouts,
      host: process.env.SMTP_HOST,
      port: Number.parseInt(process.env.SMTP_PORT ?? "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      requireTLS: process.env.SMTP_SECURE !== "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  }
  if (process.env.MAILTRAP_USER && process.env.MAILTRAP_PASS) {
    return nodemailer.createTransport({
      ...timeouts,
      host: process.env.MAILTRAP_HOST ?? "sandbox.smtp.mailtrap.io",
      port: Number.parseInt(process.env.MAILTRAP_PORT ?? "2525", 10),
      requireTLS: true,
      auth: {
        user: process.env.MAILTRAP_USER,
        pass: process.env.MAILTRAP_PASS,
      },
    })
  }
  if (process.env.MAILGUN_SMTP_USER && process.env.MAILGUN_SMTP_PASS) {
    return nodemailer.createTransport({
      ...timeouts,
      host: process.env.MAILGUN_SMTP_HOST ?? "smtp.mailgun.org",
      port: 587,
      requireTLS: true,
      auth: {
        user: process.env.MAILGUN_SMTP_USER,
        pass: process.env.MAILGUN_SMTP_PASS,
      },
    })
  }

  return null
}
