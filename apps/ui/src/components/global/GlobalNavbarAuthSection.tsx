"use client"

import { useTranslations } from "next-intl"

import { GlobalLoggedUserMenu } from "@/components/global/GlobalLoggedUserMenu"
import { authClient } from "@/lib/auth-client"
import type { AuthSessionResult } from "@/lib/auth-server"
import { Link } from "@/lib/navigation"

export function GlobalNavbarAuthSection({
  sessionSSR,
}: {
  sessionSSR?: AuthSessionResult | null
}) {
  const t = useTranslations("navbar")

  const { data, error } = authClient.useSession()
  const session = error || data ? data : sessionSSR

  return (
    <>
      {session?.user ? (
        <GlobalLoggedUserMenu user={session.user} />
      ) : (
        <Link
          href="/auth/signin"
          className="px-3 py-2 text-sm text-white/55 transition-colors hover:text-white/85"
        >
          {t("actions.signIn")}
        </Link>
      )}
    </>
  )
}

GlobalNavbarAuthSection.displayName = "GlobalNavbarAuthSection"

export default GlobalNavbarAuthSection
