import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { MainContent } from "@/components/ds/MainContent"
import { withMessages } from "@/i18n/scoped-messages"
import { T } from "@/lib/design-tokens"

export const metadata: Metadata = {
  robots: "noindex, nofollow",
}

async function AuthLayout({ children, params }: LayoutProps<"/[locale]/auth">) {
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

export default withMessages(AuthLayout, "[locale]/auth/layout")
