import type { Locale } from "next-intl"

import { withMessages } from "@/i18n/scoped-messages"
import { redirect } from "@/lib/navigation"

/** Short URL for /legal/privacy. */
async function PrivacyRedirect({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  redirect({ locale: locale as Locale, href: "/legal/privacy" })
}

export default withMessages(PrivacyRedirect, "[locale]/privacy/page")
