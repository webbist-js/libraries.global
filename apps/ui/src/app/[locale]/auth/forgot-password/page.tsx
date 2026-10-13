import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { UtilityPage } from "@/components/utility/UtilityPage"
import { privateMetadata } from "@/lib/seo/metadata"

import { ForgotPasswordForm } from "./_components/ForgotPasswordForm"

export const metadata = privateMetadata("Forgot password")

export default async function ForgotPasswordPage({
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
