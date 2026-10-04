import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { parseVerifyEmailState } from "@/lib/auth-redirects"
import { privateMetadata } from "@/lib/seo/metadata"

import { AuthLeftPanel } from "../_components/AuthLeftPanel"
import { AuthShell } from "../_components/AuthShell"
import { VerifyEmailContent } from "./_components/VerifyEmailContent"

export const metadata = privateMetadata("Confirm your email")

export default async function VerifyEmailSentPage({
  params,
  searchParams,
}: PageProps<"/[locale]/auth/verify-email-sent">) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  const { state } = await searchParams

  return (
    <AuthShell
      locale={locale}
      aside={<AuthLeftPanel mode="verify" />}
      footnote="We never share your email."
    >
      <VerifyEmailContent state={parseVerifyEmailState(state)} />
    </AuthShell>
  )
}
