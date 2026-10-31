import type { Locale } from "next-intl"

import { redirect } from "@/lib/navigation"
import type { ProfileSection } from "@/lib/profile-drawer"

/** Direct account URLs enter the same authenticated workspace as account links. */
export function createProfileDrawerRoute(section: ProfileSection) {
  return async function ProfileDrawerRoute({
    params,
    searchParams,
  }: {
    params: Promise<{ locale: Locale }>
    searchParams?: Promise<Record<string, string | string[] | undefined>>
  }) {
    const [{ locale }, query] = await Promise.all([params, searchParams])
    redirect({
      href: { pathname: "/map", query: { ...query, account: section } },
      locale,
    })
  }
}
