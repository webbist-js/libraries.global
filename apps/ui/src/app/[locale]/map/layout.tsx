import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import GlobalHeader from "@/components/global/GlobalHeader"
import { T } from "@/lib/design-tokens"

export default async function MapLayout({
  children,
  params,
}: LayoutProps<"/[locale]/map">) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  // h-dvh makes the height chain definite so flex children resolve percentage heights.
  // background: T.bg.surface ensures the transparent GlobalHeader shows the correct background.
  return (
    <div
      className="flex h-dvh flex-col overflow-hidden"
      style={{ background: T.bg.surface }}
    >
      <GlobalHeader locale={locale} />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}
