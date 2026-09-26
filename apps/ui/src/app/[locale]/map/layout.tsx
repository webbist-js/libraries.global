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
  // overflow-clip (not hidden): clips the same, but isn't a scroll container,
  // so focus changes can't scroll the full-screen map sideways.
  return (
    <div
      className="flex h-dvh flex-col overflow-clip"
      style={{ background: T.bg.surface }}
    >
      <GlobalHeader locale={locale} variant="app" />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-clip">
        {children}
      </div>
    </div>
  )
}
