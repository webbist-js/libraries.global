import "server-only"

import { headers } from "next/headers"
import { redirect as redirectTo } from "next/navigation"
import type { Locale } from "next-intl"

import { sessionCapabilities } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"
import { redirect } from "@/lib/navigation"

/**
 * The signed-in editorial board member, for the drive builder's pages.
 * Signs in first when there is no session; anyone without `drives.manage`
 * goes back to the Noticeboard. Strapi re-checks every write.
 */
export async function requireBoardMember(locale: string, callbackPath: string) {
  const session = await getSessionSSR(await headers())
  if (!session?.user) {
    redirectTo(`/auth/signin?callbackUrl=${encodeURIComponent(callbackPath)}`)
  }
  if (!sessionCapabilities(session.user).set.has("drives.manage")) {
    redirect({ href: "/community", locale: locale as Locale })
  }

  return session.user
}
