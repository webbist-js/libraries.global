import type { Locale } from "next-intl"

import { redirect } from "@/lib/navigation"

/** Short URL for /legal/privacy. */
export default async function PrivacyRedirect({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  redirect({ locale: locale as Locale, href: "/legal/privacy" })
}
