import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { UtilityPage } from "@/components/utility/UtilityPage"
import { withMessages } from "@/i18n/scoped-messages"
import { parseVerifyEmailState } from "@/lib/auth-redirects"
import { privateMetadata } from "@/lib/seo/metadata"

import { VerifyEmailContent } from "./_components/VerifyEmailContent"

export const metadata = privateMetadata("Confirm your email")

async function VerifyEmailSentPage({
  params,
  searchParams,
}: PageProps<"/[locale]/auth/verify-email-sent">) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  const { state } = await searchParams

  return (
    <UtilityPage>
      <VerifyEmailContent state={parseVerifyEmailState(state)} />
    </UtilityPage>
  )
}

export default withMessages(
  VerifyEmailSentPage,
  "[locale]/auth/verify-email-sent/page"
)
