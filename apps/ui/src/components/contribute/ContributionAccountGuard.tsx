"use client"

import { useTranslations } from "next-intl"
import { useEffect, useRef, type ReactNode } from "react"

import { useHydratedSession } from "@/lib/access-client"
import { contributionAccountScope } from "@/lib/contribution-account-scope"
import { usePathname, useRouter } from "@/lib/navigation"

/** Unmount private local state until the server and current account agree. */
export function ContributionAccountGuard({
  expectedScope,
  children,
}: {
  readonly expectedScope: string
  readonly children: ReactNode
}) {
  const t = useTranslations("contributionSession")
  const { data, isPending } = useHydratedSession()
  const actualScope = contributionAccountScope(data?.user)
  const pathname = usePathname()
  const publicGuestPage = ["/contribute", "/contribute/membership"].includes(
    pathname.replace(/\/$/, "")
  )
  const router = useRouter()
  const refreshedScope = useRef<string | null>(null)
  // Matching guests must mount server-authorized children too: private pages
  // use those children to complete their sign-in redirect.
  const matches = expectedScope === actualScope
  useEffect(() => {
    if (isPending || matches || refreshedScope.current === actualScope) return
    refreshedScope.current = actualScope
    router.refresh()
  }, [actualScope, isPending, matches, router])
  // Anonymous public content has no prior-account state and remains server-rendered.
  if (expectedScope === "guest" && publicGuestPage && isPending)
    return <AccountContent key="guest">{children}</AccountContent>
  if (isPending)
    return (
      <p role="status" className="mx-auto max-w-[1000px] px-5 py-10">
        {t("loading")}
      </p>
    )
  if (!matches)
    return (
      <div
        role="status"
        className="mx-auto grid max-w-[1000px] gap-3 px-5 py-10"
      >
        <p>{t("changed")}</p>
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
