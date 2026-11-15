import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { UtilityPage } from "@/components/utility/UtilityPage"
import { withMessages } from "@/i18n/scoped-messages"
import { privateMetadata } from "@/lib/seo/metadata"

import { ResetPasswordForm } from "./_components/ResetPasswordForm"

export const metadata = privateMetadata("Reset password")

async function ResetPasswordPage({
  params,
  searchParams,
}: PageProps<"/[locale]/auth/reset-password">) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)
  const { token } = await searchParams

  return (
    <UtilityPage>
      <ResetPasswordForm
        token={typeof token === "string" && token ? token : null}
      />
    </UtilityPage>
  )
}

export default withMessages(
  ResetPasswordPage,
  "[locale]/auth/reset-password/page"
)
