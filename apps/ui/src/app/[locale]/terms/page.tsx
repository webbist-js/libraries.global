import type { Locale } from "next-intl"

import { redirect } from "@/lib/navigation"

/** Short URL for /legal/terms. */
export default async function TermsRedirect({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  redirect({ locale: locale as Locale, href: "/legal/terms" })
}
