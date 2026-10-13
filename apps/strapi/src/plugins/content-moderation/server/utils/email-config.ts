/**
 * Whether the app has a real email provider: the same credentials
 * `prepareEmailConfig` in `config/plugins.ts` looks for (SMTP, Mailgun,
 * then Mailtrap). Strapi's email plugin can't tell us: when that config is
 * null it falls back to its default `sendmail` provider, so
 * `plugin::email.provider` is never empty.
 */
export function emailConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  const mailgun = !!env.MAILGUN_API_KEY && !!env.MAILGUN_DOMAIN
  const mailtrap = !!env.MAILTRAP_USER && !!env.MAILTRAP_PASS
  const smtp = !!env.SMTP_HOST && !!env.SMTP_USER && !!env.SMTP_PASS

  return smtp || mailgun || mailtrap
}
