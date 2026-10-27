import { permanentRedirect } from "next/navigation"
import type { Locale } from "next-intl"

import { getPathname } from "@/lib/navigation"

/** Keep existing pricing bookmarks; the transactional /checkout child stays in place. */
export default async function LegacyMembershipPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  permanentRedirect(getPathname({ href: "/plans", locale }))
}
