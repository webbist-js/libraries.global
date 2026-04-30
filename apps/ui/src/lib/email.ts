import "server-only"

import nodemailer, { type Transporter } from "nodemailer"

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
      host: "smtp.mailgun.org",
      port: 587,
      auth: {
        user: process.env.MAILGUN_SMTP_USER,
        pass: process.env.MAILGUN_SMTP_PASS,
      },
    })
  }

  console.warn(
    "⚠️  No email provider configured. Email content will be logged to console."
  )

  return null
}

export async function sendMagicLinkEmail(
  to: string,
  magicUrl: string
): Promise<void> {
  const transporter = createTransporter()
  const from = process.env.EMAIL_FROM ?? "noreply@libraries.global"

  if (!transporter) {
    console.log(`[email] Magic link for ${to}: ${magicUrl}`)

    return
  }

  await transporter.sendMail({
    from,
    to,
    subject: "Your libraries.global sign-in link",
    html: `<p>Click the link below to sign in to libraries.global. This link expires in 5 minutes.</p><p><a href="${magicUrl}">${magicUrl}</a></p>`,
    text: `Sign in to libraries.global: ${magicUrl}\n\nThis link expires in 5 minutes.`,
  })
}

export async function sendResetPasswordEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  const transporter = createTransporter()
  const from = process.env.EMAIL_FROM ?? "noreply@libraries.global"

  if (!transporter) {
    console.log(`[email] Password reset link for ${to}: ${resetUrl}`)

    return
  }

  await transporter.sendMail({
    from,
    to,
    subject: "Reset your libraries.global password",
    html: `<p>Reset your libraries.global password: <a href="${resetUrl}">${resetUrl}</a></p>`,
    text: `Reset your libraries.global password: ${resetUrl}`,
  })
}
