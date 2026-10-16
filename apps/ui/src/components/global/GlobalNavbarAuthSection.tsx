"use client"

import { useTranslations } from "next-intl"
import { useEffect, useRef } from "react"

import { GlobalLoggedUserMenu } from "@/components/global/GlobalLoggedUserMenu"
import { useHydratedSession } from "@/lib/access-client"
import type { AuthSessionResult } from "@/lib/auth-server"
import { Link, useRouter } from "@/lib/navigation"

export function GlobalNavbarAuthSection({
  sessionSSR,
  profileSnippet,
}: {
  sessionSSR?: AuthSessionResult | null
  profileSnippet?: {
    avatarUrl?: string | null
    username?: string | null
    isVerifiedLibrarian?: boolean | null
  } | null
}) {
  const t = useTranslations("navbar")

  const { data: session, isPending, error } = useHydratedSession()
  const router = useRouter()
  const lastRefresh = useRef<string | null>(null)
  const actor = session?.user?.id ?? "guest"
  const serverActor = sessionSSR?.user?.id ?? "guest"
  useEffect(() => {
    if (
      isPending ||
      error ||
      actor === serverActor ||
      lastRefresh.current === actor
    )
      return
    lastRefresh.current = actor
    router.refresh()
  }, [actor, serverActor, isPending, error, router])
  const currentSnippet = actor === serverActor ? profileSnippet : null

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      {isPending || error ? (
        <span aria-busy="true" className="px-3 py-2 text-sm text-(--t-ink-dim)">
          …
        </span>
      ) : session?.user ? (
        <GlobalLoggedUserMenu
          user={session.user}
          profileSnippet={currentSnippet}
        />
      ) : (
        <Link
          href="/auth/signin"
          className="px-3 py-2 text-sm text-(--t-ink-dim) transition-colors hover:text-(--t-ink-base)"
        >
          {t("actions.signIn")}
        </Link>
      )}
    </div>
  )
}

GlobalNavbarAuthSection.displayName = "GlobalNavbarAuthSection"

export default GlobalNavbarAuthSection
