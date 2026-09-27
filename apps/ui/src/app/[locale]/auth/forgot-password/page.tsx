import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { privateMetadata } from "@/lib/seo/metadata"

import { AuthLeftPanel } from "../_components/AuthLeftPanel"
import { AuthShell } from "../_components/AuthShell"
import { fetchJournalTeaser } from "../_components/fetch-journal-teaser"
import { ForgotPasswordForm } from "./_components/ForgotPasswordForm"

export const metadata = privateMetadata("Forgot password")

export default async function ForgotPasswordPage({
  params,
}: PageProps<"/[locale]/auth/forgot-password">) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  const journal = await fetchJournalTeaser(locale)

  return (
    <AuthShell
      locale={locale}
      aside={<AuthLeftPanel mode="signin" journal={journal} />}
      footnote="We send the same message whether or not the email has an account."
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}
