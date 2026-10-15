import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { getSessionSSR } from "@/lib/auth-server"
import { mobileAppConfig, mobilePageTarget } from "@/lib/mobile-app"
import { safeRedirectPath } from "@/lib/safe-redirect"

export const dynamic = "force-dynamic"

/** Account providers and onboarding stay on the main origin. */
export default async function MobileSignIn({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const config = mobileAppConfig()
  if (!config) notFound()
  const { next } = await searchParams
  const requested = safeRedirectPath(next)
  const path = mobilePageTarget(requested) ? requested : "/"
  const session = await getSessionSSR(await headers())
  if (!session?.user)
    redirect(
      `/auth/signin?callbackUrl=${encodeURIComponent(`/auth/mobile?next=${encodeURIComponent(path)}`)}`
    )
  redirect(new URL(path, config.mobile).href)
}
