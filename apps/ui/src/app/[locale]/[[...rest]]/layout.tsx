import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { use } from "react"

function isHomepageRoute(rest?: string[]) {
  return (
    rest == null || rest.length === 0 || (rest.length === 1 && rest[0] === "")
  )
}

export default function Layout({
  children,
  params,
}: LayoutProps<"/[locale]/[[...rest]]">) {
  const { locale, rest } = use(params) as { locale: Locale; rest?: string[] }

  setRequestLocale(locale)

  return (
    <div
      className={
        isHomepageRoute(rest)
          ? "flex min-h-full w-full flex-1 flex-col"
          : "flex items-center pb-8"
      }
    >
      {children}
    </div>
  )
}
