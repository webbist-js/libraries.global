import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import GlobalHeader from "@/components/global/GlobalHeader"
import { fetchNavbar } from "@/lib/strapi-api/content/server"

export default async function MapLayout({
  children,
  params,
}: LayoutProps<"/[locale]/map">) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const navbar = (await fetchNavbar(locale))?.data ?? null

  // h-dvh makes the height chain definite so flex children resolve percentage heights.
  // bg-[#060b19] ensures the transparent GlobalHeader shows the dark map background.
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#060b19]">
      <GlobalHeader locale={locale} navbar={navbar} />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}
