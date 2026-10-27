"use client"

import { useTranslations } from "next-intl"
import { useEffect, useRef, type ReactNode } from "react"

import { useHydratedSession } from "@/lib/access-client"
import { contributionAccountScope } from "@/lib/contribution-account-scope"
import { usePathname, useRouter } from "@/lib/navigation"

/** A shared account boundary for private server-rendered contribution and profile views. */
export function AccountGuard({
  expectedScope,
  mode = "permissions",
  publicGuestPaths = [],
  children,
}: {
  readonly expectedScope: string
  readonly mode?: "permissions" | "identity"
  readonly publicGuestPaths?: readonly string[]
  readonly children: ReactNode
}) {
  const t = useTranslations("contributionSession")
  const { data, isPending, error } = useHydratedSession()
  const actualScope =
    mode === "identity"
      ? (data?.user?.id ?? "guest")
      : contributionAccountScope(data?.user)
  const pathname = usePathname()
  const publicGuestPage = publicGuestPaths.includes(pathname.replace(/\/$/, ""))
  const router = useRouter()
  const refreshedScope = useRef<string | null>(null)
  // Matching guests must mount server-authorized children too: private pages
  // use those children to complete their sign-in redirect.
  const matches = expectedScope === actualScope
  useEffect(() => {
    if (isPending || error || matches || refreshedScope.current === actualScope)
      return
    refreshedScope.current = actualScope
    router.refresh()
  }, [actualScope, isPending, error, matches, router])
  // Guest-only public content has no prior-account state. Keep its main and
  // keyboard focus intact while the session service is pending or unavailable.
  if (
    expectedScope === "guest" &&
    matches &&
    publicGuestPage &&
    (isPending || error)
  )
    return <AccountContent key="guest">{children}</AccountContent>
  if (isPending)
    return (
      <p role="status" className="mx-auto max-w-[1000px] px-5 py-10">
        {t("loading")}
      </p>
    )
  if (error || !matches)
    return (
      <div
        role="status"
        className="mx-auto grid max-w-[1000px] gap-3 px-5 py-10"
      >
        <p>{t(error ? "unavailable" : "changed")}</p>
        <button
          type="button"
          className="justify-self-start rounded-full border px-4 py-2"
          onClick={() => globalThis.location.reload()}
        >
          {t("reload")}
        </button>
      </div>
    )

  return <AccountContent key={actualScope}>{children}</AccountContent>
}

function AccountContent({ children }: { readonly children: ReactNode }) {
  return <>{children}</>
}
