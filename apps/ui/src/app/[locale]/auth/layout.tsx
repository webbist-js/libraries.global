import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { MainContent } from "@/components/ds/MainContent"
import { T } from "@/lib/design-tokens"

export const metadata: Metadata = {
  robots: "noindex, nofollow",
}

export default async function AuthLayout({
  children,
  params,
}: LayoutProps<"/[locale]/auth">) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  return (
    <MainContent
      className="relative isolate flex min-h-screen w-full"
      style={{ background: T.bg.space, color: T.ink.base }}
    >
      {children}
    </MainContent>
  )
}
