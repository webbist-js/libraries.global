import type { Locale } from "next-intl"

import GlobalHeader from "@/components/global/GlobalHeader"
import { T } from "@/lib/design-tokens"
import { fetchNavbar } from "@/lib/strapi-api/content/server"

export default async function ContributeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const navbarResult = await fetchNavbar(locale as Locale)

  return (
    <>
      <GlobalHeader locale={locale as Locale} navbar={navbarResult?.data} />
      <div style={{ background: T.bg.void }}>{children}</div>
    </>
  )
}
