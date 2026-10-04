import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { privateMetadata } from "@/lib/seo/metadata"

import { AuthLeftPanel } from "../_components/AuthLeftPanel"
import { AuthShell } from "../_components/AuthShell"
import { fetchJournalTeaser } from "../_components/fetch-journal-teaser"
import { ResetPasswordForm } from "./_components/ResetPasswordForm"

export const metadata = privateMetadata("Reset password")

export default async function ResetPasswordPage({
  params,
  searchParams,
}: PageProps<"/[locale]/auth/reset-password">) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  const { token } = await searchParams
  const journal = await fetchJournalTeaser(locale)

  return (
    <AuthShell
      locale={locale}
      aside={<AuthLeftPanel mode="signin" journal={journal} />}
      footnote="A new password signs you out on every device."
    >
      <ResetPasswordForm
        token={typeof token === "string" && token ? token : null}
      />
    </AuthShell>
  )
}
