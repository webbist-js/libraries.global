import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { UtilityPage } from "@/components/utility/UtilityPage"
import { withMessages } from "@/i18n/scoped-messages"
import { privateMetadata } from "@/lib/seo/metadata"

import { ForgotPasswordForm } from "./_components/ForgotPasswordForm"

export const metadata = privateMetadata("Forgot password")

async function ForgotPasswordPage({
  params,
}: PageProps<"/[locale]/auth/forgot-password">) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  return (
    <UtilityPage>
      <ForgotPasswordForm />
    </UtilityPage>
  )
}

export default withMessages(
  ForgotPasswordPage,
  "[locale]/auth/forgot-password/page"
)
