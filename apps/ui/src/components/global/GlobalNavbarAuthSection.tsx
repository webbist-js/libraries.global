"use client"

import { useTranslations } from "next-intl"

import { GlobalLoggedUserMenu } from "@/components/global/GlobalLoggedUserMenu"
import { ThemeToggle } from "@/components/global/ThemeToggle"
import { authClient } from "@/lib/auth-client"
import type { AuthSessionResult } from "@/lib/auth-server"
import { Link } from "@/lib/navigation"

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

  const { data, error } = authClient.useSession()
  const session = error || data ? data : sessionSSR

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <ThemeToggle variant="icon" />
      {session?.user ? (
        <GlobalLoggedUserMenu
          user={session.user}
          profileSnippet={profileSnippet}
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
