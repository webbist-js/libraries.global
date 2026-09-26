import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getSessionSSR } from "@/lib/auth-server"
import { safeRedirectPath } from "@/lib/safe-redirect"

export default async function PostSigninPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const session = await getSessionSSR(await headers())
  const { next } = await searchParams

  const destination = safeRedirectPath(next)

  if (!session?.user)
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(destination)}`)

  // customSession enriches the session with `username` from Strapi.
  // null means the user has never completed onboarding.
  if (!session.user.username) {
    const nextParam =
      destination !== "/" ? `?next=${encodeURIComponent(destination)}` : ""
    redirect(`/profile/onboarding${nextParam}`)
  }

  redirect(destination)
}
