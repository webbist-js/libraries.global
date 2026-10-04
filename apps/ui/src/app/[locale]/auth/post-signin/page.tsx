import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { verifyLinkErrorPath } from "@/lib/auth-redirects"
import { getSessionSSR } from "@/lib/auth-server"
import { safeRedirectPath } from "@/lib/safe-redirect"

export default async function PostSigninPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const session = await getSessionSSR(await headers())
  const { next, error } = await searchParams

  const destination = safeRedirectPath(next)

  if (!session?.user) {
    // A confirmation link that failed (expired, already used, account gone)
    // lands here with ?error=; say so instead of showing a bare sign-in form.
    const linkError = verifyLinkErrorPath(error)
    if (linkError) redirect(linkError)

    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(destination)}`)
  }

  // customSession enriches the session with `username` from Strapi.
  // null means the user has never completed onboarding, but only when the
  // profile loaded: a Strapi outage must not bounce users into onboarding.
  if (session.user.profileLoaded && !session.user.username) {
    const nextParam =
      destination !== "/" ? `?next=${encodeURIComponent(destination)}` : ""
    redirect(`/profile/onboarding${nextParam}`)
  }

  redirect(destination)
}
