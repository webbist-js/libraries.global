import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { use } from "react"

import { SetPasswordForm } from "@/app/[locale]/auth/activate/_components/SetPasswordForm"
import { removeThisWhenYouNeedMe } from "@/lib/general-helpers"
import { privateMetadata } from "@/lib/seo/metadata"

export const metadata = privateMetadata("Reset password")

export default function ResetPasswordPage({
  params,
  searchParams,
}: PageProps<"/[locale]/auth/reset-password">) {
  removeThisWhenYouNeedMe("ResetPasswordPage")

  const { locale } = use(params) as { locale: Locale }
  const { token } = use(searchParams) as { token?: string }

  setRequestLocale(locale)

  return <SetPasswordForm token={token} />
}
