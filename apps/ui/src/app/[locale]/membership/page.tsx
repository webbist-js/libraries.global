import { permanentRedirect } from "next/navigation"
import type { Locale } from "next-intl"

import { getPathname } from "@/lib/navigation"

/** Keep account bookmarks and billing returns after moving into Profile. */
export default async function MembershipRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  permanentRedirect(
    getPathname({ href: { pathname: "/profile/membership", query }, locale })
  )
}
