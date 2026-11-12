import type { Locale } from "next-intl"

import { withMessages } from "@/i18n/scoped-messages"
import { redirect } from "@/lib/navigation"

/** Short URL for /legal/terms. */
async function TermsRedirect({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  redirect({ locale: locale as Locale, href: "/legal/terms" })
}

export default withMessages(TermsRedirect, "[locale]/terms/page")
