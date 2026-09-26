import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { use } from "react"

import { removeThisWhenYouNeedMe } from "@/lib/general-helpers"
import { privateMetadata } from "@/lib/seo/metadata"

import { ForgotPasswordForm } from "./_components/ForgotPasswordForm"

export const metadata = privateMetadata("Forgot password")

export default function ForgotPasswordPage({
  params,
}: PageProps<"/[locale]/auth/forgot-password">) {
  removeThisWhenYouNeedMe("ForgotPasswordPage")

  const { locale } = use(params) as { locale: Locale }

  setRequestLocale(locale)

  return <ForgotPasswordForm />
}
