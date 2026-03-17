"use client"

import { useTranslations } from "next-intl"

import AppLink from "@/components/elementary/AppLink"
import { GlobalLoggedUserMenu } from "@/components/global/GlobalLoggedUserMenu"
import { authClient } from "@/lib/auth-client"
import type { BetterAuthSessionWithStrapi } from "@/types/better-auth"

export function GlobalNavbarAuthSection({
  sessionSSR,
}: {
  sessionSSR?: BetterAuthSessionWithStrapi | null
}) {
  const t = useTranslations("navbar")

  const { data, error } = authClient.useSession()
  const session = error || data ? data : sessionSSR

  return (
    <div className="hidden flex-1 items-center justify-end space-x-4 lg:flex">
      {session?.user ? (
        <nav className="flex items-center space-x-1">
          <GlobalLoggedUserMenu user={session.user} />
        </nav>
      ) : (
        <AppLink href="/auth/signin">{t("actions.signIn")}</AppLink>
      )}
    </div>
  )
}

GlobalNavbarAuthSection.displayName = "GlobalNavbarAuthSection"

export default GlobalNavbarAuthSection
